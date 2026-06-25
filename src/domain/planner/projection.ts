import type {
  ExpenseSnapshot,
  PlannerProfile,
  PlannerViewModel,
  ProjectionPoint,
  ProjectionResult,
  ScenarioDefinition,
} from "./types";

const yearsToProject = 60;
const daysPerYear = 365;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function calculateFireNumber(annualExpenses: number, safeWithdrawalRate: number) {
  assertPositive("annualExpenses", annualExpenses);
  assertPositive("safeWithdrawalRate", safeWithdrawalRate);

  return roundCurrency(annualExpenses / safeWithdrawalRate);
}

export function deriveAnnualizedExpenses(snapshot: ExpenseSnapshot) {
  assertPositive("netSpend", snapshot.netSpend);

  const days = daysBetweenInclusive(snapshot.periodStart, snapshot.periodEnd);

  return (snapshot.netSpend / days) * daysPerYear;
}

export function applyExpenseSnapshot(
  profile: PlannerProfile,
  snapshot: ExpenseSnapshot,
  useSnapshot: boolean,
): PlannerProfile {
  if (!useSnapshot) {
    return profile;
  }

  return {
    ...profile,
    annualExpenses: deriveAnnualizedExpenses(snapshot),
  };
}

export function projectFireScenario(scenario: ScenarioDefinition): ProjectionResult {
  const points: ProjectionPoint[] = [];
  let netWorth = scenario.profile.currentNetWorth;
  let projectedFireAge: number | null = null;
  let projectedFireYear: number | null = null;

  for (let year = 0; year <= yearsToProject; year += 1) {
    const annualExpenses = scenario.profile.annualExpenses * (1 + scenario.profile.inflationRate) ** year;
    const fireNumber = calculateFireNumber(annualExpenses, scenario.profile.safeWithdrawalRate);
    const age = scenario.profile.currentAge + year;
    const reachedFire = netWorth >= fireNumber;

    if (reachedFire && projectedFireAge === null) {
      projectedFireAge = age;
      projectedFireYear = new Date().getFullYear() + year;
    }

    points.push({
      year,
      age,
      netWorth,
      annualExpenses,
      fireNumber,
      reachedFire,
    });

    netWorth = netWorth * (1 + scenario.profile.expectedReturnRate) + scenario.profile.annualContribution;
  }

  const targetFireNumber = points[0].fireNumber;
  const yearsToFire = projectedFireAge === null ? null : projectedFireAge - scenario.profile.currentAge;

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    currency: scenario.profile.currency,
    targetFireNumber,
    currentFireProgress: scenario.profile.currentNetWorth / targetFireNumber,
    projectedFireAge,
    projectedFireYear,
    yearsToFire,
    targetRetirementGapYears:
      projectedFireAge === null ? null : projectedFireAge - scenario.profile.targetRetirementAge,
    points,
  };
}

export function buildScenarioDefinitions(
  baselineProfile: PlannerProfile,
  customProfile?: PlannerProfile,
): ScenarioDefinition[] {
  return [
    { id: "baseline", label: "Baseline", profile: baselineProfile },
    {
      id: "optimistic",
      label: "Optimistic",
      profile: {
        ...baselineProfile,
        annualContribution: baselineProfile.annualContribution * 1.1,
        annualExpenses: baselineProfile.annualExpenses * 0.97,
        expectedReturnRate: baselineProfile.expectedReturnRate + 0.015,
      },
    },
    {
      id: "conservative",
      label: "Conservative",
      profile: {
        ...baselineProfile,
        annualContribution: baselineProfile.annualContribution * 0.9,
        annualExpenses: baselineProfile.annualExpenses * 1.05,
        expectedReturnRate: Math.max(0, baselineProfile.expectedReturnRate - 0.015),
      },
    },
    ...(customProfile ? [{ id: "custom", label: "Custom", profile: customProfile }] : []),
  ];
}

export function buildPlannerViewModel(
  profile: PlannerProfile,
  activeSnapshot: ExpenseSnapshot,
  useSnapshot: boolean,
  customProfile?: PlannerProfile,
): PlannerViewModel {
  const baselineProfile = applyExpenseSnapshot(profile, activeSnapshot, useSnapshot);
  const scenarios = buildScenarioDefinitions(baselineProfile, customProfile).map(projectFireScenario);

  return {
    activeSnapshot,
    baseline: scenarios[0],
    scenarios,
  };
}

function daysBetweenInclusive(periodStart: string, periodEnd: string) {
  const start = Date.parse(`${periodStart}T00:00:00.000Z`);
  const end = Date.parse(`${periodEnd}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("Snapshot period dates must be ISO YYYY-MM-DD strings.");
  }

  if (end < start) {
    throw new Error("Snapshot period end must be on or after start.");
  }

  return (end - start) / millisecondsPerDay + 1;
}

function assertPositive(field: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number.`);
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
