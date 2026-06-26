import type { ReviewItem, ReviewReason } from "../transactions/reviewModel";

export type ReviewRowStatus =
  | "clean"
  | "needs_category"
  | "needs_mcc"
  | "refund_match_review"
  | "miles_exception";

export type ReviewInboxStateKind =
  | "loading"
  | "empty"
  | "ready"
  | "error"
  | "duplicate_import"
  | "stale_card_rule"
  | "unmatched_refund"
  | "miles_exception";

export type ReviewTransaction = {
  id: string;
  postedDate: string;
  descriptionNormalized: string;
  amountMinor: number;
  categoryId?: string | null;
  mccCode?: string | null;
  merchantId?: string | null;
  cardId?: string | null;
  confidenceScore: number;
  eligibleForMiles: boolean;
  needsReview: boolean;
  transactionKind: "purchase" | "refund" | "fee" | "interest" | "payment" | "adjustment";
};

export type ReviewInboxRow = {
  transactionId: string;
  postedDate: string;
  description: string;
  amountMinor: number;
  status: ReviewRowStatus;
  openReasons: ReviewReason[];
  confidenceScore: number;
  diagnostics: string[];
  primaryAction: string;
};

export type ReviewInboxSummary = Record<ReviewRowStatus, number> & {
  total: number;
  actionable: number;
};

export type ReviewInboxModel = {
  state: ReviewInboxStateKind;
  rows: ReviewInboxRow[];
  summary: ReviewInboxSummary;
  message?: string;
};

export type BuildReviewInboxInput = {
  loading?: boolean;
  error?: string;
  duplicateImport?: boolean;
  staleCardRule?: boolean;
  transactions: ReviewTransaction[];
  reviewItems: ReviewItem[];
};

const reasonPriority: ReviewReason[] = ["miles_exception", "refund_match", "mcc", "category"];

export function buildReviewInboxModel(input: BuildReviewInboxInput): ReviewInboxModel {
  if (input.loading) {
    return buildState("loading", [], "Loading review inbox.");
  }

  if (input.error) {
    return buildState("error", [], input.error);
  }

  if (input.duplicateImport) {
    return buildState("duplicate_import", [], "Duplicate statement import detected.");
  }

  if (input.staleCardRule) {
    return buildState("stale_card_rule", [], "Card rule catalogue is stale.");
  }

  const rows = input.transactions
    .map((transaction) => buildReviewInboxRow(transaction, input.reviewItems))
    .sort(compareRows);

  if (rows.length === 0 || rows.every((row) => row.status === "clean")) {
    return buildState("empty", rows, "No review items need attention.");
  }

  if (rows.some((row) => row.status === "miles_exception")) {
    return buildState("miles_exception", rows);
  }

  if (rows.some((row) => row.status === "refund_match_review")) {
    return buildState("unmatched_refund", rows);
  }

  return buildState("ready", rows);
}

export function buildReviewInboxRow(
  transaction: ReviewTransaction,
  reviewItems: ReviewItem[],
): ReviewInboxRow {
  const openReasons = reviewItems
    .filter((item) => item.transactionId === transaction.id && item.status === "open")
    .map((item) => item.reason)
    .sort((left, right) => reasonPriority.indexOf(left) - reasonPriority.indexOf(right));
  const status = deriveReviewRowStatus(transaction, openReasons);

  return {
    transactionId: transaction.id,
    postedDate: transaction.postedDate,
    description: transaction.descriptionNormalized,
    amountMinor: transaction.amountMinor,
    status,
    openReasons,
    confidenceScore: transaction.confidenceScore,
    diagnostics: diagnosticsForStatus(transaction, status, openReasons),
    primaryAction: primaryActionForStatus(status),
  };
}

export function deriveReviewRowStatus(
  transaction: ReviewTransaction,
  openReasons: ReviewReason[],
): ReviewRowStatus {
  if (openReasons.includes("miles_exception")) {
    return "miles_exception";
  }

  if (openReasons.includes("refund_match")) {
    return "refund_match_review";
  }

  if (openReasons.includes("mcc") || !transaction.mccCode) {
    return "needs_mcc";
  }

  if (openReasons.includes("category") || !transaction.categoryId) {
    return "needs_category";
  }

  return "clean";
}

export function summarizeReviewRows(rows: ReviewInboxRow[]): ReviewInboxSummary {
  const summary: ReviewInboxSummary = {
    clean: 0,
    needs_category: 0,
    needs_mcc: 0,
    refund_match_review: 0,
    miles_exception: 0,
    total: rows.length,
    actionable: 0,
  };

  for (const row of rows) {
    summary[row.status] += 1;
    if (row.status !== "clean") {
      summary.actionable += 1;
    }
  }

  return summary;
}

function buildState(
  state: ReviewInboxStateKind,
  rows: ReviewInboxRow[],
  message?: string,
): ReviewInboxModel {
  return {
    state,
    rows,
    summary: summarizeReviewRows(rows),
    message,
  };
}

function compareRows(left: ReviewInboxRow, right: ReviewInboxRow) {
  if (left.status !== right.status) {
    return statusPriority(right.status) - statusPriority(left.status);
  }

  return right.postedDate.localeCompare(left.postedDate);
}

function statusPriority(status: ReviewRowStatus) {
  switch (status) {
    case "miles_exception":
      return 5;
    case "refund_match_review":
      return 4;
    case "needs_mcc":
      return 3;
    case "needs_category":
      return 2;
    case "clean":
      return 1;
  }
}

function diagnosticsForStatus(
  transaction: ReviewTransaction,
  status: ReviewRowStatus,
  openReasons: ReviewReason[],
) {
  const diagnostics: string[] = [];

  if (transaction.confidenceScore < 0.8) {
    diagnostics.push(`Confidence ${Math.round(transaction.confidenceScore * 100)}%.`);
  }

  if (openReasons.length > 0) {
    diagnostics.push(`Open review reasons: ${openReasons.join(", ")}.`);
  }

  switch (status) {
    case "clean":
      diagnostics.push("No review action required.");
      break;
    case "needs_category":
      diagnostics.push("Assign category before updating expense snapshots.");
      break;
    case "needs_mcc":
      diagnostics.push("Assign MCC before miles eligibility calculation.");
      break;
    case "refund_match_review":
      diagnostics.push("Confirm refund match before netting spend and reversing miles.");
      break;
    case "miles_exception":
      diagnostics.push("Resolve miles exception before reward ledger posting.");
      break;
  }

  return diagnostics;
}

function primaryActionForStatus(status: ReviewRowStatus) {
  switch (status) {
    case "clean":
      return "View";
    case "needs_category":
      return "Set category";
    case "needs_mcc":
      return "Set MCC";
    case "refund_match_review":
      return "Match refund";
    case "miles_exception":
      return "Resolve miles";
  }
}
