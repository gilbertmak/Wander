import { eq } from "drizzle-orm";

import type { DatabaseConnection } from "../db/client";
import { merchantHeuristics, merchants } from "../db/schema";
import { getMccSeedByCode, mccSeeds, seedMccTaxonomy, type MccSeed } from "./mccTaxonomy";

export type PatternType = "contains" | "prefix" | "regex";

export type MerchantSeed = {
  id: string;
  canonicalName: string;
  defaultCategoryId?: string | null;
  defaultMccId?: string | null;
  country: string;
};

export type MerchantHeuristicSeed = {
  id: string;
  merchantId: string;
  patternType: PatternType;
  patternValue: string;
  mccId?: string | null;
  categoryId?: string | null;
  confidenceScore: number;
  source: "seed" | "user_correction";
  verifiedAt?: string;
};

export type MerchantResolution = {
  merchantId: string;
  canonicalName: string;
  categoryId?: string;
  mccCode?: string;
  confidenceScore: number;
  source: MerchantHeuristicSeed["source"];
  explanation: string;
};

export type MerchantResolverOptions = {
  merchantRecords?: MerchantSeed[];
  heuristicRecords?: MerchantHeuristicSeed[];
  mccRecords?: MccSeed[];
};

export const merchantSeeds: MerchantSeed[] = [
  {
    id: "merchant_grab",
    canonicalName: "Grab",
    defaultCategoryId: "category_transport",
    defaultMccId: "mcc_4121",
    country: "SG",
  },
  {
    id: "merchant_fairprice",
    canonicalName: "FairPrice",
    defaultCategoryId: "category_groceries",
    defaultMccId: "mcc_5411",
    country: "SG",
  },
  {
    id: "merchant_cold_storage",
    canonicalName: "Cold Storage",
    defaultCategoryId: "category_groceries",
    defaultMccId: "mcc_5411",
    country: "SG",
  },
  {
    id: "merchant_sheng_siong",
    canonicalName: "Sheng Siong",
    defaultCategoryId: "category_groceries",
    defaultMccId: "mcc_5411",
    country: "SG",
  },
  {
    id: "merchant_mcdonalds",
    canonicalName: "McDonald's",
    defaultCategoryId: "category_dining",
    defaultMccId: "mcc_5812",
    country: "SG",
  },
  {
    id: "merchant_starbucks",
    canonicalName: "Starbucks",
    defaultCategoryId: "category_dining",
    defaultMccId: "mcc_5812",
    country: "SG",
  },
  {
    id: "merchant_shopee",
    canonicalName: "Shopee",
    defaultCategoryId: "category_shopping",
    defaultMccId: "mcc_5311",
    country: "SG",
  },
  {
    id: "merchant_lazada",
    canonicalName: "Lazada",
    defaultCategoryId: "category_shopping",
    defaultMccId: "mcc_5311",
    country: "SG",
  },
  {
    id: "merchant_singtel",
    canonicalName: "Singtel",
    defaultCategoryId: "category_utilities",
    defaultMccId: "mcc_4814",
    country: "SG",
  },
  {
    id: "merchant_sp_services",
    canonicalName: "SP Services",
    defaultCategoryId: "category_utilities",
    defaultMccId: "mcc_4900",
    country: "SG",
  },
  {
    id: "merchant_axs",
    canonicalName: "AXS",
    defaultCategoryId: "category_government",
    defaultMccId: "mcc_9399",
    country: "SG",
  },
  {
    id: "merchant_ntuc_income",
    canonicalName: "NTUC Income",
    defaultCategoryId: "category_insurance",
    defaultMccId: "mcc_6300",
    country: "SG",
  },
];

export const merchantHeuristicSeeds: MerchantHeuristicSeed[] = [
  heuristic("heuristic_grab", "merchant_grab", "contains", "grab", "mcc_4121", "category_transport", 0.92),
  heuristic("heuristic_grab_trip", "merchant_grab", "contains", "grab trip", "mcc_4121", "category_transport", 0.96),
  heuristic(
    "heuristic_fairprice",
    "merchant_fairprice",
    "contains",
    "fairprice",
    "mcc_5411",
    "category_groceries",
    0.94,
  ),
  heuristic(
    "heuristic_ntuc_fp",
    "merchant_fairprice",
    "contains",
    "ntuc fp",
    "mcc_5411",
    "category_groceries",
    0.9,
  ),
  heuristic(
    "heuristic_cold_storage",
    "merchant_cold_storage",
    "contains",
    "cold storage",
    "mcc_5411",
    "category_groceries",
    0.95,
  ),
  heuristic(
    "heuristic_sheng_siong",
    "merchant_sheng_siong",
    "contains",
    "sheng siong",
    "mcc_5411",
    "category_groceries",
    0.95,
  ),
  heuristic(
    "heuristic_mcdonalds",
    "merchant_mcdonalds",
    "regex",
    "\\b(mc ?donald|mcdonald)",
    "mcc_5812",
    "category_dining",
    0.93,
  ),
  heuristic(
    "heuristic_starbucks",
    "merchant_starbucks",
    "contains",
    "starbucks",
    "mcc_5812",
    "category_dining",
    0.93,
  ),
  heuristic("heuristic_shopee", "merchant_shopee", "contains", "shopee", "mcc_5311", "category_shopping", 0.9),
  heuristic("heuristic_lazada", "merchant_lazada", "contains", "lazada", "mcc_5311", "category_shopping", 0.9),
  heuristic(
    "heuristic_singtel",
    "merchant_singtel",
    "contains",
    "singtel",
    "mcc_4814",
    "category_utilities",
    0.92,
  ),
  heuristic(
    "heuristic_sp_services",
    "merchant_sp_services",
    "contains",
    "sp services",
    "mcc_4900",
    "category_utilities",
    0.95,
  ),
  heuristic("heuristic_axs", "merchant_axs", "prefix", "axs", "mcc_9399", "category_government", 0.86),
  heuristic(
    "heuristic_ntuc_income",
    "merchant_ntuc_income",
    "contains",
    "ntuc income",
    "mcc_6300",
    "category_insurance",
    0.94,
  ),
];

export type SeedMerchantHeuristicsResult = {
  merchantsSeeded: number;
  heuristicsSeeded: number;
};

export function seedMerchantHeuristics(connection: DatabaseConnection): SeedMerchantHeuristicsResult {
  seedMccTaxonomy(connection);

  connection.sqlite.transaction(() => {
    for (const merchant of merchantSeeds) {
      connection.db
        .insert(merchants)
        .values(merchant)
        .onConflictDoUpdate({
          target: merchants.id,
          set: {
            canonicalName: merchant.canonicalName,
            defaultCategoryId: merchant.defaultCategoryId,
            defaultMccId: merchant.defaultMccId,
            country: merchant.country,
          },
        })
        .run();
    }

    for (const rule of merchantHeuristicSeeds) {
      connection.db
        .insert(merchantHeuristics)
        .values(rule)
        .onConflictDoUpdate({
          target: merchantHeuristics.id,
          set: {
            merchantId: rule.merchantId,
            patternType: rule.patternType,
            patternValue: rule.patternValue,
            mccId: rule.mccId,
            categoryId: rule.categoryId,
            confidenceScore: rule.confidenceScore,
            source: rule.source,
            verifiedAt: rule.verifiedAt,
          },
        })
        .run();
    }
  })();

  return {
    merchantsSeeded: merchantSeeds.length,
    heuristicsSeeded: merchantHeuristicSeeds.length,
  };
}

export function resolveMerchant(
  description: string,
  options: MerchantResolverOptions = {},
): MerchantResolution | undefined {
  const heuristicRecords = options.heuristicRecords ?? merchantHeuristicSeeds;
  const merchantRecords = options.merchantRecords ?? merchantSeeds;
  const mccRecords = options.mccRecords ?? mccSeeds;
  const normalizedDescription = normalizeMerchantText(description);
  const match = heuristicRecords
    .filter((candidate) => matchesPattern(normalizedDescription, candidate))
    .sort(compareHeuristicMatches)[0];

  if (!match) {
    return undefined;
  }

  const merchant = merchantRecords.find((candidate) => candidate.id === match.merchantId);
  const mcc = mccRecords.find((candidate) => candidate.id === match.mccId);

  if (!merchant) {
    return undefined;
  }

  return {
    merchantId: merchant.id,
    canonicalName: merchant.canonicalName,
    categoryId: match.categoryId ?? undefined,
    mccCode: mcc?.code,
    confidenceScore: match.confidenceScore,
    source: match.source,
    explanation: `Matched ${merchant.canonicalName} using ${match.patternType} pattern "${match.patternValue}".`,
  };
}

export function getSeededMerchantById(connection: DatabaseConnection, id: string) {
  return connection.db.select().from(merchants).where(eq(merchants.id, id)).get();
}

export function getSeededHeuristicById(connection: DatabaseConnection, id: string) {
  return connection.db.select().from(merchantHeuristics).where(eq(merchantHeuristics.id, id)).get();
}

export function normalizeMerchantText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function heuristic(
  id: string,
  merchantId: string,
  patternType: PatternType,
  patternValue: string,
  mccId: string,
  categoryId: string,
  confidenceScore: number,
): MerchantHeuristicSeed {
  return {
    id,
    merchantId,
    patternType,
    patternValue,
    mccId,
    categoryId,
    confidenceScore,
    source: "seed",
    verifiedAt: "2026-06-25",
  };
}

function matchesPattern(normalizedDescription: string, rule: MerchantHeuristicSeed): boolean {
  const normalizedPattern = normalizeMerchantText(rule.patternValue);

  switch (rule.patternType) {
    case "contains":
      return normalizedDescription.includes(normalizedPattern);
    case "prefix":
      return normalizedDescription.startsWith(normalizedPattern);
    case "regex":
      return new RegExp(rule.patternValue, "i").test(normalizedDescription);
  }
}

function compareHeuristicMatches(left: MerchantHeuristicSeed, right: MerchantHeuristicSeed): number {
  if (right.confidenceScore !== left.confidenceScore) {
    return right.confidenceScore - left.confidenceScore;
  }

  return right.patternValue.length - left.patternValue.length;
}

export function getMccSeedForMerchantResolution(mccCode: string): MccSeed | undefined {
  return getMccSeedByCode(mccCode);
}
