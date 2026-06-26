import type { RefundMatchDecision } from "./refundMatcher";

export type SpendTransaction = {
  id: string;
  postedDate: string;
  amountMinor: number;
  transactionKind: "purchase" | "refund" | "fee" | "interest" | "payment" | "adjustment";
};

export type NetSpendSnapshotInput = {
  profileId: string;
  periodStart: string;
  periodEnd: string;
  transactions: SpendTransaction[];
  refundMatches: RefundMatchDecision[];
  source: "statement_import" | "manual";
  sourceRecordId?: string;
};

export type NetSpendSnapshot = {
  profileId: string;
  periodStart: string;
  periodEnd: string;
  grossSpendMinor: number;
  refundsMinor: number;
  netSpendMinor: number;
  annualizedExpensesMinor: number;
  source: "statement_import" | "manual";
  sourceModule: "transactions";
  sourceRecordId?: string;
  calculatedAt: string;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function calculateNetSpendSnapshot(input: NetSpendSnapshotInput): NetSpendSnapshot {
  const periodTransactions = input.transactions.filter((transaction) =>
    isWithinPeriod(transaction.postedDate, input.periodStart, input.periodEnd),
  );
  const grossSpendMinor = periodTransactions
    .filter((transaction) => transaction.amountMinor < 0 && transaction.transactionKind !== "refund")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amountMinor), 0);
  const matchedRefundTransactionIds = new Set(
    input.refundMatches
      .filter((match) => match.status === "matched" || match.status === "partial")
      .map((match) => match.refundTransactionId),
  );
  const refundsMinor = periodTransactions
    .filter((transaction) => matchedRefundTransactionIds.has(transaction.id))
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amountMinor), 0);
  const netSpendMinor = Math.max(0, grossSpendMinor - refundsMinor);

  return {
    profileId: input.profileId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    grossSpendMinor,
    refundsMinor,
    netSpendMinor,
    annualizedExpensesMinor: annualizeMinor(netSpendMinor, input.periodStart, input.periodEnd),
    source: input.source,
    sourceModule: "transactions",
    sourceRecordId: input.sourceRecordId,
    calculatedAt: new Date().toISOString(),
  };
}

function annualizeMinor(amountMinor: number, periodStart: string, periodEnd: string) {
  const days = daysBetweenInclusive(periodStart, periodEnd);
  return Math.round((amountMinor / days) * 365);
}

function isWithinPeriod(postedDate: string, periodStart: string, periodEnd: string) {
  return postedDate >= periodStart && postedDate <= periodEnd;
}

function daysBetweenInclusive(periodStart: string, periodEnd: string) {
  const start = Date.parse(`${periodStart}T00:00:00.000Z`);
  const end = Date.parse(`${periodEnd}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    throw new Error("Invalid net spend snapshot period.");
  }

  return (end - start) / millisecondsPerDay + 1;
}
