import { describe, expect, it } from "vitest";

import { categorizeTransaction } from "../../src/transactions/categorization";

const baseTransaction = {
  id: "transaction_1",
  descriptionNormalized: "grab trip singapore",
  merchantId: "merchant_grab",
  mccCode: "4121",
  amountMinor: -1840,
};

describe("transaction categorization", () => {
  it("applies user rules before merchant heuristics and MCC defaults", () => {
    const decision = categorizeTransaction({
      transaction: baseTransaction,
      userRules: [{ id: "rule_grab", pattern: "grab", categoryId: "transport", confidenceScore: 0.99 }],
      merchantHeuristics: [
        { merchantId: "merchant_grab", categoryId: "food", mccCode: "5812", confidenceScore: 0.95 },
      ],
      mccDefaults: [{ mccCode: "4121", categoryId: "transport_default", defaultMilesEligibility: true }],
    });

    expect(decision).toMatchObject({
      categoryId: "transport",
      source: "user_rule",
      needsReview: false,
      eligibleForMiles: true,
    });
  });

  it("falls back to the highest-confidence merchant heuristic", () => {
    const decision = categorizeTransaction({
      transaction: baseTransaction,
      userRules: [],
      merchantHeuristics: [
        { merchantId: "merchant_grab", categoryId: "food", confidenceScore: 0.72 },
        { merchantId: "merchant_grab", categoryId: "transport", mccCode: "4121", confidenceScore: 0.91 },
      ],
      mccDefaults: [],
    });

    expect(decision).toMatchObject({
      categoryId: "transport",
      mccCode: "4121",
      source: "merchant_heuristic",
      needsReview: false,
    });
  });

  it("applies MCC defaults when no user or merchant rule matches", () => {
    const decision = categorizeTransaction({
      transaction: { ...baseTransaction, merchantId: null },
      userRules: [],
      merchantHeuristics: [],
      mccDefaults: [{ mccCode: "4121", categoryId: "transport_default", defaultMilesEligibility: true }],
    });

    expect(decision).toMatchObject({
      categoryId: "transport_default",
      source: "mcc_default",
      needsReview: true,
      eligibleForMiles: true,
    });
  });

  it("falls back to review when no categorization signal exists", () => {
    const decision = categorizeTransaction({
      transaction: { ...baseTransaction, merchantId: null, mccCode: null },
      userRules: [],
      merchantHeuristics: [],
      mccDefaults: [],
    });

    expect(decision).toMatchObject({
      source: "review",
      needsReview: true,
      eligibleForMiles: false,
    });
  });
});
