import { projectFire, type ProjectionInput, type ProjectionResult } from "./projectionEngine";

export type ScenarioKind = "baseline" | "optimistic" | "conservative" | "custom";

export type ScenarioAdjustment = {
  expectedReturnRateDelta?: number;
  inflationRateDelta?: number;
  annualSavingsMinorDelta?: number;
  annualExpensesMinorDelta?: number;
};

export type ScenarioDefinition = {
  id: string;
  label: string;
  kind: ScenarioKind;
  adjustment: ScenarioAdjustment;
};

export type ScenarioComparisonResult = {
  scenario: ScenarioDefinition;
  projection: ProjectionResult;
  fiAgeDelta?: number;
  targetFireNumberDeltaMinor: number;
  finalNetWorthDeltaMinor: number;
};

export const defaultScenarioDefinitions: ScenarioDefinition[] = [
  {
    id: "baseline",
    label: "Baseline",
    kind: "baseline",
    adjustment: {},
  },
  {
    id: "optimistic",
    label: "Optimistic",
    kind: "optimistic",
    adjustment: {
      expectedReturnRateDelta: 0.015,
      inflationRateDelta: -0.005,
      annualSavingsMinorDelta: 500_000,
      annualExpensesMinorDelta: -200_000,
    },
  },
  {
    id: "conservative",
    label: "Conservative",
    kind: "conservative",
    adjustment: {
      expectedReturnRateDelta: -0.015,
      inflationRateDelta: 0.005,
      annualSavingsMinorDelta: -500_000,
      annualExpensesMinorDelta: 300_000,
    },
  },
];

export function compareFireScenarios(input: {
  baseProjectionInput: ProjectionInput;
  customScenarios?: ScenarioDefinition[];
}): ScenarioComparisonResult[] {
  const scenarios = [...defaultScenarioDefinitions, ...(input.customScenarios ?? [])];
  const baselineScenario = scenarios.find((scenario) => scenario.kind === "baseline");

  if (!baselineScenario) {
    throw new Error("A baseline scenario is required.");
  }

  const baselineProjection = projectFire(
    applyScenarioAdjustment(input.baseProjectionInput, baselineScenario.adjustment),
  );

  return scenarios.map((scenario) => {
    const projection =
      scenario.id === baselineScenario.id
        ? baselineProjection
        : projectFire(applyScenarioAdjustment(input.baseProjectionInput, scenario.adjustment));

    return {
      scenario,
      projection,
      fiAgeDelta: compareOptionalNumber(projection.fiAge, baselineProjection.fiAge),
      targetFireNumberDeltaMinor:
        projection.targetFireNumberMinor - baselineProjection.targetFireNumberMinor,
      finalNetWorthDeltaMinor: projection.finalNetWorthMinor - baselineProjection.finalNetWorthMinor,
    };
  });
}

export function applyScenarioAdjustment(
  input: ProjectionInput,
  adjustment: ScenarioAdjustment,
): ProjectionInput {
  return {
    ...input,
    expectedReturnRate: Math.max(
      -0.99,
      input.expectedReturnRate + (adjustment.expectedReturnRateDelta ?? 0),
    ),
    inflationRate: Math.max(-0.99, input.inflationRate + (adjustment.inflationRateDelta ?? 0)),
    annualSavingsMinor: Math.max(
      0,
      input.annualSavingsMinor + (adjustment.annualSavingsMinorDelta ?? 0),
    ),
    annualExpensesMinor: Math.max(
      0,
      input.annualExpensesMinor + (adjustment.annualExpensesMinorDelta ?? 0),
    ),
  };
}

function compareOptionalNumber(left: number | undefined, right: number | undefined) {
  if (left === undefined || right === undefined) {
    return undefined;
  }

  return left - right;
}
