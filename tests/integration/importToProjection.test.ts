import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { createRepositories } from "../../src/db/repositories";
import { transactions } from "../../src/db/schema";
import { buildImportPreview, commitImportPreview } from "../../src/ingestion/importWorkflow";
import type { ParseStatementRequest, ParseStatementSuccess } from "../../src/ingestion/parserBridge";
import { createExpenseUpdateProposal } from "../../src/planner/expenseSnapshotConnector";
import { projectFire } from "../../src/planner/projectionEngine";
import { calculateNetSpendSnapshot } from "../../src/transactions/netSpend";

describe("import to projection integration", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
    runMigrations(connection);
    createRepositories(connection).profiles.create({
      id: "profile_fixture",
      name: "Fixture",
      currency: "SGD",
    });
  });

  afterEach(() => {
    connection.close();
  });

  it("commits synthetic parser output and proposes planner expense updates", () => {
    const parserResult = readJsonFixture<ParseStatementSuccess>("statementSensei.success.json");
    const expectedPlanner = readJsonFixture<{
      importedExpenseAnnualizedMinor: number;
      baseProjection: { fiAge: number };
    }>("plannerSnapshot.expected.json");
    const preview = buildImportPreview(request, parserResult);
    const commit = commitImportPreview(connection, preview);
    const repositories = createRepositories(connection);
    const importedTransactions = connection.db.select().from(transactions).all();
    const snapshot = calculateNetSpendSnapshot({
      profileId: "profile_fixture",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      transactions: preview.transactions.map((transaction, index) => ({
        id: commit.transactionIds[index],
        postedDate: transaction.postedDate,
        amountMinor: transaction.amountMinor,
        transactionKind: transaction.transactionKind,
      })),
      refundMatches: [
        {
          refundTransactionId: commit.transactionIds[2],
          originalTransactionId: commit.transactionIds[0],
          matchedAmountMinor: 2_000,
          matchConfidence: 0.95,
          matchMethod: "exact",
          status: "matched",
          milesEligibleAmountMinor: 10_000,
          explanation: "Synthetic fixture refund matched to original grocery purchase.",
        },
      ],
      source: "statement_import",
      sourceRecordId: commit.statementImportId,
    });

    repositories.expenseSnapshots.create({
      id: "snapshot_fixture",
      ...snapshot,
    });

    const proposal = createExpenseUpdateProposal({
      currentAssumption: {
        profileId: "profile_fixture",
        annualExpensesMinor: 4_800_000,
        expenseSource: "statement_import",
      },
      snapshots: repositories.expenseSnapshots.listForProfile("profile_fixture").map((expenseSnapshot) => ({
        id: expenseSnapshot.id,
        profileId: expenseSnapshot.profileId,
        periodStart: expenseSnapshot.periodStart,
        periodEnd: expenseSnapshot.periodEnd,
        annualizedExpensesMinor: expenseSnapshot.annualizedExpensesMinor,
        source: expenseSnapshot.source,
        calculatedAt: expenseSnapshot.calculatedAt,
      })),
    });
    const projection = projectFire({
      currentAge: 35,
      targetRetirementAge: 45,
      currentNetWorthMinor: 80_000_000,
      annualExpensesMinor: proposal!.proposedAnnualExpensesMinor,
      annualSavingsMinor: 3_000_000,
      safeWithdrawalRate: 0.035,
      expectedReturnRate: 0.05,
      inflationRate: 0.02,
      maxYears: 30,
    });

    expect(importedTransactions).toHaveLength(3);
    expect(snapshot).toMatchObject({
      grossSpendMinor: 13_840,
      refundsMinor: 2_000,
      netSpendMinor: 11_840,
      annualizedExpensesMinor: expectedPlanner.importedExpenseAnnualizedMinor,
    });
    expect(proposal).toMatchObject({
      sourceSnapshotId: "snapshot_fixture",
      proposedAnnualExpensesMinor: expectedPlanner.importedExpenseAnnualizedMinor,
      blockedByManualOverride: false,
    });
    expect(projection.fiAge).toBeLessThan(expectedPlanner.baseProjection.fiAge);
  });
});

const request: ParseStatementRequest = {
  requestId: "parse_fixture_001",
  profileId: "profile_fixture",
  sourceType: "pdf",
  sourceFilename: "fixture.pdf",
  sourceFilePath: "/tmp/wander/fixture.pdf",
  sourceFileSha256: "c".repeat(64),
  parserOptions: {
    ocrEnabled: false,
    passwordProvided: false,
    locale: "en-SG",
  },
};

function readJsonFixture<T>(filename: string): T {
  return JSON.parse(readFileSync(join("tests", "fixtures", "golden", filename), "utf8")) as T;
}
