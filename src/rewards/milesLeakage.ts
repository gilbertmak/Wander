import { createHash } from "node:crypto";

export type MilesLeakageReason =
  | "wrong_card"
  | "cap_exhausted"
  | "excluded_mcc"
  | "refund_reversal"
  | "low_confidence_mcc"
  | "missing_card_assignment";

export type MilesLeakageTransaction = {
  id: string;
  profileId: string;
  cardId?: string | null;
  amountMinor: number;
  transactionKind: "purchase" | "refund" | "fee" | "interest" | "payment" | "adjustment";
  eligibleForMiles: boolean;
  mccCode?: string | null;
  mccConfidence?: number;
  refundLinked?: boolean;
  cardAssigned?: boolean;
  capRemainingMinor?: number;
  bestAlternativeMiles?: number;
  actualMilesEarned?: number;
  excludedMccCodes?: string[];
};

export type MilesLeakageItem = {
  id: string;
  profileId: string;
  transactionId: string;
  cardId?: string | null;
  reason: MilesLeakageReason;
  spendMinor: number;
  milesMissed: number;
  recoverable: boolean;
  confidenceScore: number;
  traceId?: string;
};

export type CardPeriodSummaryInput = {
  profileId: string;
  cardId: string;
  periodStart: string;
  periodEnd: string;
  capAmountMinor: number;
  transactions: MilesLeakageTransaction[];
  leakageItems: MilesLeakageItem[];
  calculatedAt: string;
};

export type CardPeriodSummaryProjection = {
  id: string;
  profileId: string;
  cardId: string;
  periodStart: string;
  periodEnd: string;
  eligibleSpendMinor: number;
  excludedSpendMinor: number;
  capUsedMinor: number;
  milesEarned: number;
  milesMissed: number;
  confidenceScore: number;
  calculatedAt: string;
};

export function classifyMilesLeakage(
  transaction: MilesLeakageTransaction,
): MilesLeakageItem | undefined {
  if (transaction.transactionKind === "refund") {
    return buildItem(transaction, "refund_reversal", 0, false, 1);
  }

  if (transaction.refundLinked) {
    return undefined;
  }

  if (!transaction.cardAssigned || !transaction.cardId) {
    return buildItem(
      transaction,
      "missing_card_assignment",
      estimatedMissedMiles(transaction),
      true,
      0.7,
    );
  }

  if (transaction.mccCode && transaction.excludedMccCodes?.includes(transaction.mccCode)) {
    return buildItem(transaction, "excluded_mcc", 0, false, transaction.mccConfidence ?? 0.8);
  }

  if ((transaction.mccConfidence ?? 1) < 0.8) {
    return buildItem(
      transaction,
      "low_confidence_mcc",
      estimatedMissedMiles(transaction),
      true,
      transaction.mccConfidence ?? 0.5,
    );
  }

  if ((transaction.capRemainingMinor ?? Number.POSITIVE_INFINITY) <= 0) {
    return buildItem(transaction, "cap_exhausted", estimatedMissedMiles(transaction), false, 0.95);
  }

  const missedMiles = estimatedMissedMiles(transaction);
  if (missedMiles > 0) {
    return buildItem(transaction, "wrong_card", missedMiles, true, 0.85);
  }

  return undefined;
}

export function buildCardPeriodSummary(input: CardPeriodSummaryInput): CardPeriodSummaryProjection {
  const eligibleSpendMinor = input.transactions
    .filter(
      (transaction) => transaction.eligibleForMiles && transaction.transactionKind === "purchase",
    )
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  const excludedSpendMinor = input.transactions
    .filter(
      (transaction) => !transaction.eligibleForMiles || transaction.transactionKind !== "purchase",
    )
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  const milesEarned = input.transactions.reduce(
    (total, transaction) => total + (transaction.actualMilesEarned ?? 0),
    0,
  );

  return {
    id: stableId(input.profileId, input.cardId, input.periodStart, input.periodEnd),
    profileId: input.profileId,
    cardId: input.cardId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    eligibleSpendMinor,
    excludedSpendMinor,
    capUsedMinor: Math.min(input.capAmountMinor, eligibleSpendMinor),
    milesEarned,
    milesMissed: input.leakageItems.reduce((total, item) => total + item.milesMissed, 0),
    confidenceScore: confidenceForLeakage(input.leakageItems),
    calculatedAt: input.calculatedAt,
  };
}

export function toCardPeriodSummaryInsert(summary: CardPeriodSummaryProjection) {
  return summary;
}

export function toMilesLeakageItemInsert(item: MilesLeakageItem, periodSummaryId?: string) {
  return {
    id: item.id,
    profileId: item.profileId,
    transactionId: item.transactionId,
    cardId: item.cardId,
    periodSummaryId,
    reason: item.reason,
    spendMinor: item.spendMinor,
    milesMissed: item.milesMissed,
    recoverable: item.recoverable,
    confidenceScore: item.confidenceScore,
    traceId: item.traceId,
  };
}

function buildItem(
  transaction: MilesLeakageTransaction,
  reason: MilesLeakageReason,
  milesMissed: number,
  recoverable: boolean,
  confidenceScore: number,
): MilesLeakageItem {
  return {
    id: stableId(transaction.profileId, transaction.id, reason),
    profileId: transaction.profileId,
    transactionId: transaction.id,
    cardId: transaction.cardId,
    reason,
    spendMinor: Math.abs(transaction.amountMinor),
    milesMissed,
    recoverable,
    confidenceScore,
  };
}

function estimatedMissedMiles(transaction: MilesLeakageTransaction) {
  return Math.max(
    0,
    (transaction.bestAlternativeMiles ?? 0) - (transaction.actualMilesEarned ?? 0),
  );
}

function confidenceForLeakage(items: MilesLeakageItem[]) {
  if (items.length === 0) return 1;
  return (
    Math.round(
      (items.reduce((total, item) => total + item.confidenceScore, 0) / items.length) * 100,
    ) / 100
  );
}

function stableId(...parts: string[]) {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `leakage_${digest}`;
}
