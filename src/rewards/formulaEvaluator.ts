import { z } from "zod";

import type { CardRuleSeed } from "./cardRuleCatalogue";

const channelSchema = z.enum(["online", "contactless", "offline"]);
const formulaSchema = z.object({
  kind: z.literal("mpd"),
  milesPerDollar: z.number().nonnegative(),
  rounding: z.object({
    mode: z.enum(["floor_per_transaction", "aggregate_period"]),
    unitMinor: z.number().int().positive(),
  }),
});
const bonusFormulaSchema = formulaSchema.extend({
  capAmountMinor: z.number().int().nonnegative(),
  capPeriod: z.enum(["calendar_month", "statement_month"]),
  excessMilesPerDollar: z.number().nonnegative(),
});
const eligibilitySchema = z.object({
  channels: z.array(channelSchema),
  categoryIds: z.array(z.string()).optional(),
  merchantCategoryNotes: z.array(z.string()).optional(),
  selectedCategoryCount: z.number().int().positive().optional(),
  excludedMccCodes: z.array(z.string()).optional(),
  excludedWalletTypes: z.array(z.string()).optional(),
  excludedNotes: z.array(z.string()).optional(),
});
const transferRuleSchema = z.object({
  redemptionProgramId: z.string(),
  pointsPerMile: z.number().positive(),
  minimumTransferPoints: z.number().int().positive(),
  transferBlockPoints: z.number().int().positive(),
});

export type RewardTransaction = {
  id: string;
  postedDate: string;
  amountMinor: number;
  transactionKind: "purchase" | "refund" | "fee" | "interest" | "payment" | "adjustment";
  channel: "online" | "contactless" | "offline";
  categoryId?: string;
  mccCode?: string;
  walletType?: string;
  eligibleForMiles: boolean;
};

export type RewardEvaluationContext = {
  priorQualifiedSpendMinor?: number;
  selectedCategoryIds?: string[];
};

export type RewardEvaluationTrace = {
  ruleId: string;
  transactionId?: string;
  eligible: boolean;
  eligibilityReasons: string[];
  qualifiedSpendMinor: number;
  roundedSpendMinor: number;
  bonusSpendMinor: number;
  excessSpendMinor: number;
  capRemainingBeforeMinor: number;
  milesEarned: number;
  pointsEarned: number;
  roundingMode: "floor_per_transaction" | "aggregate_period";
  sourceUrl: string;
  verifiedAt: string;
};

export type RewardEvaluationResult = {
  milesEarned: number;
  pointsEarned: number;
  trace: RewardEvaluationTrace;
};

export type FormulaValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateCardRuleFormula(rule: CardRuleSeed): FormulaValidationResult {
  const errors = [
    ...formatErrors("baseFormula", formulaSchema.safeParse(rule.baseFormula)),
    ...formatErrors("bonusFormula", bonusFormulaSchema.safeParse(rule.bonusFormula)),
    ...formatErrors("eligibility", eligibilitySchema.safeParse(rule.eligibility)),
    ...formatErrors("exclusion", eligibilitySchema.safeParse(rule.exclusion)),
    ...formatErrors("transferRule", transferRuleSchema.safeParse(rule.transferRule)),
  ];

  if (rule.capAmountMinor !== rule.bonusFormula.capAmountMinor) {
    errors.push("capAmountMinor must match bonusFormula.capAmountMinor");
  }

  if (rule.capPeriod !== rule.bonusFormula.capPeriod) {
    errors.push("capPeriod must match bonusFormula.capPeriod");
  }

  return { valid: errors.length === 0, errors };
}

export function evaluateTransactionReward(
  rule: CardRuleSeed,
  transaction: RewardTransaction,
  context: RewardEvaluationContext = {},
): RewardEvaluationResult {
  const validation = validateCardRuleFormula(rule);
  if (!validation.valid) {
    throw new Error(`Invalid card rule ${rule.id}: ${validation.errors.join("; ")}`);
  }

  const eligibility = checkEligibility(rule, transaction, context);
  const capRemainingBeforeMinor = Math.max(
    0,
    rule.capAmountMinor - (context.priorQualifiedSpendMinor ?? 0),
  );

  if (!eligibility.eligible) {
    return buildResult(rule, transaction, {
      eligible: false,
      eligibilityReasons: eligibility.reasons,
      qualifiedSpendMinor: 0,
      roundedSpendMinor: 0,
      bonusSpendMinor: 0,
      excessSpendMinor: 0,
      capRemainingBeforeMinor,
      roundingMode: rule.bonusFormula.rounding.mode,
    });
  }

  const spendMinor = Math.abs(transaction.amountMinor);
  const roundedSpendMinor = roundSpend(spendMinor, rule.bonusFormula.rounding.unitMinor);
  const bonusSpendMinor = Math.min(roundedSpendMinor, capRemainingBeforeMinor);
  const excessSpendMinor = Math.max(0, roundedSpendMinor - bonusSpendMinor);
  const milesEarned =
    calculateMiles(bonusSpendMinor, rule.bonusFormula.milesPerDollar) +
    calculateMiles(excessSpendMinor, rule.bonusFormula.excessMilesPerDollar);

  return buildResult(rule, transaction, {
    eligible: true,
    eligibilityReasons: eligibility.reasons,
    qualifiedSpendMinor: spendMinor,
    roundedSpendMinor,
    bonusSpendMinor,
    excessSpendMinor,
    capRemainingBeforeMinor,
    milesEarned,
    pointsEarned: calculatePoints(milesEarned, rule.transferRule.pointsPerMile),
    roundingMode: rule.bonusFormula.rounding.mode,
  });
}

export function evaluateAggregatePeriodReward(
  rule: CardRuleSeed,
  transactions: RewardTransaction[],
  context: RewardEvaluationContext = {},
): RewardEvaluationResult {
  const validation = validateCardRuleFormula(rule);
  if (!validation.valid) {
    throw new Error(`Invalid card rule ${rule.id}: ${validation.errors.join("; ")}`);
  }

  const eligibleTransactions = transactions.filter(
    (transaction) => checkEligibility(rule, transaction, context).eligible,
  );
  const qualifiedSpendMinor = eligibleTransactions.reduce(
    (total, transaction) => total + Math.abs(transaction.amountMinor),
    0,
  );
  const capRemainingBeforeMinor = Math.max(
    0,
    rule.capAmountMinor - (context.priorQualifiedSpendMinor ?? 0),
  );
  const roundedSpendMinor =
    rule.bonusFormula.rounding.mode === "aggregate_period"
      ? roundSpend(qualifiedSpendMinor, rule.bonusFormula.rounding.unitMinor)
      : eligibleTransactions.reduce(
          (total, transaction) =>
            total + roundSpend(Math.abs(transaction.amountMinor), rule.bonusFormula.rounding.unitMinor),
          0,
        );
  const bonusSpendMinor = Math.min(roundedSpendMinor, capRemainingBeforeMinor);
  const excessSpendMinor = Math.max(0, roundedSpendMinor - bonusSpendMinor);
  const milesEarned =
    calculateMiles(bonusSpendMinor, rule.bonusFormula.milesPerDollar) +
    calculateMiles(excessSpendMinor, rule.bonusFormula.excessMilesPerDollar);

  return buildResult(rule, undefined, {
    eligible: eligibleTransactions.length > 0,
    eligibilityReasons:
      eligibleTransactions.length > 0
        ? [`${eligibleTransactions.length} eligible transaction(s) included.`]
        : ["No eligible transactions in aggregate period."],
    qualifiedSpendMinor,
    roundedSpendMinor,
    bonusSpendMinor,
    excessSpendMinor,
    capRemainingBeforeMinor,
    milesEarned,
    pointsEarned: calculatePoints(milesEarned, rule.transferRule.pointsPerMile),
    roundingMode: rule.bonusFormula.rounding.mode,
  });
}

function checkEligibility(
  rule: CardRuleSeed,
  transaction: RewardTransaction,
  context: RewardEvaluationContext,
) {
  const reasons: string[] = [];

  if (transaction.transactionKind === "refund") {
    return { eligible: false, reasons: ["Refund transactions do not earn miles."] };
  }

  if (!transaction.eligibleForMiles) {
    return { eligible: false, reasons: ["Transaction is marked ineligible for miles."] };
  }

  if (!rule.eligibility.channels.includes(transaction.channel)) {
    return { eligible: false, reasons: [`Channel ${transaction.channel} is not eligible.`] };
  }

  if (transaction.mccCode && rule.exclusion.excludedMccCodes?.includes(transaction.mccCode)) {
    return { eligible: false, reasons: [`MCC ${transaction.mccCode} is excluded.`] };
  }

  if (transaction.walletType && rule.exclusion.excludedWalletTypes?.includes(transaction.walletType)) {
    return { eligible: false, reasons: [`Wallet type ${transaction.walletType} is excluded.`] };
  }

  const eligibleCategoryIds = context.selectedCategoryIds ?? rule.eligibility.categoryIds;
  if (eligibleCategoryIds?.length) {
    if (!transaction.categoryId || !eligibleCategoryIds.includes(transaction.categoryId)) {
      return {
        eligible: false,
        reasons: [`Category ${transaction.categoryId ?? "unknown"} is not eligible.`],
      };
    }
    reasons.push(`Category ${transaction.categoryId} is eligible.`);
  }

  reasons.push(`Channel ${transaction.channel} is eligible.`);
  return { eligible: true, reasons };
}

function buildResult(
  rule: CardRuleSeed,
  transaction: RewardTransaction | undefined,
  values: {
    eligible: boolean;
    eligibilityReasons: string[];
    qualifiedSpendMinor: number;
    roundedSpendMinor: number;
    bonusSpendMinor: number;
    excessSpendMinor: number;
    capRemainingBeforeMinor: number;
    milesEarned?: number;
    pointsEarned?: number;
    roundingMode: "floor_per_transaction" | "aggregate_period";
  },
): RewardEvaluationResult {
  const milesEarned = values.milesEarned ?? 0;
  const pointsEarned = values.pointsEarned ?? 0;

  return {
    milesEarned,
    pointsEarned,
    trace: {
      ruleId: rule.id,
      transactionId: transaction?.id,
      eligible: values.eligible,
      eligibilityReasons: values.eligibilityReasons,
      qualifiedSpendMinor: values.qualifiedSpendMinor,
      roundedSpendMinor: values.roundedSpendMinor,
      bonusSpendMinor: values.bonusSpendMinor,
      excessSpendMinor: values.excessSpendMinor,
      capRemainingBeforeMinor: values.capRemainingBeforeMinor,
      milesEarned,
      pointsEarned,
      roundingMode: values.roundingMode,
      sourceUrl: rule.sourceUrl,
      verifiedAt: rule.verifiedAt,
    },
  };
}

function roundSpend(amountMinor: number, unitMinor: number): number {
  return Math.floor(amountMinor / unitMinor) * unitMinor;
}

function calculateMiles(amountMinor: number, milesPerDollar: number): number {
  return Math.floor((amountMinor / 100) * milesPerDollar);
}

function calculatePoints(miles: number, pointsPerMile: number): number {
  return Math.floor(miles * pointsPerMile);
}

function formatErrors(
  label: string,
  result: { success: true } | { success: false; error: z.ZodError },
): string[] {
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => `${label}.${issue.path.join(".")}: ${issue.message}`);
}
