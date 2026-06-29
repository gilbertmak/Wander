import { projectSingaporeFire, type SingaporeFireInput } from "./singaporeFireEngine";

export type StressScenarioKind =
  | "market_shock"
  | "inflation_spike"
  | "expense_shock"
  | "income_pause"
  | "late_retirement";

export type StressSeverity = "low" | "medium" | "high";

export type StressScenarioDefinition = {
  id: string;
  label: string;
  kind: StressScenarioKind;
  description: string;
  adjustments: {
    liquidReturnRateDelta?: number;
    inflationRateDelta?: number;
    annualRetirementSpendMinorDelta?: number;
    annualHealthcareSpendMinorDelta?: number;
    monthlyInvestmentMinorDelta?: number;
    annualIncomeMinorDelta?: number;
    targetRetirementAgeDelta?: number;
  };
};

export type StressScenarioResult = {
  scenario: StressScenarioDefinition;
  fireReadyAge?: number;
  fireReadyAgeDelta?: number;
  finalFireProgress: number;
  finalFireGapMinor: number;
  targetRetirementGapYears: number;
  severity: StressSeverity;
  recommendedAction: string;
};

export type StressTestReport = {
  baselineFireReadyAge?: number;
  baselineFinalFireProgress: number;
  results: StressScenarioResult[];
  worstScenario: StressScenarioResult;
  summary: string;
};

export const defaultStressScenarios: StressScenarioDefinition[] = [
  {
    id: "market_shock",
    label: "Market shock",
    kind: "market_shock",
    description: "Liquid portfolio returns are three percentage points lower.",
    adjustments: { liquidReturnRateDelta: -0.03 },
  },
  {
    id: "inflation_spike",
    label: "Inflation spike",
    kind: "inflation_spike",
    description: "Inflation is two percentage points higher.",
    adjustments: { inflationRateDelta: 0.02 },
  },
  {
    id: "healthcare_shock",
    label: "Healthcare shock",
    kind: "expense_shock",
    description: "Annual healthcare spending rises by S$6,000.",
    adjustments: { annualHealthcareSpendMinorDelta: 600_000 },
  },
  {
    id: "income_pause",
    label: "Income pause",
    kind: "income_pause",
    description: "Annual income and monthly investing are reduced for a conservative proxy.",
    adjustments: { annualIncomeMinorDelta: -3_600_000, monthlyInvestmentMinorDelta: -300_000 },
  },
  {
    id: "late_retirement",
    label: "Retire later",
    kind: "late_retirement",
    description: "Target retirement is delayed by three years.",
    adjustments: { targetRetirementAgeDelta: 3 },
  },
];

export function runSingaporeStressTests(input: {
  baseInput: SingaporeFireInput;
  scenarios?: StressScenarioDefinition[];
}): StressTestReport {
  const scenarios = input.scenarios ?? defaultStressScenarios;
  if (scenarios.length === 0) {
    throw new Error("At least one stress scenario is required.");
  }

  const baseline = projectSingaporeFire(input.baseInput);
  const baselineFinalYear = baseline.years.at(-1)!;
  const results = scenarios.map((scenario) => {
    const projection = projectSingaporeFire(applyStressScenario(input.baseInput, scenario));
    const finalYear = projection.years.at(-1)!;
    const finalFireGapMinor = Math.max(
      0,
      finalYear.targetCorpusMinor - finalYear.totalFireAssetsMinor,
    );
    const fireReadyAgeDelta =
      projection.fireReadyAge === undefined || baseline.fireReadyAge === undefined
        ? undefined
        : projection.fireReadyAge - baseline.fireReadyAge;
    const severity = classifyStressSeverity({
      fireReadyAgeDelta,
      finalFireGapMinor,
      finalFireProgress: finalYear.fireProgress,
    });

    return {
      scenario,
      fireReadyAge: projection.fireReadyAge,
      fireReadyAgeDelta,
      finalFireProgress: finalYear.fireProgress,
      finalFireGapMinor,
      targetRetirementGapYears: projection.targetRetirementGapYears,
      severity,
      recommendedAction: buildStressAction(severity, scenario),
    };
  });
  const worstScenario = [...results].sort(compareStressResults)[0];

  return {
    baselineFireReadyAge: baseline.fireReadyAge,
    baselineFinalFireProgress: baselineFinalYear.fireProgress,
    results,
    worstScenario,
    summary: `${worstScenario.scenario.label} is the largest current stress case with ${worstScenario.severity} severity.`,
  };
}

export function applyStressScenario(
  input: SingaporeFireInput,
  scenario: StressScenarioDefinition,
): SingaporeFireInput {
  return {
    ...input,
    liquidReturnRate: Math.max(
      -0.99,
      input.liquidReturnRate + (scenario.adjustments.liquidReturnRateDelta ?? 0),
    ),
    inflationRate: Math.max(
      -0.99,
      input.inflationRate + (scenario.adjustments.inflationRateDelta ?? 0),
    ),
    annualRetirementSpendMinor: Math.max(
      0,
      input.annualRetirementSpendMinor +
        (scenario.adjustments.annualRetirementSpendMinorDelta ?? 0),
    ),
    annualHealthcareSpendMinor: Math.max(
      0,
      (input.annualHealthcareSpendMinor ?? 0) +
        (scenario.adjustments.annualHealthcareSpendMinorDelta ?? 0),
    ),
    monthlyInvestmentMinor: Math.max(
      0,
      input.monthlyInvestmentMinor + (scenario.adjustments.monthlyInvestmentMinorDelta ?? 0),
    ),
    annualIncomeMinor: Math.max(
      0,
      input.annualIncomeMinor + (scenario.adjustments.annualIncomeMinorDelta ?? 0),
    ),
    targetRetirementAge: Math.max(
      input.currentAge,
      input.targetRetirementAge + (scenario.adjustments.targetRetirementAgeDelta ?? 0),
    ),
  };
}

function classifyStressSeverity(input: {
  fireReadyAgeDelta?: number;
  finalFireGapMinor: number;
  finalFireProgress: number;
}): StressSeverity {
  if (input.fireReadyAgeDelta !== undefined && input.fireReadyAgeDelta >= 5) {
    return "high";
  }
  if (input.finalFireGapMinor > 0 || input.finalFireProgress < 1) {
    return "high";
  }
  if (input.fireReadyAgeDelta !== undefined && input.fireReadyAgeDelta >= 2) {
    return "medium";
  }

  return "low";
}

function compareStressResults(left: StressScenarioResult, right: StressScenarioResult) {
  if (severityScore(left.severity) !== severityScore(right.severity)) {
    return severityScore(right.severity) - severityScore(left.severity);
  }
  if ((left.fireReadyAgeDelta ?? -99) !== (right.fireReadyAgeDelta ?? -99)) {
    return (right.fireReadyAgeDelta ?? -99) - (left.fireReadyAgeDelta ?? -99);
  }

  return right.finalFireGapMinor - left.finalFireGapMinor;
}

function severityScore(severity: StressSeverity) {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function buildStressAction(severity: StressSeverity, scenario: StressScenarioDefinition) {
  if (severity === "high") {
    return `Run a mitigation plan for ${scenario.label}: reduce spending, delay goal funding, or increase monthly investing.`;
  }
  if (severity === "medium") {
    return `Monitor ${scenario.label} and keep a fallback savings lever ready.`;
  }

  return `${scenario.label} is tolerable under current assumptions; review after the next import.`;
}
