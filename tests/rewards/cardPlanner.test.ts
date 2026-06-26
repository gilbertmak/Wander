import { describe, expect, it } from "vitest";

import {
  createPlannedPurchase,
  matchPlannedPurchase,
  rankCardsForPurchase,
  toPlannedPurchaseInsert,
} from "../../src/rewards/cardPlanner";
import { cardRuleSeeds } from "../../src/rewards/cardRuleCatalogue";

const purchase = {
  profileId: "profile_1",
  merchantText: "haidilao",
  amountMinor: 12_000,
  currency: "SGD",
  categoryId: "category_dining",
  mccCode: "5812",
  channel: "contactless" as const,
  plannedDate: "2026-06-28",
};

describe("use this card planner", () => {
  it("ranks eligible cards by expected miles and cap context", () => {
    const [best] = rankCardsForPurchase(purchase, { cardRules: cardRuleSeeds });

    expect(best.expectedMiles).toBeGreaterThan(0);
    expect(best.cardId).toMatch(/card_/);
    expect(best.capRemainingMinor).toBeGreaterThan(0);
  });

  it("keeps capped-out cards from ranking first", () => {
    const cappedRule = cardRuleSeeds.find((rule) => rule.cardId === "card_hsbc_revolution")!;
    const recommendations = rankCardsForPurchase(purchase, {
      cardRules: cardRuleSeeds,
      priorQualifiedSpendByRuleId: { [cappedRule.id]: cappedRule.capAmountMinor },
    });

    expect(recommendations[0].ruleId).not.toBe(cappedRule.id);
    expect(
      recommendations.find((recommendation) => recommendation.ruleId === cappedRule.id)?.caveats,
    ).toContain("Bonus cap is exhausted.");
  });

  it("warns when excluded MCCs make cards ineligible", () => {
    const recommendations = rankCardsForPurchase(
      { ...purchase, channel: "online", mccCode: "9399" },
      { cardRules: cardRuleSeeds },
    );

    expect(recommendations.every((recommendation) => recommendation.expectedMiles === 0)).toBe(
      true,
    );
    expect(recommendations[0].caveats.join(" ")).toContain("MCC 9399 is excluded");
  });

  it("lowers confidence for unknown MCC recommendations", () => {
    const [best] = rankCardsForPurchase(
      { ...purchase, mccCode: undefined },
      { cardRules: cardRuleSeeds },
    );

    expect(best.confidenceScore).toBeLessThan(0.9);
    expect(best.caveats).toContain("Unknown MCC lowers recommendation confidence.");
  });

  it("saves planned purchases without ledger output", () => {
    const [best] = rankCardsForPurchase(purchase, { cardRules: cardRuleSeeds });
    const planned = createPlannedPurchase(purchase, best);
    const insert = toPlannedPurchaseInsert(planned);

    expect(planned.status).toBe("planned");
    expect(insert).not.toHaveProperty("ledgerType");
    expect(insert.recommendedCardId).toBe(best.cardId);
  });

  it("matches imported transactions back to planned purchases", () => {
    const [best] = rankCardsForPurchase(purchase, { cardRules: cardRuleSeeds });
    const planned = createPlannedPurchase(purchase, best);
    const matched = matchPlannedPurchase(planned, {
      id: "transaction_1",
      postedDate: "2026-06-28",
      amountMinor: -12_000,
      descriptionNormalized: "haidilao marina bay",
      categoryId: "category_dining",
      cardId: best.cardId,
    });

    expect(matched).toMatchObject({
      status: "matched",
      matchedTransactionId: "transaction_1",
    });
  });
});
