import { eq } from "drizzle-orm";

import type { DatabaseConnection } from "../db/client";
import { categories, mccCodes, seededDataVersions } from "../db/schema";

export const mccTaxonomyDataset = {
  id: "sg_mcc_taxonomy_2026_06",
  name: "sg_mcc_taxonomy",
  version: "2026.06",
  sourceUrl: "internal://curated/sg-mcc-taxonomy",
  verifiedAt: "2026-06-25",
} as const;

export type MccCategorySeed = {
  id: string;
  name: string;
  fireExpenseGroup: string;
  isDiscretionary: boolean;
};

export type MccSeed = {
  id: string;
  code: string;
  title: string;
  networkDescription: string;
  defaultCategoryId: string;
  defaultMilesEligibility: boolean;
};

export const mccCategorySeeds: MccCategorySeed[] = [
  {
    id: "category_groceries",
    name: "Groceries",
    fireExpenseGroup: "living",
    isDiscretionary: false,
  },
  {
    id: "category_dining",
    name: "Dining",
    fireExpenseGroup: "lifestyle",
    isDiscretionary: true,
  },
  {
    id: "category_transport",
    name: "Transport",
    fireExpenseGroup: "living",
    isDiscretionary: false,
  },
  {
    id: "category_shopping",
    name: "Shopping",
    fireExpenseGroup: "lifestyle",
    isDiscretionary: true,
  },
  {
    id: "category_utilities",
    name: "Utilities",
    fireExpenseGroup: "living",
    isDiscretionary: false,
  },
  {
    id: "category_insurance",
    name: "Insurance",
    fireExpenseGroup: "protection",
    isDiscretionary: false,
  },
  {
    id: "category_government",
    name: "Government",
    fireExpenseGroup: "taxes",
    isDiscretionary: false,
  },
  {
    id: "category_healthcare",
    name: "Healthcare",
    fireExpenseGroup: "living",
    isDiscretionary: false,
  },
  {
    id: "category_financial_services",
    name: "Financial Services",
    fireExpenseGroup: "transfers",
    isDiscretionary: false,
  },
];

export const mccSeeds: MccSeed[] = [
  {
    id: "mcc_5411",
    code: "5411",
    title: "Grocery Stores And Supermarkets",
    networkDescription: "Grocery stores, supermarkets, and food markets.",
    defaultCategoryId: "category_groceries",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_5812",
    code: "5812",
    title: "Eating Places And Restaurants",
    networkDescription: "Restaurants, cafes, and eating places.",
    defaultCategoryId: "category_dining",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_4111",
    code: "4111",
    title: "Local And Suburban Commuter Passenger Transportation",
    networkDescription: "Local transport services and commuter passenger transport.",
    defaultCategoryId: "category_transport",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_4121",
    code: "4121",
    title: "Taxicabs And Limousines",
    networkDescription: "Taxi, limousine, and ride-hailing services.",
    defaultCategoryId: "category_transport",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_5311",
    code: "5311",
    title: "Department Stores",
    networkDescription: "Department stores and similar retail merchants.",
    defaultCategoryId: "category_shopping",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_5541",
    code: "5541",
    title: "Service Stations",
    networkDescription: "Fuel, petrol, and service stations.",
    defaultCategoryId: "category_transport",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_4814",
    code: "4814",
    title: "Telecommunication Services",
    networkDescription: "Telecommunication services including recurring telco bills.",
    defaultCategoryId: "category_utilities",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_4900",
    code: "4900",
    title: "Utilities",
    networkDescription: "Electric, gas, sanitary, water, and utility services.",
    defaultCategoryId: "category_utilities",
    defaultMilesEligibility: false,
  },
  {
    id: "mcc_6300",
    code: "6300",
    title: "Insurance Sales And Underwriting",
    networkDescription: "Insurance premiums, sales, and underwriting.",
    defaultCategoryId: "category_insurance",
    defaultMilesEligibility: false,
  },
  {
    id: "mcc_8062",
    code: "8062",
    title: "Hospitals",
    networkDescription: "Hospital services.",
    defaultCategoryId: "category_healthcare",
    defaultMilesEligibility: true,
  },
  {
    id: "mcc_9399",
    code: "9399",
    title: "Government Services",
    networkDescription: "Government services not elsewhere classified.",
    defaultCategoryId: "category_government",
    defaultMilesEligibility: false,
  },
  {
    id: "mcc_6012",
    code: "6012",
    title: "Financial Institutions",
    networkDescription: "Financial institutions, payment services, and quasi-cash transactions.",
    defaultCategoryId: "category_financial_services",
    defaultMilesEligibility: false,
  },
];

export type SeedMccTaxonomyResult = {
  datasetName: string;
  datasetVersion: string;
  categoriesSeeded: number;
  mccCodesSeeded: number;
};

export function seedMccTaxonomy(connection: DatabaseConnection): SeedMccTaxonomyResult {
  connection.sqlite.transaction(() => {
    for (const category of mccCategorySeeds) {
      connection.db
        .insert(categories)
        .values(category)
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            name: category.name,
            fireExpenseGroup: category.fireExpenseGroup,
            isDiscretionary: category.isDiscretionary,
          },
        })
        .run();
    }

    for (const mcc of mccSeeds) {
      connection.db
        .insert(mccCodes)
        .values(mcc)
        .onConflictDoUpdate({
          target: mccCodes.code,
          set: {
            title: mcc.title,
            networkDescription: mcc.networkDescription,
            defaultCategoryId: mcc.defaultCategoryId,
            defaultMilesEligibility: mcc.defaultMilesEligibility,
          },
        })
        .run();
    }

    connection.db
      .insert(seededDataVersions)
      .values({
        id: mccTaxonomyDataset.id,
        datasetName: mccTaxonomyDataset.name,
        datasetVersion: mccTaxonomyDataset.version,
        sourceUrl: mccTaxonomyDataset.sourceUrl,
        verifiedAt: mccTaxonomyDataset.verifiedAt,
      })
      .onConflictDoUpdate({
        target: seededDataVersions.id,
        set: {
          datasetName: mccTaxonomyDataset.name,
          datasetVersion: mccTaxonomyDataset.version,
          sourceUrl: mccTaxonomyDataset.sourceUrl,
          verifiedAt: mccTaxonomyDataset.verifiedAt,
        },
      })
      .run();
  })();

  return {
    datasetName: mccTaxonomyDataset.name,
    datasetVersion: mccTaxonomyDataset.version,
    categoriesSeeded: mccCategorySeeds.length,
    mccCodesSeeded: mccSeeds.length,
  };
}

export function getMccSeedByCode(code: string): MccSeed | undefined {
  return mccSeeds.find((seed) => seed.code === code);
}

export function getSeededMccVersion(connection: DatabaseConnection) {
  return connection.db
    .select()
    .from(seededDataVersions)
    .where(eq(seededDataVersions.id, mccTaxonomyDataset.id))
    .get();
}
