export type RefundCandidateTransaction = {
  id: string;
  postedDate: string;
  amountMinor: number;
  direction: "debit" | "credit";
  transactionKind: "purchase" | "refund" | "fee" | "interest" | "payment" | "adjustment";
  descriptionNormalized: string;
  merchantId?: string | null;
  accountId?: string | null;
  cardId?: string | null;
};

export type RefundMatchDecision = {
  refundTransactionId: string;
  originalTransactionId?: string;
  matchedAmountMinor: number;
  matchConfidence: number;
  matchMethod: "exact" | "partial" | "merchant_similarity" | "unmatched";
  status: "matched" | "partial" | "uncertain" | "rejected";
  milesEligibleAmountMinor: number;
  explanation: string;
};

export type RefundMatcherOptions = {
  maxWindowDays: number;
  uncertainThreshold: number;
};

const defaultOptions: RefundMatcherOptions = {
  maxWindowDays: 120,
  uncertainThreshold: 0.7,
};

export function matchRefunds(
  transactions: RefundCandidateTransaction[],
  options: Partial<RefundMatcherOptions> = {},
): RefundMatchDecision[] {
  const mergedOptions = { ...defaultOptions, ...options };
  const purchases = transactions.filter((transaction) => transaction.amountMinor < 0);
  const refunds = transactions.filter(
    (transaction) => transaction.amountMinor > 0 && transaction.transactionKind === "refund",
  );

  return refunds.map((refund) => matchRefund(refund, purchases, mergedOptions));
}

export function matchRefund(
  refund: RefundCandidateTransaction,
  purchases: RefundCandidateTransaction[],
  options: RefundMatcherOptions = defaultOptions,
): RefundMatchDecision {
  const candidates = purchases
    .map((purchase) => scoreRefundCandidate(refund, purchase, options))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];

  if (!best || best.score < options.uncertainThreshold) {
    return {
      refundTransactionId: refund.id,
      matchedAmountMinor: 0,
      matchConfidence: best?.score ?? 0,
      matchMethod: "unmatched",
      status: "rejected",
      milesEligibleAmountMinor: 0,
      explanation: "No purchase was similar enough to match this refund.",
    };
  }

  const matchedAmountMinor = Math.min(refund.amountMinor, Math.abs(best.purchase.amountMinor));
  const isFullRefund = refund.amountMinor >= Math.abs(best.purchase.amountMinor);
  const status = isFullRefund ? "matched" : "partial";

  return {
    refundTransactionId: refund.id,
    originalTransactionId: best.purchase.id,
    matchedAmountMinor,
    matchConfidence: best.score,
    matchMethod: isFullRefund ? "exact" : "partial",
    status,
    milesEligibleAmountMinor: Math.max(0, Math.abs(best.purchase.amountMinor) - matchedAmountMinor),
    explanation: `${status === "matched" ? "Full" : "Partial"} refund matched by amount, merchant, and date window.`,
  };
}

function scoreRefundCandidate(
  refund: RefundCandidateTransaction,
  purchase: RefundCandidateTransaction,
  options: RefundMatcherOptions,
) {
  const dayDistance = daysBetween(purchase.postedDate, refund.postedDate);
  if (dayDistance < 0 || dayDistance > options.maxWindowDays) {
    return { purchase, score: 0 };
  }

  const purchaseAmount = Math.abs(purchase.amountMinor);
  const amountRatio = Math.min(refund.amountMinor, purchaseAmount) / Math.max(refund.amountMinor, purchaseAmount);
  const merchantScore =
    refund.merchantId && refund.merchantId === purchase.merchantId
      ? 1
      : tokenSimilarity(refund.descriptionNormalized, purchase.descriptionNormalized);
  const accountScore =
    (refund.accountId && refund.accountId === purchase.accountId) ||
    (refund.cardId && refund.cardId === purchase.cardId)
      ? 1
      : 0.5;
  const dateScore = 1 - dayDistance / options.maxWindowDays;

  const score = roundScore(amountRatio * 0.45 + merchantScore * 0.3 + accountScore * 0.15 + dateScore * 0.1);

  return { purchase, score };
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.length / union.size;
}

function daysBetween(startIso: string, endIso: string) {
  const start = Date.parse(`${startIso}T00:00:00.000Z`);
  const end = Date.parse(`${endIso}T00:00:00.000Z`);
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}
