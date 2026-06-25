import { describe, expect, it } from "vitest";

import { getCardRuleSeedById } from "../../src/rewards/cardRuleCatalogue";
import {
  calculateRewardProjection,
  calculateSpendToNextChunkMinor,
} from "../../src/rewards/redeemableProjection";

describe("redeemable reward projection", () => {
  it("calculates accumulated, pending, reversed, and redeemable miles by card", () => {
    const citiRule = getCardRuleSeedById("rule_citi_rewards_2026_02")!;
    const dbsRule = getCardRuleSeedById("rule_dbs_womans_world_2025_08")!;

    const [citi, dbs] = calculateRewardProjection({
      cardRules: [citiRule, dbsRule],
      ledgerEntries: [
        {
          cardId: "card_citi_rewards",
          ruleId: citiRule.id,
          points: 25_000,
          milesEquivalent: 10_000,
          status: "posted",
        },
        {
          cardId: "card_citi_rewards",
          ruleId: citiRule.id,
          points: 2_500,
          milesEquivalent: 1_000,
          status: "pending",
        },
        {
          cardId: "card_citi_rewards",
          ruleId: citiRule.id,
          points: -1_000,
          milesEquivalent: -400,
          status: "pending",
        },
        {
          cardId: "card_citi_rewards",
          ruleId: citiRule.id,
          points: 999_999,
          milesEquivalent: 999_999,
          status: "excluded",
        },
        {
          cardId: "card_dbs_womans_world",
          ruleId: dbsRule.id,
          points: 4_900,
          milesEquivalent: 9_800,
          status: "posted",
        },
      ],
      periodQualifiedSpendByRuleId: {
        [citiRule.id]: 80_000,
        [dbsRule.id]: 20_000,
      },
    });

    expect(citi).toMatchObject({
      cardId: "card_citi_rewards",
      accumulatedMiles: 10_600,
      postedMiles: 10_000,
      pendingMiles: 1_000,
      reversedMiles: 400,
      pointsBalance: 26_500,
      redeemableMiles: 10_000,
      nextTransferBlockPoints: 25_000,
      pointsToNextTransferBlock: 23_500,
      capRemainingMinor: 20_000,
      cappedBeforeNextChunk: true,
    });
    expect(dbs).toMatchObject({
      cardId: "card_dbs_womans_world",
      pointsBalance: 4_900,
      redeemableMiles: 0,
      pointsToNextTransferBlock: 100,
      capRemainingMinor: 80_000,
      cappedBeforeNextChunk: false,
    });
  });

  it("calculates spend required for the next redeemable chunk", () => {
    expect(calculateSpendToNextChunkMinor(100, 0.5, 4)).toBe(5_000);
    expect(calculateSpendToNextChunkMinor(23_500, 2.5, 4)).toBe(235_000);
    expect(calculateSpendToNextChunkMinor(0, 2.5, 4)).toBe(0);
  });

  it("treats an exact transfer-block balance as needing a full next block", () => {
    const rule = getCardRuleSeedById("rule_uob_ladys_2025_08")!;
    const [projection] = calculateRewardProjection({
      cardRules: [rule],
      ledgerEntries: [
        {
          cardId: rule.cardId,
          ruleId: rule.id,
          points: 5_000,
          milesEquivalent: 10_000,
          status: "posted",
        },
      ],
    });

    expect(projection).toMatchObject({
      redeemableMiles: 10_000,
      pointsToNextTransferBlock: 5_000,
      spendToNextRedeemableChunkMinor: 250_000,
    });
  });
});
