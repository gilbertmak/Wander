import { describe, expect, it } from "vitest";

import {
  applyScenarioAdjustment,
  compareFireScenarios,
} from "../../src/planner/scenarioComparison";
import type { ProjectionInput } from "../../src/planner/projectionEngine";

const baseProjectionInput: ProjectionInput = {
  currentAge: 35,
  targetRetirementAge: 45,
  currentNetWorthMinor: 80_000_000,
  annualExpensesMinor: 4_800_000,
  annualSavingsMinor: 3_000_000,
  safeWithdrawalRate: 0.035,
  expectedReturnRate: 0.05,
  inflationRate: 0.02,
  maxYears: 30,
};

describe("FIRE scenario comparison", () => {
  it("compares baseline, optimistic, and conservative scenarios", () => {
    const [baseline, optimistic, conservative] = compareFireScenarios({
      baseProjectionInput,
    });

    expect(baseline).toMatchObject({
      scenario: { id: "baseline", kind: "baseline" },
      fiAgeDelta: 0,
      targetFireNumberDeltaMinor: 0,
      finalNetWorthDeltaMinor: 0,
    });
    expect(optimistic.scenario.id).toBe("optimistic");
    expect(optimistic.projection.fiAge).toBeLessThan(baseline.projection.fiAge!);
    expect(optimistic.fiAgeDelta).toBeLessThan(0);
    expect(optimistic.targetFireNumberDeltaMinor).toBeLessThan(0);
    expect(conservative.scenario.id).toBe("conservative");
    expect(conservative.projection.fiAge).toBeGreaterThan(baseline.projection.fiAge!);
    expect(conservative.fiAgeDelta).toBeGreaterThan(0);
    expect(conservative.targetFireNumberDeltaMinor).toBeGreaterThan(0);
  });

  it("supports custom scenarios with explicit impact against baseline", () => {
    const results = compareFireScenarios({
      baseProjectionInput,
      customScenarios: [
        {
          id: "custom_sabbatical",
          label: "One year sabbatical proxy",
          kind: "custom",
          adjustment: {
            annualSavingsMinorDelta: -2_000_000,
            annualExpensesMinorDelta: 1_000_000,
          },
        },
      ],
    });
    const baseline = results.find((result) => result.scenario.id === "baseline")!;
    const custom = results.find((result) => result.scenario.id === "custom_sabbatical")!;

    expect(custom.projection.targetFireNumberMinor).toBeGreaterThan(
      baseline.projection.targetFireNumberMinor,
    );
    expect(custom.fiAgeDelta).toBeGreaterThan(0);
    expect(custom.finalNetWorthDeltaMinor).toBeLessThan(0);
  });

  it("clamps scenario adjustments so rates and savings remain valid", () => {
    expect(
      applyScenarioAdjustment(baseProjectionInput, {
        expectedReturnRateDelta: -2,
        inflationRateDelta: -2,
        annualSavingsMinorDelta: -99_000_000,
        annualExpensesMinorDelta: -99_000_000,
      }),
    ).toMatchObject({
      expectedReturnRate: -0.99,
      inflationRate: -0.99,
      annualSavingsMinor: 0,
      annualExpensesMinor: 0,
    });
  });

  it("returns undefined FI age deltas when either scenario does not reach FI", () => {
    const [baseline, , conservative] = compareFireScenarios({
      baseProjectionInput: {
        ...baseProjectionInput,
        currentNetWorthMinor: 100_000,
        annualSavingsMinor: 100_000,
        annualExpensesMinor: 20_000_000,
        maxYears: 3,
      },
    });

    expect(baseline.projection.fiAge).toBeUndefined();
    expect(conservative.projection.fiAge).toBeUndefined();
    expect(conservative.fiAgeDelta).toBeUndefined();
  });
});
