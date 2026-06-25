import { describe, expect, it } from "vitest";

import { calculateNetSpendSnapshot } from "../../src/transactions/netSpend";
import type { RefundMatchDecision } from "../../src/transactions/refundMatcher";

describe("net spend calculation", () => {
  it("calculates gross spend minus matched refunds for the snapshot period", () => {
    const snapshot = calculateNetSpendSnapshot({
      profileId: "profile_1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      source: "statement_import",
      sourceRecordId: "import_1",
      transactions: [
        purchase("purchase_1", "2026-06-01", -10_000),
        purchase("purchase_2", "2026-06-02", -5_000),
        refund("refund_1", "2026-06-10", 4_000),
        refund("refund_unmatched", "2026-06-12", 1_000),
        purchase("outside_period", "2026-07-01", -20_000),
      ],
      refundMatches: [match("refund_1", "purchase_1", 4_000, "partial")],
    });

    expect(snapshot).toMatchObject({
      grossSpendMinor: 15_000,
      refundsMinor: 4_000,
      netSpendMinor: 11_000,
      annualizedExpensesMinor: 133_833,
      sourceModule: "transactions",
      sourceRecordId: "import_1",
    });
  });

  it("ignores rejected refund matches when calculating net spend", () => {
    const snapshot = calculateNetSpendSnapshot({
      profileId: "profile_1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      source: "statement_import",
      transactions: [purchase("purchase_1", "2026-06-01", -10_000), refund("refund_1", "2026-06-10", 10_000)],
      refundMatches: [match("refund_1", "purchase_1", 0, "rejected")],
    });

    expect(snapshot.refundsMinor).toBe(0);
    expect(snapshot.netSpendMinor).toBe(10_000);
  });

  it("rejects invalid periods", () => {
    expect(() =>
      calculateNetSpendSnapshot({
        profileId: "profile_1",
        periodStart: "2026-07-01",
        periodEnd: "2026-06-01",
        source: "manual",
        transactions: [],
        refundMatches: [],
      }),
    ).toThrow(/invalid/i);
  });
});

function purchase(id: string, postedDate: string, amountMinor: number) {
  return { id, postedDate, amountMinor, transactionKind: "purchase" as const };
}

function refund(id: string, postedDate: string, amountMinor: number) {
  return { id, postedDate, amountMinor, transactionKind: "refund" as const };
}

function match(
  refundTransactionId: string,
  originalTransactionId: string,
  matchedAmountMinor: number,
  status: RefundMatchDecision["status"],
): RefundMatchDecision {
  return {
    refundTransactionId,
    originalTransactionId,
    matchedAmountMinor,
    matchConfidence: status === "rejected" ? 0 : 0.9,
    matchMethod: status === "rejected" ? "unmatched" : "partial",
    status,
    milesEligibleAmountMinor: Math.max(0, 10_000 - matchedAmountMinor),
    explanation: "fixture",
  };
}
