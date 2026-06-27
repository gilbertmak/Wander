import { buildDecisionTrace, type DecisionTrace } from "../explainability/decisionTrace";
import type { GoalGapPlan } from "./goalGapPlanner";
import type { SingaporeFireProjectionResult } from "./singaporeFireEngine";

export type AdvisorInsightType =
  | "on_track"
  | "savings_gap"
  | "expense_drift"
  | "cpf_shortfall"
  | "goal_conflict"
  | "sequence_risk"
  | "emergency_reserve"
  | "retirement_spending_risk";

export type AdvisorSeverity = "info" | "warning" | "critical";

export type AdvisorInsightInput = {
  profileId: string;
  projectionRunId?: string;
  currentDate: string;
  projection: SingaporeFireProjectionResult;
  goalPlan: GoalGapPlan;
  monthlyNetSpendMinor: number;
  monthlyIncomeMinor: number;
  monthlyInvestmentMinor: number;
  emergencyReserveMinor: number;
  monthlyExpenseTrendRate?: number;
  ruleVersion?: string;
};

export type AdvisorInsight = {
  id: string;
  profileId: string;
  projectionRunId?: string;
  insightType: AdvisorInsightType;
  severity: AdvisorSeverity;
  title: string;
  body: string;
  recommendedAction: string;
  confidenceScore: number;
  priorityScore: number;
  sourceRecordIds: string[];
  trace: DecisionTrace;
};

export type AdvisorInsightPlan = {
  profileId: string;
  generatedAt: string;
  insights: AdvisorInsight[];
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    topAction?: string;
  };
};

type InsightDraft = Omit<AdvisorInsight, "id" | "profileId" | "projectionRunId" | "trace"> & {
  inputFacts: Record<string, unknown>;
  outputValue: Record<string, unknown>;
  caveats?: string[];
};

export function generateAdvisorInsights(input: AdvisorInsightInput): AdvisorInsightPlan {
  validateAdvisorInsightInput(input);

  const ruleVersion = input.ruleVersion ?? "advisor-r3-v1";
  const drafts = [
    buildSavingsGapInsight(input),
    buildGoalConflictInsight(input),
    buildCpfShortfallInsight(input),
    buildEmergencyReserveInsight(input),
    buildExpenseDriftInsight(input),
    buildRetirementSpendingRiskInsight(input),
    buildOnTrackInsight(input),
  ].filter((draft): draft is InsightDraft => draft !== undefined);

  const insights = drafts
    .map((draft) => finalizeInsight(draft, input, ruleVersion))
    .sort(compareInsights);

  return {
    profileId: input.profileId,
    generatedAt: input.currentDate,
    insights,
    summary: {
      criticalCount: insights.filter((insight) => insight.severity === "critical").length,
      warningCount: insights.filter((insight) => insight.severity === "warning").length,
      infoCount: insights.filter((insight) => insight.severity === "info").length,
      topAction: insights[0]?.recommendedAction,
    },
  };
}

export function toAdvisorInsightInsert(insight: AdvisorInsight) {
  return {
    id: insight.id,
    profileId: insight.profileId,
    projectionRunId: insight.projectionRunId,
    insightType: insight.insightType,
    severity: insight.severity,
    title: insight.title,
    body: insight.body,
    recommendedAction: insight.recommendedAction,
    confidenceScore: insight.confidenceScore,
    traceId: insight.trace.id,
    status: "open",
  };
}

function buildSavingsGapInsight(input: AdvisorInsightInput): InsightDraft | undefined {
  if (input.goalPlan.monthlyShortfallMinor <= 0) {
    return undefined;
  }

  return {
    insightType: "savings_gap",
    severity:
      input.goalPlan.monthlyShortfallMinor > input.monthlyIncomeMinor * 0.1
        ? "critical"
        : "warning",
    title: "Goal funding gap",
    body: `Active goals need ${formatMinor(input.goalPlan.requiredMonthlyFundingMinor)} monthly, above the current available goal budget.`,
    recommendedAction: `Increase goal funding by ${formatMinor(input.goalPlan.monthlyShortfallMinor)} monthly or resize the lowest-priority goal.`,
    confidenceScore: 0.9,
    priorityScore: scorePriority("savings_gap", input.goalPlan.monthlyShortfallMinor),
    sourceRecordIds: input.goalPlan.goalItems.map((goal) => goal.goalId),
    inputFacts: {
      requiredMonthlyFundingMinor: input.goalPlan.requiredMonthlyFundingMinor,
      availableMonthlyFundingMinor: input.goalPlan.availableMonthlyFundingMinor,
      monthlyIncomeMinor: input.monthlyIncomeMinor,
    },
    outputValue: {
      monthlyShortfallMinor: input.goalPlan.monthlyShortfallMinor,
    },
  };
}

function buildGoalConflictInsight(input: AdvisorInsightInput): InsightDraft | undefined {
  if (input.goalPlan.retirementGoalConflictMinor <= 0) {
    return undefined;
  }

  return {
    insightType: "goal_conflict",
    severity: "critical",
    title: "Goal competes with FIRE target",
    body: `Current goal timing can pull ${formatMinor(input.goalPlan.retirementGoalConflictMinor)} below the retirement-year FIRE target.`,
    recommendedAction: "Move the goal date, lower the target, or fund it from a separate bucket.",
    confidenceScore: 0.86,
    priorityScore: scorePriority("goal_conflict", input.goalPlan.retirementGoalConflictMinor),
    sourceRecordIds: input.goalPlan.goalItems
      .filter((goal) => goal.fireConflictMinor > 0)
      .map((goal) => goal.goalId),
    inputFacts: {
      retirementGoalConflictMinor: input.goalPlan.retirementGoalConflictMinor,
      fireReadyAge: input.projection.fireReadyAge,
    },
    outputValue: {
      conflictMinor: input.goalPlan.retirementGoalConflictMinor,
    },
  };
}

function buildCpfShortfallInsight(input: AdvisorInsightInput): InsightDraft | undefined {
  if (input.projection.firstCpfFullRetirementSumAge !== undefined) {
    return undefined;
  }

  const lastYear = input.projection.years.at(-1)!;
  const shortfallMinor = Math.max(
    0,
    input.projection.assumptions.fullRetirementSumMinor - lastYear.cpfRaMinor,
  );

  if (shortfallMinor === 0) {
    return undefined;
  }

  return {
    insightType: "cpf_shortfall",
    severity: "warning",
    title: "CPF retirement sum gap",
    body: `Projected RA balance does not reach the configured Full Retirement Sum; estimated gap is ${formatMinor(shortfallMinor)}.`,
    recommendedAction: "Review CPF top-up, retirement age, or CPF LIFE payout assumptions.",
    confidenceScore: 0.78,
    priorityScore: scorePriority("cpf_shortfall", shortfallMinor),
    sourceRecordIds: ["cpf_projection"],
    inputFacts: {
      finalCpfRaMinor: lastYear.cpfRaMinor,
      fullRetirementSumMinor: input.projection.assumptions.fullRetirementSumMinor,
    },
    outputValue: {
      cpfShortfallMinor: shortfallMinor,
    },
    caveats: ["CPF policy-sensitive assumptions require review before real-data use."],
  };
}

function buildEmergencyReserveInsight(input: AdvisorInsightInput): InsightDraft | undefined {
  const requiredReserveMinor = input.monthlyNetSpendMinor * 6;
  const reserveGapMinor = Math.max(0, requiredReserveMinor - input.emergencyReserveMinor);

  if (reserveGapMinor === 0) {
    return undefined;
  }

  return {
    insightType: "emergency_reserve",
    severity: reserveGapMinor > input.monthlyNetSpendMinor * 3 ? "critical" : "warning",
    title: "Emergency reserve gap",
    body: `Emergency reserve covers ${roundRatio(input.emergencyReserveMinor / input.monthlyNetSpendMinor)} months of current spending.`,
    recommendedAction: `Build another ${formatMinor(reserveGapMinor)} before increasing discretionary goals.`,
    confidenceScore: 0.88,
    priorityScore: scorePriority("emergency_reserve", reserveGapMinor),
    sourceRecordIds: ["emergency_reserve"],
    inputFacts: {
      emergencyReserveMinor: input.emergencyReserveMinor,
      monthlyNetSpendMinor: input.monthlyNetSpendMinor,
      requiredReserveMinor,
    },
    outputValue: {
      reserveGapMinor,
    },
  };
}

function buildExpenseDriftInsight(input: AdvisorInsightInput): InsightDraft | undefined {
  const trendRate = input.monthlyExpenseTrendRate ?? 0;

  if (trendRate <= 0.05) {
    return undefined;
  }

  return {
    insightType: "expense_drift",
    severity: trendRate >= 0.15 ? "critical" : "warning",
    title: "Spending drift",
    body: `Monthly spending trend is up ${Math.round(trendRate * 100)}%, which can delay FIRE if it persists.`,
    recommendedAction:
      "Open the expense breakdown and review recurring or discretionary increases.",
    confidenceScore: 0.74,
    priorityScore: scorePriority("expense_drift", trendRate * input.monthlyNetSpendMinor),
    sourceRecordIds: ["expense_snapshot"],
    inputFacts: {
      monthlyExpenseTrendRate: trendRate,
      monthlyNetSpendMinor: input.monthlyNetSpendMinor,
    },
    outputValue: {
      trendRate,
    },
  };
}

function buildRetirementSpendingRiskInsight(input: AdvisorInsightInput): InsightDraft | undefined {
  const fireReadyAge = input.projection.fireReadyAge;

  if (fireReadyAge !== undefined && fireReadyAge <= input.projection.years[0].age + 20) {
    return undefined;
  }

  const finalYear = input.projection.years.at(-1)!;

  return {
    insightType: "retirement_spending_risk",
    severity: "warning",
    title: "Retirement spending target needs review",
    body: "The projection does not reach FIRE within the expected planning window under current spend assumptions.",
    recommendedAction:
      "Review retirement spending, target age, and investment assumptions before relying on the FIRE date.",
    confidenceScore: 0.8,
    priorityScore: scorePriority("retirement_spending_risk", finalYear.targetCorpusMinor),
    sourceRecordIds: ["fire_projection"],
    inputFacts: {
      fireReadyAge,
      finalTargetCorpusMinor: finalYear.targetCorpusMinor,
      finalFireProgress: finalYear.fireProgress,
    },
    outputValue: {
      fireReadyAge,
      finalFireProgress: finalYear.fireProgress,
    },
  };
}

function buildOnTrackInsight(input: AdvisorInsightInput): InsightDraft | undefined {
  const hasWarnings =
    input.goalPlan.monthlyShortfallMinor > 0 ||
    input.goalPlan.retirementGoalConflictMinor > 0 ||
    input.emergencyReserveMinor < input.monthlyNetSpendMinor * 6 ||
    (input.monthlyExpenseTrendRate ?? 0) > 0.05;

  if (hasWarnings || input.projection.fireReadyAge === undefined) {
    return undefined;
  }

  return {
    insightType: "on_track",
    severity: "info",
    title: "Plan is on track",
    body: `Projected FIRE age is ${input.projection.fireReadyAge}, with active goal funding inside the available monthly budget.`,
    recommendedAction:
      "Keep current savings rate and review assumptions after the next statement import.",
    confidenceScore: 0.82,
    priorityScore: 10,
    sourceRecordIds: ["fire_projection"],
    inputFacts: {
      fireReadyAge: input.projection.fireReadyAge,
      monthlyShortfallMinor: input.goalPlan.monthlyShortfallMinor,
      emergencyReserveMinor: input.emergencyReserveMinor,
    },
    outputValue: {
      status: "on_track",
    },
  };
}

function finalizeInsight(
  draft: InsightDraft,
  input: AdvisorInsightInput,
  ruleVersion: string,
): AdvisorInsight {
  const trace = buildDecisionTrace({
    profileId: input.profileId,
    sourceModule: "advisor_insight",
    sourceRecordId: draft.insightType,
    sourceRecordIds: draft.sourceRecordIds,
    ruleVersion,
    inputFacts: draft.inputFacts,
    outputValue: draft.outputValue,
    confidenceScore: draft.confidenceScore,
    explanationText: draft.body,
    caveats: draft.caveats,
  });

  return {
    id: `advisor_${trace.id.replace("trace_", "")}`,
    profileId: input.profileId,
    projectionRunId: input.projectionRunId,
    insightType: draft.insightType,
    severity: draft.severity,
    title: draft.title,
    body: draft.body,
    recommendedAction: draft.recommendedAction,
    confidenceScore: draft.confidenceScore,
    priorityScore: draft.priorityScore,
    sourceRecordIds: draft.sourceRecordIds,
    trace,
  };
}

function compareInsights(left: AdvisorInsight, right: AdvisorInsight) {
  if (severityRank(left.severity) !== severityRank(right.severity)) {
    return severityRank(right.severity) - severityRank(left.severity);
  }

  return right.priorityScore - left.priorityScore;
}

function severityRank(severity: AdvisorSeverity) {
  return severity === "critical" ? 3 : severity === "warning" ? 2 : 1;
}

function scorePriority(type: AdvisorInsightType, amount: number) {
  const base: Record<AdvisorInsightType, number> = {
    goal_conflict: 90,
    emergency_reserve: 80,
    savings_gap: 75,
    retirement_spending_risk: 70,
    cpf_shortfall: 60,
    expense_drift: 55,
    sequence_risk: 50,
    on_track: 10,
  };

  return base[type] + Math.min(20, Math.round(Math.abs(amount) / 1_000_000));
}

function validateAdvisorInsightInput(input: AdvisorInsightInput) {
  if (
    input.monthlyNetSpendMinor <= 0 ||
    input.monthlyIncomeMinor < 0 ||
    input.monthlyInvestmentMinor < 0 ||
    input.emergencyReserveMinor < 0
  ) {
    throw new Error("Invalid advisor insight input.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.currentDate)) {
    throw new Error("Advisor insight date must use ISO YYYY-MM-DD format.");
  }
}

function formatMinor(amountMinor: number) {
  return `S$${Math.round(amountMinor / 100).toLocaleString("en-SG")}`;
}

function roundRatio(value: number) {
  return Math.round(value * 10) / 10;
}
