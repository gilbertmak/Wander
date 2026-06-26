import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getCardRuleSeedById } from "../../src/rewards/cardRuleCatalogue";
import {
  evaluateAggregatePeriodReward,
  evaluateTransactionReward,
  type RewardTransaction,
} from "../../src/rewards/formulaEvaluator";

const baseTransaction: RewardTransaction = {
  id: "transaction_fixture",
  postedDate: "2026-06-10",
  amountMinor: -25_000,
  transactionKind: "purchase",
  channel: "online",
  categoryId: "category_shopping",
  mccCode: "5311",
  eligibleForMiles: true,
};

describe("golden card formula fixtures", () => {
  it("matches stored reward formula fixture outputs", () => {
    const expected = JSON.parse(
      readFileSync(join("tests", "fixtures", "golden", "cardFormula.expected.json"), "utf8"),
    ) as {
      citiRewardsOnline250: Record<string, number>;
      dbsCapOverflow: Record<string, number>;
      uobAggregateTwoSmallDining: Record<string, number>;
    };

    const citi = evaluateTransactionReward(getCardRuleSeedById("rule_citi_rewards_2026_02")!, baseTransaction);
    const dbs = evaluateTransactionReward(
      getCardRuleSeedById("rule_dbs_womans_world_2025_08")!,
      { ...baseTransaction, amountMinor: -20_000 },
      { priorQualifiedSpendMinor: 90_000 },
    );
    const uob = evaluateAggregatePeriodReward(
      getCardRuleSeedById("rule_uob_ladys_2025_08")!,
      [
        { ...baseTransaction, id: "uob_1", amountMinor: -250, channel: "offline", categoryId: "category_dining" },
        { ...baseTransaction, id: "uob_2", amountMinor: -250, channel: "contactless", categoryId: "category_dining" },
      ],
      { selectedCategoryIds: ["category_dining"] },
    );

    expect({
      milesEarned: citi.milesEarned,
      pointsEarned: citi.pointsEarned,
      bonusSpendMinor: citi.trace.bonusSpendMinor,
      excessSpendMinor: citi.trace.excessSpendMinor,
    }).toEqual(expected.citiRewardsOnline250);
    expect({
      milesEarned: dbs.milesEarned,
      pointsEarned: dbs.pointsEarned,
      bonusSpendMinor: dbs.trace.bonusSpendMinor,
      excessSpendMinor: dbs.trace.excessSpendMinor,
    }).toEqual(expected.dbsCapOverflow);
    expect({
      milesEarned: uob.milesEarned,
      pointsEarned: uob.pointsEarned,
      qualifiedSpendMinor: uob.trace.qualifiedSpendMinor,
      roundedSpendMinor: uob.trace.roundedSpendMinor,
    }).toEqual(expected.uobAggregateTwoSmallDining);
  });
});
