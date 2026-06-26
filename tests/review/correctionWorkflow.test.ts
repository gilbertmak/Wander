import { describe, expect, it } from "vitest";

import {
  applyCorrectionDraft,
  validateCorrectionDraft,
  type CorrectionDraft,
} from "../../src/review/correctionWorkflow";
import type { ReviewTransaction } from "../../src/review/reviewInboxModel";

const transaction: ReviewTransaction = {
  id: "transaction_1",
  postedDate: "2026-06-20",
  descriptionNormalized: "sp services utilities",
  amountMinor: -9400,
  categoryId: null,
  mccCode: null,
  merchantId: null,
  cardId: "card_citi_rewards",
  confidenceScore: 0.54,
  eligibleForMiles: true,
  needsReview: true,
  transactionKind: "purchase",
};

describe("correction workflow", () => {
  it("applies category corrections and can create heuristic input", () => {
    const result = applyCorrectionDraft(transaction, draft("category", "category_utilities", true));

    expect(result.transaction).toMatchObject({
      categoryId: "category_utilities",
      needsReview: false,
      confidenceScore: 0.9,
    });
    expect(result.correction).toMatchObject({
      field: "category",
      previousValue: null,
      nextValue: "category_utilities",
    });
    expect(result.recalculationTriggers).toEqual(["category_corrected"]);
    expect(result.heuristicInput).toMatchObject({
      transactionId: "transaction_1",
      correctedCategoryId: "category_utilities",
      confidenceScore: 0.9,
    });
  });

  it("applies MCC corrections and triggers miles recalculation", () => {
    const result = applyCorrectionDraft(transaction, draft("mcc", "4900", true));

    expect(result.transaction.mccCode).toBe("4900");
    expect(result.recalculationTriggers).toEqual(["mcc_corrected", "miles_eligibility_changed"]);
    expect(result.heuristicInput).toMatchObject({
      correctedMccCode: "4900",
    });
  });

  it("applies card, refund match, and miles eligibility corrections", () => {
    expect(applyCorrectionDraft(transaction, draft("card", "card_hsbc_revolution")).recalculationTriggers).toEqual([
      "miles_eligibility_changed",
    ]);
    expect(applyCorrectionDraft(transaction, draft("refund_match", "transaction_purchase")).recalculationTriggers).toEqual([
      "refund_match_changed",
      "miles_eligibility_changed",
    ]);
    expect(
      applyCorrectionDraft(transaction, {
        ...draft("miles_eligibility", false),
      }),
    ).toMatchObject({
      transaction: {
        eligibleForMiles: false,
        needsReview: false,
      },
      recalculationTriggers: ["miles_eligibility_changed"],
    });
  });

  it("rejects mismatched transactions and invalid drafts", () => {
    expect(() =>
      applyCorrectionDraft(transaction, {
        ...draft("category", "category_utilities"),
        transactionId: "other",
      }),
    ).toThrow(/does not match/i);
    expect(
      validateCorrectionDraft({
        transactionId: "",
        field: "category",
        nextValue: "",
        correctedAt: "not-a-date",
      }),
    ).toEqual([
      "Transaction is required.",
      "Correction value is required.",
      "Correction timestamp is invalid.",
    ]);
    expect(validateCorrectionDraft(draft("miles_eligibility", "true"))).toEqual([
      "Miles eligibility corrections require a boolean value.",
    ]);
  });
});

function draft(
  field: CorrectionDraft["field"],
  nextValue: CorrectionDraft["nextValue"],
  createHeuristic = false,
): CorrectionDraft {
  return {
    transactionId: "transaction_1",
    field,
    nextValue,
    createHeuristic,
    correctedAt: "2026-06-26T01:00:00.000Z",
  };
}
