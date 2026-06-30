import type { SingaporeFireProjectionResult } from "./singaporeFireEngine";

export type GoalType =
  | "emergency_fund"
  | "home"
  | "education"
  | "car"
  | "wedding"
  | "travel"
  | "parent_support"
  | "custom";

export type GoalStatus = "active" | "funded" | "paused" | "dismissed";

export type GoalInput = {
  id: string;
  goalType: GoalType;
  label: string;
  targetAmountMinor: number;
  currentAmountMinor: number;
  targetDate?: string;
  priority: number;
  fundingSource?: string;
  inflationAdjusted?: boolean;
  status: GoalStatus;
};

export type GoalGapPlannerInput = {
  currentDate: string;
  monthlyAvailableForGoalsMinor: number;
  monthlyReturnRate?: number;
  inflationRate: number;
  goals: GoalInput[];
  projection: SingaporeFireProjectionResult;
};

export type GoalPressure = "funded" | "on_track" | "watch" | "shortfall" | "blocked";

export type GoalGapItem = {
  goalId: string;
  goalType: GoalType;
  label: string;
  priority: number;
  status: GoalStatus;
  targetDate?: string;
  monthsToTarget?: number;
  adjustedTargetAmountMinor: number;
  currentAmountMinor: number;
  remainingGapMinor: number;
  requiredMonthlyFundingMinor: number;
  pressure: GoalPressure;
  projectedFundingMinor: number;
  projectedSurplusMinor: number;
  fireConflictMinor: number;
  explanation: string;
};

export type GoalGapPlan = {
  currentDate: string;
  activeGoalCount: number;
  totalRemainingGapMinor: number;
  requiredMonthlyFundingMinor: number;
  availableMonthlyFundingMinor: number;
  monthlyShortfallMinor: number;
  retirementGoalConflictMinor: number;
  fireReadyAge?: number;
  goalItems: GoalGapItem[];
  nextBestActions: string[];
};

export function planGoalGaps(input: GoalGapPlannerInput): GoalGapPlan {
  validateGoalGapPlannerInput(input);

  const activeGoals = input.goals
    .filter((goal) => goal.status === "active" || goal.status === "funded")
    .sort(compareGoals);
  const goalItems = activeGoals.map((goal) => buildGoalGapItem(goal, input));
  const requiredMonthlyFundingMinor = goalItems.reduce(
    (sum, item) => sum + item.requiredMonthlyFundingMinor,
    0,
  );
  const totalRemainingGapMinor = goalItems.reduce((sum, item) => sum + item.remainingGapMinor, 0);
  const retirementGoalConflictMinor = goalItems.reduce(
    (sum, item) => sum + item.fireConflictMinor,
    0,
  );

  return {
    currentDate: input.currentDate,
    activeGoalCount: activeGoals.filter((goal) => goal.status === "active").length,
    totalRemainingGapMinor,
    requiredMonthlyFundingMinor,
    availableMonthlyFundingMinor: input.monthlyAvailableForGoalsMinor,
    monthlyShortfallMinor: Math.max(
      0,
      requiredMonthlyFundingMinor - input.monthlyAvailableForGoalsMinor,
    ),
    retirementGoalConflictMinor,
    fireReadyAge: input.projection.fireReadyAge,
    goalItems,
    nextBestActions: buildNextBestActions(goalItems, input.monthlyAvailableForGoalsMinor),
  };
}

function buildGoalGapItem(goal: GoalInput, input: GoalGapPlannerInput): GoalGapItem {
  const monthsToTarget = goal.targetDate
    ? monthDistance(input.currentDate, goal.targetDate)
    : undefined;
  const adjustedTargetAmountMinor =
    goal.inflationAdjusted === false
      ? goal.targetAmountMinor
      : inflate(goal.targetAmountMinor, input.inflationRate, monthsToTarget ?? 0);
  const remainingGapMinor = Math.max(0, adjustedTargetAmountMinor - goal.currentAmountMinor);
  const requiredMonthlyFundingMinor = calculateRequiredMonthlyFunding({
    gapMinor: remainingGapMinor,
    monthsToTarget,
    monthlyReturnRate: input.monthlyReturnRate ?? 0,
  });
  const projectedFundingMinor =
    monthsToTarget === undefined
      ? goal.currentAmountMinor
      : projectMonthlyFunding({
          currentAmountMinor: goal.currentAmountMinor,
          monthlyFundingMinor: input.monthlyAvailableForGoalsMinor,
          months: monthsToTarget,
          monthlyReturnRate: input.monthlyReturnRate ?? 0,
        });
  const projectedSurplusMinor = projectedFundingMinor - adjustedTargetAmountMinor;
  const fireConflictMinor = calculateFireConflict(goal, input, adjustedTargetAmountMinor);
  const pressure = classifyGoalPressure({
    status: goal.status,
    remainingGapMinor,
    monthsToTarget,
    requiredMonthlyFundingMinor,
    availableMonthlyFundingMinor: input.monthlyAvailableForGoalsMinor,
    fireConflictMinor,
  });

  return {
    goalId: goal.id,
    goalType: goal.goalType,
    label: goal.label,
    priority: goal.priority,
    status: goal.status,
    targetDate: goal.targetDate,
    monthsToTarget,
    adjustedTargetAmountMinor,
    currentAmountMinor: goal.currentAmountMinor,
    remainingGapMinor,
    requiredMonthlyFundingMinor,
    pressure,
    projectedFundingMinor: Math.max(0, roundMinor(projectedFundingMinor)),
    projectedSurplusMinor: roundMinor(projectedSurplusMinor),
    fireConflictMinor,
    explanation: explainGoalPressure(pressure, remainingGapMinor, requiredMonthlyFundingMinor),
  };
}

function calculateRequiredMonthlyFunding(input: {
  gapMinor: number;
  monthsToTarget?: number;
  monthlyReturnRate: number;
}) {
  if (input.gapMinor === 0) {
    return 0;
  }
  if (input.monthsToTarget === undefined) {
    return input.gapMinor;
  }
  if (input.monthsToTarget <= 0) {
    return input.gapMinor;
  }
  if (input.monthlyReturnRate === 0) {
    return Math.ceil(input.gapMinor / input.monthsToTarget);
  }

  const futureValueFactor =
    ((1 + input.monthlyReturnRate) ** input.monthsToTarget - 1) / input.monthlyReturnRate;

  return Math.ceil(input.gapMinor / futureValueFactor);
}

function projectMonthlyFunding(input: {
  currentAmountMinor: number;
  monthlyFundingMinor: number;
  months: number;
  monthlyReturnRate: number;
}) {
  let value = input.currentAmountMinor;

  for (let month = 0; month < Math.max(0, input.months); month += 1) {
    value = (value + input.monthlyFundingMinor) * (1 + input.monthlyReturnRate);
  }

  return value;
}

function calculateFireConflict(
  goal: GoalInput,
  input: GoalGapPlannerInput,
  adjustedTargetAmountMinor: number,
) {
  const retirementYear = input.projection.years.find((year) =>
    year.milestones.includes("target_retirement_age"),
  );

  if (!retirementYear || goal.status === "funded") {
    return 0;
  }

  const targetYear = goal.targetDate ? Number(goal.targetDate.slice(0, 4)) : undefined;
  const happensByRetirement = targetYear === undefined || targetYear <= retirementYear.calendarYear;
  const assetsAfterGoalMinor = retirementYear.totalFireAssetsMinor - adjustedTargetAmountMinor;

  return happensByRetirement
    ? Math.max(0, retirementYear.targetCorpusMinor - assetsAfterGoalMinor)
    : 0;
}

function classifyGoalPressure(input: {
  status: GoalStatus;
  remainingGapMinor: number;
  monthsToTarget?: number;
  requiredMonthlyFundingMinor: number;
  availableMonthlyFundingMinor: number;
  fireConflictMinor: number;
}): GoalPressure {
  if (input.remainingGapMinor === 0 || input.status === "funded") {
    return "funded";
  }
  if (input.monthsToTarget !== undefined && input.monthsToTarget <= 0) {
    return "blocked";
  }
  if (input.fireConflictMinor > 0) {
    return "shortfall";
  }
  if (input.requiredMonthlyFundingMinor <= input.availableMonthlyFundingMinor) {
    return "on_track";
  }
  if (input.requiredMonthlyFundingMinor <= input.availableMonthlyFundingMinor * 1.25) {
    return "watch";
  }

  return "shortfall";
}

function buildNextBestActions(goalItems: GoalGapItem[], availableMonthlyFundingMinor: number) {
  const actions: string[] = [];
  const topShortfall = goalItems.find((item) => item.pressure === "shortfall");
  const topWatch = goalItems.find((item) => item.pressure === "watch");
  const topBlocked = goalItems.find((item) => item.pressure === "blocked");

  if (topBlocked) {
    actions.push(
      `Decide whether to defer or resize ${topBlocked.label}; the target date has passed.`,
    );
  }
  if (topShortfall) {
    const extraMonthlyMinor = Math.max(
      0,
      topShortfall.requiredMonthlyFundingMinor - availableMonthlyFundingMinor,
    );
    actions.push(`Add ${formatMinor(extraMonthlyMinor)} monthly or adjust ${topShortfall.label}.`);
  }
  if (topWatch) {
    actions.push(`Review ${topWatch.label}; it has a narrow monthly funding buffer.`);
  }
  if (actions.length === 0 && goalItems.some((item) => item.pressure === "on_track")) {
    actions.push("Keep current goal funding allocation; active goals are on track.");
  }
  if (actions.length === 0) {
    actions.push("Add at least one active goal to calculate a funding gap.");
  }

  return actions;
}

function explainGoalPressure(
  pressure: GoalPressure,
  remainingGapMinor: number,
  requiredMonthlyFundingMinor: number,
) {
  if (pressure === "funded") {
    return "Current funding already covers the adjusted target.";
  }
  if (pressure === "blocked") {
    return "The target date has passed while the goal still has a gap.";
  }
  if (pressure === "shortfall") {
    return `The goal needs ${formatMinor(requiredMonthlyFundingMinor)} monthly and may compete with FIRE assets.`;
  }
  if (pressure === "watch") {
    return `The goal has ${formatMinor(remainingGapMinor)} remaining with limited monthly buffer.`;
  }

  return `The goal needs ${formatMinor(requiredMonthlyFundingMinor)} monthly under current assumptions.`;
}

function compareGoals(left: GoalInput, right: GoalInput) {
  if (left.status !== right.status) {
    return left.status === "active" ? -1 : 1;
  }
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return (left.targetDate ?? "9999-12-31").localeCompare(right.targetDate ?? "9999-12-31");
}

function monthDistance(fromIsoDate: string, toIsoDate: string) {
  const from = parseIsoDate(fromIsoDate);
  const to = parseIsoDate(toIsoDate);

  return (to.year - from.year) * 12 + (to.month - from.month);
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("Dates must use ISO YYYY-MM-DD format.");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function inflate(amountMinor: number, annualInflationRate: number, months: number) {
  return roundMinor(amountMinor * (1 + annualInflationRate) ** (months / 12));
}

function validateGoalGapPlannerInput(input: GoalGapPlannerInput) {
  parseIsoDate(input.currentDate);

  if (
    input.monthlyAvailableForGoalsMinor < 0 ||
    (input.monthlyReturnRate ?? 0) <= -1 ||
    input.inflationRate <= -1
  ) {
    throw new Error("Invalid goal gap planner input.");
  }

  for (const goal of input.goals) {
    if (
      goal.targetAmountMinor < 0 ||
      goal.currentAmountMinor < 0 ||
      goal.priority < 1 ||
      goal.priority > 5
    ) {
      throw new Error("Invalid financial goal input.");
    }
    if (goal.targetDate) {
      parseIsoDate(goal.targetDate);
    }
  }
}

function formatMinor(amountMinor: number) {
  return `S$${Math.round(amountMinor / 100).toLocaleString("en-SG")}`;
}

function roundMinor(value: number) {
  return Math.round(value);
}
