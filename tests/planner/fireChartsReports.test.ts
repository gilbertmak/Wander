import { describe, expect, it } from "vitest";

import { buildFireChartsReport } from "../../src/planner/fireChartsReports";
import { planGoalGaps, type GoalInput } from "../../src/planner/goalGapPlanner";
import {
  projectSingaporeFire,
  type SingaporeFireInput,
} from "../../src/planner/singaporeFireEngine";

const fireInput: SingaporeFireInput = {
  currentAge: 40,
  targetRetirementAge: 55,
  lifeExpectancyAge: 90,
  currentYear: 2026,
  liquidAssetsMinor: 160_000_000,
  cpf: {
    oaMinor: 20_000_000,
    saMinor: 14_000_000,
    maMinor: 6_000_000,
  },
  annualIncomeMinor: 14_400_000,
  annualBonusMinor: 2_000_000,
  monthlyInvestmentMinor: 800_000,
  annualRetirementSpendMinor: 6_000_000,
  annualHealthcareSpendMinor: 800_000,
  propertyValueMinor: 120_000_000,
  mortgageBalanceMinor: 55_000_000,
  annualMortgagePaymentMinor: 3_600_000,
  safeWithdrawalRate: 0.035,
  liquidReturnRate: 0.045,
  inflationRate: 0.025,
  propertyGrowthRate: 0.01,
};

const goals: GoalInput[] = [
  {
    id: "goal_parent",
    goalType: "parent_support",
    label: "Parent support reserve",
    targetAmountMinor: 18_000_000,
    currentAmountMinor: 2_000_000,
    targetDate: "2030-06-01",
    priority: 2,
    status: "active",
  },
  {
    id: "goal_travel",
    goalType: "travel",
    label: "Sabbatical travel",
    targetAmountMinor: 2_400_000,
    currentAmountMinor: 600_000,
    targetDate: "2028-06-01",
    priority: 4,
    status: "active",
    inflationAdjusted: false,
  },
];

function buildReport() {
  const projection = projectSingaporeFire(fireInput);
  const goalPlan = planGoalGaps({
    currentDate: "2026-06-01",
    monthlyAvailableForGoalsMinor: 250_000,
    monthlyReturnRate: 0.003,
    inflationRate: 0.025,
    goals,
    projection,
  });

  return buildFireChartsReport({
    generatedAt: "2026-06-29",
    projection,
    goalPlan,
    sampleEveryYears: 10,
  });
}

describe("FIRE charts and reports", () => {
  it("builds chart sections for FIRE, gap, spending, CPF, and goals", () => {
    const report = buildReport();

    expect(report.fireTrajectory.points[0]).toMatchObject({
      label: "Age 40",
      valueMinor: expect.any(Number),
      secondaryValueMinor: expect.any(Number),
    });
    expect(report.fireGap.points[0].valueMinor).toBeGreaterThan(0);
    expect(report.retirementSpending.points[0].secondaryValueMinor).toBe(800_000);
    expect(report.cpfTrajectory.summary).toMatch(/FRS milestone age 55/);
    expect(report.goalFunding.points).toHaveLength(2);
    expect(report.reportCards.map((card) => card.id)).toEqual([
      "current_gap",
      "final_assets",
      "goal_shortfall",
    ]);
  });

  it("calculates current asset bucket percentages that reconcile to roughly 100 percent", () => {
    const report = buildReport();
    const totalPercent = report.assetBuckets.reduce((sum, bucket) => sum + bucket.percent, 0);

    expect(report.assetBuckets.map((bucket) => bucket.label)).toEqual([
      "Liquid",
      "CPF",
      "Property equity",
    ]);
    expect(totalPercent).toBeGreaterThan(99.9);
    expect(totalPercent).toBeLessThan(100.1);
  });

  it("rejects invalid report input", () => {
    const projection = projectSingaporeFire(fireInput);
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 250_000,
      inflationRate: 0.025,
      goals,
      projection,
    });

    expect(() =>
      buildFireChartsReport({
        generatedAt: "29-06-2026",
        projection,
        goalPlan,
      }),
    ).toThrow(/Invalid FIRE charts report input/i);
  });
});
