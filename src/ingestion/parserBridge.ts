import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";

export const parserErrorCodes = [
  "UNSUPPORTED_BANK",
  "PASSWORD_REQUIRED",
  "OCR_FAILED",
  "NO_TRANSACTIONS_FOUND",
  "DUPLICATE_FILE",
  "TIMEOUT",
  "INVALID_RESULT",
  "INTERNAL_ERROR",
] as const;

export const parseStatementRequestSchema = z.object({
  requestId: z.string().min(1),
  profileId: z.string().min(1),
  sourceType: z.enum(["pdf", "csv"]),
  sourceFilename: z.string().min(1),
  sourceFilePath: z.string().min(1),
  sourceFileSha256: z.string().min(1),
  parserOptions: z.object({
    ocrEnabled: z.boolean(),
    passwordProvided: z.boolean(),
    locale: z.string().min(1).default("en-SG"),
  }),
});

export const parserWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
});

export const parsedTransactionSchema = z.object({
  externalId: z.string().min(1),
  postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  descriptionRaw: z.string().min(1),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  currency: z.string().min(3).max(3),
  direction: z.enum(["debit", "credit"]),
  accountHint: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
});

export const parseStatementSuccessSchema = z.object({
  requestId: z.string().min(1),
  status: z.literal("success"),
  parserName: z.string().min(1),
  parserVersion: z.string().min(1),
  bankName: z.string().min(1),
  accountHints: z.array(
    z.object({
      accountType: z.string().min(1),
      maskedIdentifier: z.string().optional(),
      currency: z.string().min(3).max(3),
    }),
  ),
  transactions: z.array(parsedTransactionSchema).min(1),
  warnings: z.array(parserWarningSchema),
});

export const parseStatementFailureSchema = z.object({
  requestId: z.string().min(1),
  status: z.literal("failed"),
  parserName: z.string().min(1),
  parserVersion: z.string().min(1),
  error: z.object({
    code: z.enum(parserErrorCodes),
    message: z.string().min(1),
    retryable: z.boolean(),
  }),
  warnings: z.array(parserWarningSchema),
});

export const parseStatementResultSchema = z.discriminatedUnion("status", [
  parseStatementSuccessSchema,
  parseStatementFailureSchema,
]);

export type ParseStatementRequest = z.infer<typeof parseStatementRequestSchema>;
export type ParseStatementResult = z.infer<typeof parseStatementResultSchema>;
export type ParseStatementSuccess = z.infer<typeof parseStatementSuccessSchema>;
export type ParseStatementFailure = z.infer<typeof parseStatementFailureSchema>;

export type ParserBridgeOptions = {
  command: string;
  args?: string[];
  timeoutMs?: number;
};

const defaultTimeoutMs = 60_000;

export async function parseStatementWithBridge(
  candidateRequest: unknown,
  options: ParserBridgeOptions,
): Promise<ParseStatementResult> {
  const request = parseStatementRequestSchema.parse(candidateRequest);
  const tempDir = await mkdtemp(join(tmpdir(), "wander-parser-"));

  try {
    const requestPath = join(tempDir, "request.json");
    await writeFile(requestPath, JSON.stringify(request), { encoding: "utf8", mode: 0o600 });

    const raw = await runParserProcess({
      command: options.command,
      args: [...(options.args ?? []), requestPath],
      timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
    });

    return parseStatementResultSchema.parse(JSON.parse(raw));
  } catch (error) {
    return toFailureResult(request.requestId, error);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

export function sanitizeParserLog(value: string) {
  return value
    .replace(/[A-Fa-f0-9]{32,}/g, "[hash-redacted]")
    .replace(/\/[^\s]+/g, "[path-redacted]")
    .replace(/\*{0,8}\d{4,}/g, "[account-redacted]");
}

function runParserProcess({
  command,
  args,
  timeoutMs,
}: {
  command: string;
  args: string[];
  timeoutMs: number;
}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("TIMEOUT"));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += sanitizeParserLog(chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        reject(error);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || `Parser bridge exited with code ${code}.`));
    });
  });
}

function toFailureResult(requestId: string, error: unknown): ParseStatementFailure {
  const message = error instanceof Error ? error.message : "Parser bridge failed.";
  const code = message === "TIMEOUT" ? "TIMEOUT" : "INTERNAL_ERROR";

  return {
    requestId,
    status: "failed",
    parserName: "StatementSenseiBridge",
    parserVersion: "0.1.0",
    error: {
      code,
      message: code === "TIMEOUT" ? "Parser bridge timed out." : "Parser bridge failed.",
      retryable: true,
    },
    warnings: [],
  };
}
