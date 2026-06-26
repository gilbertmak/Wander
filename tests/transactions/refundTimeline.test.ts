import { describe, expect, it } from "vitest";

import { buildRefundTimeline, toRefundTimelineInsert } from "../../src/transactions/refundTimeline";

describe("refund timeline projection", () => {
  it("nets full refunds and reverses miles to zero remaining spend", () => {
    const timeline = buildRefundTimeline({
      profileId: "profile_1",
      originalTransactionId: "purchase_1",
      refundTransactionId: "refund_1",
      originalAmountMinor: -10_000,
      originalMilesEarned: 400,
      match: {
        refundTransactionId: "refund_1",
        originalTransactionId: "purchase_1",
        matchedAmountMinor: 10_000,
        matchConfidence: 0.95,
        matchMethod: "exact",
        status: "matched",
        milesEligibleAmountMinor: 0,
        explanation: "Full refund matched.",
      },
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(timeline).toMatchObject({
      status: "matched",
      receivedRefundMinor: 10_000,
      remainingEligibleSpendMinor: 0,
      milesReversal: 400,
    });
  });

  it("keeps partial refunds as remaining eligible spend", () => {
    const timeline = buildRefundTimeline({
      profileId: "profile_1",
      originalTransactionId: "purchase_1",
      refundTransactionId: "refund_1",
      originalAmountMinor: -10_000,
      originalMilesEarned: 400,
      match: {
        refundTransactionId: "refund_1",
        originalTransactionId: "purchase_1",
        matchedAmountMinor: 4_000,
        matchConfidence: 0.88,
        matchMethod: "partial",
        status: "partial",
        milesEligibleAmountMinor: 6_000,
        explanation: "Partial refund matched.",
      },
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(timeline.status).toBe("partial");
    expect(timeline.remainingEligibleSpendMinor).toBe(6_000);
    expect(timeline.milesReversal).toBe(160);
    expect(timeline.caveats).toContain("Partial refund leaves some spend eligible for miles.");
  });

  it("marks missing expected refunds for review", () => {
    const timeline = buildRefundTimeline({
      profileId: "profile_1",
      originalTransactionId: "purchase_1",
      originalAmountMinor: -10_000,
      expectedBy: "2026-07-01",
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(timeline.status).toBe("missing");
    expect(timeline.events.map((event) => event.label)).toEqual([
      "Original charge",
      "Expected refund",
    ]);
    expect(timeline.caveats).toEqual([
      "Expected refund has not appeared in imported statements.",
      "Timeline is based on expected refund data only.",
    ]);
  });

  it("supports cross-statement matches through transaction IDs", () => {
    const timeline = buildRefundTimeline({
      profileId: "profile_1",
      originalTransactionId: "purchase_may",
      refundTransactionId: "refund_june",
      originalAmountMinor: -12_000,
      match: {
        refundTransactionId: "refund_june",
        originalTransactionId: "purchase_may",
        matchedAmountMinor: 12_000,
        matchConfidence: 0.9,
        matchMethod: "exact",
        status: "matched",
        milesEligibleAmountMinor: 0,
        explanation: "Cross-statement refund matched.",
      },
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(timeline.status).toBe("matched");
    expect(timeline.events[2]).toMatchObject({
      label: "Received refund",
      transactionId: "refund_june",
    });
  });

  it("keeps rejected refunds from affecting spend or miles", () => {
    const timeline = buildRefundTimeline({
      profileId: "profile_1",
      originalTransactionId: "purchase_1",
      refundTransactionId: "refund_1",
      originalAmountMinor: -10_000,
      originalMilesEarned: 400,
      match: {
        refundTransactionId: "refund_1",
        matchedAmountMinor: 0,
        matchConfidence: 0.2,
        matchMethod: "unmatched",
        status: "rejected",
        milesEligibleAmountMinor: 0,
        explanation: "Rejected.",
      },
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(timeline.status).toBe("rejected");
    expect(timeline.remainingEligibleSpendMinor).toBe(10_000);
    expect(timeline.milesReversal).toBe(0);
    expect(JSON.parse(toRefundTimelineInsert(timeline).eventJson)).toHaveLength(2);
  });
});
