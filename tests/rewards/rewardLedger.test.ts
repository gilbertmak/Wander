import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { createRepositories } from "../../src/db/repositories";
import { getCardRuleSeedById, seedCardRuleCatalogue } from "../../src/rewards/cardRuleCatalogue";
import type { RewardTransaction } from "../../src/rewards/formulaEvaluator";
import {
  buildPendingEarnLedgerEntry,
  buildRefundReversalLedgerEntry,
  insertRewardLedgerEntry,
  markLedgerEntryConfirmed,
  updateRewardLedgerStatus,
} from "../../src/rewards/rewardLedger";

const purchase: RewardTransaction = {
  id: "transaction_purchase",
  postedDate: "2026-06-15",
  amountMinor: -25_000,
  transactionKind: "purchase",
  channel: "online",
  categoryId: "category_shopping",
  mccCode: "5311",
  eligibleForMiles: true,
};

describe("reward ledger", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
    runMigrations(connection);
  });

  afterEach(() => {
    connection.close();
  });

  it("creates a pending earn ledger entry from formula evaluation", () => {
    const rule = getCardRuleSeedById("rule_citi_rewards_2026_02")!;
    const entry = buildPendingEarnLedgerEntry({
      profileId: "profile_1",
      transaction: purchase,
      cardId: "card_citi_rewards",
      rule,
      calculatedAt: "2026-06-25T00:00:00.000Z",
    });

    expect(entry).toMatchObject({
      id: "ledger_transaction_purchase_earn",
      profileId: "profile_1",
      transactionId: "transaction_purchase",
      cardId: "card_citi_rewards",
      ruleId: "rule_citi_rewards_2026_02",
      ledgerType: "earn",
      points: 2_500,
      milesEquivalent: 1_000,
      status: "pending",
      sourceModule: "rewards_formula_evaluator",
      sourceVersion: "2026-06-25",
    });
    expect(JSON.parse(entry.calculationTraceJson ?? "{}")).toMatchObject({
      eligible: true,
      bonusSpendMinor: 25_000,
      ledgerStatus: "pending",
    });
  });

  it("creates an excluded earn ledger entry for refunded transactions", () => {
    const rule = getCardRuleSeedById("rule_citi_rewards_2026_02")!;
    const entry = buildPendingEarnLedgerEntry({
      profileId: "profile_1",
      transaction: {
        ...purchase,
        id: "transaction_refund",
        amountMinor: 10_000,
        transactionKind: "refund",
      },
      cardId: "card_citi_rewards",
      rule,
      calculatedAt: "2026-06-25T00:00:00.000Z",
    });

    expect(entry).toMatchObject({
      ledgerType: "earn",
      points: 0,
      milesEquivalent: 0,
      status: "excluded",
    });
    expect(JSON.parse(entry.calculationTraceJson ?? "{}")).toMatchObject({
      eligible: false,
      eligibilityReasons: ["Refund transactions do not earn miles."],
      ledgerStatus: "excluded",
    });
  });

  it("creates proportional refund reversal entries from the original earn ledger", () => {
    const originalEntry = buildPendingEarnLedgerEntry({
      profileId: "profile_1",
      transaction: purchase,
      cardId: "card_citi_rewards",
      rule: getCardRuleSeedById("rule_citi_rewards_2026_02")!,
      calculatedAt: "2026-06-25T00:00:00.000Z",
    });
    const reversal = buildRefundReversalLedgerEntry({
      profileId: "profile_1",
      refundTransactionId: "transaction_refund",
      originalLedgerEntry: originalEntry,
      originalTransactionAmountMinor: 25_000,
      matchedRefundAmountMinor: 10_000,
      calculatedAt: "2026-06-25T01:00:00.000Z",
    });

    expect(reversal).toMatchObject({
      id: "ledger_transaction_refund_reversal",
      ledgerType: "reversal",
      points: -1_000,
      milesEquivalent: -400,
      status: "pending",
      sourceModule: "refund_matcher",
    });
    expect(JSON.parse(reversal.calculationTraceJson ?? "{}")).toMatchObject({
      originalLedgerEntryId: "ledger_transaction_purchase_earn",
      matchedRefundAmountMinor: 10_000,
      reversedMiles: 400,
      reversedPoints: 1_000,
    });
  });

  it("marks ledger entries confirmed after statement confirmation", () => {
    const rule = getCardRuleSeedById("rule_citi_rewards_2026_02")!;
    const entry = buildPendingEarnLedgerEntry({
      profileId: "profile_1",
      transaction: purchase,
      cardId: "card_citi_rewards",
      rule,
      calculatedAt: "2026-06-25T00:00:00.000Z",
    });

    expect(markLedgerEntryConfirmed(entry, "posted")).toMatchObject({
      id: entry.id,
      status: "posted",
    });
  });

  it("persists ledger entries and updates confirmation status", () => {
    seedCardRuleCatalogue(connection);
    const repositories = createRepositories(connection);
    const rule = getCardRuleSeedById("rule_citi_rewards_2026_02")!;

    repositories.profiles.create({ id: "profile_1", name: "Primary", currency: "SGD" });
    repositories.transactions.create({
      id: purchase.id,
      profileId: "profile_1",
      postedDate: purchase.postedDate,
      descriptionRaw: "SHOPEE SINGAPORE",
      descriptionNormalized: "shopee singapore",
      amountMinor: purchase.amountMinor,
      direction: "debit",
      transactionKind: "purchase",
      cardId: "card_citi_rewards",
      eligibleForMiles: true,
      confidenceScore: 0.95,
      needsReview: false,
      transactionFingerprint: "fingerprint_purchase",
    });

    const inserted = insertRewardLedgerEntry(
      connection,
      buildPendingEarnLedgerEntry({
        profileId: "profile_1",
        transaction: purchase,
        cardId: "card_citi_rewards",
        rule,
        calculatedAt: "2026-06-25T00:00:00.000Z",
      }),
    );
    const updated = updateRewardLedgerStatus(connection, inserted.id, "posted");

    expect(inserted.status).toBe("pending");
    expect(updated).toMatchObject({
      id: inserted.id,
      status: "posted",
      milesEquivalent: 1_000,
    });
    expect(repositories.rewardLedger.listForProfile("profile_1")).toHaveLength(1);
  });
});
