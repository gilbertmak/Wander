import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { merchantHeuristics, merchants } from "../../src/db/schema";
import { learnMerchantHeuristic } from "../../src/merchant/learningLoop";
import {
  merchantHeuristicSeeds,
  merchantSeeds,
  resolveMerchant,
} from "../../src/merchant/merchantHeuristics";

describe("merchant learning loop", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
    runMigrations(connection);
  });

  afterEach(() => {
    connection.close();
  });

  it("creates a learned heuristic from a category correction and uses it for future resolution", () => {
    const learned = learnMerchantHeuristic(connection, {
      transactionId: "transaction_1",
      descriptionNormalized: "blue bottle coffee singapore",
      correctedCategoryId: "category_dining",
      canonicalMerchantName: "Blue Bottle Coffee",
      confidenceScore: 0.88,
      correctedAt: "2026-06-25T01:00:00.000Z",
    });

    expect(
      connection.db.select().from(merchants).where(eq(merchants.id, learned.merchant.id)).get(),
    ).toMatchObject({
      canonicalName: "Blue Bottle Coffee",
      defaultCategoryId: "category_dining",
    });
    expect(
      connection.db
        .select()
        .from(merchantHeuristics)
        .where(eq(merchantHeuristics.id, learned.heuristic.id))
        .get(),
    ).toMatchObject({
      aliasText: "blue bottle coffee singapore",
      categoryId: "category_dining",
      categoryOverrideId: "category_dining",
      sourceTransactionId: "transaction_1",
      ruleVersion: "user-v1",
      source: "user_correction",
      confidenceScore: 0.88,
    });
    expect(
      resolveMerchant("BLUE BOTTLE COFFEE SINGAPORE #01", {
        merchantRecords: [...merchantSeeds, learned.merchant],
        heuristicRecords: [learned.heuristic, ...merchantHeuristicSeeds],
      }),
    ).toMatchObject({
      canonicalName: "Blue Bottle Coffee",
      categoryId: "category_dining",
      confidenceScore: 0.88,
      source: "user_correction",
    });
  });

  it("learns MCC corrections and carries default category plus MCC into future resolution", () => {
    const learned = learnMerchantHeuristic(connection, {
      transactionId: "transaction_2",
      descriptionNormalized: "town council payment",
      correctedMccCode: "9399",
      canonicalMerchantName: "Town Council",
      correctedAt: "2026-06-25T02:00:00.000Z",
    });

    expect(learned.heuristic).toMatchObject({
      categoryId: "category_government",
      mccId: "mcc_9399",
      source: "user_correction",
      confidenceScore: 0.82,
    });
    expect(
      resolveMerchant("TOWN COUNCIL PAYMENT", {
        merchantRecords: [...merchantSeeds, learned.merchant],
        heuristicRecords: [learned.heuristic, ...merchantHeuristicSeeds],
      }),
    ).toMatchObject({
      canonicalName: "Town Council",
      categoryId: "category_government",
      mccCode: "9399",
    });
  });

  it("updates an existing learned rule for the same merchant and normalized text", () => {
    const first = learnMerchantHeuristic(connection, {
      transactionId: "transaction_3",
      descriptionNormalized: "gym membership orchard",
      correctedCategoryId: "category_healthcare",
      confidenceScore: 0.76,
      correctedAt: "2026-06-25T03:00:00.000Z",
    });
    const second = learnMerchantHeuristic(connection, {
      transactionId: "transaction_4",
      descriptionNormalized: "gym membership orchard",
      correctedCategoryId: "category_healthcare",
      confidenceScore: 0.91,
      correctedAt: "2026-06-25T04:00:00.000Z",
    });

    expect(second.heuristic.id).toBe(first.heuristic.id);
    expect(connection.db.select().from(merchantHeuristics).all()).toHaveLength(1);
    expect(
      connection.db
        .select()
        .from(merchantHeuristics)
        .where(eq(merchantHeuristics.id, first.heuristic.id))
        .get(),
    ).toMatchObject({
      confidenceScore: 0.91,
      verifiedAt: "2026-06-25T04:00:00.000Z",
      sourceTransactionId: "transaction_4",
    });
  });

  it("prioritizes learned local rules over seeded heuristics", () => {
    const learnedGrab = learnMerchantHeuristic(connection, {
      transactionId: "transaction_7",
      descriptionNormalized: "grab",
      correctedMccCode: "5814",
      merchantId: "merchant_grabfood",
      canonicalMerchantName: "GrabFood",
      confidenceScore: 0.8,
      correctedAt: "2026-06-25T05:00:00.000Z",
    });

    expect(
      resolveMerchant("GRAB *TRIP SINGAPORE", {
        merchantRecords: merchantSeeds,
        heuristicRecords: [...merchantHeuristicSeeds, learnedGrab.heuristic],
      }),
    ).toMatchObject({
      canonicalName: "GrabFood",
      mccCode: "5814",
      source: "user_correction",
    });
  });

  it("requires at least one correction field and validates MCC codes", () => {
    expect(() =>
      learnMerchantHeuristic(connection, {
        transactionId: "transaction_5",
        descriptionNormalized: "empty correction",
      }),
    ).toThrow(/category or MCC correction/i);

    expect(() =>
      learnMerchantHeuristic(connection, {
        transactionId: "transaction_6",
        descriptionNormalized: "unknown mcc",
        correctedMccCode: "0000",
      }),
    ).toThrow(/Unknown MCC code 0000/i);
  });
});
