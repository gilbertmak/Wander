import { describe, expect, it } from "vitest";

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
    id: "goal_emergency",
    goalType: "emergency_fund",
    label: "Emergency fund",
    targetAmountMinor: 3_000_000,
    currentAmountMinor: 3_000_000,
    priority: 1,
    status: "funded",
  },
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

describe("goal gap planner", () => {
  it("calculates goal gaps, required monthly funding, and next actions", () => {
    const plan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 250_000,
      monthlyReturnRate: 0.003,
      inflationRate: 0.025,
      goals,
      projection: projectSingaporeFire(fireInput),
    });
    const parentSupport = plan.goalItems.find((item) => item.goalId === "goal_parent")!;
    const travel = plan.goalItems.find((item) => item.goalId === "goal_travel")!;

    expect(plan.activeGoalCount).toBe(2);
    expect(parentSupport).toMatchObject({
      monthsToTarget: 48,
      pressure: "shortfall",
    });
    expect(parentSupport.adjustedTargetAmountMinor).toBeGreaterThan(18_000_000);
    expect(parentSupport.requiredMonthlyFundingMinor).toBeGreaterThan(
      plan.availableMonthlyFundingMinor,
    );
    expect(travel).toMatchObject({
      monthsToTarget: 24,
      adjustedTargetAmountMinor: 2_400_000,
      pressure: "on_track",
    });
    expect(plan.monthlyShortfallMinor).toBeGreaterThan(0);
    expect(plan.nextBestActions[0]).toMatch(/Parent support reserve/);
  });

  it("identifies goals that conflict with retirement-year FIRE assets", () => {
    const projection = projectSingaporeFire({
      ...fireInput,
      liquidAssetsMinor: 60_000_000,
      monthlyInvestmentMinor: 150_000,
      annualRetirementSpendMinor: 8_000_000,
      annualHealthcareSpendMinor: 1_200_000,
    });
    const plan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 500_000,
      inflationRate: 0.025,
      goals: [
        {
          id: "goal_home",
          goalType: "home",
          label: "Downsize buffer",
          targetAmountMinor: 40_000_000,
          currentAmountMinor: 5_000_000,
          targetDate: "2040-06-01",
          priority: 1,
          status: "active",
        },
      ],
      projection,
    });

    expect(plan.retirementGoalConflictMinor).toBeGreaterThan(0);
    expect(plan.goalItems[0]).toMatchObject({
      pressure: "shortfall",
    });
    expect(plan.goalItems[0].fireConflictMinor).toBe(plan.retirementGoalConflictMinor);
  });

  it("marks overdue unfunded goals as blocked", () => {
    const plan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 100_000,
      inflationRate: 0.02,
      goals: [
        {
          id: "goal_overdue",
          goalType: "custom",
          label: "Overdue goal",
          targetAmountMinor: 1_000_000,
          currentAmountMinor: 100_000,
          targetDate: "2026-05-01",
          priority: 1,
          status: "active",
        },
      ],
      projection: projectSingaporeFire(fireInput),
    });

    expect(plan.goalItems[0].pressure).toBe("blocked");
    expect(plan.nextBestActions[0]).toMatch(/defer or resize/);
  });

  it("rejects invalid goal inputs", () => {
    expect(() =>
      planGoalGaps({
        currentDate: "2026-06-01",
        monthlyAvailableForGoalsMinor: 0,
        inflationRate: 0.02,
        goals: [
          {
            id: "goal_bad",
            goalType: "custom",
            label: "Bad goal",
            targetAmountMinor: -1,
            currentAmountMinor: 0,
            priority: 1,
            status: "active",
          },
        ],
        projection: projectSingaporeFire(fireInput),
      }),
    ).toThrow(/Invalid financial goal input/i);
  });
});
