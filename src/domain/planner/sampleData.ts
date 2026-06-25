import { buildPlannerViewModel } from "./projection";
import type { ExpenseSnapshot, PlannerProfile } from "./types";

export const samplePlannerProfile: PlannerProfile = {
  currentAge: 36,
  targetRetirementAge: 45,
  currentNetWorth: 1_100_000,
  annualContribution: 72_000,
  annualExpenses: 56_700,
  safeWithdrawalRate: 0.035,
  expectedReturnRate: 0.055,
  inflationRate: 0.025,
  currency: "SGD",
};

export const sampleExpenseSnapshot: ExpenseSnapshot = {
  id: "snapshot_2026_06",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  grossSpend: 4_720,
  refunds: 520,
  netSpend: 4_200,
  source: "statement_import",
};

export const samplePlannerViewModel = buildPlannerViewModel(
  samplePlannerProfile,
  sampleExpenseSnapshot,
  false,
  {
    ...samplePlannerProfile,
    annualContribution: 84_000,
    annualExpenses: 50_400,
    expectedReturnRate: 0.06,
  },
);
