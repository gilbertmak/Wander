import { describe, expect, it } from "vitest";

import {
  applyStressScenario,
  defaultStressScenarios,
  runSingaporeStressTests,
} from "../../src/planner/singaporeStressTesting";
import type { SingaporeFireInput } from "../../src/planner/singaporeFireEngine";

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

describe("Singapore stress testing", () => {
  it("runs default stress scenarios and ranks the largest risk", () => {
    const report = runSingaporeStressTests({ baseInput: fireInput });

    expect(report.results).toHaveLength(defaultStressScenarios.length);
    expect(report.baselineFireReadyAge).toBe(42);
    expect(report.worstScenario.severity).toMatch(/low|medium|high/);
    expect(report.summary).toContain(report.worstScenario.scenario.label);
  });

  it("applies scenario adjustments without mutating the base input", () => {
    const stressed = applyStressScenario(fireInput, {
      id: "custom",
      label: "Custom shock",
      kind: "income_pause",
      description: "Test",
      adjustments: {
        annualIncomeMinorDelta: -20_000_000,
        monthlyInvestmentMinorDelta: -900_000,
        inflationRateDelta: 0.02,
      },
    });

    expect(stressed.annualIncomeMinor).toBe(0);
    expect(stressed.monthlyInvestmentMinor).toBe(0);
    expect(stressed.inflationRate).toBe(0.045);
    expect(fireInput.annualIncomeMinor).toBe(14_400_000);
  });

  it("marks severe scenarios when FIRE is delayed materially", () => {
    const report = runSingaporeStressTests({
      baseInput: fireInput,
      scenarios: [
        {
          id: "severe_market",
          label: "Severe market",
          kind: "market_shock",
          description: "Large return shock",
          adjustments: {
            liquidReturnRateDelta: -0.08,
            inflationRateDelta: 0.04,
            monthlyInvestmentMinorDelta: -500_000,
          },
        },
      ],
    });

    expect(report.results[0].severity).toBe("high");
    expect(report.results[0].recommendedAction).toMatch(/mitigation plan/i);
  });

  it("requires at least one stress scenario", () => {
    expect(() => runSingaporeStressTests({ baseInput: fireInput, scenarios: [] })).toThrow(
      /At least one stress scenario/i,
    );
  });
});
