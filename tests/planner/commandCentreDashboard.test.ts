import { describe, expect, it } from "vitest";

import { generateAdvisorInsights } from "../../src/planner/advisorInsightEngine";
import { buildCommandCentreSnapshot } from "../../src/planner/commandCentreDashboard";
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

const activeGoals: GoalInput[] = [
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
];

describe("command centre dashboard model", () => {
  it("builds an action-needed command centre snapshot from advisor and goal signals", () => {
    const projection = projectSingaporeFire({
      ...fireInput,
      liquidAssetsMinor: 60_000_000,
      monthlyInvestmentMinor: 150_000,
      annualRetirementSpendMinor: 8_000_000,
      annualHealthcareSpendMinor: 1_200_000,
    });
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 150_000,
      inflationRate: 0.025,
      goals: activeGoals,
      projection,
    });
    const advisorPlan = generateAdvisorInsights({
      profileId: "profile_1",
      currentDate: "2026-06-01",
      projection,
      goalPlan,
      monthlyNetSpendMinor: 7_000_000,
      monthlyIncomeMinor: 12_000_000,
      monthlyInvestmentMinor: 150_000,
      emergencyReserveMinor: 8_000_000,
      monthlyExpenseTrendRate: 0.18,
    });
    const snapshot = buildCommandCentreSnapshot({
      projection,
      goalPlan,
      advisorPlan,
      monthlyNetSpendMinor: 7_000_000,
      emergencyReserveMinor: 8_000_000,
    });

    expect(snapshot.status).toBe("action_needed");
    expect(snapshot.headline).toMatch(/planning constraint/i);
    expect(snapshot.commandCards.map((card) => card.id)).toEqual([
      "fire_progress",
      "goal_gap",
      "cpf",
      "reserve",
    ]);
    expect(snapshot.commandCards.find((card) => card.id === "reserve")).toMatchObject({
      tone: "critical",
      value: "1.1 months",
    });
    expect(snapshot.topAdvisorAction).toBe(advisorPlan.summary.topAction);
  });

  it("builds an on-track snapshot when warnings are absent", () => {
    const projection = projectSingaporeFire(fireInput);
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 500_000,
      monthlyReturnRate: 0.003,
      inflationRate: 0.025,
      goals: activeGoals,
      projection,
    });
    const advisorPlan = generateAdvisorInsights({
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
    const snapshot = buildCommandCentreSnapshot({
      projection,
      goalPlan: {
        ...goalPlan,
        monthlyShortfallMinor: 0,
        retirementGoalConflictMinor: 0,
      },
      advisorPlan,
      monthlyNetSpendMinor: 6_000_000,
      emergencyReserveMinor: 40_000_000,
    });

    expect(snapshot.status).toBe("on_track");
    expect(snapshot.fireReadyAge).toBe(42);
    expect(snapshot.commandCards.find((card) => card.id === "reserve")).toMatchObject({
      tone: "good",
      value: "6.7 months",
    });
    expect(snapshot.nextMilestones[0]).toMatchObject({
      label: "FIRE ready",
      age: 42,
    });
  });

  it("rejects invalid command centre inputs", () => {
    const projection = projectSingaporeFire(fireInput);
    const goalPlan = planGoalGaps({
      currentDate: "2026-06-01",
      monthlyAvailableForGoalsMinor: 500_000,
      inflationRate: 0.025,
      goals: activeGoals,
      projection,
    });
    const advisorPlan = generateAdvisorInsights({
      profileId: "profile_1",
      currentDate: "2026-06-01",
      projection,
      goalPlan,
      monthlyNetSpendMinor: 6_000_000,
      monthlyIncomeMinor: 12_000_000,
      monthlyInvestmentMinor: 800_000,
      emergencyReserveMinor: 40_000_000,
    });

    expect(() =>
      buildCommandCentreSnapshot({
        projection,
        goalPlan,
        advisorPlan,
        monthlyNetSpendMinor: 0,
        emergencyReserveMinor: 40_000_000,
      }),
    ).toThrow(/Invalid command centre dashboard input/i);
  });
});
