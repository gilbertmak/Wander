import { eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { DatabaseConnection } from "../db/client";
import { rewardLedger } from "../db/schema";
import {
  evaluateTransactionReward,
  type RewardEvaluationContext,
  type RewardTransaction,
} from "./formulaEvaluator";
import type { CardRuleSeed } from "./cardRuleCatalogue";

export type RewardLedgerEntry = InferSelectModel<typeof rewardLedger>;
export type NewRewardLedgerEntry = InferInsertModel<typeof rewardLedger>;

export type BuildEarnLedgerInput = {
  profileId: string;
  transaction: RewardTransaction;
  cardId: string;
  rule: CardRuleSeed;
  context?: RewardEvaluationContext;
  calculatedAt: string;
};

export type BuildRefundReversalInput = {
  profileId: string;
  refundTransactionId: string;
  originalLedgerEntry: {
    id: string;
    transactionId?: string | null;
    cardId?: string | null;
    ruleId?: string | null;
    points: number;
    milesEquivalent: number;
  };
  originalTransactionAmountMinor: number;
  matchedRefundAmountMinor: number;
  calculatedAt: string;
};

export function buildPendingEarnLedgerEntry(input: BuildEarnLedgerInput): NewRewardLedgerEntry {
  const evaluation = evaluateTransactionReward(input.rule, input.transaction, input.context);
  const status = evaluation.trace.eligible && evaluation.milesEarned > 0 ? "pending" : "excluded";

  return {
    id: `ledger_${input.transaction.id}_earn`,
    profileId: input.profileId,
    transactionId: input.transaction.id,
    cardId: input.cardId,
    ruleId: input.rule.id,
    ledgerType: "earn",
    points: evaluation.pointsEarned,
    milesEquivalent: evaluation.milesEarned,
    status,
    calculationTraceJson: JSON.stringify({
      ...evaluation.trace,
      ledgerStatus: status,
    }),
    sourceModule: "rewards_formula_evaluator",
    sourceRecordId: input.rule.id,
    sourceVersion: input.rule.verifiedAt,
    calculatedAt: input.calculatedAt,
  };
}

export function buildRefundReversalLedgerEntry(
  input: BuildRefundReversalInput,
): NewRewardLedgerEntry {
  if (input.originalLedgerEntry.milesEquivalent <= 0 || input.originalLedgerEntry.points <= 0) {
    return {
      id: `ledger_${input.refundTransactionId}_reversal`,
      profileId: input.profileId,
      transactionId: input.refundTransactionId,
      cardId: input.originalLedgerEntry.cardId,
      ruleId: input.originalLedgerEntry.ruleId,
      ledgerType: "reversal",
      points: 0,
      milesEquivalent: 0,
      status: "excluded",
      calculationTraceJson: JSON.stringify({
        originalLedgerEntryId: input.originalLedgerEntry.id,
        reason: "Original ledger entry did not earn miles.",
      }),
      sourceModule: "refund_matcher",
      sourceRecordId: input.originalLedgerEntry.transactionId ?? undefined,
      sourceVersion: "FP-7.3",
      calculatedAt: input.calculatedAt,
    };
  }

  const reversalRatio = Math.min(
    1,
    Math.abs(input.matchedRefundAmountMinor) / Math.abs(input.originalTransactionAmountMinor),
  );
  const reversedMiles = Math.floor(input.originalLedgerEntry.milesEquivalent * reversalRatio);
  const reversedPoints = Math.floor(input.originalLedgerEntry.points * reversalRatio);

  return {
    id: `ledger_${input.refundTransactionId}_reversal`,
    profileId: input.profileId,
    transactionId: input.refundTransactionId,
    cardId: input.originalLedgerEntry.cardId,
    ruleId: input.originalLedgerEntry.ruleId,
    ledgerType: "reversal",
    points: -reversedPoints,
    milesEquivalent: -reversedMiles,
    status: "pending",
    calculationTraceJson: JSON.stringify({
      originalLedgerEntryId: input.originalLedgerEntry.id,
      originalTransactionId: input.originalLedgerEntry.transactionId,
      originalTransactionAmountMinor: Math.abs(input.originalTransactionAmountMinor),
      matchedRefundAmountMinor: Math.abs(input.matchedRefundAmountMinor),
      reversalRatio,
      reversedPoints,
      reversedMiles,
    }),
    sourceModule: "refund_matcher",
    sourceRecordId: input.originalLedgerEntry.transactionId ?? undefined,
    sourceVersion: "FP-7.3",
    calculatedAt: input.calculatedAt,
  };
}

export function markLedgerEntryConfirmed(
  entry: NewRewardLedgerEntry,
  status: "posted" | "reversed" | "excluded",
): NewRewardLedgerEntry {
  return {
    ...entry,
    status,
  };
}

export function insertRewardLedgerEntry(
  connection: DatabaseConnection,
  entry: NewRewardLedgerEntry,
): RewardLedgerEntry {
  return connection.db.insert(rewardLedger).values(entry).returning().get();
}

export function updateRewardLedgerStatus(
  connection: DatabaseConnection,
  id: string,
  status: "posted" | "reversed" | "excluded",
): RewardLedgerEntry | undefined {
  return connection.db
    .update(rewardLedger)
    .set({ status })
    .where(eq(rewardLedger.id, id))
    .returning()
    .get();
}
