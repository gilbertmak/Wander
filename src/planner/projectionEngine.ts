export type CpfProjectionSettings = {
  annualContributionMinor: number;
  annualInterestRate: number;
};

export type ProjectionInput = {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorthMinor: number;
  annualExpensesMinor: number;
  annualSavingsMinor: number;
  safeWithdrawalRate: number;
  expectedReturnRate: number;
  inflationRate: number;
  cpfSettings?: CpfProjectionSettings;
  maxYears?: number;
};

export type ProjectionYear = {
  yearIndex: number;
  age: number;
  netWorthMinor: number;
  cpfBalanceMinor: number;
  annualExpensesMinor: number;
  targetFireNumberMinor: number;
  fireProgress: number;
  isFinanciallyIndependent: boolean;
};

export type ProjectionResult = {
  targetFireNumberMinor: number;
  fiYearIndex?: number;
  fiAge?: number;
  retirementGapYears: number;
  finalNetWorthMinor: number;
  success: boolean;
  years: ProjectionYear[];
};

export type MonteCarloInput = ProjectionInput & {
  trials: number;
  volatilityRate: number;
  seed: number;
};

export type MonteCarloResult = {
  trials: number;
  successCount: number;
  successRate: number;
  medianFiAge?: number;
  percentile10FiAge?: number;
  percentile90FiAge?: number;
};

export function calculateFireTarget(
  annualExpensesMinor: number,
  safeWithdrawalRate: number,
): number {
  if (annualExpensesMinor < 0 || safeWithdrawalRate <= 0) {
    throw new Error("Annual expenses and safe withdrawal rate must be positive.");
  }

  return Math.ceil(annualExpensesMinor / safeWithdrawalRate);
}

export function projectFire(input: ProjectionInput): ProjectionResult {
  validateProjectionInput(input);

  const maxYears = input.maxYears ?? 60;
  const years: ProjectionYear[] = [];
  let netWorthMinor = input.currentNetWorthMinor;
  let cpfBalanceMinor = 0;
  let fiYearIndex: number | undefined;

  for (let yearIndex = 0; yearIndex <= maxYears; yearIndex += 1) {
    const annualExpensesMinor = inflate(input.annualExpensesMinor, input.inflationRate, yearIndex);
    const targetFireNumberMinor = calculateFireTarget(annualExpensesMinor, input.safeWithdrawalRate);
    const totalAssetsMinor = netWorthMinor + cpfBalanceMinor;
    const isFinanciallyIndependent = totalAssetsMinor >= targetFireNumberMinor;

    if (isFinanciallyIndependent && fiYearIndex === undefined) {
      fiYearIndex = yearIndex;
    }

    years.push({
      yearIndex,
      age: input.currentAge + yearIndex,
      netWorthMinor: roundMinor(netWorthMinor),
      cpfBalanceMinor: roundMinor(cpfBalanceMinor),
      annualExpensesMinor,
      targetFireNumberMinor,
      fireProgress: roundRatio(totalAssetsMinor / targetFireNumberMinor),
      isFinanciallyIndependent,
    });

    if (yearIndex === maxYears) {
      break;
    }

    netWorthMinor = (netWorthMinor + input.annualSavingsMinor) * (1 + input.expectedReturnRate);
    cpfBalanceMinor =
      (cpfBalanceMinor + (input.cpfSettings?.annualContributionMinor ?? 0)) *
      (1 + (input.cpfSettings?.annualInterestRate ?? 0));
  }

  const fiAge = fiYearIndex === undefined ? undefined : input.currentAge + fiYearIndex;
  const retirementGapYears =
    fiAge === undefined ? maxYears : Math.max(0, fiAge - input.targetRetirementAge);

  return {
    targetFireNumberMinor: years[0].targetFireNumberMinor,
    fiYearIndex,
    fiAge,
    retirementGapYears,
    finalNetWorthMinor: years[years.length - 1].netWorthMinor + years[years.length - 1].cpfBalanceMinor,
    success: fiYearIndex !== undefined,
    years,
  };
}

export function runMonteCarloProjection(input: MonteCarloInput): MonteCarloResult {
  if (input.trials <= 0 || input.volatilityRate < 0) {
    throw new Error("Monte Carlo trials must be positive and volatility cannot be negative.");
  }

  const random = seededRandom(input.seed);
  const fiAges: number[] = [];

  for (let trial = 0; trial < input.trials; trial += 1) {
    const sampledReturnRate =
      input.expectedReturnRate + normalSample(random) * input.volatilityRate;
    const result = projectFire({
      ...input,
      expectedReturnRate: sampledReturnRate,
    });

    if (result.fiAge !== undefined) {
      fiAges.push(result.fiAge);
    }
  }

  fiAges.sort((left, right) => left - right);

  return {
    trials: input.trials,
    successCount: fiAges.length,
    successRate: roundRatio(fiAges.length / input.trials),
    medianFiAge: percentile(fiAges, 0.5),
    percentile10FiAge: percentile(fiAges, 0.1),
    percentile90FiAge: percentile(fiAges, 0.9),
  };
}

function validateProjectionInput(input: ProjectionInput) {
  if (
    input.currentAge <= 0 ||
    input.targetRetirementAge <= 0 ||
    input.currentNetWorthMinor < 0 ||
    input.annualExpensesMinor < 0 ||
    input.safeWithdrawalRate <= 0 ||
    input.maxYears !== undefined && input.maxYears < 0
  ) {
    throw new Error("Invalid FIRE projection input.");
  }
}

function inflate(amountMinor: number, inflationRate: number, yearIndex: number) {
  return roundMinor(amountMinor * (1 + inflationRate) ** yearIndex);
}

function roundMinor(value: number) {
  return Math.round(value);
}

function roundRatio(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function normalSample(random: () => number) {
  const left = Math.max(random(), Number.EPSILON);
  const right = Math.max(random(), Number.EPSILON);

  return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);
}

function percentile(values: number[], percentileValue: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const index = Math.min(values.length - 1, Math.floor((values.length - 1) * percentileValue));
  return values[index];
}
