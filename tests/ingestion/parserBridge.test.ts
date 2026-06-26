import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  parseStatementRequestSchema,
  parseStatementResultSchema,
  parseStatementWithBridge,
  sanitizeParserLog,
  type ParseStatementRequest,
} from "../../src/ingestion/parserBridge";

const request: ParseStatementRequest = {
  requestId: "parse_2026_0001",
  profileId: "profile_001",
  sourceType: "pdf",
  sourceFilename: "statement.pdf",
  sourceFilePath: "/tmp/fire-planner/imports/statement.pdf",
  sourceFileSha256: "a".repeat(64),
  parserOptions: {
    ocrEnabled: true,
    passwordProvided: false,
    locale: "en-SG",
  },
};

describe("parser bridge", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "wander-parser-test-"));
  });

  afterEach(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(tempDir, { force: true, recursive: true }));
  });

  it("validates the documented parser request and success result shape", () => {
    expect(parseStatementRequestSchema.parse(request)).toEqual(request);
    expect(
      parseStatementResultSchema.parse({
        requestId: request.requestId,
        status: "success",
        parserName: "StatementSenseiBridge",
        parserVersion: "0.1.0",
        bankName: "DBS",
        accountHints: [{ accountType: "credit_card", maskedIdentifier: "**** 1234", currency: "SGD" }],
        transactions: [
          {
            externalId: "row_1",
            postedDate: "2026-06-20",
            transactionDate: "2026-06-19",
            descriptionRaw: "GRAB *TRIP SINGAPORE",
            amount: "-18.40",
            currency: "SGD",
            direction: "debit",
            accountHint: "**** 1234",
            confidenceScore: 0.92,
          },
        ],
        warnings: [{ code: "OCR_USED", message: "OCR fallback used.", severity: "info" }],
      }).status,
    ).toBe("success");
  });

  it("executes a parser command, validates its result, and cleans temp request files", async () => {
    const commandPath = join(tempDir, "parser.mjs");
    const markerPath = join(tempDir, "request-path.txt");

    await writeFile(
      commandPath,
      `
        import { readFileSync, writeFileSync } from "node:fs";
        const requestPath = process.argv[2];
        const request = JSON.parse(readFileSync(requestPath, "utf8"));
        writeFileSync(${JSON.stringify(markerPath)}, requestPath);
        console.log(JSON.stringify({
          requestId: request.requestId,
          status: "success",
          parserName: "StatementSenseiBridge",
          parserVersion: "0.1.0",
          bankName: "DBS",
          accountHints: [{ accountType: "credit_card", currency: "SGD" }],
          transactions: [{
            externalId: "row_1",
            postedDate: "2026-06-20",
            descriptionRaw: "GRAB *TRIP SINGAPORE",
            amount: "-18.40",
            currency: "SGD",
            direction: "debit",
            confidenceScore: 0.92
          }],
          warnings: []
        }));
      `,
    );

    const result = await parseStatementWithBridge(request, {
      command: process.execPath,
      args: [commandPath],
      timeoutMs: 5_000,
    });
    const requestPath = await readFile(markerPath, "utf8");

    expect(result.status).toBe("success");
    await expect(readFile(requestPath, "utf8")).rejects.toThrow();
  });

  it("maps parser timeout to a recoverable failure", async () => {
    const commandPath = join(tempDir, "slow-parser.mjs");
    await writeFile(commandPath, "setTimeout(() => {}, 5000);");

    const result = await parseStatementWithBridge(request, {
      command: process.execPath,
      args: [commandPath],
      timeoutMs: 10,
    });

    expect(result).toMatchObject({
      status: "failed",
      error: {
        code: "TIMEOUT",
        retryable: true,
      },
    });
  });

  it("redacts hashes, file paths, and account-like values from parser logs", () => {
    expect(
      sanitizeParserLog(
        "failed /tmp/fire-planner/imports/statement.pdf hash abcdef1234567890abcdef1234567890 card ****123456",
      ),
    ).toBe("failed [path-redacted] hash [hash-redacted] card [account-redacted]");
  });
});
