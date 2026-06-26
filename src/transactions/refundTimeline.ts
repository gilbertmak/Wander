import { createHash } from "node:crypto";

import type { RefundMatchDecision } from "./refundMatcher";

export type RefundTimelineStatus =
  | "none"
  | "matched"
  | "partial"
  | "missing"
  | "unmatched"
  | "rejected";

export type RefundTimelineEvent = {
  label: string;
  transactionId?: string;
  amountMinor: number;
  postedDate?: string;
};

export type RefundTimelineInput = {
  profileId: string;
  originalTransactionId?: string;
  refundTransactionId?: string;
  refundMatchId?: string;
  originalAmountMinor: number;
  expectedRefundMinor?: number;
  originalMilesEarned?: number;
  match?: RefundMatchDecision;
  expectedBy?: string;
  calculatedAt: string;
};

export type RefundTimelineProjection = {
  id: string;
  profileId: string;
  originalTransactionId?: string;
  refundTransactionId?: string;
  refundMatchId?: string;
  status: RefundTimelineStatus;
  expectedRefundMinor: number;
  receivedRefundMinor: number;
  remainingEligibleSpendMinor: number;
  milesReversal: number;
  confidenceScore: number;
  events: RefundTimelineEvent[];
  caveats: string[];
  calculatedAt: string;
};

export function buildRefundTimeline(input: RefundTimelineInput): RefundTimelineProjection {
  const expectedRefundMinor = Math.abs(input.expectedRefundMinor ?? input.originalAmountMinor);
  const receivedRefundMinor = Math.abs(input.match?.matchedAmountMinor ?? 0);
  const status = deriveStatus(input, expectedRefundMinor, receivedRefundMinor);
  const remainingEligibleSpendMinor =
    status === "rejected" || status === "unmatched"
      ? Math.abs(input.originalAmountMinor)
      : Math.max(0, Math.abs(input.originalAmountMinor) - receivedRefundMinor);
  const milesReversal = calculateMilesReversal(
    input.originalMilesEarned ?? 0,
    Math.abs(input.originalAmountMinor),
    receivedRefundMinor,
    status,
  );

  return {
    id: stableId(
      input.profileId,
      input.originalTransactionId ?? "missing_original",
      input.refundTransactionId ?? "missing_refund",
      status,
    ),
    profileId: input.profileId,
    originalTransactionId: input.originalTransactionId,
    refundTransactionId: input.refundTransactionId,
    refundMatchId: input.refundMatchId,
    status,
    expectedRefundMinor,
    receivedRefundMinor,
    remainingEligibleSpendMinor,
    milesReversal,
    confidenceScore: input.match?.matchConfidence ?? (status === "missing" ? 0.4 : 1),
    events: buildEvents(input, expectedRefundMinor, receivedRefundMinor),
    caveats: buildCaveats(status, input),
    calculatedAt: input.calculatedAt,
  };
}

export function toRefundTimelineInsert(projection: RefundTimelineProjection) {
  return {
    id: projection.id,
    profileId: projection.profileId,
    originalTransactionId: projection.originalTransactionId,
    refundTransactionId: projection.refundTransactionId,
    refundMatchId: projection.refundMatchId,
    status: projection.status,
    expectedRefundMinor: projection.expectedRefundMinor,
    receivedRefundMinor: projection.receivedRefundMinor,
    remainingEligibleSpendMinor: projection.remainingEligibleSpendMinor,
    milesReversal: projection.milesReversal,
    confidenceScore: projection.confidenceScore,
    eventJson: JSON.stringify(projection.events),
    caveatJson: JSON.stringify(projection.caveats),
    calculatedAt: projection.calculatedAt,
  };
}

function deriveStatus(
  input: RefundTimelineInput,
  expectedRefundMinor: number,
  receivedRefundMinor: number,
): RefundTimelineStatus {
  if (input.match?.status === "rejected") return "rejected";
  if (input.match?.matchMethod === "unmatched") return "unmatched";
  if (receivedRefundMinor >= expectedRefundMinor && receivedRefundMinor > 0) return "matched";
  if (receivedRefundMinor > 0) return "partial";
  if (input.expectedBy) return "missing";
  return "none";
}

function calculateMilesReversal(
  originalMilesEarned: number,
  originalAmountMinor: number,
  receivedRefundMinor: number,
  status: RefundTimelineStatus,
) {
  if (status === "rejected" || status === "unmatched" || originalMilesEarned <= 0) {
    return 0;
  }

  const ratio =
    originalAmountMinor === 0 ? 0 : Math.min(1, receivedRefundMinor / originalAmountMinor);
  return Math.floor(originalMilesEarned * ratio);
}

function buildEvents(
  input: RefundTimelineInput,
  expectedRefundMinor: number,
  receivedRefundMinor: number,
): RefundTimelineEvent[] {
  return [
    {
      label: "Original charge",
      transactionId: input.originalTransactionId,
      amountMinor: Math.abs(input.originalAmountMinor),
    },
    {
      label: "Expected refund",
      amountMinor: expectedRefundMinor,
      postedDate: input.expectedBy,
    },
    ...(receivedRefundMinor > 0
      ? [
          {
            label: "Received refund",
            transactionId: input.refundTransactionId,
            amountMinor: receivedRefundMinor,
          },
        ]
      : []),
  ];
}

function buildCaveats(status: RefundTimelineStatus, input: RefundTimelineInput) {
  const caveats: string[] = [];

  if (status === "missing")
    caveats.push("Expected refund has not appeared in imported statements.");
  if (status === "partial") caveats.push("Partial refund leaves some spend eligible for miles.");
  if (status === "unmatched") caveats.push("Refund transaction needs manual matching.");
  if (status === "rejected") caveats.push("Rejected refund does not affect net spend or miles.");
  if (!input.match) caveats.push("Timeline is based on expected refund data only.");

  return caveats;
}

function stableId(...parts: string[]) {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `refund_timeline_${digest}`;
}
