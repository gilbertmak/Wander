import { createHash } from "node:crypto";

import type { DatabaseConnection } from "../db/client";
import { merchantHeuristics, merchants } from "../db/schema";
import {
  normalizeMerchantText,
  type MerchantHeuristicSeed,
  type MerchantSeed,
} from "./merchantHeuristics";
import { getMccSeedByCode, seedMccTaxonomy } from "./mccTaxonomy";

export type MerchantCorrectionInput = {
  transactionId: string;
  descriptionNormalized: string;
  correctedCategoryId?: string;
  correctedMccCode?: string;
  merchantId?: string;
  canonicalMerchantName?: string;
  ruleVersion?: string;
  confidenceScore?: number;
  correctedAt?: string;
};

export type LearnedMerchantHeuristic = {
  merchant: MerchantSeed;
  heuristic: MerchantHeuristicSeed;
};

export function learnMerchantHeuristic(
  connection: DatabaseConnection,
  correction: MerchantCorrectionInput,
): LearnedMerchantHeuristic {
  if (!correction.correctedCategoryId && !correction.correctedMccCode) {
    throw new Error("A category or MCC correction is required to learn a merchant heuristic.");
  }

  seedMccTaxonomy(connection);

  const normalizedDescription = normalizeMerchantText(correction.descriptionNormalized);
  const correctedMcc = correction.correctedMccCode
    ? getMccSeedByCode(correction.correctedMccCode)
    : undefined;

  if (correction.correctedMccCode && !correctedMcc) {
    throw new Error(`Unknown MCC code ${correction.correctedMccCode}.`);
  }

  const merchantId = correction.merchantId ?? `merchant_user_${stableId(normalizedDescription)}`;
  const canonicalName = correction.canonicalMerchantName ?? titleCase(normalizedDescription);
  const merchant: MerchantSeed = {
    id: merchantId,
    canonicalName,
    defaultCategoryId: correction.correctedCategoryId ?? correctedMcc?.defaultCategoryId ?? null,
    defaultMccId: correctedMcc?.id ?? null,
    country: "SG",
  };
  const heuristic: MerchantHeuristicSeed = {
    id: `heuristic_user_${stableId(`${merchantId}:${normalizedDescription}`)}`,
    merchantId,
    patternType: "contains",
    patternValue: normalizedDescription,
    categoryId: correction.correctedCategoryId ?? correctedMcc?.defaultCategoryId ?? null,
    mccId: correctedMcc?.id ?? null,
    aliasText: normalizedDescription,
    categoryOverrideId: correction.correctedCategoryId ?? correctedMcc?.defaultCategoryId ?? null,
    mccOverrideId: correctedMcc?.id ?? null,
    sourceTransactionId: correction.transactionId,
    ruleVersion: correction.ruleVersion ?? "user-v1",
    confidenceScore: correction.confidenceScore ?? 0.82,
    source: "user_correction",
    verifiedAt: correction.correctedAt ?? new Date().toISOString(),
  };

  connection.sqlite.transaction(() => {
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

    connection.db
      .insert(merchantHeuristics)
      .values(heuristic)
      .onConflictDoUpdate({
        target: merchantHeuristics.id,
        set: {
          merchantId: heuristic.merchantId,
          patternType: heuristic.patternType,
          patternValue: heuristic.patternValue,
          mccId: heuristic.mccId,
          categoryId: heuristic.categoryId,
          confidenceScore: heuristic.confidenceScore,
          source: heuristic.source,
          aliasText: heuristic.aliasText,
          categoryOverrideId: heuristic.categoryOverrideId,
          mccOverrideId: heuristic.mccOverrideId,
          sourceTransactionId: heuristic.sourceTransactionId,
          ruleVersion: heuristic.ruleVersion,
          verifiedAt: heuristic.verifiedAt,
        },
      })
      .run();
  })();

  return { merchant, heuristic };
}

function stableId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
