import type { TrustLabel } from "../ingestion/reconciliation";
import type { ReviewItem, ReviewReason } from "../transactions/reviewModel";

export type ReviewRowStatus =
  | "clean"
  | "needs_merchant"
  | "needs_category"
  | "needs_mcc"
  | "needs_card"
  | "refund_match_review"
  | "miles_exception";

export type ReviewActionGroup =
  | "confirm_merchant"
  | "confirm_mcc"
  | "confirm_category"
  | "match_refund"
  | "assign_card"
  | "resolve_miles"
  | "clean";

export type ReviewRowAction = "accept" | "edit" | "ignore";

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
  trustScore?: number;
  trustLabel?: TrustLabel;
  trustDrivers?: string[];
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
  actionGroup: ReviewActionGroup;
  openReasons: ReviewReason[];
  availableActions: ReviewRowAction[];
  confidenceScore: number;
  trustScore?: number;
  trustLabel?: TrustLabel;
  diagnostics: string[];
  primaryAction: string;
};

export type ReviewInboxSummary = Record<ReviewRowStatus, number> & {
  total: number;
  actionable: number;
};

export type ReviewInboxGroup = {
  actionGroup: ReviewActionGroup;
  label: string;
  rows: ReviewInboxRow[];
  totalAmountMinor: number;
  openCount: number;
};

export type ReviewInboxModel = {
  state: ReviewInboxStateKind;
  rows: ReviewInboxRow[];
  groups: ReviewInboxGroup[];
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

const reasonPriority: ReviewReason[] = [
  "miles_exception",
  "refund_match",
  "merchant",
  "mcc",
  "category",
  "card",
];

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
    actionGroup: actionGroupForStatus(status),
    openReasons,
    availableActions: status === "clean" ? [] : ["accept", "edit", "ignore"],
    confidenceScore: transaction.confidenceScore,
    trustScore: transaction.trustScore,
    trustLabel: transaction.trustLabel,
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

  if (openReasons.includes("merchant") || !transaction.merchantId) {
    return "needs_merchant";
  }

  if (openReasons.includes("mcc") || !transaction.mccCode) {
    return "needs_mcc";
  }

  if (openReasons.includes("category") || !transaction.categoryId) {
    return "needs_category";
  }

  if (openReasons.includes("card") || !transaction.cardId) {
    return "needs_card";
  }

  return "clean";
}

export function summarizeReviewRows(rows: ReviewInboxRow[]): ReviewInboxSummary {
  const summary: ReviewInboxSummary = {
    clean: 0,
    needs_merchant: 0,
    needs_category: 0,
    needs_mcc: 0,
    needs_card: 0,
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

export function groupReviewInboxRows(rows: ReviewInboxRow[]): ReviewInboxGroup[] {
  const groupsByAction = new Map<ReviewActionGroup, ReviewInboxRow[]>();

  for (const row of rows.filter((candidate) => candidate.actionGroup !== "clean")) {
    groupsByAction.set(row.actionGroup, [...(groupsByAction.get(row.actionGroup) ?? []), row]);
  }

  return [...groupsByAction.entries()]
    .map(([actionGroup, groupRows]) => ({
      actionGroup,
      label: actionGroupLabel(actionGroup),
      rows: groupRows.sort(compareRows),
      totalAmountMinor: groupRows.reduce((total, row) => total + Math.abs(row.amountMinor), 0),
      openCount: groupRows.length,
    }))
    .sort(
      (left, right) =>
        actionGroupPriority(right.actionGroup) - actionGroupPriority(left.actionGroup),
    );
}

function buildState(
  state: ReviewInboxStateKind,
  rows: ReviewInboxRow[],
  message?: string,
): ReviewInboxModel {
  return {
    state,
    rows,
    groups: groupReviewInboxRows(rows),
    summary: summarizeReviewRows(rows),
    message,
  };
}

function compareRows(left: ReviewInboxRow, right: ReviewInboxRow) {
  if (left.status !== right.status) {
    return statusPriority(right.status) - statusPriority(left.status);
  }

  if (left.trustLabel !== right.trustLabel) {
    return trustPriority(right.trustLabel) - trustPriority(left.trustLabel);
  }

  if (Math.abs(left.amountMinor) !== Math.abs(right.amountMinor)) {
    return Math.abs(right.amountMinor) - Math.abs(left.amountMinor);
  }

  return right.postedDate.localeCompare(left.postedDate);
}

function statusPriority(status: ReviewRowStatus) {
  switch (status) {
    case "miles_exception":
      return 6;
    case "refund_match_review":
      return 5;
    case "needs_merchant":
      return 4;
    case "needs_mcc":
      return 3;
    case "needs_category":
      return 2;
    case "needs_card":
      return 1.5;
    case "clean":
      return 1;
  }
}

function trustPriority(label: TrustLabel | undefined) {
  switch (label) {
    case "needs_review":
      return 3;
    case "medium_trust":
      return 2;
    case "high_trust":
      return 1;
    case undefined:
      return 0;
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

  if (transaction.trustLabel) {
    diagnostics.push(`${formatTrustLabel(transaction.trustLabel)}.`);
  }

  if (transaction.trustDrivers && transaction.trustDrivers.length > 0) {
    diagnostics.push(...transaction.trustDrivers);
  }

  if (openReasons.length > 0) {
    diagnostics.push(`Open review reasons: ${openReasons.join(", ")}.`);
  }

  switch (status) {
    case "clean":
      diagnostics.push("No review action required.");
      break;
    case "needs_merchant":
      diagnostics.push("Confirm merchant before learning future statement aliases.");
      break;
    case "needs_category":
      diagnostics.push("Assign category before updating expense snapshots.");
      break;
    case "needs_mcc":
      diagnostics.push("Assign MCC before miles eligibility calculation.");
      break;
    case "needs_card":
      diagnostics.push("Assign card before card-specific miles calculation.");
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

function formatTrustLabel(label: TrustLabel) {
  switch (label) {
    case "high_trust":
      return "High trust";
    case "medium_trust":
      return "Medium trust";
    case "needs_review":
      return "Needs review";
  }
}

function primaryActionForStatus(status: ReviewRowStatus) {
  switch (status) {
    case "clean":
      return "View";
    case "needs_merchant":
      return "Confirm merchant";
    case "needs_category":
      return "Set category";
    case "needs_mcc":
      return "Set MCC";
    case "needs_card":
      return "Assign card";
    case "refund_match_review":
      return "Match refund";
    case "miles_exception":
      return "Resolve miles";
  }
}

function actionGroupForStatus(status: ReviewRowStatus): ReviewActionGroup {
  switch (status) {
    case "needs_merchant":
      return "confirm_merchant";
    case "needs_mcc":
      return "confirm_mcc";
    case "needs_category":
      return "confirm_category";
    case "refund_match_review":
      return "match_refund";
    case "needs_card":
      return "assign_card";
    case "miles_exception":
      return "resolve_miles";
    case "clean":
      return "clean";
  }
}

function actionGroupLabel(actionGroup: ReviewActionGroup) {
  switch (actionGroup) {
    case "confirm_merchant":
      return "Confirm merchant";
    case "confirm_mcc":
      return "Confirm MCC";
    case "confirm_category":
      return "Confirm category";
    case "match_refund":
      return "Match refund";
    case "assign_card":
      return "Assign card";
    case "resolve_miles":
      return "Resolve miles";
    case "clean":
      return "Clean";
  }
}

function actionGroupPriority(actionGroup: ReviewActionGroup) {
  switch (actionGroup) {
    case "resolve_miles":
      return 6;
    case "match_refund":
      return 5;
    case "confirm_merchant":
      return 4;
    case "confirm_mcc":
      return 3;
    case "confirm_category":
      return 2;
    case "assign_card":
      return 1;
    case "clean":
      return 0;
  }
}
