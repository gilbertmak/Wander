export type PlannerExpenseAssumption = {
  profileId: string;
  annualExpensesMinor: number;
  expenseSource: "manual" | "statement_import";
  sourceSnapshotId?: string;
  updatedAt?: string;
};

export type ExpenseSnapshotForPlanner = {
  id: string;
  profileId: string;
  periodStart: string;
  periodEnd: string;
  annualizedExpensesMinor: number;
  source: string;
  calculatedAt?: string | null;
};

export type ExpenseUpdateProposal = {
  profileId: string;
  currentAnnualExpensesMinor: number;
  proposedAnnualExpensesMinor: number;
  deltaMinor: number;
  sourceSnapshotId: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  requiresConfirmation: true;
  blockedByManualOverride: boolean;
  explanation: string;
};

export function createExpenseUpdateProposal(input: {
  currentAssumption: PlannerExpenseAssumption;
  snapshots: ExpenseSnapshotForPlanner[];
}): ExpenseUpdateProposal | undefined {
  const latestImportedSnapshot = input.snapshots
    .filter(
      (snapshot) =>
        snapshot.profileId === input.currentAssumption.profileId &&
        snapshot.source === "statement_import",
    )
    .sort(compareSnapshotsNewestFirst)[0];

  if (!latestImportedSnapshot) {
    return undefined;
  }

  const blockedByManualOverride = input.currentAssumption.expenseSource === "manual";
  const deltaMinor =
    latestImportedSnapshot.annualizedExpensesMinor - input.currentAssumption.annualExpensesMinor;

  return {
    profileId: input.currentAssumption.profileId,
    currentAnnualExpensesMinor: input.currentAssumption.annualExpensesMinor,
    proposedAnnualExpensesMinor: latestImportedSnapshot.annualizedExpensesMinor,
    deltaMinor,
    sourceSnapshotId: latestImportedSnapshot.id,
    sourcePeriodStart: latestImportedSnapshot.periodStart,
    sourcePeriodEnd: latestImportedSnapshot.periodEnd,
    requiresConfirmation: true,
    blockedByManualOverride,
    explanation: blockedByManualOverride
      ? "Manual expense override is active; imported net spend requires explicit confirmation."
      : "Imported transaction net spend can refresh planner annual expenses after confirmation.",
  };
}

export function applyConfirmedExpenseProposal(
  currentAssumption: PlannerExpenseAssumption,
  proposal: ExpenseUpdateProposal,
  confirmed: boolean,
  confirmedAt: string,
): PlannerExpenseAssumption {
  if (!confirmed || proposal.blockedByManualOverride) {
    return currentAssumption;
  }

  return {
    ...currentAssumption,
    annualExpensesMinor: proposal.proposedAnnualExpensesMinor,
    expenseSource: "statement_import",
    sourceSnapshotId: proposal.sourceSnapshotId,
    updatedAt: confirmedAt,
  };
}

function compareSnapshotsNewestFirst(
  left: ExpenseSnapshotForPlanner,
  right: ExpenseSnapshotForPlanner,
) {
  const leftDate = left.calculatedAt ?? left.periodEnd;
  const rightDate = right.calculatedAt ?? right.periodEnd;

  if (rightDate !== leftDate) {
    return rightDate.localeCompare(leftDate);
  }

  return right.periodEnd.localeCompare(left.periodEnd);
}
