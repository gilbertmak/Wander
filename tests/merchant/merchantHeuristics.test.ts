import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { merchantHeuristics, merchants } from "../../src/db/schema";
import {
  getMccSeedForMerchantResolution,
  getSeededHeuristicById,
  getSeededMerchantById,
  merchantHeuristicSeeds,
  merchantSeeds,
  normalizeMerchantText,
  resolveMerchant,
  seedMerchantHeuristics,
} from "../../src/merchant/merchantHeuristics";

describe("merchant heuristics", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
    runMigrations(connection);
  });

  afterEach(() => {
    connection.close();
  });

  it("seeds canonical merchants and text heuristics", () => {
    const result = seedMerchantHeuristics(connection);

    expect(result).toEqual({
      merchantsSeeded: merchantSeeds.length,
      heuristicsSeeded: merchantHeuristicSeeds.length,
    });
    expect(connection.db.select().from(merchants).all()).toHaveLength(merchantSeeds.length);
    expect(connection.db.select().from(merchantHeuristics).all()).toHaveLength(merchantHeuristicSeeds.length);
    expect(getSeededMerchantById(connection, "merchant_grab")).toMatchObject({
      canonicalName: "Grab",
      defaultCategoryId: "category_transport",
      defaultMccId: "mcc_4121",
    });
    expect(getSeededHeuristicById(connection, "heuristic_sp_services")).toMatchObject({
      merchantId: "merchant_sp_services",
      mccId: "mcc_4900",
      categoryId: "category_utilities",
      source: "seed",
    });
  });

  it("is idempotent when merchant heuristics are seeded more than once", () => {
    seedMerchantHeuristics(connection);
    seedMerchantHeuristics(connection);

    expect(connection.db.select().from(merchants).all()).toHaveLength(merchantSeeds.length);
    expect(connection.db.select().from(merchantHeuristics).all()).toHaveLength(merchantHeuristicSeeds.length);
  });

  it("resolves Singapore merchant statement text to category, MCC, confidence, and explanation", () => {
    expect(resolveMerchant("GRAB *TRIP SINGAPORE")).toMatchObject({
      merchantId: "merchant_grab",
      canonicalName: "Grab",
      categoryId: "category_transport",
      mccCode: "4121",
      confidenceScore: 0.96,
      explanation: 'Matched Grab using contains pattern "grab trip".',
    });
    expect(resolveMerchant("SP SERVICES UTILITIES")).toMatchObject({
      canonicalName: "SP Services",
      categoryId: "category_utilities",
      mccCode: "4900",
      confidenceScore: 0.95,
    });
  });

  it("uses regex and prefix patterns where statement text varies", () => {
    expect(resolveMerchant("MC DONALD'S SG")).toMatchObject({
      merchantId: "merchant_mcdonalds",
      categoryId: "category_dining",
      mccCode: "5812",
    });
    expect(resolveMerchant("AXS PAYMENT SINGAPORE")).toMatchObject({
      merchantId: "merchant_axs",
      categoryId: "category_government",
      mccCode: "9399",
    });
  });

  it("normalizes noisy statement text and leaves unknown merchants unresolved", () => {
    expect(normalizeMerchantText("  NTUC-FP #1234 / SG ")).toBe("ntuc fp 1234 sg");
    expect(resolveMerchant("UNKNOWN MERCHANT 123")).toBeUndefined();
  });

  it("exposes MCC seed metadata for downstream resolver bootstrapping", () => {
    expect(getMccSeedForMerchantResolution("4900")).toMatchObject({
      code: "4900",
      defaultCategoryId: "category_utilities",
      defaultMilesEligibility: false,
    });
  });
});
