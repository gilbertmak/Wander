import type { GoalGapPlan } from "./goalGapPlanner";
import type {
  SingaporeFireProjectionResult,
  SingaporeFireProjectionYear,
} from "./singaporeFireEngine";

export type ChartPoint = {
  label: string;
  age: number;
  calendarYear: number;
  valueMinor: number;
  secondaryValueMinor?: number;
  ratio?: number;
};

export type AssetBucketPoint = {
  label: string;
  valueMinor: number;
  percent: number;
  tone: "liquid" | "cpf" | "property";
};

export type FireReportSection = {
  id: string;
  title: string;
  summary: string;
  points: ChartPoint[];
};

export type FireChartsReport = {
  generatedAt: string;
  fireTrajectory: FireReportSection;
  fireGap: FireReportSection;
  retirementSpending: FireReportSection;
  cpfTrajectory: FireReportSection;
  goalFunding: FireReportSection;
  assetBuckets: AssetBucketPoint[];
  reportCards: Array<{
    id: string;
    label: string;
    value: string;
    detail: string;
  }>;
};

export function buildFireChartsReport(input: {
  generatedAt: string;
  projection: SingaporeFireProjectionResult;
  goalPlan: GoalGapPlan;
  sampleEveryYears?: number;
}): FireChartsReport {
  validateReportInput(input);

  const sampleEveryYears = input.sampleEveryYears ?? 5;
  const sampledYears = sampleProjectionYears(input.projection.years, sampleEveryYears);
  const currentYear = input.projection.years[0];
  const finalYear = input.projection.years.at(-1)!;

  return {
    generatedAt: input.generatedAt,
    fireTrajectory: {
      id: "fire_trajectory",
      title: "FIRE trajectory",
      summary: `Projected FIRE age ${input.projection.fireReadyAge ?? "not reached"} with ${Math.round(currentYear.fireProgress * 100)}% progress today.`,
      points: sampledYears.map((year) => ({
        label: `Age ${year.age}`,
        age: year.age,
        calendarYear: year.calendarYear,
        valueMinor: year.totalFireAssetsMinor,
        secondaryValueMinor: year.targetCorpusMinor,
        ratio: year.fireProgress,
      })),
    },
    fireGap: {
      id: "fire_gap",
      title: "FIRE gap",
      summary: "Gap between FIRE assets and target corpus by planning age.",
      points: sampledYears.map((year) => ({
        label: `Age ${year.age}`,
        age: year.age,
        calendarYear: year.calendarYear,
        valueMinor: Math.max(0, year.targetCorpusMinor - year.totalFireAssetsMinor),
      })),
    },
    retirementSpending: {
      id: "retirement_spending",
      title: "Retirement spending",
      summary: "Inflation-adjusted spending and healthcare assumptions used by the projection.",
      points: sampledYears.map((year) => ({
        label: `Age ${year.age}`,
        age: year.age,
        calendarYear: year.calendarYear,
        valueMinor: year.retirementSpendMinor,
        secondaryValueMinor: year.healthcareSpendMinor,
      })),
    },
    cpfTrajectory: {
      id: "cpf_trajectory",
      title: "CPF trajectory",
      summary: `FRS milestone ${input.projection.firstCpfFullRetirementSumAge ? `age ${input.projection.firstCpfFullRetirementSumAge}` : "not reached"}.`,
      points: sampledYears.map((year) => ({
        label: `Age ${year.age}`,
        age: year.age,
        calendarYear: year.calendarYear,
        valueMinor: year.cpfOaMinor + year.cpfSaMinor + year.cpfMaMinor + year.cpfRaMinor,
        secondaryValueMinor: year.cpfRaMinor,
      })),
    },
    goalFunding: {
      id: "goal_funding",
      title: "Goal funding",
      summary: `${input.goalPlan.activeGoalCount} active goals, ${formatMinor(input.goalPlan.monthlyShortfallMinor)} monthly shortfall.`,
      points: input.goalPlan.goalItems.map((goal) => ({
        label: goal.label,
        age: currentYear.age + Math.max(0, Math.round((goal.monthsToTarget ?? 0) / 12)),
        calendarYear:
          goal.targetDate === undefined
            ? currentYear.calendarYear
            : Number(goal.targetDate.slice(0, 4)),
        valueMinor: goal.currentAmountMinor,
        secondaryValueMinor: goal.adjustedTargetAmountMinor,
        ratio: safeRatio(goal.currentAmountMinor, goal.adjustedTargetAmountMinor),
      })),
    },
    assetBuckets: buildAssetBuckets(currentYear),
    reportCards: [
      {
        id: "current_gap",
        label: "Current FIRE gap",
        value: formatMinor(
          Math.max(0, currentYear.targetCorpusMinor - currentYear.totalFireAssetsMinor),
        ),
        detail: `${Math.round(currentYear.fireProgress * 100)}% funded today`,
      },
      {
        id: "final_assets",
        label: "Planning-age assets",
        value: formatMinor(finalYear.totalFireAssetsMinor),
        detail: `Age ${finalYear.age} projection`,
      },
      {
        id: "goal_shortfall",
        label: "Monthly goal shortfall",
        value: formatMinor(input.goalPlan.monthlyShortfallMinor),
        detail: input.goalPlan.nextBestActions[0] ?? "No action required",
      },
    ],
  };
}

function sampleProjectionYears(years: SingaporeFireProjectionYear[], sampleEveryYears: number) {
  return years.filter(
    (year, index) =>
      index === 0 || index === years.length - 1 || year.yearIndex % sampleEveryYears === 0,
  );
}

function buildAssetBuckets(year: SingaporeFireProjectionYear): AssetBucketPoint[] {
  const cpfTotalMinor = year.cpfOaMinor + year.cpfSaMinor + year.cpfMaMinor + year.cpfRaMinor;
  const totalMinor = Math.max(1, year.liquidAssetsMinor + cpfTotalMinor + year.propertyEquityMinor);

  return [
    {
      label: "Liquid",
      valueMinor: year.liquidAssetsMinor,
      percent: roundPercent(year.liquidAssetsMinor / totalMinor),
      tone: "liquid",
    },
    {
      label: "CPF",
      valueMinor: cpfTotalMinor,
      percent: roundPercent(cpfTotalMinor / totalMinor),
      tone: "cpf",
    },
    {
      label: "Property equity",
      valueMinor: year.propertyEquityMinor,
      percent: roundPercent(year.propertyEquityMinor / totalMinor),
      tone: "property",
    },
  ];
}

function validateReportInput(input: {
  generatedAt: string;
  projection: SingaporeFireProjectionResult;
  goalPlan: GoalGapPlan;
  sampleEveryYears?: number;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.generatedAt) || input.projection.years.length === 0) {
    throw new Error("Invalid FIRE charts report input.");
  }
  if (input.sampleEveryYears !== undefined && input.sampleEveryYears <= 0) {
    throw new Error("Invalid FIRE charts report input.");
  }
}

function safeRatio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 1;
  }

  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

function roundPercent(value: number) {
  return Math.round(value * 1000) / 10;
}

function formatMinor(amountMinor: number) {
  return `S$${Math.round(amountMinor / 100).toLocaleString("en-SG")}`;
}
