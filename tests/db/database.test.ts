import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { createRepositories } from "../../src/db/repositories";

describe("SQLite database layer", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
  });

  afterEach(() => {
    connection.close();
  });

  it("runs migrations from an empty database and skips already applied migrations", () => {
    const firstRun = runMigrations(connection);
    const secondRun = runMigrations(connection);

    expect(firstRun.applied).toEqual(["0001"]);
    expect(firstRun.skipped).toEqual([]);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual(["0001"]);

    const tableCount = connection.sqlite
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type = 'table' AND name = 'profiles'")
      .get() as { count: number };

    expect(tableCount.count).toBe(1);
  });

  it("creates and reads core profile, planner, import, account, transaction, snapshot, and ledger records", () => {
    runMigrations(connection);
    const repositories = createRepositories(connection);

    repositories.profiles.create({ id: "profile_1", name: "Primary", currency: "SGD" });
    repositories.plannerProfiles.upsert({
      profileId: "profile_1",
      currentAge: 36,
      targetRetirementAge: 45,
      currentNetWorthMinor: 110_000_000,
      targetFireNumberMinor: 162_000_000,
      annualExpensesMinor: 5_670_000,
      safeWithdrawalRate: 0.035,
      expectedReturnRate: 0.055,
      inflationRate: 0.025,
    });
    repositories.statementImports.create({
      id: "import_1",
      profileId: "profile_1",
      sourceFileHash: "hash_1",
      sourceFilename: "dbs.pdf",
      bankName: "DBS",
      parserName: "StatementSenseiBridge",
      parserVersion: "0.1.0",
      importStatus: "committed",
    });
    repositories.accounts.create({
      id: "account_1",
      profileId: "profile_1",
      institutionName: "DBS",
      accountLabel: "DBS Visa",
      accountType: "credit_card",
      maskedIdentifier: "**** 1234",
      currency: "SGD",
    });
    repositories.expenseSnapshots.create({
      id: "snapshot_1",
      profileId: "profile_1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      grossSpendMinor: 472_000,
      refundsMinor: 52_000,
      netSpendMinor: 420_000,
      annualizedExpensesMinor: 5_110_000,
      source: "statement_import",
    });
    repositories.transactions.create({
      id: "transaction_1",
      profileId: "profile_1",
      accountId: "account_1",
      statementImportId: "import_1",
      postedDate: "2026-06-20",
      transactionDate: "2026-06-19",
      descriptionRaw: "GRAB *TRIP SINGAPORE",
      descriptionNormalized: "grab trip singapore",
      amountMinor: -1840,
      currency: "SGD",
      direction: "debit",
      transactionKind: "purchase",
      eligibleForMiles: true,
      confidenceScore: 0.92,
      needsReview: true,
      transactionFingerprint: "fingerprint_1",
    });
    repositories.rewardLedger.create({
      id: "ledger_1",
      profileId: "profile_1",
      transactionId: "transaction_1",
      ledgerType: "earn",
      points: 18,
      milesEquivalent: 7,
      status: "pending",
    });

    expect(repositories.profiles.getById("profile_1")?.name).toBe("Primary");
    expect(repositories.plannerProfiles.getByProfileId("profile_1")?.targetFireNumberMinor).toBe(
      162_000_000,
    );
    expect(repositories.statementImports.getByProfileAndHash("profile_1", "hash_1")?.bankName).toBe(
      "DBS",
    );
    expect(repositories.accounts.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.expenseSnapshots.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.transactions.listReviewItems("profile_1")).toHaveLength(1);
    expect(repositories.rewardLedger.listForProfile("profile_1")).toHaveLength(1);
  });

  it("rejects duplicate statement file hashes per profile", () => {
    runMigrations(connection);
    const repositories = createRepositories(connection);

    repositories.profiles.create({ id: "profile_1", name: "Primary", currency: "SGD" });

    const statementImport = {
      id: "import_1",
      profileId: "profile_1",
      sourceFileHash: "hash_1",
      sourceFilename: "dbs.pdf",
      bankName: "DBS",
      parserName: "StatementSenseiBridge",
      parserVersion: "0.1.0",
      importStatus: "committed",
    };

    repositories.statementImports.create(statementImport);

    expect(() =>
      repositories.statementImports.create({
        ...statementImport,
        id: "import_2",
      }),
    ).toThrow(/unique/i);
  });

  it("rejects duplicate transaction fingerprints per profile", () => {
    runMigrations(connection);
    const repositories = createRepositories(connection);

    repositories.profiles.create({ id: "profile_1", name: "Primary", currency: "SGD" });

    const transaction = {
      id: "transaction_1",
      profileId: "profile_1",
      postedDate: "2026-06-20",
      transactionDate: "2026-06-19",
      descriptionRaw: "GRAB *TRIP SINGAPORE",
      descriptionNormalized: "grab trip singapore",
      amountMinor: -1840,
      currency: "SGD",
      direction: "debit",
      transactionKind: "purchase",
      eligibleForMiles: true,
      confidenceScore: 0.92,
      needsReview: true,
      transactionFingerprint: "fingerprint_1",
    };

    repositories.transactions.create(transaction);

    expect(() =>
      repositories.transactions.create({
        ...transaction,
        id: "transaction_2",
      }),
    ).toThrow(/unique/i);
  });
});
