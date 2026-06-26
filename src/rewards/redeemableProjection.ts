import type { CardRuleSeed } from "./cardRuleCatalogue";

export type ProjectionLedgerEntry = {
  cardId?: string | null;
  ruleId?: string | null;
  points: number;
  milesEquivalent: number;
  status: "pending" | "posted" | "reversed" | "excluded" | string;
};

export type CardRewardProjection = {
  cardId: string;
  accumulatedMiles: number;
  postedMiles: number;
  pendingMiles: number;
  reversedMiles: number;
  pointsBalance: number;
  redeemableMiles: number;
  nextTransferBlockPoints: number;
  pointsToNextTransferBlock: number;
  spendToNextRedeemableChunkMinor: number;
  capRemainingMinor: number;
  cappedBeforeNextChunk: boolean;
};

export type RewardProjectionInput = {
  ledgerEntries: ProjectionLedgerEntry[];
  cardRules: CardRuleSeed[];
  periodQualifiedSpendByRuleId?: Record<string, number>;
};

export function calculateRewardProjection(input: RewardProjectionInput): CardRewardProjection[] {
  return input.cardRules.map((rule) => {
    const entries = input.ledgerEntries.filter(
      (entry) => entry.cardId === rule.cardId && entry.status !== "excluded",
    );
    const pointsBalance = Math.max(
      0,
      entries.reduce((total, entry) => total + entry.points, 0),
    );
    const accumulatedMiles = entries.reduce((total, entry) => total + entry.milesEquivalent, 0);
    const postedMiles = sumMilesByStatus(entries, "posted");
    const pendingMiles = sumMilesByStatus(entries, "pending");
    const reversedMiles = Math.abs(
      entries
        .filter((entry) => entry.milesEquivalent < 0 || entry.status === "reversed")
        .reduce((total, entry) => total + entry.milesEquivalent, 0),
    );
    const transferBlockPoints = rule.transferRule.transferBlockPoints;
    const redeemablePoints = Math.floor(pointsBalance / transferBlockPoints) * transferBlockPoints;
    const redeemableMiles = Math.floor(redeemablePoints / rule.transferRule.pointsPerMile);
    const pointsRemainder = pointsBalance % transferBlockPoints;
    const pointsToNextTransferBlock =
      pointsRemainder === 0 ? transferBlockPoints : transferBlockPoints - pointsRemainder;
    const periodQualifiedSpendMinor = input.periodQualifiedSpendByRuleId?.[rule.id] ?? 0;
    const capRemainingMinor = Math.max(0, rule.capAmountMinor - periodQualifiedSpendMinor);
    const spendToNextRedeemableChunkMinor = calculateSpendToNextChunkMinor(
      pointsToNextTransferBlock,
      rule.transferRule.pointsPerMile,
      rule.bonusFormula.milesPerDollar,
    );

    return {
      cardId: rule.cardId,
      accumulatedMiles,
      postedMiles,
      pendingMiles,
      reversedMiles,
      pointsBalance,
      redeemableMiles,
      nextTransferBlockPoints: transferBlockPoints,
      pointsToNextTransferBlock,
      spendToNextRedeemableChunkMinor,
      capRemainingMinor,
      cappedBeforeNextChunk: spendToNextRedeemableChunkMinor > capRemainingMinor,
    };
  });
}

export function calculateSpendToNextChunkMinor(
  pointsToNextTransferBlock: number,
  pointsPerMile: number,
  milesPerDollar: number,
): number {
  const pointsPerDollar = pointsPerMile * milesPerDollar;

  if (pointsToNextTransferBlock <= 0 || pointsPerDollar <= 0) {
    return 0;
  }

  return Math.ceil((pointsToNextTransferBlock / pointsPerDollar) * 100);
}

function sumMilesByStatus(entries: ProjectionLedgerEntry[], status: ProjectionLedgerEntry["status"]) {
  return entries
    .filter((entry) => entry.status === status && entry.milesEquivalent > 0)
    .reduce((total, entry) => total + entry.milesEquivalent, 0);
}
