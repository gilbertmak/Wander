import { describe, expect, it } from "vitest";

import {
  applyConfirmedExpenseProposal,
  createExpenseUpdateProposal,
  type ExpenseSnapshotForPlanner,
  type PlannerExpenseAssumption,
} from "../../src/planner/expenseSnapshotConnector";

const currentAssumption: PlannerExpenseAssumption = {
  profileId: "profile_1",
  annualExpensesMinor: 5_000_000,
  expenseSource: "statement_import",
  sourceSnapshotId: "snapshot_old",
};

const snapshots: ExpenseSnapshotForPlanner[] = [
  {
    id: "snapshot_old",
    profileId: "profile_1",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    annualizedExpensesMinor: 4_800_000,
    source: "statement_import",
    calculatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "snapshot_latest",
    profileId: "profile_1",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    annualizedExpensesMinor: 5_400_000,
    source: "statement_import",
    calculatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "snapshot_manual",
    profileId: "profile_1",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    annualizedExpensesMinor: 6_000_000,
    source: "manual",
    calculatedAt: "2026-07-01T00:00:00.000Z",
  },
];

describe("expense snapshot connector", () => {
  it("proposes an annual expense update from the latest imported net spend snapshot", () => {
    expect(
      createExpenseUpdateProposal({
        currentAssumption,
        snapshots,
      }),
    ).toEqual({
      profileId: "profile_1",
      currentAnnualExpensesMinor: 5_000_000,
      proposedAnnualExpensesMinor: 5_400_000,
      deltaMinor: 400_000,
      sourceSnapshotId: "snapshot_latest",
      sourcePeriodStart: "2026-05-01",
      sourcePeriodEnd: "2026-05-31",
      requiresConfirmation: true,
      blockedByManualOverride: false,
      explanation:
        "Imported transaction net spend can refresh planner annual expenses after confirmation.",
    });
  });

  it("preserves manual overrides until the user explicitly removes the block", () => {
    const proposal = createExpenseUpdateProposal({
      currentAssumption: {
        ...currentAssumption,
        annualExpensesMinor: 7_200_000,
        expenseSource: "manual",
      },
      snapshots,
    });

    expect(proposal).toMatchObject({
      blockedByManualOverride: true,
      proposedAnnualExpensesMinor: 5_400_000,
      explanation:
        "Manual expense override is active; imported net spend requires explicit confirmation.",
    });
    expect(
      applyConfirmedExpenseProposal(
        {
          ...currentAssumption,
          annualExpensesMinor: 7_200_000,
          expenseSource: "manual",
        },
        proposal!,
        true,
        "2026-06-25T00:00:00.000Z",
      ),
    ).toMatchObject({
      annualExpensesMinor: 7_200_000,
      expenseSource: "manual",
    });
  });

  it("applies confirmed imported expense updates to planner assumptions", () => {
    const proposal = createExpenseUpdateProposal({
      currentAssumption,
      snapshots,
    });

    expect(
      applyConfirmedExpenseProposal(
        currentAssumption,
        proposal!,
        true,
        "2026-06-25T00:00:00.000Z",
      ),
    ).toEqual({
      profileId: "profile_1",
      annualExpensesMinor: 5_400_000,
      expenseSource: "statement_import",
      sourceSnapshotId: "snapshot_latest",
      updatedAt: "2026-06-25T00:00:00.000Z",
    });
  });

  it("does not apply declined proposals", () => {
    const proposal = createExpenseUpdateProposal({
      currentAssumption,
      snapshots,
    });

    expect(
      applyConfirmedExpenseProposal(
        currentAssumption,
        proposal!,
        false,
        "2026-06-25T00:00:00.000Z",
      ),
    ).toEqual(currentAssumption);
  });

  it("returns no proposal when no imported snapshot exists for the profile", () => {
    expect(
      createExpenseUpdateProposal({
        currentAssumption,
        snapshots: snapshots.filter((snapshot) => snapshot.profileId !== "profile_1"),
      }),
    ).toBeUndefined();
  });
});
