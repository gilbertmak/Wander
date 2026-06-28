import type { AdvisorInsightPlan } from "./advisorInsightEngine";
import type { GoalGapPlan } from "./goalGapPlanner";
import type { SingaporeFireProjectionResult } from "./singaporeFireEngine";

export type CommandCentreStatus = "on_track" | "watch" | "action_needed";

export type CommandCentreSnapshot = {
  status: CommandCentreStatus;
  headline: string;
  fireProgressPercent: number;
  fireReadyAge?: number;
  targetRetirementAge: number;
  targetCorpusMinor: number;
  currentFireAssetsMinor: number;
  monthlyGoalShortfallMinor: number;
  retirementGoalConflictMinor: number;
  cpfFullRetirementSumAge?: number;
  emergencyReserveMonths: number;
  topAdvisorAction: string;
  activeGoalCount: number;
  nextMilestones: Array<{
    label: string;
    age?: number;
    calendarYear?: number;
    tone: "good" | "watch" | "critical";
  }>;
  commandCards: Array<{
    id: string;
    label: string;
    value: string;
    detail: string;
    tone: "good" | "watch" | "critical" | "neutral";
  }>;
};

export type CommandCentreSnapshotInput = {
  projection: SingaporeFireProjectionResult;
  goalPlan: GoalGapPlan;
  advisorPlan: Pick<AdvisorInsightPlan, "summary">;
  monthlyNetSpendMinor: number;
  emergencyReserveMinor: number;
};

export function buildCommandCentreSnapshot(
  input: CommandCentreSnapshotInput,
): CommandCentreSnapshot {
  validateCommandCentreInput(input);

  const currentYear = input.projection.years[0];
  const retirementYear =
    input.projection.years.find((year) => year.milestones.includes("target_retirement_age")) ??
    currentYear;
  const fireProgressPercent = Math.min(999, Math.round(currentYear.fireProgress * 100));
  const emergencyReserveMonths = roundOneDecimal(
    input.emergencyReserveMinor / input.monthlyNetSpendMinor,
  );
  const status = classifyCommandCentreStatus(input, emergencyReserveMonths);
  const headline = buildHeadline(status, input);
  const topAdvisorAction =
    input.advisorPlan.summary.topAction ?? "Review FIRE assumptions after the next import.";

  return {
    status,
    headline,
    fireProgressPercent,
    fireReadyAge: input.projection.fireReadyAge,
    targetRetirementAge: retirementYear.age,
    targetCorpusMinor: currentYear.targetCorpusMinor,
    currentFireAssetsMinor: currentYear.totalFireAssetsMinor,
    monthlyGoalShortfallMinor: input.goalPlan.monthlyShortfallMinor,
    retirementGoalConflictMinor: input.goalPlan.retirementGoalConflictMinor,
    cpfFullRetirementSumAge: input.projection.firstCpfFullRetirementSumAge,
    emergencyReserveMonths,
    topAdvisorAction,
    activeGoalCount: input.goalPlan.activeGoalCount,
    nextMilestones: buildMilestones(input.projection),
    commandCards: buildCommandCards(input, fireProgressPercent, emergencyReserveMonths),
  };
}

function classifyCommandCentreStatus(
  input: CommandCentreSnapshotInput,
  emergencyReserveMonths: number,
): CommandCentreStatus {
  if (
    input.advisorPlan.summary.criticalCount > 0 ||
    input.goalPlan.retirementGoalConflictMinor > 0 ||
    emergencyReserveMonths < 3
  ) {
    return "action_needed";
  }
  if (
    input.advisorPlan.summary.warningCount > 0 ||
    input.goalPlan.monthlyShortfallMinor > 0 ||
    emergencyReserveMonths < 6
  ) {
    return "watch";
  }

  return "on_track";
}

function buildHeadline(status: CommandCentreStatus, input: CommandCentreSnapshotInput) {
  if (status === "action_needed") {
    return "One planning constraint needs attention before the FIRE date is reliable.";
  }
  if (status === "watch") {
    return "FIRE plan is moving, with goal or reserve pressure to monitor.";
  }

  return `FIRE path is on track for age ${input.projection.fireReadyAge ?? "n/a"}.`;
}

function buildMilestones(projection: SingaporeFireProjectionResult) {
  const milestones: CommandCentreSnapshot["nextMilestones"] = [];
  const fireReadyRow = projection.years.find((year) => year.milestones.includes("fire_ready"));
  const cpfLifeRow = projection.years.find((year) => year.milestones.includes("cpf_life_payout"));
  const retirementRow = projection.years.find((year) =>
    year.milestones.includes("target_retirement_age"),
  );

  if (fireReadyRow) {
    milestones.push({
      label: "FIRE ready",
      age: fireReadyRow.age,
      calendarYear: fireReadyRow.calendarYear,
      tone: "good",
    });
  }
  if (retirementRow) {
    milestones.push({
      label: "Target retirement",
      age: retirementRow.age,
      calendarYear: retirementRow.calendarYear,
      tone: fireReadyRow && fireReadyRow.age <= retirementRow.age ? "good" : "watch",
    });
  }
  if (cpfLifeRow) {
    milestones.push({
      label: "CPF LIFE starts",
      age: cpfLifeRow.age,
      calendarYear: cpfLifeRow.calendarYear,
      tone: "watch",
    });
  }

  return milestones.slice(0, 3);
}

function buildCommandCards(
  input: CommandCentreSnapshotInput,
  fireProgressPercent: number,
  emergencyReserveMonths: number,
): CommandCentreSnapshot["commandCards"] {
  const currentYear = input.projection.years[0];
  const cpfTone = input.projection.firstCpfFullRetirementSumAge ? "good" : "watch";

  return [
    {
      id: "fire_progress",
      label: "FI progress",
      value: `${fireProgressPercent}%`,
      detail: `${formatMinor(currentYear.totalFireAssetsMinor)} of ${formatMinor(currentYear.targetCorpusMinor)}`,
      tone: fireProgressPercent >= 100 ? "good" : fireProgressPercent >= 70 ? "watch" : "neutral",
    },
    {
      id: "goal_gap",
      label: "Goal gap",
      value: formatMinor(input.goalPlan.totalRemainingGapMinor),
      detail:
        input.goalPlan.monthlyShortfallMinor > 0
          ? `${formatMinor(input.goalPlan.monthlyShortfallMinor)} monthly shortfall`
          : "Current monthly allocation covers active goals",
      tone: input.goalPlan.monthlyShortfallMinor > 0 ? "critical" : "good",
    },
    {
      id: "cpf",
      label: "CPF checkpoint",
      value: input.projection.firstCpfFullRetirementSumAge
        ? `Age ${input.projection.firstCpfFullRetirementSumAge}`
        : "Review",
      detail: "Configured Full Retirement Sum milestone",
      tone: cpfTone,
    },
    {
      id: "reserve",
      label: "Emergency reserve",
      value: `${emergencyReserveMonths} months`,
      detail: "Target range: 6 months of net spend",
      tone:
        emergencyReserveMonths >= 6 ? "good" : emergencyReserveMonths >= 3 ? "watch" : "critical",
    },
  ];
}

function validateCommandCentreInput(input: CommandCentreSnapshotInput) {
  if (input.projection.years.length === 0 || input.monthlyNetSpendMinor <= 0) {
    throw new Error("Invalid command centre dashboard input.");
  }
  if (input.emergencyReserveMinor < 0) {
    throw new Error("Invalid command centre dashboard input.");
  }
}

function formatMinor(amountMinor: number) {
  return `S$${Math.round(amountMinor / 100).toLocaleString("en-SG")}`;
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
