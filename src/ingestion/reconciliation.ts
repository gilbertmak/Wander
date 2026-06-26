import { createHash } from "node:crypto";

import type { ImportPreviewTransaction } from "./importWorkflow";

export type ReconciliationStatus = "verified" | "mostly_verified" | "needs_review";
export type TrustLabel = "high_trust" | "medium_trust" | "needs_review";

export type ReconciliationInput = {
  statementImportId: string;
  profileId: string;
  periodStart: string;
  periodEnd: string;
  openingBalanceMinor?: number;
  closingBalanceMinor?: number;
  transactions: Array<
    Pick<ImportPreviewTransaction, "amountMinor" | "direction"> & {
      transactionKind: ImportPreviewTransaction["transactionKind"] | "fee";
    }
  >;
  duplicateCount?: number;
  toleranceMinor?: number;
};

export type StatementReconciliation = {
  id: string;
  statementImportId: string;
  profileId: string;
  periodStart: string;
  periodEnd: string;
  openingBalanceMinor?: number;
  closingBalanceMinor?: number;
  debitTotalMinor: number;
  creditTotalMinor: number;
  feeTotalMinor: number;
  rowCount: number;
  duplicateCount: number;
  unexplainedDeltaMinor: number;
  status: ReconciliationStatus;
  confidenceScore: number;
  issues: string[];
};

export type TransactionTrustInput = {
  transactionId: string;
  statementImportId: string;
  profileId: string;
  parserConfidence: number;
  duplicateRisk?: boolean;
  merchantConfidence?: number;
  mccConfidence?: number;
  categoryConfidence?: number;
  refundLinked?: boolean;
  reconciliationStatus: ReconciliationStatus;
};

export type TransactionTrustScore = {
  id: string;
  transactionId: string;
  statementImportId: string;
  profileId: string;
  score: number;
  label: TrustLabel;
  drivers: string[];
};

const defaultToleranceMinor = 100;

export function calculateStatementReconciliation(
  input: ReconciliationInput,
): StatementReconciliation {
  const debitTotalMinor = input.transactions
    .filter((transaction) => transaction.direction === "debit")
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  const creditTotalMinor = input.transactions
    .filter((transaction) => transaction.direction === "credit")
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  const feeTotalMinor = input.transactions
    .filter((transaction) => transaction.transactionKind === "fee")
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  const duplicateCount = input.duplicateCount ?? 0;
  const toleranceMinor = input.toleranceMinor ?? defaultToleranceMinor;
  const hasBalances =
    input.openingBalanceMinor !== undefined && input.closingBalanceMinor !== undefined;
  const expectedClosingBalanceMinor = hasBalances
    ? input.openingBalanceMinor! - debitTotalMinor + creditTotalMinor
    : undefined;
  const unexplainedDeltaMinor =
    expectedClosingBalanceMinor === undefined
      ? 0
      : input.closingBalanceMinor! - expectedClosingBalanceMinor;
  const issues: string[] = [];

  if (!hasBalances) {
    issues.push("Statement balances unavailable; row-level checks only.");
  }

  if (duplicateCount > 0) {
    issues.push(`${duplicateCount} duplicate row${duplicateCount === 1 ? "" : "s"} detected.`);
  }

  if (Math.abs(unexplainedDeltaMinor) > toleranceMinor) {
    issues.push(`Unexplained balance delta ${unexplainedDeltaMinor} minor units.`);
  }

  const status = deriveReconciliationStatus({
    hasBalances,
    duplicateCount,
    unexplainedDeltaMinor,
    toleranceMinor,
  });

  return {
    id: stableId("reconciliation", input.statementImportId),
    statementImportId: input.statementImportId,
    profileId: input.profileId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    openingBalanceMinor: input.openingBalanceMinor,
    closingBalanceMinor: input.closingBalanceMinor,
    debitTotalMinor,
    creditTotalMinor,
    feeTotalMinor,
    rowCount: input.transactions.length,
    duplicateCount,
    unexplainedDeltaMinor,
    status,
    confidenceScore: confidenceForStatus(status, duplicateCount),
    issues,
  };
}

export function calculateTransactionTrustScore(
  input: TransactionTrustInput,
): TransactionTrustScore {
  const components = [
    input.parserConfidence * 0.35,
    (input.merchantConfidence ?? 0.75) * 0.15,
    (input.mccConfidence ?? 0.7) * 0.15,
    (input.categoryConfidence ?? 0.7) * 0.15,
    reconciliationWeight(input.reconciliationStatus) * 0.15,
    (input.refundLinked === false ? 0.75 : 1) * 0.05,
  ];
  const duplicatePenalty = input.duplicateRisk ? 0.25 : 0;
  const score = clamp(
    roundScore(components.reduce((total, value) => total + value, 0) - duplicatePenalty),
  );
  const drivers = trustDrivers(input, score);

  return {
    id: stableId("trust", input.transactionId),
    transactionId: input.transactionId,
    statementImportId: input.statementImportId,
    profileId: input.profileId,
    score,
    label: trustLabel(score),
    drivers,
  };
}

export function trustLabel(score: number): TrustLabel {
  if (score >= 0.85) return "high_trust";
  if (score >= 0.65) return "medium_trust";
  return "needs_review";
}

function deriveReconciliationStatus({
  hasBalances,
  duplicateCount,
  unexplainedDeltaMinor,
  toleranceMinor,
}: {
  hasBalances: boolean;
  duplicateCount: number;
  unexplainedDeltaMinor: number;
  toleranceMinor: number;
}): ReconciliationStatus {
  if (duplicateCount > 0 || Math.abs(unexplainedDeltaMinor) > toleranceMinor) {
    return "needs_review";
  }

  return hasBalances ? "verified" : "mostly_verified";
}

function confidenceForStatus(status: ReconciliationStatus, duplicateCount: number) {
  const base = status === "verified" ? 1 : status === "mostly_verified" ? 0.86 : 0.45;
  return clamp(roundScore(base - Math.min(duplicateCount * 0.1, 0.3)));
}

function reconciliationWeight(status: ReconciliationStatus) {
  switch (status) {
    case "verified":
      return 1;
    case "mostly_verified":
      return 0.86;
    case "needs_review":
      return 0.45;
  }
}

function trustDrivers(input: TransactionTrustInput, score: number) {
  const drivers: string[] = [`Trust score ${Math.round(score * 100)}%.`];

  if (input.parserConfidence < 0.8) drivers.push("Low parser confidence.");
  if (input.duplicateRisk) drivers.push("Possible duplicate transaction.");
  if ((input.merchantConfidence ?? 1) < 0.8) drivers.push("Merchant match needs review.");
  if ((input.mccConfidence ?? 1) < 0.8) drivers.push("MCC confidence below review threshold.");
  if ((input.categoryConfidence ?? 1) < 0.8)
    drivers.push("Category confidence below review threshold.");
  if (input.refundLinked === false) drivers.push("Refund linkage is unresolved.");
  if (input.reconciliationStatus !== "verified") {
    drivers.push(
      input.reconciliationStatus === "mostly_verified"
        ? "Import has no statement balance check."
        : "Statement reconciliation needs review.",
    );
  }

  return drivers;
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function stableId(prefix: string, ...parts: string[]) {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `${prefix}_${digest}`;
}
