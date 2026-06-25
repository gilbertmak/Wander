import { describe, expect, it } from "vitest";

import {
  applyExpenseSnapshot,
  buildPlannerViewModel,
  buildScenarioDefinitions,
  calculateFireNumber,
  deriveAnnualizedExpenses,
  projectFireScenario,
} from "../../src/domain/planner/projection";
import { sampleExpenseSnapshot, samplePlannerProfile } from "../../src/domain/planner/sampleData";

describe("FIRE planner projection", () => {
  it("calculates the target FIRE number from expenses and withdrawal rate", () => {
    expect(calculateFireNumber(56_700, 0.035)).toBe(1_620_000);
  });

  it("annualizes imported expense snapshots from net spend", () => {
    expect(deriveAnnualizedExpenses(sampleExpenseSnapshot)).toBe(51_100);
  });

  it("preserves manual expense assumptions unless the snapshot is accepted", () => {
    expect(applyExpenseSnapshot(samplePlannerProfile, sampleExpenseSnapshot, false).annualExpenses).toBe(
      56_700,
    );
    expect(applyExpenseSnapshot(samplePlannerProfile, sampleExpenseSnapshot, true).annualExpenses).toBe(
      51_100,
    );
  });

  it("projects the baseline FI age and progress deterministically", () => {
    const result = projectFireScenario({
      id: "baseline",
      label: "Baseline",
      profile: samplePlannerProfile,
    });

    expect(result.targetFireNumber).toBe(1_620_000);
    expect(result.currentFireProgress).toBeCloseTo(0.679, 3);
    expect(result.projectedFireAge).toBe(41);
    expect(result.yearsToFire).toBe(5);
    expect(result.targetRetirementGapYears).toBe(-4);
  });

  it("builds baseline, optimistic, conservative, and custom scenarios", () => {
    const customProfile = {
      ...samplePlannerProfile,
      annualContribution: 84_000,
      expectedReturnRate: 0.06,
    };
    const viewModel = buildPlannerViewModel(
      samplePlannerProfile,
      sampleExpenseSnapshot,
      false,
      customProfile,
    );

    expect(viewModel.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      "baseline",
      "optimistic",
      "conservative",
      "custom",
    ]);

    const definitions = buildScenarioDefinitions(samplePlannerProfile, customProfile);
    const projected = definitions.map(projectFireScenario);
    const optimistic = projected.find((scenario) => scenario.scenarioId === "optimistic");
    const conservative = projected.find((scenario) => scenario.scenarioId === "conservative");

    expect(optimistic?.yearsToFire).toBeLessThan(viewModel.baseline.yearsToFire ?? Number.MAX_VALUE);
    expect(conservative?.yearsToFire).toBeGreaterThan(viewModel.baseline.yearsToFire ?? 0);
  });

  it("rejects invalid snapshot periods", () => {
    expect(() =>
      deriveAnnualizedExpenses({
        ...sampleExpenseSnapshot,
        periodStart: "2026-07-01",
        periodEnd: "2026-06-01",
      }),
    ).toThrow(/period end/i);
  });
});
