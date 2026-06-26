import { describe, expect, it } from "vitest";

import { buildDecisionTrace, toDecisionTraceInsert } from "../../src/explainability/decisionTrace";

describe("decision trace", () => {
  it("builds stable trace records and redacts sensitive fields", () => {
    const trace = buildDecisionTrace({
      profileId: "profile_1",
      sourceModule: "trust_score",
      sourceRecordId: "transaction_1",
      ruleVersion: "trust-v1",
      inputFacts: {
        parserConfidence: 0.82,
        descriptionRaw: "RAW CARD TEXT",
        nested: {
          sourceFilePath: "/tmp/source.pdf",
          mccCode: "4900",
        },
      },
      outputValue: {
        label: "medium_trust",
        cardNumber: "4111111111111111",
      },
      confidenceScore: 0.76,
      explanationText: "Trust score uses parser and reconciliation signals.",
      caveats: ["No statement balance supplied."],
    });

    expect(trace.id).toMatch(/^trace_/);
    expect(trace.inputFacts).toMatchObject({
      parserConfidence: 0.82,
      descriptionRaw: "[redacted]",
      nested: {
        sourceFilePath: "[redacted]",
        mccCode: "4900",
      },
    });
    expect(trace.outputValue).toMatchObject({
      label: "medium_trust",
      cardNumber: "[redacted]",
    });
  });

  it("serializes trace payloads for SQLite persistence", () => {
    const insert = toDecisionTraceInsert(
      buildDecisionTrace({
        profileId: "profile_1",
        sourceModule: "reward_evaluator",
        sourceRecordId: "transaction_1",
        sourceRecordIds: ["transaction_1", "rule_1"],
        ruleVersion: "rule-v1",
        inputFacts: { amountMinor: -1000 },
        outputValue: { milesEarned: 40 },
        confidenceScore: 0.93,
        explanationText: "Rule matched eligible spend.",
      }),
    );

    expect(JSON.parse(insert.sourceRecordIdsJson)).toEqual(["transaction_1", "rule_1"]);
    expect(JSON.parse(insert.outputValueJson)).toEqual({ milesEarned: 40 });
    expect(JSON.parse(insert.caveatJson)).toEqual([]);
  });
});
