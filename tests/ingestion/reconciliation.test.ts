import { describe, expect, it } from "vitest";

import {
  calculateStatementReconciliation,
  calculateTransactionTrustScore,
} from "../../src/ingestion/reconciliation";

describe("statement reconciliation and transaction trust", () => {
  it("verifies a statement when parsed rows explain the closing balance", () => {
    const reconciliation = calculateStatementReconciliation({
      statementImportId: "import_1",
      profileId: "profile_1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      openingBalanceMinor: 100_000,
      closingBalanceMinor: 92_000,
      transactions: [
        { amountMinor: -10_000, direction: "debit", transactionKind: "purchase" },
        { amountMinor: 2_000, direction: "credit", transactionKind: "refund" },
      ],
    });

    expect(reconciliation).toMatchObject({
      debitTotalMinor: 10_000,
      creditTotalMinor: 2_000,
      unexplainedDeltaMinor: 0,
      status: "verified",
      confidenceScore: 1,
      issues: [],
    });
  });

  it("flags unexplained balance deltas and duplicate rows", () => {
    const reconciliation = calculateStatementReconciliation({
      statementImportId: "import_1",
      profileId: "profile_1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      openingBalanceMinor: 100_000,
      closingBalanceMinor: 90_000,
      duplicateCount: 1,
      transactions: [
        { amountMinor: -10_000, direction: "debit", transactionKind: "purchase" },
        { amountMinor: 2_000, direction: "credit", transactionKind: "refund" },
      ],
    });

    expect(reconciliation.status).toBe("needs_review");
    expect(reconciliation.confidenceScore).toBeLessThan(0.5);
    expect(reconciliation.issues).toEqual([
      "1 duplicate row detected.",
      "Unexplained balance delta -2000 minor units.",
    ]);
  });

  it("uses mostly verified when statement balances are unavailable", () => {
    const reconciliation = calculateStatementReconciliation({
      statementImportId: "import_1",
      profileId: "profile_1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      transactions: [{ amountMinor: -10_000, direction: "debit", transactionKind: "purchase" }],
    });

    expect(reconciliation.status).toBe("mostly_verified");
    expect(reconciliation.issues).toEqual([
      "Statement balances unavailable; row-level checks only.",
    ]);
  });

  it("keeps high-confidence verified rows high trust", () => {
    const trust = calculateTransactionTrustScore({
      transactionId: "transaction_1",
      statementImportId: "import_1",
      profileId: "profile_1",
      parserConfidence: 0.97,
      merchantConfidence: 0.95,
      mccConfidence: 0.95,
      categoryConfidence: 0.95,
      reconciliationStatus: "verified",
    });

    expect(trust.label).toBe("high_trust");
    expect(trust.score).toBeGreaterThanOrEqual(0.95);
  });

  it("reduces trust for low parser confidence and duplicate risk", () => {
    const trust = calculateTransactionTrustScore({
      transactionId: "transaction_1",
      statementImportId: "import_1",
      profileId: "profile_1",
      parserConfidence: 0.4,
      duplicateRisk: true,
      merchantConfidence: 0.7,
      mccConfidence: 0.7,
      categoryConfidence: 0.7,
      reconciliationStatus: "needs_review",
    });

    expect(trust.label).toBe("needs_review");
    expect(trust.drivers).toEqual(
      expect.arrayContaining([
        "Low parser confidence.",
        "Possible duplicate transaction.",
        "Statement reconciliation needs review.",
      ]),
    );
  });
});
