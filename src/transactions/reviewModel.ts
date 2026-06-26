export type ReviewReason =
  | "merchant"
  | "category"
  | "mcc"
  | "refund_match"
  | "card"
  | "miles_exception";
export type ReviewStatus = "open" | "accepted" | "edited" | "rejected" | "ignored";
export type ReviewAction = "accept" | "edit" | "reject" | "ignore";
export type RecalculationTrigger =
  | "category_corrected"
  | "mcc_corrected"
  | "refund_match_changed"
  | "miles_eligibility_changed";

export type ReviewItem = {
  id: string;
  transactionId: string;
  reason: ReviewReason;
  status: ReviewStatus;
  suggestedValue?: string;
  currentValue?: string;
  confidenceScore: number;
};

export type CorrectionEvent = {
  reviewItemId: string;
  transactionId: string;
  action: ReviewAction;
  previousValue?: string;
  nextValue?: string;
  createdAt: string;
};

export type ReviewActionResult = {
  item: ReviewItem;
  correctionEvent: CorrectionEvent;
  recalculationTriggers: RecalculationTrigger[];
};

export function createReviewItems(input: {
  transactionId: string;
  needsMerchant?: boolean;
  needsCategory: boolean;
  needsMcc: boolean;
  needsRefundMatch: boolean;
  needsCard?: boolean;
  hasMilesException: boolean;
  confidenceScore: number;
}) {
  const reasons: ReviewReason[] = [];

  if (input.needsMerchant) reasons.push("merchant");
  if (input.needsCategory) reasons.push("category");
  if (input.needsMcc) reasons.push("mcc");
  if (input.needsRefundMatch) reasons.push("refund_match");
  if (input.needsCard) reasons.push("card");
  if (input.hasMilesException) reasons.push("miles_exception");

  return reasons.map((reason) => ({
    id: `${input.transactionId}_${reason}`,
    transactionId: input.transactionId,
    reason,
    status: "open" as const,
    confidenceScore: input.confidenceScore,
  }));
}

export function applyReviewAction(
  item: ReviewItem,
  action: ReviewAction,
  nextValue?: string,
): ReviewActionResult {
  const previousValue = item.currentValue ?? item.suggestedValue;
  const updatedItem: ReviewItem = {
    ...item,
    status:
      action === "accept"
        ? "accepted"
        : action === "edit"
          ? "edited"
          : action === "ignore"
            ? "ignored"
            : "rejected",
    currentValue: action === "edit" ? nextValue : item.currentValue,
  };

  return {
    item: updatedItem,
    correctionEvent: {
      reviewItemId: item.id,
      transactionId: item.transactionId,
      action,
      previousValue,
      nextValue:
        action === "edit" ? nextValue : action === "ignore" ? undefined : item.suggestedValue,
      createdAt: new Date().toISOString(),
    },
    recalculationTriggers:
      action === "reject" || action === "ignore" ? [] : triggersForReason(item.reason),
  };
}

function triggersForReason(reason: ReviewReason): RecalculationTrigger[] {
  switch (reason) {
    case "merchant":
      return ["category_corrected"];
    case "category":
      return ["category_corrected"];
    case "mcc":
      return ["mcc_corrected", "miles_eligibility_changed"];
    case "refund_match":
      return ["refund_match_changed", "miles_eligibility_changed"];
    case "card":
      return ["miles_eligibility_changed"];
    case "miles_exception":
      return ["miles_eligibility_changed"];
  }
}
