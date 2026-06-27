import { describe, expect, it } from "vitest";

import {
  calculateSingaporeFireTarget,
  estimateCpfContribution,
  getCpfAllocation,
  projectSingaporeFire,
  type SingaporeFireInput,
} from "../../src/planner/singaporeFireEngine";

const baseInput: SingaporeFireInput = {
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
  dependantSupportAnnualMinor: 0,
  propertyValueMinor: 120_000_000,
  mortgageBalanceMinor: 55_000_000,
  annualMortgagePaymentMinor: 3_600_000,
  safeWithdrawalRate: 0.035,
  liquidReturnRate: 0.045,
  inflationRate: 0.025,
  propertyGrowthRate: 0.01,
};

describe("Singapore FIRE engine", () => {
  it("calculates CPF contribution under the annual wage ceiling and allocation ratios", () => {
    const estimate = estimateCpfContribution({
      age: 40,
      annualIncomeMinor: 14_400_000,
      annualBonusMinor: 2_000_000,
    });

    expect(estimate.pensionableIncomeMinor).toBe(10_200_000);
    expect(estimate.employeeContributionMinor).toBe(2_040_000);
    expect(estimate.employerContributionMinor).toBe(1_734_000);
    expect(estimate.totalContributionMinor).toBe(3_774_000);
    expect(estimate.allocatedOaMinor).toBe(2_142_500);
    expect(estimate.allocatedSaMinor).toBe(713_663);
    expect(estimate.allocatedMaMinor).toBe(917_837);
  });

  it("routes post-55 allocations to RA instead of SA", () => {
    expect(getCpfAllocation(56)).toMatchObject({
      saRatio: 0,
      raRatio: 0.3076,
    });
  });

  it("reduces the required portfolio target when CPF LIFE payout starts", () => {
    const beforePayout = calculateSingaporeFireTarget({
      annualRetirementSpendMinor: 8_000_000,
      annualHealthcareSpendMinor: 1_000_000,
      cpfLifeAnnualPayoutMinor: 0,
      safeWithdrawalRate: 0.035,
      healthcareReserveGapMinor: 1_000_000,
    });
    const afterPayout = calculateSingaporeFireTarget({
      annualRetirementSpendMinor: 8_000_000,
      annualHealthcareSpendMinor: 1_000_000,
      cpfLifeAnnualPayoutMinor: 2_400_000,
      safeWithdrawalRate: 0.035,
      healthcareReserveGapMinor: 1_000_000,
    });

    expect(afterPayout).toBeLessThan(beforePayout);
    expect(beforePayout - afterPayout).toBe(68_571_429);
  });

  it("projects Singapore FIRE readiness with CPF, healthcare, and retirement milestones", () => {
    const result = projectSingaporeFire(baseInput);
    const retirementRow = result.years.find((year) => year.age === 55)!;
    const cpfLifeRow = result.years.find((year) => year.age === 65)!;
    const finalRow = result.years.at(-1)!;

    expect(result.fireReadyAge).toBe(42);
    expect(result.targetRetirementGapYears).toBe(0);
    expect(result.firstCpfFullRetirementSumAge).toBe(55);
    expect(retirementRow.milestones).toContain("target_retirement_age");
    expect(retirementRow.cpfRaMinor).toBeGreaterThan(0);
    expect(cpfLifeRow.milestones).toContain("cpf_life_payout");
    expect(cpfLifeRow.cpfLifeAnnualPayoutMinor).toBeGreaterThan(0);
    expect(finalRow.milestones).toContain("life_expectancy");
    expect(result.caveats).toEqual(expect.arrayContaining([expect.stringMatching(/CPF/i)]));
  });

  it("keeps owner-occupied property out of FIRE assets unless an unlock ratio is configured", () => {
    const withoutPropertyUnlock = projectSingaporeFire(baseInput);
    const withPropertyUnlock = projectSingaporeFire({
      ...baseInput,
      assumptions: {
        propertyUnlockRatio: 0.5,
      },
    });

    expect(withPropertyUnlock.fireReadyAge).toBeLessThan(withoutPropertyUnlock.fireReadyAge!);
    expect(withPropertyUnlock.years[0].totalFireAssetsMinor).toBeGreaterThan(
      withoutPropertyUnlock.years[0].totalFireAssetsMinor,
    );
  });

  it("draws down liquid assets after retirement when spending exceeds CPF LIFE payout", () => {
    const result = projectSingaporeFire({
      ...baseInput,
      currentAge: 64,
      targetRetirementAge: 64,
      lifeExpectancyAge: 67,
      monthlyInvestmentMinor: 0,
      liquidAssetsMinor: 60_000_000,
      cpf: {
        oaMinor: 0,
        saMinor: 0,
        maMinor: 7_500_000,
        raMinor: 25_000_000,
      },
    });

    expect(result.years[1].age).toBe(65);
    expect(result.years[1].cpfLifeAnnualPayoutMinor).toBeGreaterThan(0);
    expect(result.years[2].liquidAssetsMinor).toBeLessThan(result.years[1].liquidAssetsMinor);
  });

  it("keeps ratios finite when a placeholder profile has zero retirement spend", () => {
    const result = projectSingaporeFire({
      ...baseInput,
      annualRetirementSpendMinor: 0,
      annualHealthcareSpendMinor: 0,
      cpf: {
        oaMinor: 0,
        saMinor: 0,
        maMinor: 8_000_000,
      },
    });

    expect(result.years[0].fireProgress).toBe(1);
    expect(result.years[0].retirementSpendCoverageRatio).toBe(1);
  });

  it("rejects invalid Singapore planner inputs", () => {
    expect(() =>
      projectSingaporeFire({
        ...baseInput,
        safeWithdrawalRate: 0,
      }),
    ).toThrow(/Invalid Singapore FIRE projection input/i);
  });
});
