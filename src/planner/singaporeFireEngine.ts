export type CpfAccountBalances = {
  oaMinor: number;
  saMinor: number;
  maMinor: number;
  raMinor?: number;
};

export type SingaporeFireInput = {
  currentAge: number;
  targetRetirementAge: number;
  lifeExpectancyAge: number;
  currentYear: number;
  liquidAssetsMinor: number;
  cpf: CpfAccountBalances;
  annualIncomeMinor: number;
  annualBonusMinor?: number;
  monthlyInvestmentMinor: number;
  annualRetirementSpendMinor: number;
  annualHealthcareSpendMinor?: number;
  dependantSupportAnnualMinor?: number;
  propertyValueMinor?: number;
  mortgageBalanceMinor?: number;
  annualMortgagePaymentMinor?: number;
  safeWithdrawalRate: number;
  liquidReturnRate: number;
  inflationRate: number;
  propertyGrowthRate?: number;
  assumptions?: Partial<SingaporeFireAssumptions>;
};

export type CpfContributionRates = {
  employeeRate: number;
  employerRate: number;
};

export type CpfAllocation = {
  oaRatio: number;
  saRatio: number;
  maRatio: number;
  raRatio: number;
};

export type CpfContributionEstimate = {
  pensionableIncomeMinor: number;
  employeeContributionMinor: number;
  employerContributionMinor: number;
  totalContributionMinor: number;
  allocation: CpfAllocation;
  allocatedOaMinor: number;
  allocatedSaMinor: number;
  allocatedMaMinor: number;
  allocatedRaMinor: number;
};

export type SingaporeFireAssumptions = {
  annualCpfWageCeilingMinor: number;
  oaInterestRate: number;
  saInterestRate: number;
  maInterestRate: number;
  raInterestRate: number;
  fullRetirementSumMinor: number;
  basicHealthcareReserveMinor: number;
  cpfLifePayoutStartAge: number;
  cpfLifeAnnualPayoutRate: number;
  propertyUnlockRatio: number;
};

export type SingaporeFireMilestone =
  | "target_retirement_age"
  | "fire_ready"
  | "cpf_full_retirement_sum"
  | "cpf_life_payout"
  | "life_expectancy";

export type SingaporeFireProjectionYear = {
  yearIndex: number;
  calendarYear: number;
  age: number;
  employmentIncomeMinor: number;
  retirementSpendMinor: number;
  healthcareSpendMinor: number;
  cpfContribution: CpfContributionEstimate;
  cpfOaMinor: number;
  cpfSaMinor: number;
  cpfMaMinor: number;
  cpfRaMinor: number;
  cpfLifeAnnualPayoutMinor: number;
  liquidAssetsMinor: number;
  propertyValueMinor: number;
  mortgageBalanceMinor: number;
  propertyEquityMinor: number;
  targetCorpusMinor: number;
  healthcareReserveGapMinor: number;
  totalFireAssetsMinor: number;
  fireProgress: number;
  retirementSpendCoverageRatio: number;
  milestones: SingaporeFireMilestone[];
};

export type SingaporeFireProjectionResult = {
  fireReadyAge?: number;
  fireReadyYear?: number;
  targetRetirementGapYears: number;
  firstCpfFullRetirementSumAge?: number;
  finalLiquidAssetsMinor: number;
  finalCpfTotalMinor: number;
  finalPropertyEquityMinor: number;
  finalTargetCorpusMinor: number;
  years: SingaporeFireProjectionYear[];
  assumptions: SingaporeFireAssumptions;
  caveats: string[];
};

export const defaultSingaporeFireAssumptions: SingaporeFireAssumptions = {
  annualCpfWageCeilingMinor: 10_200_000,
  oaInterestRate: 0.025,
  saInterestRate: 0.04,
  maInterestRate: 0.04,
  raInterestRate: 0.04,
  fullRetirementSumMinor: 21_300_000,
  basicHealthcareReserveMinor: 7_150_000,
  cpfLifePayoutStartAge: 65,
  cpfLifeAnnualPayoutRate: 0.06,
  propertyUnlockRatio: 0,
};

export function projectSingaporeFire(input: SingaporeFireInput): SingaporeFireProjectionResult {
  validateSingaporeFireInput(input);

  const assumptions = {
    ...defaultSingaporeFireAssumptions,
    ...input.assumptions,
  };
  const maxYears = input.lifeExpectancyAge - input.currentAge;
  const years: SingaporeFireProjectionYear[] = [];
  const caveats = [
    "CPF contribution, allocation, retirement sum, and CPF LIFE values are configurable planning assumptions and should be reviewed when CPF rules change.",
    "Property equity only counts toward FIRE assets through the configured unlock ratio.",
    "Tax, SRS reliefs, insurance underwriting, and bequest goals are outside this deterministic engine.",
  ];

  let liquidAssetsMinor = input.liquidAssetsMinor;
  let cpfOaMinor = input.cpf.oaMinor;
  let cpfSaMinor = input.cpf.saMinor;
  let cpfMaMinor = input.cpf.maMinor;
  let cpfRaMinor = input.cpf.raMinor ?? 0;
  let propertyValueMinor = input.propertyValueMinor ?? 0;
  let mortgageBalanceMinor = input.mortgageBalanceMinor ?? 0;
  let fireReadyYearIndex: number | undefined;
  let firstCpfFullRetirementSumYearIndex: number | undefined;

  for (let yearIndex = 0; yearIndex <= maxYears; yearIndex += 1) {
    const age = input.currentAge + yearIndex;
    const isWorking = age < input.targetRetirementAge;
    const inflationMultiplier = (1 + input.inflationRate) ** yearIndex;
    const retirementSpendMinor = roundMinor(
      (input.annualRetirementSpendMinor + (input.dependantSupportAnnualMinor ?? 0)) *
        inflationMultiplier,
    );
    const healthcareSpendMinor = roundMinor(
      (input.annualHealthcareSpendMinor ?? 0) * inflationMultiplier,
    );
    const cpfLifeAnnualPayoutMinor =
      age >= assumptions.cpfLifePayoutStartAge
        ? roundMinor(cpfRaMinor * assumptions.cpfLifeAnnualPayoutRate)
        : 0;
    const targetCorpusMinor = calculateSingaporeFireTarget({
      annualRetirementSpendMinor: retirementSpendMinor,
      annualHealthcareSpendMinor: healthcareSpendMinor,
      cpfLifeAnnualPayoutMinor,
      safeWithdrawalRate: input.safeWithdrawalRate,
      healthcareReserveGapMinor: calculateHealthcareReserveGap(cpfMaMinor, assumptions),
    });
    const propertyEquityMinor = Math.max(0, propertyValueMinor - mortgageBalanceMinor);
    const totalFireAssetsMinor = roundMinor(
      liquidAssetsMinor +
        cpfSaMinor +
        cpfRaMinor +
        propertyEquityMinor * assumptions.propertyUnlockRatio,
    );
    const milestones: SingaporeFireMilestone[] = [];
    const fireProgress = roundRatioOrComplete(totalFireAssetsMinor, targetCorpusMinor);

    if (age === input.targetRetirementAge) {
      milestones.push("target_retirement_age");
    }
    if (age === assumptions.cpfLifePayoutStartAge) {
      milestones.push("cpf_life_payout");
    }
    if (age === input.lifeExpectancyAge) {
      milestones.push("life_expectancy");
    }
    if (cpfRaMinor >= assumptions.fullRetirementSumMinor) {
      milestones.push("cpf_full_retirement_sum");
      firstCpfFullRetirementSumYearIndex ??= yearIndex;
    }
    if (totalFireAssetsMinor >= targetCorpusMinor) {
      milestones.push("fire_ready");
      fireReadyYearIndex ??= yearIndex;
    }

    const cpfContribution = isWorking
      ? estimateCpfContribution({
          age,
          annualIncomeMinor: input.annualIncomeMinor,
          annualBonusMinor: input.annualBonusMinor ?? 0,
          assumptions,
        })
      : emptyCpfContribution(age);

    years.push({
      yearIndex,
      calendarYear: input.currentYear + yearIndex,
      age,
      employmentIncomeMinor: isWorking
        ? input.annualIncomeMinor + (input.annualBonusMinor ?? 0)
        : 0,
      retirementSpendMinor,
      healthcareSpendMinor,
      cpfContribution,
      cpfOaMinor: roundMinor(cpfOaMinor),
      cpfSaMinor: roundMinor(cpfSaMinor),
      cpfMaMinor: roundMinor(cpfMaMinor),
      cpfRaMinor: roundMinor(cpfRaMinor),
      cpfLifeAnnualPayoutMinor,
      liquidAssetsMinor: roundMinor(liquidAssetsMinor),
      propertyValueMinor: roundMinor(propertyValueMinor),
      mortgageBalanceMinor: roundMinor(mortgageBalanceMinor),
      propertyEquityMinor: roundMinor(propertyEquityMinor),
      targetCorpusMinor,
      healthcareReserveGapMinor: calculateHealthcareReserveGap(cpfMaMinor, assumptions),
      totalFireAssetsMinor,
      fireProgress,
      retirementSpendCoverageRatio: roundRatioOrComplete(
        totalFireAssetsMinor,
        retirementSpendMinor,
      ),
      milestones,
    });

    if (yearIndex === maxYears) {
      break;
    }

    const nextAge = age + 1;
    if (nextAge === 55 && cpfSaMinor > 0) {
      const transferToRaMinor = Math.min(
        cpfSaMinor,
        Math.max(0, assumptions.fullRetirementSumMinor - cpfRaMinor),
      );
      cpfSaMinor -= transferToRaMinor;
      cpfRaMinor += transferToRaMinor;
    }

    cpfOaMinor = (cpfOaMinor + cpfContribution.allocatedOaMinor) * (1 + assumptions.oaInterestRate);
    cpfSaMinor = (cpfSaMinor + cpfContribution.allocatedSaMinor) * (1 + assumptions.saInterestRate);
    cpfMaMinor = (cpfMaMinor + cpfContribution.allocatedMaMinor) * (1 + assumptions.maInterestRate);
    cpfRaMinor = (cpfRaMinor + cpfContribution.allocatedRaMinor) * (1 + assumptions.raInterestRate);

    if (isWorking) {
      liquidAssetsMinor =
        (liquidAssetsMinor + input.monthlyInvestmentMinor * 12) * (1 + input.liquidReturnRate);
    } else {
      const netRetirementSpendMinor = Math.max(
        0,
        retirementSpendMinor + healthcareSpendMinor - cpfLifeAnnualPayoutMinor,
      );
      liquidAssetsMinor =
        (liquidAssetsMinor - netRetirementSpendMinor) * (1 + input.liquidReturnRate);
    }

    propertyValueMinor *= 1 + (input.propertyGrowthRate ?? 0);
    mortgageBalanceMinor = Math.max(
      0,
      mortgageBalanceMinor - (input.annualMortgagePaymentMinor ?? 0),
    );
  }

  const finalYear = years[years.length - 1];

  return {
    fireReadyAge:
      fireReadyYearIndex === undefined ? undefined : input.currentAge + fireReadyYearIndex,
    fireReadyYear:
      fireReadyYearIndex === undefined ? undefined : input.currentYear + fireReadyYearIndex,
    targetRetirementGapYears:
      fireReadyYearIndex === undefined
        ? maxYears
        : Math.max(0, input.currentAge + fireReadyYearIndex - input.targetRetirementAge),
    firstCpfFullRetirementSumAge:
      firstCpfFullRetirementSumYearIndex === undefined
        ? undefined
        : input.currentAge + firstCpfFullRetirementSumYearIndex,
    finalLiquidAssetsMinor: finalYear.liquidAssetsMinor,
    finalCpfTotalMinor:
      finalYear.cpfOaMinor + finalYear.cpfSaMinor + finalYear.cpfMaMinor + finalYear.cpfRaMinor,
    finalPropertyEquityMinor: finalYear.propertyEquityMinor,
    finalTargetCorpusMinor: finalYear.targetCorpusMinor,
    years,
    assumptions,
    caveats,
  };
}

export function calculateSingaporeFireTarget(input: {
  annualRetirementSpendMinor: number;
  annualHealthcareSpendMinor: number;
  cpfLifeAnnualPayoutMinor: number;
  safeWithdrawalRate: number;
  healthcareReserveGapMinor: number;
}): number {
  if (
    input.annualRetirementSpendMinor < 0 ||
    input.annualHealthcareSpendMinor < 0 ||
    input.cpfLifeAnnualPayoutMinor < 0 ||
    input.healthcareReserveGapMinor < 0 ||
    input.safeWithdrawalRate <= 0
  ) {
    throw new Error("Invalid Singapore FIRE target input.");
  }

  const portfolioFundedAnnualSpendMinor = Math.max(
    0,
    input.annualRetirementSpendMinor +
      input.annualHealthcareSpendMinor -
      input.cpfLifeAnnualPayoutMinor,
  );

  return (
    Math.ceil(portfolioFundedAnnualSpendMinor / input.safeWithdrawalRate) +
    input.healthcareReserveGapMinor
  );
}

export function estimateCpfContribution(input: {
  age: number;
  annualIncomeMinor: number;
  annualBonusMinor: number;
  assumptions?: Pick<SingaporeFireAssumptions, "annualCpfWageCeilingMinor">;
}): CpfContributionEstimate {
  if (input.age <= 0 || input.annualIncomeMinor < 0 || input.annualBonusMinor < 0) {
    throw new Error("Invalid CPF contribution input.");
  }

  const assumptions = {
    annualCpfWageCeilingMinor: defaultSingaporeFireAssumptions.annualCpfWageCeilingMinor,
    ...input.assumptions,
  };
  const contributionRates = getCpfContributionRates(input.age);
  const allocation = getCpfAllocation(input.age);
  const pensionableIncomeMinor = Math.min(
    input.annualIncomeMinor + input.annualBonusMinor,
    assumptions.annualCpfWageCeilingMinor,
  );
  const employeeContributionMinor = roundMinor(
    pensionableIncomeMinor * contributionRates.employeeRate,
  );
  const employerContributionMinor = roundMinor(
    pensionableIncomeMinor * contributionRates.employerRate,
  );
  const totalContributionMinor = employeeContributionMinor + employerContributionMinor;

  return {
    pensionableIncomeMinor,
    employeeContributionMinor,
    employerContributionMinor,
    totalContributionMinor,
    allocation,
    allocatedOaMinor: roundMinor(totalContributionMinor * allocation.oaRatio),
    allocatedSaMinor: roundMinor(totalContributionMinor * allocation.saRatio),
    allocatedMaMinor: roundMinor(totalContributionMinor * allocation.maRatio),
    allocatedRaMinor: roundMinor(totalContributionMinor * allocation.raRatio),
  };
}

export function getCpfContributionRates(age: number): CpfContributionRates {
  if (age <= 55) {
    return { employerRate: 0.17, employeeRate: 0.2 };
  }
  if (age <= 60) {
    return { employerRate: 0.155, employeeRate: 0.17 };
  }
  if (age <= 65) {
    return { employerRate: 0.12, employeeRate: 0.115 };
  }
  if (age <= 70) {
    return { employerRate: 0.09, employeeRate: 0.075 };
  }

  return { employerRate: 0.075, employeeRate: 0.05 };
}

export function getCpfAllocation(age: number): CpfAllocation {
  if (age <= 35) {
    return { oaRatio: 0.6217, saRatio: 0.1621, maRatio: 0.2162, raRatio: 0 };
  }
  if (age <= 45) {
    return { oaRatio: 0.5677, saRatio: 0.1891, maRatio: 0.2432, raRatio: 0 };
  }
  if (age <= 50) {
    return { oaRatio: 0.5136, saRatio: 0.2162, maRatio: 0.2702, raRatio: 0 };
  }
  if (age <= 55) {
    return { oaRatio: 0.4055, saRatio: 0.3108, maRatio: 0.2837, raRatio: 0 };
  }
  if (age <= 60) {
    return { oaRatio: 0.3694, saRatio: 0, maRatio: 0.323, raRatio: 0.3076 };
  }
  if (age <= 65) {
    return { oaRatio: 0.149, saRatio: 0, maRatio: 0.4468, raRatio: 0.4042 };
  }
  if (age <= 70) {
    return { oaRatio: 0.0607, saRatio: 0, maRatio: 0.6363, raRatio: 0.303 };
  }

  return { oaRatio: 0.08, saRatio: 0, maRatio: 0.84, raRatio: 0.08 };
}

function calculateHealthcareReserveGap(cpfMaMinor: number, assumptions: SingaporeFireAssumptions) {
  return Math.max(0, assumptions.basicHealthcareReserveMinor - cpfMaMinor);
}

function emptyCpfContribution(age: number): CpfContributionEstimate {
  return {
    pensionableIncomeMinor: 0,
    employeeContributionMinor: 0,
    employerContributionMinor: 0,
    totalContributionMinor: 0,
    allocation: getCpfAllocation(age),
    allocatedOaMinor: 0,
    allocatedSaMinor: 0,
    allocatedMaMinor: 0,
    allocatedRaMinor: 0,
  };
}

function validateSingaporeFireInput(input: SingaporeFireInput) {
  if (
    input.currentAge <= 0 ||
    input.targetRetirementAge < input.currentAge ||
    input.lifeExpectancyAge <= input.currentAge ||
    input.currentYear < 1900 ||
    input.liquidAssetsMinor < 0 ||
    input.cpf.oaMinor < 0 ||
    input.cpf.saMinor < 0 ||
    input.cpf.maMinor < 0 ||
    (input.cpf.raMinor ?? 0) < 0 ||
    input.annualIncomeMinor < 0 ||
    (input.annualBonusMinor ?? 0) < 0 ||
    input.monthlyInvestmentMinor < 0 ||
    input.annualRetirementSpendMinor < 0 ||
    (input.annualHealthcareSpendMinor ?? 0) < 0 ||
    (input.dependantSupportAnnualMinor ?? 0) < 0 ||
    (input.propertyValueMinor ?? 0) < 0 ||
    (input.mortgageBalanceMinor ?? 0) < 0 ||
    (input.annualMortgagePaymentMinor ?? 0) < 0 ||
    input.safeWithdrawalRate <= 0 ||
    input.liquidReturnRate <= -1 ||
    input.inflationRate <= -1 ||
    (input.propertyGrowthRate ?? 0) <= -1
  ) {
    throw new Error("Invalid Singapore FIRE projection input.");
  }
}

function roundMinor(value: number) {
  return Math.round(value);
}

function roundRatio(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function roundRatioOrComplete(numerator: number, denominator: number) {
  if (denominator === 0) {
    return numerator >= 0 ? 1 : 0;
  }

  return roundRatio(numerator / denominator);
}
