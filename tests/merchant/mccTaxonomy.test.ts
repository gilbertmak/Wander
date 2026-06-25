import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { categories, mccCodes } from "../../src/db/schema";
import {
  getMccSeedByCode,
  getSeededMccVersion,
  mccCategorySeeds,
  mccSeeds,
  seedMccTaxonomy,
} from "../../src/merchant/mccTaxonomy";

describe("MCC taxonomy seed", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
    runMigrations(connection);
  });

  afterEach(() => {
    connection.close();
  });

  it("seeds MCC categories, codes, and dataset version metadata", () => {
    const result = seedMccTaxonomy(connection);

    expect(result).toMatchObject({
      datasetName: "sg_mcc_taxonomy",
      datasetVersion: "2026.06",
      categoriesSeeded: mccCategorySeeds.length,
      mccCodesSeeded: mccSeeds.length,
    });

    const categoryCount = connection.db.select().from(categories).all();
    const mccCount = connection.db.select().from(mccCodes).all();
    const version = getSeededMccVersion(connection);

    expect(categoryCount).toHaveLength(mccCategorySeeds.length);
    expect(mccCount).toHaveLength(mccSeeds.length);
    expect(version).toMatchObject({
      datasetName: "sg_mcc_taxonomy",
      datasetVersion: "2026.06",
      sourceUrl: "internal://curated/sg-mcc-taxonomy",
    });
  });

  it("sets default category and miles eligibility for spend and exclusion MCCs", () => {
    seedMccTaxonomy(connection);

    const diningMcc = connection.db.select().from(mccCodes).where(eq(mccCodes.code, "5812")).get();
    const utilityMcc = connection.db.select().from(mccCodes).where(eq(mccCodes.code, "4900")).get();
    const governmentMcc = connection.db.select().from(mccCodes).where(eq(mccCodes.code, "9399")).get();

    expect(diningMcc).toMatchObject({
      defaultCategoryId: "category_dining",
      defaultMilesEligibility: true,
    });
    expect(utilityMcc).toMatchObject({
      defaultCategoryId: "category_utilities",
      defaultMilesEligibility: false,
    });
    expect(governmentMcc).toMatchObject({
      defaultCategoryId: "category_government",
      defaultMilesEligibility: false,
    });
  });

  it("is idempotent when the taxonomy is seeded more than once", () => {
    seedMccTaxonomy(connection);
    seedMccTaxonomy(connection);

    expect(connection.db.select().from(categories).all()).toHaveLength(mccCategorySeeds.length);
    expect(connection.db.select().from(mccCodes).all()).toHaveLength(mccSeeds.length);
  });

  it("looks up MCC seed records by code for resolver bootstrapping", () => {
    expect(getMccSeedByCode("5411")).toMatchObject({
      code: "5411",
      defaultCategoryId: "category_groceries",
      defaultMilesEligibility: true,
    });
    expect(getMccSeedByCode("0000")).toBeUndefined();
  });
});
