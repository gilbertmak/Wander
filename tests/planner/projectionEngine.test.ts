import { describe, expect, it } from "vitest";

import {
  calculateFireTarget,
  projectFire,
  runMonteCarloProjection,
} from "../../src/planner/projectionEngine";

describe("FIRE projection engine", () => {
  it("calculates the target corpus from annual expenses and withdrawal rate", () => {
    expect(calculateFireTarget(6_000_000, 0.035)).toBe(171_428_572);
  });

  it("projects the first FI age using savings, returns, and inflation", () => {
    const result = projectFire({
      currentAge: 35,
      targetRetirementAge: 45,
      currentNetWorthMinor: 80_000_000,
      annualExpensesMinor: 4_800_000,
      annualSavingsMinor: 3_000_000,
      safeWithdrawalRate: 0.035,
      expectedReturnRate: 0.05,
      inflationRate: 0.02,
      maxYears: 30,
    });

    expect(result).toMatchObject({
      targetFireNumberMinor: 137_142_858,
      fiYearIndex: 10,
      fiAge: 45,
      retirementGapYears: 0,
      success: true,
    });
    expect(result.years[0]).toMatchObject({
      age: 35,
      netWorthMinor: 80_000_000,
      annualExpensesMinor: 4_800_000,
      fireProgress: 0.5833,
    });
    expect(result.years[10]).toMatchObject({
      age: 45,
      isFinanciallyIndependent: true,
    });
  });

  it("includes CPF contribution and interest as a separate asset bucket", () => {
    const withoutCpf = projectFire({
      currentAge: 35,
      targetRetirementAge: 45,
      currentNetWorthMinor: 20_000_000,
      annualExpensesMinor: 4_800_000,
      annualSavingsMinor: 2_000_000,
      safeWithdrawalRate: 0.035,
      expectedReturnRate: 0.04,
      inflationRate: 0.02,
      maxYears: 45,
    });
    const withCpf = projectFire({
      currentAge: 35,
      targetRetirementAge: 45,
      currentNetWorthMinor: 20_000_000,
      annualExpensesMinor: 4_800_000,
      annualSavingsMinor: 2_000_000,
      safeWithdrawalRate: 0.035,
      expectedReturnRate: 0.04,
      inflationRate: 0.02,
      cpfSettings: {
        annualContributionMinor: 1_200_000,
        annualInterestRate: 0.04,
      },
      maxYears: 45,
    });

    expect(withCpf.fiAge).toBeLessThan(withoutCpf.fiAge!);
    expect(withCpf.years[5].cpfBalanceMinor).toBeGreaterThan(0);
  });

  it("reports failure when FI is not reached within the projection horizon", () => {
    const result = projectFire({
      currentAge: 35,
      targetRetirementAge: 45,
      currentNetWorthMinor: 1_000_000,
      annualExpensesMinor: 10_000_000,
      annualSavingsMinor: 100_000,
      safeWithdrawalRate: 0.03,
      expectedReturnRate: 0.01,
      inflationRate: 0.04,
      maxYears: 5,
    });

    expect(result.success).toBe(false);
    expect(result.fiAge).toBeUndefined();
    expect(result.retirementGapYears).toBe(5);
  });

  it("runs deterministic Monte Carlo projections from a seed", () => {
    const result = runMonteCarloProjection({
      currentAge: 35,
      targetRetirementAge: 45,
      currentNetWorthMinor: 80_000_000,
      annualExpensesMinor: 4_800_000,
      annualSavingsMinor: 3_000_000,
      safeWithdrawalRate: 0.035,
      expectedReturnRate: 0.05,
      volatilityRate: 0.08,
      inflationRate: 0.02,
      maxYears: 30,
      trials: 20,
      seed: 42,
    });

    expect(result).toEqual({
      trials: 20,
      successCount: 17,
      successRate: 0.85,
      medianFiAge: 41,
      percentile10FiAge: 39,
      percentile90FiAge: 46,
    });
  });

  it("rejects invalid projection inputs", () => {
    expect(() =>
      projectFire({
        currentAge: 35,
        targetRetirementAge: 45,
        currentNetWorthMinor: 0,
        annualExpensesMinor: 4_800_000,
        annualSavingsMinor: 1_000_000,
        safeWithdrawalRate: 0,
        expectedReturnRate: 0.05,
        inflationRate: 0.02,
      }),
    ).toThrow(/Invalid FIRE projection input/i);
  });
});
