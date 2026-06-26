import { createHash } from "node:crypto";

export type TraceSourceModule =
  | "merchant_resolver"
  | "refund_matcher"
  | "reward_evaluator"
  | "trust_score"
  | "card_planner"
  | "recurring_detector"
  | "backup_restore";

export type DecisionTraceInput = {
  profileId: string;
  sourceModule: TraceSourceModule;
  sourceRecordId: string;
  sourceRecordIds?: string[];
  ruleVersion: string;
  inputFacts: Record<string, unknown>;
  outputValue: Record<string, unknown>;
  confidenceScore: number;
  explanationText: string;
  caveats?: string[];
};

export type DecisionTrace = DecisionTraceInput & {
  id: string;
};

const bannedFieldPatterns = [
  /account/i,
  /cardNumber/i,
  /cvv/i,
  /descriptionRaw/i,
  /filePath/i,
  /maskedIdentifier/i,
  /password/i,
  /raw/i,
  /sourceFile/i,
];

export function buildDecisionTrace(input: DecisionTraceInput): DecisionTrace {
  return {
    ...input,
    id: stableId(
      input.profileId,
      input.sourceModule,
      input.sourceRecordId,
      input.ruleVersion,
      JSON.stringify(input.outputValue),
    ),
    inputFacts: redactSensitiveFields(input.inputFacts),
    outputValue: redactSensitiveFields(input.outputValue),
    caveats: input.caveats ?? [],
  };
}

export function toDecisionTraceInsert(trace: DecisionTrace) {
  return {
    id: trace.id,
    profileId: trace.profileId,
    sourceModule: trace.sourceModule,
    sourceRecordId: trace.sourceRecordId,
    sourceRecordIdsJson: JSON.stringify(trace.sourceRecordIds ?? [trace.sourceRecordId]),
    ruleVersion: trace.ruleVersion,
    inputFactsJson: JSON.stringify(trace.inputFacts),
    outputValueJson: JSON.stringify(trace.outputValue),
    confidenceScore: trace.confidenceScore,
    explanationText: trace.explanationText,
    caveatJson: JSON.stringify(trace.caveats ?? []),
  };
}

export function redactSensitiveFields(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  return redactRecord(value);
}

function redactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      isBannedKey(key) ? "[redacted]" : redactValue(fieldValue),
    ]),
  );
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (isRecord(value)) {
    return redactRecord(value);
  }

  return value;
}

function isBannedKey(key: string) {
  return bannedFieldPatterns.some((pattern) => pattern.test(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableId(...parts: string[]) {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `trace_${digest}`;
}
