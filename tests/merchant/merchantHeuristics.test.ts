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

  it.each([
    ["MCC-001", "GRAB *TRIP SINGAPORE", "Grab", "category_transport", "4121"],
    ["MCC-002", "GRABFOOD SG", "GrabFood", "category_dining", "5814"],
    ["MCC-003", "NTUC FP AMK HUB SINGAPORE", "FairPrice", "category_groceries", "5411"],
    ["MCC-004", "COLD STORAGE BUGIS JUNCTION", "Cold Storage", "category_groceries", "5411"],
    ["MCC-005", "SHOPEE SINGAPORE 240619", "Shopee", "category_shopping", "5311"],
    ["MCC-006", "LAZADA SG MARKETPLACE", "Lazada", "category_shopping", "5311"],
    ["MCC-007", "APPLE.COM/BILL ITUNES.COM", "Apple App Store", "category_digital_services", "5815"],
    ["MCC-008", "NETFLIX.COM SINGAPORE", "Netflix", "category_digital_services", "5815"],
    ["MCC-009", "SHELL TAMPINES", "Shell", "category_transport", "5541"],
    ["MCC-010", "SINGAPORE AIRLINES", "Singapore Airlines", "category_travel", "4511"],
    ["MCC-011", "MCDONALD'S RESTAURANT", "McDonald's", "category_dining", "5812"],
    ["MCC-012", "RAFFLES CLINIC", "Clinic", "category_healthcare", "8062"],
    ["MCC-013", "IRAS TAX PAYMENT", "IRAS", "category_government", "9399"],
    ["MCC-014", "NTUC INCOME INSURANCE", "NTUC Income", "category_insurance", "6300"],
    ["MCC-015", "SCHOOL FEE PAYMENT", "School Fees", "category_education", "8211"],
    ["MCC-016", "CARDUP BILL PAYMENT", "CardUp", "category_financial_services", "6012"],
    ["MCC-018", "CREDIT CARD PAYMENT THANK YOU", "Credit Card Bill Payment", "category_financial_services", "6012"],
  ])("resolves %s golden merchant text", (_evalId, text, canonicalName, categoryId, mccCode) => {
    expect(resolveMerchant(text)).toMatchObject({
      canonicalName,
      categoryId,
      mccCode,
    });
  });
});
