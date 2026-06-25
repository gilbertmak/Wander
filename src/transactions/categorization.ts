export type TransactionForCategorization = {
  id: string;
  descriptionNormalized: string;
  merchantId?: string | null;
  mccCode?: string | null;
  amountMinor: number;
};

export type CategoryRule = {
  id: string;
  pattern: string;
  categoryId: string;
  mccCode?: string;
  confidenceScore: number;
};

export type MerchantHeuristic = {
  merchantId: string;
  categoryId?: string | null;
  mccCode?: string | null;
  confidenceScore: number;
};

export type MccDefault = {
  mccCode: string;
  categoryId: string;
  defaultMilesEligibility: boolean;
};

export type CategorizationInput = {
  transaction: TransactionForCategorization;
  userRules: CategoryRule[];
  merchantHeuristics: MerchantHeuristic[];
  mccDefaults: MccDefault[];
};

export type CategorizationDecision = {
  categoryId?: string;
  mccCode?: string;
  eligibleForMiles: boolean;
  confidenceScore: number;
  needsReview: boolean;
  source: "user_rule" | "merchant_heuristic" | "mcc_default" | "review";
  explanation: string;
};

export function categorizeTransaction(input: CategorizationInput): CategorizationDecision {
  const matchingUserRule = input.userRules.find((rule) =>
    input.transaction.descriptionNormalized.includes(rule.pattern.toLowerCase()),
  );

  if (matchingUserRule) {
    return {
      categoryId: matchingUserRule.categoryId,
      mccCode: matchingUserRule.mccCode ?? input.transaction.mccCode ?? undefined,
      eligibleForMiles: input.transaction.amountMinor < 0,
      confidenceScore: matchingUserRule.confidenceScore,
      needsReview: matchingUserRule.confidenceScore < 0.8,
      source: "user_rule",
      explanation: `Matched user rule ${matchingUserRule.id}.`,
    };
  }

  const merchantMatch = input.merchantHeuristics
    .filter((heuristic) => heuristic.merchantId === input.transaction.merchantId)
    .sort((left, right) => right.confidenceScore - left.confidenceScore)[0];

  if (merchantMatch?.categoryId) {
    return {
      categoryId: merchantMatch.categoryId,
      mccCode: merchantMatch.mccCode ?? input.transaction.mccCode ?? undefined,
      eligibleForMiles: input.transaction.amountMinor < 0,
      confidenceScore: merchantMatch.confidenceScore,
      needsReview: merchantMatch.confidenceScore < 0.8,
      source: "merchant_heuristic",
      explanation: `Matched merchant heuristic for ${merchantMatch.merchantId}.`,
    };
  }

  const mccCode = merchantMatch?.mccCode ?? input.transaction.mccCode;
  const mccDefault = input.mccDefaults.find((candidate) => candidate.mccCode === mccCode);

  if (mccDefault) {
    return {
      categoryId: mccDefault.categoryId,
      mccCode: mccDefault.mccCode,
      eligibleForMiles: input.transaction.amountMinor < 0 && mccDefault.defaultMilesEligibility,
      confidenceScore: 0.7,
      needsReview: true,
      source: "mcc_default",
      explanation: `Applied MCC ${mccDefault.mccCode} default.`,
    };
  }

  return {
    eligibleForMiles: false,
    confidenceScore: 0,
    needsReview: true,
    source: "review",
    explanation: "No category rule, merchant heuristic, or MCC default matched.",
  };
}
