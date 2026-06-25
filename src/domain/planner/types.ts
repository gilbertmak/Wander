export type CurrencyCode = "SGD" | "USD";

export type ExpenseSnapshot = {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossSpend: number;
  refunds: number;
  netSpend: number;
  source: "manual" | "statement_import";
};

export type PlannerProfile = {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number;
  annualContribution: number;
  annualExpenses: number;
  safeWithdrawalRate: number;
  expectedReturnRate: number;
  inflationRate: number;
  currency: CurrencyCode;
};

export type ScenarioDefinition = {
  id: string;
  label: string;
  profile: PlannerProfile;
};

export type ProjectionPoint = {
  year: number;
  age: number;
  netWorth: number;
  annualExpenses: number;
  fireNumber: number;
  reachedFire: boolean;
};

export type ProjectionResult = {
  scenarioId: string;
  label: string;
  currency: CurrencyCode;
  targetFireNumber: number;
  currentFireProgress: number;
  projectedFireAge: number | null;
  projectedFireYear: number | null;
  yearsToFire: number | null;
  targetRetirementGapYears: number | null;
  points: ProjectionPoint[];
};

export type PlannerViewModel = {
  activeSnapshot: ExpenseSnapshot;
  baseline: ProjectionResult;
  scenarios: ProjectionResult[];
};
