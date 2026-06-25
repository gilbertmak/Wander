import { describe, expect, it } from "vitest";

import { matchRefunds } from "../../src/transactions/refundMatcher";

const purchase = {
  id: "purchase_1",
  postedDate: "2026-06-01",
  amountMinor: -10_000,
  direction: "debit" as const,
  transactionKind: "purchase" as const,
  descriptionNormalized: "apple store singapore",
  merchantId: "merchant_apple",
  accountId: "account_1",
  cardId: "card_1",
};

describe("refund matcher", () => {
  it("matches a full refund and marks all original spend as miles-ineligible", () => {
    const [decision] = matchRefunds([
      purchase,
      {
        ...purchase,
        id: "refund_1",
        postedDate: "2026-06-10",
        amountMinor: 10_000,
        direction: "credit",
        transactionKind: "refund",
      },
    ]);

    expect(decision).toMatchObject({
      originalTransactionId: "purchase_1",
      matchedAmountMinor: 10_000,
      status: "matched",
      matchMethod: "exact",
      milesEligibleAmountMinor: 0,
    });
  });

  it("supports partial refunds and leaves the remaining spend eligible", () => {
    const [decision] = matchRefunds([
      purchase,
      {
        ...purchase,
        id: "refund_1",
        postedDate: "2026-06-10",
        amountMinor: 4_000,
        direction: "credit",
        transactionKind: "refund",
      },
    ]);

    expect(decision).toMatchObject({
      originalTransactionId: "purchase_1",
      matchedAmountMinor: 4_000,
      status: "partial",
      matchMethod: "partial",
      milesEligibleAmountMinor: 6_000,
    });
  });

  it("rejects unmatched refunds outside the matching window", () => {
    const [decision] = matchRefunds([
      purchase,
      {
        ...purchase,
        id: "refund_1",
        postedDate: "2027-06-10",
        amountMinor: 10_000,
        direction: "credit",
        transactionKind: "refund",
      },
    ]);

    expect(decision).not.toHaveProperty("originalTransactionId");
    expect(decision).toMatchObject({
      status: "rejected",
      matchMethod: "unmatched",
      milesEligibleAmountMinor: 0,
    });
  });

  it("can match cross-statement refunds by merchant, account, amount, and date", () => {
    const [decision] = matchRefunds([
      { ...purchase, id: "purchase_previous_statement", postedDate: "2026-05-15" },
      {
        ...purchase,
        id: "refund_current_statement",
        postedDate: "2026-06-18",
        amountMinor: 10_000,
        direction: "credit",
        transactionKind: "refund",
      },
    ]);

    expect(decision).toMatchObject({
      originalTransactionId: "purchase_previous_statement",
      status: "matched",
      milesEligibleAmountMinor: 0,
    });
  });
});
