import { describe, expect, it } from "vitest";

import { applyReviewAction, createReviewItems } from "../../src/transactions/reviewModel";

describe("review inbox model", () => {
  it("creates review items for category, MCC, refund, and miles exceptions", () => {
    const items = createReviewItems({
      transactionId: "transaction_1",
      needsMerchant: true,
      needsCategory: true,
      needsMcc: true,
      needsRefundMatch: true,
      needsCard: true,
      hasMilesException: true,
      confidenceScore: 0.61,
    });

    expect(items.map((item) => item.reason)).toEqual([
      "merchant",
      "category",
      "mcc",
      "refund_match",
      "card",
      "miles_exception",
    ]);
    expect(items.every((item) => item.status === "open")).toBe(true);
  });

  it("accepts a review item and emits recalculation triggers", () => {
    const [item] = createReviewItems({
      transactionId: "transaction_1",
      needsCategory: false,
      needsMcc: false,
      needsRefundMatch: true,
      hasMilesException: false,
      confidenceScore: 0.72,
    });

    const result = applyReviewAction({ ...item, suggestedValue: "purchase_1" }, "accept");

    expect(result.item.status).toBe("accepted");
    expect(result.correctionEvent).toMatchObject({
      reviewItemId: "transaction_1_refund_match",
      action: "accept",
      nextValue: "purchase_1",
    });
    expect(result.recalculationTriggers).toEqual([
      "refund_match_changed",
      "miles_eligibility_changed",
    ]);
  });

  it("edits a category review item and emits category recalculation", () => {
    const [item] = createReviewItems({
      transactionId: "transaction_1",
      needsCategory: true,
      needsMcc: false,
      needsRefundMatch: false,
      hasMilesException: false,
      confidenceScore: 0.5,
    });

    const result = applyReviewAction(
      { ...item, currentValue: "uncategorized" },
      "edit",
      "transport",
    );

    expect(result.item).toMatchObject({
      status: "edited",
      currentValue: "transport",
    });
    expect(result.correctionEvent).toMatchObject({
      previousValue: "uncategorized",
      nextValue: "transport",
    });
    expect(result.recalculationTriggers).toEqual(["category_corrected"]);
  });

  it("rejects a review item without triggering recalculation", () => {
    const [item] = createReviewItems({
      transactionId: "transaction_1",
      needsCategory: false,
      needsMcc: false,
      needsRefundMatch: false,
      hasMilesException: true,
      confidenceScore: 0.4,
    });

    const result = applyReviewAction(item, "reject");

    expect(result.item.status).toBe("rejected");
    expect(result.recalculationTriggers).toEqual([]);
  });

  it("ignores a review item without creating future recalculation work", () => {
    const [item] = createReviewItems({
      transactionId: "transaction_1",
      needsCategory: false,
      needsMcc: true,
      needsRefundMatch: false,
      hasMilesException: false,
      confidenceScore: 0.4,
    });

    const result = applyReviewAction(item, "ignore");

    expect(result.item.status).toBe("ignored");
    expect(result.correctionEvent).toMatchObject({
      action: "ignore",
      nextValue: undefined,
    });
    expect(result.recalculationTriggers).toEqual([]);
  });
});
