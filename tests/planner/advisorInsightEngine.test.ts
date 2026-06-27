import { describe, expect, it } from "vitest";

import {
  generateAdvisorInsights,
  toAdvisorInsightInsert,
} from "../../src/planner/advisorInsightEngine";
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

const strainedFireInput: SingaporeFireInput = {
  ...fireInput,
  liquidAssetsMinor: 60_000_000,
  monthlyInvestmentMinor: 150_000,
  annualRetirementSpendMinor: 8_000_000,
  annualHealthcareSpendMinor: 1_200_000,
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

describe("advisor insight engine", () => {
  it("generates prioritized insights with decision traces", () => {
    const projection = projectSingaporeFire(strainedFireInput);
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 250_000,
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
    const plan = generateAdvisorInsights({
      profileId: "profile_1",
      projectionRunId: "projection_run_1",
      currentDate: "2026-06-01",
      projection,
      goalPlan,
      monthlyNetSpendMinor: 7_000_000,
      monthlyIncomeMinor: 12_000_000,
      monthlyInvestmentMinor: 150_000,
      emergencyReserveMinor: 8_000_000,
      monthlyExpenseTrendRate: 0.18,
    });

    expect(plan.summary.criticalCount).toBeGreaterThan(0);
    expect(plan.summary.topAction).toBe(plan.insights[0].recommendedAction);
    expect(plan.insights.map((insight) => insight.insightType)).toEqual(
      expect.arrayContaining(["goal_conflict", "emergency_reserve", "expense_drift"]),
    );
    expect(plan.insights[0].severity).toBe("critical");
    expect(plan.insights[0].trace).toMatchObject({
      sourceModule: "advisor_insight",
      ruleVersion: "advisor-r3-v1",
    });
    expect(plan.insights[0].trace.id).toMatch(/^trace_/);
  });

  it("generates an on-track insight when gaps and warnings are absent", () => {
    const projection = projectSingaporeFire(fireInput);
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 500_000,
      monthlyReturnRate: 0.003,
      inflationRate: 0.025,
      goals,
      projection,
    });
    const plan = generateAdvisorInsights({
      profileId: "profile_1",
      currentDate: "2026-06-01",
      projection,
      goalPlan: {
        ...goalPlan,
        monthlyShortfallMinor: 0,
        retirementGoalConflictMinor: 0,
      },
      monthlyNetSpendMinor: 6_000_000,
      monthlyIncomeMinor: 12_000_000,
      monthlyInvestmentMinor: 800_000,
      emergencyReserveMinor: 40_000_000,
      monthlyExpenseTrendRate: 0,
    });

    expect(plan.insights).toHaveLength(1);
    expect(plan.insights[0]).toMatchObject({
      insightType: "on_track",
      severity: "info",
      confidenceScore: 0.82,
    });
  });

  it("maps advisor insights to repository insert shape", () => {
    const projection = projectSingaporeFire(fireInput);
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 250_000,
      inflationRate: 0.025,
      goals,
      projection,
    });
    const [insight] = generateAdvisorInsights({
      profileId: "profile_1",
      projectionRunId: "projection_run_1",
      currentDate: "2026-06-01",
      projection,
      goalPlan,
      monthlyNetSpendMinor: 6_000_000,
      monthlyIncomeMinor: 12_000_000,
      monthlyInvestmentMinor: 800_000,
      emergencyReserveMinor: 20_000_000,
    }).insights;

    expect(toAdvisorInsightInsert(insight)).toMatchObject({
      id: insight.id,
      profileId: "profile_1",
      projectionRunId: "projection_run_1",
      insightType: insight.insightType,
      severity: insight.severity,
      traceId: insight.trace.id,
      status: "open",
    });
  });

  it("rejects invalid advisor inputs", () => {
    const projection = projectSingaporeFire(fireInput);
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 500_000,
      inflationRate: 0.025,
      goals,
      projection,
    });

    expect(() =>
      generateAdvisorInsights({
        profileId: "profile_1",
        currentDate: "2026-06-01",
        projection,
        goalPlan,
        monthlyNetSpendMinor: 0,
        monthlyIncomeMinor: 12_000_000,
        monthlyInvestmentMinor: 800_000,
        emergencyReserveMinor: 20_000_000,
      }),
    ).toThrow(/Invalid advisor insight input/i);
  });
});
