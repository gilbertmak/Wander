import { createHash } from "node:crypto";

import { evaluateTransactionReward } from "./formulaEvaluator";
import type { CardRuleSeed } from "./cardRuleCatalogue";

export type HypotheticalPurchaseInput = {
  profileId: string;
  merchantText: string;
  amountMinor: number;
  currency: string;
  categoryId?: string;
  mccCode?: string;
  channel: "online" | "offline" | "contactless";
  plannedDate: string;
};

export type CardPlanningContext = {
  cardRules: CardRuleSeed[];
  priorQualifiedSpendByRuleId?: Record<string, number>;
  selectedCategoryIds?: string[];
};

export type CardRecommendation = {
  cardId: string;
  ruleId: string;
  expectedMiles: number;
  capRemainingMinor: number;
  spendToNextRedeemableChunkMinor: number;
  confidenceScore: number;
  caveats: string[];
};

export type PlannedPurchaseRecord = HypotheticalPurchaseInput & {
  id: string;
  recommendedCardId?: string;
  status: "planned" | "matched" | "cancelled";
  matchedTransactionId?: string;
  confidenceScore: number;
  caveats: string[];
};

export type ImportedTransactionForPlanMatch = {
  id: string;
  postedDate: string;
  amountMinor: number;
  descriptionNormalized: string;
  categoryId?: string | null;
  cardId?: string | null;
};

export function rankCardsForPurchase(
  purchase: HypotheticalPurchaseInput,
  context: CardPlanningContext,
): CardRecommendation[] {
  return context.cardRules
    .map((rule) => {
      const priorQualifiedSpendMinor = context.priorQualifiedSpendByRuleId?.[rule.id] ?? 0;
      const capRemainingMinor = Math.max(0, rule.capAmountMinor - priorQualifiedSpendMinor);
      const evaluation = evaluateTransactionReward(
        rule,
        {
          id: "hypothetical_purchase",
          postedDate: purchase.plannedDate,
          amountMinor: -Math.abs(purchase.amountMinor),
          transactionKind: "purchase",
          channel: purchase.channel,
          categoryId: purchase.categoryId,
          mccCode: purchase.mccCode,
          eligibleForMiles: true,
        },
        {
          priorQualifiedSpendMinor,
          selectedCategoryIds: context.selectedCategoryIds,
        },
      );
      const caveats = [...evaluation.trace.eligibilityReasons];

      if (capRemainingMinor <= 0) caveats.push("Bonus cap is exhausted.");
      if (purchase.mccCode && rule.exclusion.excludedMccCodes?.includes(purchase.mccCode)) {
        caveats.push(`MCC ${purchase.mccCode} is excluded.`);
      }
      if (!purchase.mccCode) caveats.push("Unknown MCC lowers recommendation confidence.");

      return {
        cardId: rule.cardId,
        ruleId: rule.id,
        expectedMiles: evaluation.milesEarned,
        capRemainingMinor,
        spendToNextRedeemableChunkMinor: spendToNextTransferBlock(rule, evaluation.pointsEarned),
        confidenceScore: confidenceForRecommendation(
          evaluation.trace.eligible,
          purchase.mccCode,
          capRemainingMinor,
        ),
        caveats,
      };
    })
    .sort(compareRecommendations);
}

export function createPlannedPurchase(
  purchase: HypotheticalPurchaseInput,
  recommendation?: CardRecommendation,
): PlannedPurchaseRecord {
  return {
    ...purchase,
    id: stableId(
      purchase.profileId,
      purchase.merchantText,
      String(purchase.amountMinor),
      purchase.plannedDate,
    ),
    recommendedCardId: recommendation?.cardId,
    status: "planned",
    confidenceScore: recommendation?.confidenceScore ?? 0.5,
    caveats: recommendation?.caveats ?? ["No card recommendation was available."],
  };
}

export function matchPlannedPurchase(
  planned: PlannedPurchaseRecord,
  transaction: ImportedTransactionForPlanMatch,
): PlannedPurchaseRecord {
  const amountMatches = Math.abs(transaction.amountMinor) === Math.abs(planned.amountMinor);
  const merchantMatches = transaction.descriptionNormalized.includes(
    planned.merchantText.toLowerCase().trim(),
  );
  const categoryMatches = !planned.categoryId || transaction.categoryId === planned.categoryId;

  if (!amountMatches || !merchantMatches || !categoryMatches) {
    return planned;
  }

  return {
    ...planned,
    status: "matched",
    matchedTransactionId: transaction.id,
  };
}

export function toPlannedPurchaseInsert(record: PlannedPurchaseRecord) {
  return {
    id: record.id,
    profileId: record.profileId,
    merchantText: record.merchantText,
    categoryId: record.categoryId,
    mccCode: record.mccCode,
    amountMinor: record.amountMinor,
    currency: record.currency,
    channel: record.channel,
    plannedDate: record.plannedDate,
    recommendedCardId: record.recommendedCardId,
    status: record.status,
    matchedTransactionId: record.matchedTransactionId,
    confidenceScore: record.confidenceScore,
    caveatJson: JSON.stringify(record.caveats),
  };
}

function compareRecommendations(left: CardRecommendation, right: CardRecommendation) {
  if (right.expectedMiles !== left.expectedMiles) return right.expectedMiles - left.expectedMiles;
  if (right.confidenceScore !== left.confidenceScore)
    return right.confidenceScore - left.confidenceScore;
  return right.capRemainingMinor - left.capRemainingMinor;
}

function spendToNextTransferBlock(rule: CardRuleSeed, pointsEarned: number) {
  const block = rule.transferRule.transferBlockPoints;
  const remainder = pointsEarned % block;
  if (remainder === 0 && pointsEarned > 0) return 0;

  const pointsNeeded = block - remainder;
  const milesNeeded = pointsNeeded / rule.transferRule.pointsPerMile;
  return Math.ceil((milesNeeded / rule.bonusFormula.milesPerDollar) * 100);
}

function confidenceForRecommendation(
  eligible: boolean,
  mccCode: string | undefined,
  capRemainingMinor: number,
) {
  if (!eligible) return 0.4;
  let confidence = 0.95;
  if (!mccCode) confidence -= 0.18;
  if (capRemainingMinor <= 0) confidence -= 0.3;
  return Math.max(0.3, Math.round(confidence * 100) / 100);
}

function stableId(...parts: string[]) {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `planned_purchase_${digest}`;
}
