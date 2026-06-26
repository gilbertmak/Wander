import { describe, expect, it } from "vitest";

import {
  buildCardPeriodSummary,
  classifyMilesLeakage,
  toMilesLeakageItemInsert,
  type MilesLeakageTransaction,
} from "../../src/rewards/milesLeakage";

const baseTransaction: MilesLeakageTransaction = {
  id: "transaction_1",
  profileId: "profile_1",
  cardId: "card_dbs",
  amountMinor: -10_000,
  transactionKind: "purchase",
  eligibleForMiles: true,
  mccCode: "5812",
  mccConfidence: 0.95,
  cardAssigned: true,
  capRemainingMinor: 50_000,
  actualMilesEarned: 100,
  bestAlternativeMiles: 400,
};

describe("miles leakage monitor", () => {
  it("classifies wrong-card leakage as recoverable", () => {
    const item = classifyMilesLeakage(baseTransaction);

    expect(item).toMatchObject({
      reason: "wrong_card",
      milesMissed: 300,
      recoverable: true,
    });
  });

  it("does not treat refunded spend as recoverable leakage", () => {
    const item = classifyMilesLeakage({
      ...baseTransaction,
      id: "refund_1",
      amountMinor: 10_000,
      transactionKind: "refund",
      actualMilesEarned: 0,
      bestAlternativeMiles: 400,
    });

    expect(item).toMatchObject({
      reason: "refund_reversal",
      milesMissed: 0,
      recoverable: false,
    });
  });

  it("flags missing card assignment as recoverable", () => {
    const item = classifyMilesLeakage({
      ...baseTransaction,
      id: "transaction_missing_card",
      cardId: null,
      cardAssigned: false,
    });

    expect(item).toMatchObject({
      reason: "missing_card_assignment",
      recoverable: true,
      confidenceScore: 0.7,
    });
  });

  it("labels excluded MCC as non-recoverable", () => {
    const item = classifyMilesLeakage({
      ...baseTransaction,
      id: "transaction_excluded",
      mccCode: "9399",
      excludedMccCodes: ["9399"],
      actualMilesEarned: 0,
      bestAlternativeMiles: 0,
    });

    expect(item).toMatchObject({
      reason: "excluded_mcc",
      milesMissed: 0,
      recoverable: false,
    });
  });

  it("labels low-confidence MCC leakage as an estimate", () => {
    const item = classifyMilesLeakage({
      ...baseTransaction,
      id: "transaction_low_mcc",
      mccConfidence: 0.52,
    });

    expect(item).toMatchObject({
      reason: "low_confidence_mcc",
      confidenceScore: 0.52,
      recoverable: true,
    });
  });

  it("builds monthly card summaries that reconcile to leakage rows", () => {
    const leakageItems = [
      classifyMilesLeakage(baseTransaction)!,
      classifyMilesLeakage({
        ...baseTransaction,
        id: "transaction_cap",
        capRemainingMinor: 0,
        actualMilesEarned: 10,
        bestAlternativeMiles: 100,
      })!,
    ];
    const summary = buildCardPeriodSummary({
      profileId: "profile_1",
      cardId: "card_dbs",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      capAmountMinor: 15_000,
      transactions: [
        baseTransaction,
        {
          ...baseTransaction,
          id: "transaction_cap",
          capRemainingMinor: 0,
          actualMilesEarned: 10,
          bestAlternativeMiles: 100,
        },
      ],
      leakageItems,
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(summary).toMatchObject({
      eligibleSpendMinor: 20_000,
      capUsedMinor: 15_000,
      milesEarned: 110,
      milesMissed: 390,
    });
    expect(toMilesLeakageItemInsert(leakageItems[0], summary.id)).toMatchObject({
      periodSummaryId: summary.id,
      reason: "wrong_card",
    });
  });
});
