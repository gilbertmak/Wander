import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { cardRules, cards, redemptionPrograms } from "../../src/db/schema";
import {
  cardRuleSeeds,
  cardSeeds,
  getCardRuleSeedById,
  getSeededCardRuleVersion,
  redemptionProgramSeeds,
  seedCardRuleCatalogue,
} from "../../src/rewards/cardRuleCatalogue";

describe("card rule catalogue seed", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
    runMigrations(connection);
  });

  afterEach(() => {
    connection.close();
  });

  it("seeds required Singapore card rules and source metadata", () => {
    const result = seedCardRuleCatalogue(connection);

    expect(result).toEqual({
      datasetName: "sg_card_rule_catalogue",
      datasetVersion: "2026.06",
      cardsSeeded: cardSeeds.length,
      rulesSeeded: cardRuleSeeds.length,
      redemptionProgramsSeeded: redemptionProgramSeeds.length,
    });
    expect(connection.db.select().from(cards).all()).toHaveLength(4);
    expect(connection.db.select().from(cardRules).all()).toHaveLength(4);
    expect(connection.db.select().from(redemptionPrograms).all()).toHaveLength(4);
    expect(getSeededCardRuleVersion(connection)).toMatchObject({
      datasetName: "sg_card_rule_catalogue",
      datasetVersion: "2026.06",
      sourceUrl: "https://milelion.com/",
    });
  });

  it("stores source-backed rules for the four required cards", () => {
    seedCardRuleCatalogue(connection);

    const seededCards = connection.db.select().from(cards).all();
    const seededRules = connection.db.select().from(cardRules).all();

    expect(seededCards.map((card) => card.cardName).sort()).toEqual([
      "Citi Rewards Card",
      "DBS Woman's World Card",
      "HSBC Revolution Card",
      "UOB Lady's Card",
    ]);
    expect(seededRules.every((rule) => rule.sourceType === "milelion_review")).toBe(true);
    expect(
      seededRules.every((rule) => rule.sourceUrl.startsWith("https://milelion.com/")),
    ).toBe(true);
  });

  it("captures card-specific caps, periods, eligibility, and transfer blocks", () => {
    seedCardRuleCatalogue(connection);

    const citi = connection.db
      .select()
      .from(cardRules)
      .where(eq(cardRules.id, "rule_citi_rewards_2026_02"))
      .get();
    const hsbc = connection.db
      .select()
      .from(cardRules)
      .where(eq(cardRules.id, "rule_hsbc_revolution_2026_04"))
      .get();
    const uob = connection.db
      .select()
      .from(cardRules)
      .where(eq(cardRules.id, "rule_uob_ladys_2025_08"))
      .get();

    expect(citi).toMatchObject({
      capPeriod: "statement_month",
      capAmountMinor: 100_000,
    });
    expect(JSON.parse(citi?.eligibilityJson ?? "{}")).toMatchObject({
      channels: ["online", "offline"],
    });
    expect(JSON.parse(hsbc?.eligibilityJson ?? "{}")).toMatchObject({
      channels: ["online", "contactless"],
      categoryIds: ["category_dining", "category_shopping", "category_transport"],
    });
    expect(JSON.parse(uob?.eligibilityJson ?? "{}")).toMatchObject({
      selectedCategoryCount: 1,
    });
    expect(JSON.parse(uob?.transferRuleJson ?? "{}")).toMatchObject({
      redemptionProgramId: "program_uob_unidollars",
      minimumTransferPoints: 5_000,
      transferBlockPoints: 5_000,
    });
  });

  it("is idempotent when seeded more than once", () => {
    seedCardRuleCatalogue(connection);
    seedCardRuleCatalogue(connection);

    expect(connection.db.select().from(cards).all()).toHaveLength(cardSeeds.length);
    expect(connection.db.select().from(cardRules).all()).toHaveLength(cardRuleSeeds.length);
    expect(connection.db.select().from(redemptionPrograms).all()).toHaveLength(
      redemptionProgramSeeds.length,
    );
  });

  it("exposes rule seed records for the formula evaluator", () => {
    expect(getCardRuleSeedById("rule_dbs_womans_world_2025_08")).toMatchObject({
      cardId: "card_dbs_womans_world",
      capPeriod: "calendar_month",
      capAmountMinor: 100_000,
      bonusFormula: {
        milesPerDollar: 4,
        excessMilesPerDollar: 0.4,
      },
    });
    expect(getCardRuleSeedById("missing")).toBeUndefined();
  });
});
