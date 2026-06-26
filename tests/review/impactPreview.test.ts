import { describe, expect, it } from "vitest";

import { calculateImpactPreview } from "../../src/review/impactPreview";
import type { ProjectionInput } from "../../src/planner/projectionEngine";

const projectionInput: ProjectionInput = {
  currentAge: 35,
  targetRetirementAge: 45,
  currentNetWorthMinor: 80_000_000,
  annualExpensesMinor: 4_800_000,
  annualSavingsMinor: 3_000_000,
  safeWithdrawalRate: 0.035,
  expectedReturnRate: 0.05,
  inflationRate: 0.02,
  maxYears: 30,
};

describe("review impact preview", () => {
  it("shows monthly net spend, annualized expense, FI age, and miles deltas", () => {
    const preview = calculateImpactPreview({
      projectionInput,
      currentMonthlyNetSpendMinor: 400_000,
      nextMonthlyNetSpendMinor: 450_000,
      currentMiles: 10_000,
      nextMiles: 9_200,
      recalculationTriggers: ["refund_match_changed", "miles_eligibility_changed"],
    });

    expect(preview).toMatchObject({
      monthlyNetSpendDeltaMinor: 50_000,
      annualizedExpensesDeltaMinor: 600_000,
      currentFiAge: 45,
      projectedFiAge: 48,
      fiAgeDelta: 3,
      milesDelta: -800,
      affectedAreas: ["expenses", "planner", "refunds", "miles"],
    });
    expect(preview.summary).toBe("annual expenses +S$6,000; miles -800; FI age moves to 48.");
  });

  it("marks category-only corrections as expense and planner impacts", () => {
    expect(
      calculateImpactPreview({
        projectionInput,
        currentMonthlyNetSpendMinor: 400_000,
        nextMonthlyNetSpendMinor: 400_000,
        currentMiles: 10_000,
        nextMiles: 10_000,
        recalculationTriggers: ["category_corrected"],
      }),
    ).toMatchObject({
      monthlyNetSpendDeltaMinor: 0,
      annualizedExpensesDeltaMinor: 0,
      milesDelta: 0,
      affectedAreas: ["expenses", "planner"],
      summary: "annual expenses unchanged; miles unchanged; FI age remains 45.",
    });
  });

  it("marks MCC and eligibility corrections as miles impacts", () => {
    expect(
      calculateImpactPreview({
        projectionInput,
        currentMonthlyNetSpendMinor: 400_000,
        nextMonthlyNetSpendMinor: 400_000,
        currentMiles: 10_000,
        nextMiles: 11_200,
        recalculationTriggers: ["mcc_corrected", "miles_eligibility_changed"],
      }),
    ).toMatchObject({
      milesDelta: 1_200,
      affectedAreas: ["miles"],
      summary: "annual expenses unchanged; miles +1200; FI age remains 45.",
    });
  });
});
