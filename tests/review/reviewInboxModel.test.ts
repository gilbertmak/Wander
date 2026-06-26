import { describe, expect, it } from "vitest";

import {
  buildReviewInboxModel,
  buildReviewInboxRow,
  deriveReviewRowStatus,
  summarizeReviewRows,
  type ReviewTransaction,
} from "../../src/review/reviewInboxModel";
import type { ReviewItem } from "../../src/transactions/reviewModel";

const baseTransaction: ReviewTransaction = {
  id: "transaction_clean",
  postedDate: "2026-06-20",
  descriptionNormalized: "grab trip singapore",
  amountMinor: -1840,
  categoryId: "category_transport",
  mccCode: "4121",
  merchantId: "merchant_grab",
  cardId: "card_dbs_womans_world",
  confidenceScore: 0.92,
  eligibleForMiles: true,
  needsReview: false,
  transactionKind: "purchase",
};

describe("review inbox model", () => {
  it("derives every review row status", () => {
    expect(deriveReviewRowStatus(baseTransaction, [])).toBe("clean");
    expect(deriveReviewRowStatus({ ...baseTransaction, categoryId: null }, [])).toBe(
      "needs_category",
    );
    expect(deriveReviewRowStatus({ ...baseTransaction, mccCode: null }, [])).toBe("needs_mcc");
    expect(deriveReviewRowStatus(baseTransaction, ["refund_match"])).toBe("refund_match_review");
    expect(deriveReviewRowStatus(baseTransaction, ["miles_exception", "category"])).toBe(
      "miles_exception",
    );
  });

  it("builds row diagnostics and primary actions from open review items", () => {
    const row = buildReviewInboxRow(
      {
        ...baseTransaction,
        id: "transaction_1",
        confidenceScore: 0.61,
        trustLabel: "medium_trust",
        trustDrivers: ["MCC confidence below review threshold."],
      },
      [
        reviewItem("transaction_1", "category"),
        reviewItem("transaction_1", "mcc"),
        { ...reviewItem("transaction_1", "refund_match"), status: "accepted" },
      ],
    );

    expect(row).toMatchObject({
      transactionId: "transaction_1",
      status: "needs_mcc",
      openReasons: ["mcc", "category"],
      primaryAction: "Set MCC",
    });
    expect(row.diagnostics).toEqual([
      "Confidence 61%.",
      "Medium trust.",
      "MCC confidence below review threshold.",
      "Open review reasons: mcc, category.",
      "Assign MCC before miles eligibility calculation.",
    ]);
  });

  it("builds inbox summary and sorts actionable rows by severity before date", () => {
    const transactions: ReviewTransaction[] = [
      baseTransaction,
      {
        ...baseTransaction,
        id: "transaction_category",
        categoryId: null,
        postedDate: "2026-06-24",
      },
      { ...baseTransaction, id: "transaction_refund", postedDate: "2026-06-23" },
      { ...baseTransaction, id: "transaction_miles", postedDate: "2026-06-22" },
    ];
    const model = buildReviewInboxModel({
      transactions,
      reviewItems: [
        reviewItem("transaction_refund", "refund_match"),
        reviewItem("transaction_miles", "miles_exception"),
      ],
    });

    expect(model.state).toBe("miles_exception");
    expect(model.rows.map((row) => row.transactionId)).toEqual([
      "transaction_miles",
      "transaction_refund",
      "transaction_category",
      "transaction_clean",
    ]);
    expect(model.summary).toEqual({
      clean: 1,
      needs_category: 1,
      needs_mcc: 0,
      refund_match_review: 1,
      miles_exception: 1,
      total: 4,
      actionable: 3,
    });
  });

  it("returns explicit loading, error, duplicate import, stale card rule, and empty states", () => {
    expect(
      buildReviewInboxModel({ loading: true, transactions: [], reviewItems: [] }),
    ).toMatchObject({
      state: "loading",
      message: "Loading review inbox.",
    });
    expect(
      buildReviewInboxModel({ error: "Parser failed.", transactions: [], reviewItems: [] }),
    ).toMatchObject({
      state: "error",
      message: "Parser failed.",
    });
    expect(
      buildReviewInboxModel({ duplicateImport: true, transactions: [], reviewItems: [] }),
    ).toMatchObject({
      state: "duplicate_import",
    });
    expect(
      buildReviewInboxModel({ staleCardRule: true, transactions: [], reviewItems: [] }),
    ).toMatchObject({
      state: "stale_card_rule",
    });
    expect(
      buildReviewInboxModel({ transactions: [baseTransaction], reviewItems: [] }),
    ).toMatchObject({
      state: "empty",
      summary: {
        clean: 1,
        total: 1,
        actionable: 0,
      },
    });
  });

  it("summarizes rows independently for UI counters", () => {
    expect(
      summarizeReviewRows([
        buildReviewInboxRow(baseTransaction, []),
        buildReviewInboxRow(
          { ...baseTransaction, id: "transaction_missing_mcc", mccCode: null },
          [],
        ),
      ]),
    ).toMatchObject({
      clean: 1,
      needs_mcc: 1,
      total: 2,
      actionable: 1,
    });
  });

  it("sorts lower trust rows first within the same review status", () => {
    const model = buildReviewInboxModel({
      transactions: [
        {
          ...baseTransaction,
          id: "transaction_high_trust",
          categoryId: null,
          postedDate: "2026-06-24",
          trustLabel: "high_trust",
        },
        {
          ...baseTransaction,
          id: "transaction_low_trust",
          categoryId: null,
          postedDate: "2026-06-20",
          trustLabel: "needs_review",
        },
      ],
      reviewItems: [],
    });

    expect(model.rows.map((row) => row.transactionId)).toEqual([
      "transaction_low_trust",
      "transaction_high_trust",
    ]);
  });
});

function reviewItem(transactionId: string, reason: ReviewItem["reason"]): ReviewItem {
  return {
    id: `${transactionId}_${reason}`,
    transactionId,
    reason,
    status: "open",
    confidenceScore: 0.62,
  };
}
