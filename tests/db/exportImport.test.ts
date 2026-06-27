import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import {
  assertMigrationsCurrent,
  exportFormatVersion,
  exportLocalData,
  importLocalData,
} from "../../src/db/exportImport";
import { runMigrations } from "../../src/db/migrate";
import { createRepositories } from "../../src/db/repositories";

describe("local data export and import", () => {
  let source: DatabaseConnection;

  beforeEach(() => {
    source = createDatabaseConnection();
    runMigrations(source);
    seedSourceDatabase(source);
  });

  afterEach(() => {
    source.close();
  });

  it("exports all local data as a versioned JSON artifact without source files", () => {
    const artifact = exportLocalData(source);

    expect(artifact.formatVersion).toBe(exportFormatVersion);
    expect(artifact.app).toEqual({ name: "Wander", exportSource: "local-sqlite" });
    expect(artifact.database.sourceFilesIncluded).toBe(false);
    expect(artifact.database.migrationIds).toEqual([
      "0001",
      "0002",
      "0003",
      "0004",
      "0005",
      "0006",
      "0007",
      "0008",
    ]);
    expect(artifact.data.profiles).toHaveLength(1);
    expect(artifact.data.decision_traces).toHaveLength(1);
    expect(artifact.data.statement_imports).toHaveLength(1);
    expect(artifact.data.statement_reconciliations).toHaveLength(1);
    expect(artifact.data.transaction_trust_scores).toHaveLength(1);
    expect(artifact.data.refund_timelines).toHaveLength(1);
    expect(artifact.data.card_period_summaries).toHaveLength(1);
    expect(artifact.data.miles_leakage_items).toHaveLength(1);
    expect(artifact.data.planned_purchases).toHaveLength(1);
    expect(artifact.data.income_streams).toHaveLength(1);
    expect(artifact.data.asset_liability_accounts).toHaveLength(1);
    expect(artifact.data.cpf_accounts).toHaveLength(1);
    expect(artifact.data.property_profiles).toHaveLength(1);
    expect(artifact.data.healthcare_assumptions).toHaveLength(1);
    expect(artifact.data.financial_goals).toHaveLength(1);
    expect(artifact.data.projection_runs).toHaveLength(1);
    expect(artifact.data.projection_years).toHaveLength(1);
    expect(artifact.data.advisor_insights).toHaveLength(1);
    expect(artifact.data.seeded_data_versions).toHaveLength(1);

    const serialized = JSON.stringify(artifact);
    expect(serialized).not.toContain("sourceFileBytes");
    expect(serialized).not.toContain("originalPdf");
  });

  it("imports an export artifact into a migrated empty database", () => {
    const artifact = exportLocalData(source);
    const target = createDatabaseConnection();
    runMigrations(target);

    try {
      const result = importLocalData(target, artifact);
      const repositories = createRepositories(target);

      expect(result.importedTables).toBe(32);
      expect(repositories.profiles.getById("profile_1")?.name).toBe("Primary");
      expect(
        repositories.statementImports.getByProfileAndHash("profile_1", "hash_1")?.bankName,
      ).toBe("DBS");
      expect(
        repositories.transactions.getByFingerprint("profile_1", "fingerprint_1")?.amountMinor,
      ).toBe(-1840);
      expect(repositories.statementReconciliations.getByImportId("import_profile_1")?.status).toBe(
        "verified",
      );
      expect(
        repositories.transactionTrustScores.getByTransactionId("transaction_profile_1")?.label,
      ).toBe("high_trust");
      expect(
        repositories.refundTimelines.getByOriginalTransactionId("transaction_profile_1")?.status,
      ).toBe("none");
      expect(repositories.cardPeriodSummaries.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.milesLeakageItems.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.plannedPurchases.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.incomeStreams.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.assetLiabilityAccounts.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.cpfAccounts.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.propertyProfiles.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.healthcareAssumptions.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.financialGoals.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.projectionRuns.listForProfile("profile_1")).toHaveLength(1);
      expect(repositories.projectionYears.listForRun(`projection_run_profile_1`)).toHaveLength(1);
      expect(repositories.advisorInsights.listOpenForProfile("profile_1")).toHaveLength(1);
      expect(repositories.decisionTraces.listForSourceRecord("transaction_profile_1")).toHaveLength(
        1,
      );

      const seededVersion = target.sqlite
        .prepare("SELECT dataset_version FROM seeded_data_versions WHERE dataset_name = ?")
        .get("mcc_taxonomy") as { dataset_version: string };

      expect(seededVersion.dataset_version).toBe("2026.06");
    } finally {
      target.close();
    }
  });

  it("replaces existing local data during import", () => {
    const artifact = exportLocalData(source);
    const target = createDatabaseConnection();
    runMigrations(target);
    seedSourceDatabase(target, "existing_profile", "existing_hash", "existing_fingerprint");

    try {
      importLocalData(target, artifact);

      const profileCount = target.sqlite
        .prepare("SELECT count(*) as count FROM profiles")
        .get() as {
        count: number;
      };

      expect(profileCount.count).toBe(1);
      expect(createRepositories(target).profiles.getById("existing_profile")).toBeUndefined();
      expect(createRepositories(target).profiles.getById("profile_1")?.name).toBe("Primary");
    } finally {
      target.close();
    }
  });

  it("rejects export and import when migrations are missing", () => {
    const unmigrated = createDatabaseConnection();

    try {
      expect(() => assertMigrationsCurrent(unmigrated)).toThrow(/migrations are not current/i);
      expect(() => exportLocalData(unmigrated)).toThrow(/migrations are not current/i);
      expect(() => importLocalData(unmigrated, exportLocalData(source))).toThrow(
        /migrations are not current/i,
      );
    } finally {
      unmigrated.close();
    }
  });

  it("rejects invalid or incompatible artifacts", () => {
    const target = createDatabaseConnection();
    runMigrations(target);

    try {
      const artifact = exportLocalData(source);

      expect(() => importLocalData(target, { ...artifact, formatVersion: 999 })).toThrow();
      expect(() =>
        importLocalData(target, {
          ...artifact,
          database: { ...artifact.database, migrationIds: [] },
        }),
      ).toThrow(/missing required migrations/i);
    } finally {
      target.close();
    }
  });
});

function seedSourceDatabase(
  connection: DatabaseConnection,
  profileId = "profile_1",
  sourceFileHash = "hash_1",
  transactionFingerprint = "fingerprint_1",
) {
  const repositories = createRepositories(connection);

  repositories.profiles.create({ id: profileId, name: "Primary", currency: "SGD" });
  repositories.plannerProfiles.upsert({
    profileId,
    currentAge: 36,
    targetRetirementAge: 45,
    currentNetWorthMinor: 110_000_000,
    targetFireNumberMinor: 162_000_000,
    annualExpensesMinor: 5_670_000,
    safeWithdrawalRateBasisPoints: 350,
    expectedReturnRateBasisPoints: 550,
    inflationRateBasisPoints: 250,
  });
  repositories.statementImports.create({
    id: `import_${profileId}`,
    profileId,
    sourceFileHash,
    sourceFilename: "dbs-statement.pdf",
    bankName: "DBS",
    parserName: "StatementSenseiBridge",
    parserVersion: "0.1.0",
    importStatus: "committed",
  });
  repositories.accounts.create({
    id: `account_${profileId}`,
    profileId,
    institutionName: "DBS",
    accountLabel: "DBS Visa",
    accountType: "credit_card",
    maskedIdentifier: "**** 1234",
    currency: "SGD",
  });
  connection.sqlite
    .prepare(
      `INSERT INTO cards (id, issuer, card_name, network, currency, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(`card_${profileId}`, "DBS", "DBS Visa", "Visa", "SGD", 1);
  repositories.expenseSnapshots.create({
    id: `snapshot_${profileId}`,
    profileId,
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    grossSpendMinor: 472_000,
    refundsMinor: 52_000,
    netSpendMinor: 420_000,
    annualizedExpensesMinor: 5_110_000,
    source: "statement_import",
  });
  repositories.incomeStreams.create({
    id: `income_${profileId}`,
    profileId,
    label: "Salary",
    incomeType: "salary",
    annualAmountMinor: 18_000_000,
    annualBonusMinor: 2_000_000,
    growthRateBasisPoints: 300,
  });
  repositories.assetLiabilityAccounts.create({
    id: `asset_${profileId}`,
    profileId,
    accountLabel: "Brokerage",
    accountKind: "asset",
    assetClass: "brokerage",
    balanceMinor: 25_000_000,
    expectedReturnBasisPoints: 550,
    liquidity: "liquid",
  });
  repositories.cpfAccounts.create({
    id: `cpf_${profileId}`,
    profileId,
    oaBalanceMinor: 6_000_000,
    saBalanceMinor: 8_000_000,
    maBalanceMinor: 3_000_000,
    asOfDate: "2026-06-30",
  });
  repositories.propertyProfiles.create({
    id: `property_${profileId}`,
    profileId,
    propertyType: "hdb",
    estimatedValueMinor: 70_000_000,
    outstandingMortgageMinor: 20_000_000,
    monthlyPaymentMinor: 220_000,
  });
  repositories.healthcareAssumptions.create({
    id: `healthcare_${profileId}`,
    profileId,
    annualPremiumMinor: 240_000,
    annualOutOfPocketMinor: 100_000,
    escalationRateBasisPoints: 400,
  });
  repositories.financialGoals.create({
    id: `goal_${profileId}`,
    profileId,
    goalType: "emergency_fund",
    label: "Emergency fund",
    targetAmountMinor: 36_000_000,
    currentAmountMinor: 20_000_000,
    targetDate: "2027-06-30",
    priority: 1,
  });
  repositories.transactions.create({
    id: `transaction_${profileId}`,
    profileId,
    accountId: `account_${profileId}`,
    statementImportId: `import_${profileId}`,
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
    transactionFingerprint,
  });
  repositories.decisionTraces.create({
    id: `trace_${profileId}`,
    profileId,
    sourceModule: "trust_score",
    sourceRecordId: `transaction_${profileId}`,
    sourceRecordIdsJson: JSON.stringify([`transaction_${profileId}`]),
    ruleVersion: "trust-v1",
    inputFactsJson: JSON.stringify({ parserConfidence: 0.92 }),
    outputValueJson: JSON.stringify({ label: "high_trust" }),
    confidenceScore: 0.91,
    explanationText: "Trust score uses parser confidence.",
    caveatJson: "[]",
  });
  repositories.projectionRuns.create({
    id: `projection_run_${profileId}`,
    profileId,
    runType: "baseline",
    inputHash: `input_hash_${profileId}`,
    assumptionsJson: JSON.stringify({ swr: 0.035 }),
    resultSummaryJson: JSON.stringify({ fiAge: 45 }),
    confidenceScore: 0.88,
    calculatedAt: "2026-06-30T00:00:00.000Z",
  });
  repositories.projectionYears.create({
    id: `projection_year_${profileId}`,
    profileId,
    projectionRunId: `projection_run_${profileId}`,
    yearIndex: 0,
    calendarYear: 2026,
    age: 36,
    liquidAssetsMinor: 25_000_000,
    cpfBalanceMinor: 17_000_000,
    propertyEquityMinor: 50_000_000,
    annualIncomeMinor: 18_000_000,
    annualExpensesMinor: 5_110_000,
    annualSavingsMinor: 5_400_000,
    fireTargetMinor: 162_000_000,
    fireProgressBasisPoints: 5600,
  });
  repositories.advisorInsights.create({
    id: `insight_${profileId}`,
    profileId,
    projectionRunId: `projection_run_${profileId}`,
    insightType: "savings_gap",
    severity: "warning",
    title: "Monthly savings gap",
    body: "Increase monthly savings to hit the target retirement age.",
    recommendedAction: "Review spending and goal timing.",
    confidenceScore: 0.82,
    traceId: `trace_${profileId}`,
  });
  repositories.statementReconciliations.create({
    id: `reconciliation_${profileId}`,
    profileId,
    statementImportId: `import_${profileId}`,
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    openingBalanceMinor: 100_000,
    closingBalanceMinor: 98_160,
    debitTotalMinor: 1_840,
    creditTotalMinor: 0,
    feeTotalMinor: 0,
    rowCount: 1,
    duplicateCount: 0,
    unexplainedDeltaMinor: 0,
    status: "verified",
    confidenceScore: 1,
    issueJson: "[]",
  });
  repositories.transactionTrustScores.create({
    id: `trust_${profileId}`,
    profileId,
    statementImportId: `import_${profileId}`,
    transactionId: `transaction_${profileId}`,
    score: 0.91,
    label: "high_trust",
    driverJson: JSON.stringify(["Trust score 91%."]),
  });
  repositories.refundTimelines.create({
    id: `refund_timeline_${profileId}`,
    profileId,
    originalTransactionId: `transaction_${profileId}`,
    status: "none",
    expectedRefundMinor: 0,
    receivedRefundMinor: 0,
    remainingEligibleSpendMinor: 1_840,
    milesReversal: 0,
    confidenceScore: 1,
    eventJson: "[]",
    caveatJson: "[]",
    calculatedAt: "2026-06-26T00:00:00.000Z",
  });
  repositories.cardPeriodSummaries.create({
    id: `card_period_${profileId}`,
    profileId,
    cardId: `card_${profileId}`,
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    eligibleSpendMinor: 1_840,
    excludedSpendMinor: 0,
    capUsedMinor: 1_840,
    milesEarned: 7,
    milesMissed: 20,
    confidenceScore: 0.9,
    calculatedAt: "2026-06-26T00:00:00.000Z",
  });
  repositories.milesLeakageItems.create({
    id: `leakage_${profileId}`,
    profileId,
    transactionId: `transaction_${profileId}`,
    cardId: `card_${profileId}`,
    periodSummaryId: `card_period_${profileId}`,
    reason: "wrong_card",
    spendMinor: 1_840,
    milesMissed: 20,
    recoverable: true,
    confidenceScore: 0.9,
  });
  repositories.plannedPurchases.create({
    id: `planned_${profileId}`,
    profileId,
    merchantText: "haidilao",
    mccCode: "5812",
    amountMinor: 12_000,
    currency: "SGD",
    channel: "contactless",
    plannedDate: "2026-06-28",
    recommendedCardId: `card_${profileId}`,
    status: "planned",
    confidenceScore: 0.9,
    caveatJson: "[]",
  });
  repositories.rewardLedger.create({
    id: `ledger_${profileId}`,
    profileId,
    transactionId: `transaction_${profileId}`,
    ledgerType: "earn",
    points: 18,
    milesEquivalent: 7,
    status: "pending",
  });

  connection.sqlite
    .prepare(
      `INSERT INTO seeded_data_versions (id, dataset_name, dataset_version, source_url, verified_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      `seed_${profileId}`,
      "mcc_taxonomy",
      "2026.06",
      "https://example.test/mcc",
      "2026-06-25T00:00:00.000Z",
    );
}
