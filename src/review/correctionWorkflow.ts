import type { MerchantCorrectionInput } from "../merchant/learningLoop";
import type { RecalculationTrigger } from "../transactions/reviewModel";
import type { ReviewTransaction } from "./reviewInboxModel";

export type CorrectionField =
  | "category"
  | "merchant"
  | "mcc"
  | "card"
  | "refund_match"
  | "miles_eligibility";

export type CorrectionDraft = {
  transactionId: string;
  field: CorrectionField;
  nextValue: string | boolean;
  createHeuristic?: boolean;
  note?: string;
  correctedAt: string;
};

export type PersistedCorrection = {
  id: string;
  transactionId: string;
  field: CorrectionField;
  previousValue?: string | boolean | null;
  nextValue: string | boolean;
  note?: string;
  createdAt: string;
};

export type CorrectionWorkflowResult = {
  transaction: ReviewTransaction;
  correction: PersistedCorrection;
  recalculationTriggers: RecalculationTrigger[];
  heuristicInput?: MerchantCorrectionInput;
};

export function applyCorrectionDraft(
  transaction: ReviewTransaction,
  draft: CorrectionDraft,
): CorrectionWorkflowResult {
  if (transaction.id !== draft.transactionId) {
    throw new Error("Correction transaction does not match selected review row.");
  }

  const previousValue = previousValueForField(transaction, draft.field);
  const updatedTransaction = updateTransaction(transaction, draft);
  const correction: PersistedCorrection = {
    id: `correction_${draft.transactionId}_${draft.field}_${Date.parse(draft.correctedAt)}`,
    transactionId: draft.transactionId,
    field: draft.field,
    previousValue,
    nextValue: draft.nextValue,
    note: draft.note,
    createdAt: draft.correctedAt,
  };

  return {
    transaction: updatedTransaction,
    correction,
    recalculationTriggers: triggersForCorrection(draft.field),
    heuristicInput: draft.createHeuristic ? buildHeuristicInput(updatedTransaction, draft) : undefined,
  };
}

export function validateCorrectionDraft(draft: CorrectionDraft): string[] {
  const errors: string[] = [];

  if (!draft.transactionId) {
    errors.push("Transaction is required.");
  }

  if (draft.nextValue === "" || draft.nextValue === undefined || draft.nextValue === null) {
    errors.push("Correction value is required.");
  }

  if (draft.field !== "miles_eligibility" && typeof draft.nextValue !== "string") {
    errors.push(`${draft.field} corrections require a string value.`);
  }

  if (draft.field === "miles_eligibility" && typeof draft.nextValue !== "boolean") {
    errors.push("Miles eligibility corrections require a boolean value.");
  }

  if (Number.isNaN(Date.parse(draft.correctedAt))) {
    errors.push("Correction timestamp is invalid.");
  }

  return errors;
}

function previousValueForField(transaction: ReviewTransaction, field: CorrectionField) {
  switch (field) {
    case "category":
      return transaction.categoryId;
    case "merchant":
      return transaction.merchantId;
    case "mcc":
      return transaction.mccCode;
    case "card":
      return transaction.cardId;
    case "refund_match":
      return undefined;
    case "miles_eligibility":
      return transaction.eligibleForMiles;
  }
}

function updateTransaction(
  transaction: ReviewTransaction,
  draft: CorrectionDraft,
): ReviewTransaction {
  switch (draft.field) {
    case "category":
      return {
        ...transaction,
        categoryId: draft.nextValue as string,
        needsReview: false,
        confidenceScore: Math.max(transaction.confidenceScore, 0.9),
      };
    case "merchant":
      return {
        ...transaction,
        merchantId: draft.nextValue as string,
        needsReview: false,
        confidenceScore: Math.max(transaction.confidenceScore, 0.9),
      };
    case "mcc":
      return {
        ...transaction,
        mccCode: draft.nextValue as string,
        needsReview: false,
        confidenceScore: Math.max(transaction.confidenceScore, 0.9),
      };
    case "card":
      return {
        ...transaction,
        cardId: draft.nextValue as string,
        needsReview: false,
      };
    case "refund_match":
      return {
        ...transaction,
        needsReview: false,
      };
    case "miles_eligibility":
      return {
        ...transaction,
        eligibleForMiles: draft.nextValue as boolean,
        needsReview: false,
      };
  }
}

function triggersForCorrection(field: CorrectionField): RecalculationTrigger[] {
  switch (field) {
    case "category":
    case "merchant":
      return ["category_corrected"];
    case "mcc":
      return ["mcc_corrected", "miles_eligibility_changed"];
    case "card":
      return ["miles_eligibility_changed"];
    case "refund_match":
      return ["refund_match_changed", "miles_eligibility_changed"];
    case "miles_eligibility":
      return ["miles_eligibility_changed"];
  }
}

function buildHeuristicInput(
  transaction: ReviewTransaction,
  draft: CorrectionDraft,
): MerchantCorrectionInput | undefined {
  if (draft.field !== "category" && draft.field !== "mcc" && draft.field !== "merchant") {
    return undefined;
  }

  return {
    transactionId: transaction.id,
    descriptionNormalized: transaction.descriptionNormalized,
    correctedCategoryId:
      draft.field === "category" ? (draft.nextValue as string) : transaction.categoryId ?? undefined,
    correctedMccCode:
      draft.field === "mcc" ? (draft.nextValue as string) : transaction.mccCode ?? undefined,
    merchantId: draft.field === "merchant" ? (draft.nextValue as string) : transaction.merchantId ?? undefined,
    confidenceScore: 0.9,
    correctedAt: draft.correctedAt,
  };
}
