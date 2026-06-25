import { describe, expect, it } from "vitest";

import { getCardRuleSeedById } from "../../src/rewards/cardRuleCatalogue";
import {
  evaluateAggregatePeriodReward,
  evaluateTransactionReward,
  validateCardRuleFormula,
  type RewardTransaction,
} from "../../src/rewards/formulaEvaluator";

const baseTransaction: RewardTransaction = {
  id: "transaction_1",
  postedDate: "2026-06-10",
  amountMinor: -25_000,
  transactionKind: "purchase",
  channel: "online",
  categoryId: "category_shopping",
  mccCode: "5311",
  eligibleForMiles: true,
};

describe("card rule formula evaluator", () => {
  it("validates every seeded card rule formula contract", () => {
    const ruleIds = [
      "rule_citi_rewards_2026_02",
      "rule_dbs_womans_world_2025_08",
      "rule_hsbc_revolution_2026_04",
      "rule_uob_ladys_2025_08",
    ];

    for (const ruleId of ruleIds) {
      const rule = getCardRuleSeedById(ruleId);

      expect(rule).toBeDefined();
      expect(validateCardRuleFormula(rule!).valid).toBe(true);
    }
  });

  it("calculates Citi Rewards 4 mpd online earn and excludes in-app mobile wallets", () => {
    const rule = getCardRuleSeedById("rule_citi_rewards_2026_02")!;

    expect(evaluateTransactionReward(rule, baseTransaction)).toMatchObject({
      milesEarned: 1_000,
      pointsEarned: 2_500,
      trace: {
        eligible: true,
        bonusSpendMinor: 25_000,
        excessSpendMinor: 0,
        roundingMode: "floor_per_transaction",
      },
    });
    expect(
      evaluateTransactionReward(rule, {
        ...baseTransaction,
        id: "transaction_wallet",
        walletType: "in_app_mobile_wallet",
      }).trace,
    ).toMatchObject({
      eligible: false,
      milesEarned: 0,
      eligibilityReasons: ["Wallet type in_app_mobile_wallet is excluded."],
    });
  });

  it("applies DBS Woman's World cap and excess earn rate", () => {
    const rule = getCardRuleSeedById("rule_dbs_womans_world_2025_08")!;
    const result = evaluateTransactionReward(
      rule,
      {
        ...baseTransaction,
        id: "transaction_dbs",
        amountMinor: -20_000,
      },
      { priorQualifiedSpendMinor: 90_000 },
    );

    expect(result).toMatchObject({
      milesEarned: 440,
      pointsEarned: 220,
      trace: {
        capRemainingBeforeMinor: 10_000,
        bonusSpendMinor: 10_000,
        excessSpendMinor: 10_000,
      },
    });
  });

  it("enforces HSBC Revolution category and channel eligibility", () => {
    const rule = getCardRuleSeedById("rule_hsbc_revolution_2026_04")!;

    expect(
      evaluateTransactionReward(rule, {
        ...baseTransaction,
        id: "transaction_hsbc",
        channel: "contactless",
        categoryId: "category_dining",
        amountMinor: -12_345,
      }),
    ).toMatchObject({
      milesEarned: 492,
      trace: {
        eligible: true,
        roundedSpendMinor: 12_300,
      },
    });
    expect(
      evaluateTransactionReward(rule, {
        ...baseTransaction,
        id: "transaction_hsbc_bad",
        channel: "offline",
        categoryId: "category_dining",
      }).trace,
    ).toMatchObject({
      eligible: false,
      eligibilityReasons: ["Channel offline is not eligible."],
    });
  });

  it("uses UOB Lady's aggregate-period rounding with selected categories", () => {
    const rule = getCardRuleSeedById("rule_uob_ladys_2025_08")!;
    const result = evaluateAggregatePeriodReward(
      rule,
      [
        {
          ...baseTransaction,
          id: "transaction_uob_1",
          amountMinor: -250,
          channel: "offline",
          categoryId: "category_dining",
        },
        {
          ...baseTransaction,
          id: "transaction_uob_2",
          amountMinor: -250,
          channel: "contactless",
          categoryId: "category_dining",
        },
        {
          ...baseTransaction,
          id: "transaction_uob_3",
          amountMinor: -500,
          channel: "online",
          categoryId: "category_shopping",
        },
      ],
      { selectedCategoryIds: ["category_dining"] },
    );

    expect(result).toMatchObject({
      milesEarned: 20,
      pointsEarned: 10,
      trace: {
        eligible: true,
        qualifiedSpendMinor: 500,
        roundedSpendMinor: 500,
        roundingMode: "aggregate_period",
      },
    });
  });

  it("prevents refunded and explicitly ineligible transactions from earning miles", () => {
    const rule = getCardRuleSeedById("rule_citi_rewards_2026_02")!;

    expect(
      evaluateTransactionReward(rule, {
        ...baseTransaction,
        id: "transaction_refund",
        transactionKind: "refund",
        amountMinor: 10_000,
      }).trace,
    ).toMatchObject({
      eligible: false,
      milesEarned: 0,
      eligibilityReasons: ["Refund transactions do not earn miles."],
    });
    expect(
      evaluateTransactionReward(rule, {
        ...baseTransaction,
        id: "transaction_ineligible",
        eligibleForMiles: false,
      }).trace,
    ).toMatchObject({
      eligible: false,
      milesEarned: 0,
      eligibilityReasons: ["Transaction is marked ineligible for miles."],
    });
  });
});
