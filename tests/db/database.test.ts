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

    expect(firstRun.applied).toEqual([
      "0001",
      "0002",
      "0003",
      "0004",
      "0005",
      "0006",
      "0007",
      "0008",
    ]);
    expect(firstRun.skipped).toEqual([]);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual([
      "0001",
      "0002",
      "0003",
      "0004",
      "0005",
      "0006",
      "0007",
      "0008",
    ]);

    const tableCount = connection.sqlite
      .prepare(
        "SELECT count(*) as count FROM sqlite_master WHERE type = 'table' AND name = 'profiles'",
      )
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
      safeWithdrawalRateBasisPoints: 350,
      expectedReturnRateBasisPoints: 550,
      inflationRateBasisPoints: 250,
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
    connection.sqlite
      .prepare(
        `INSERT INTO cards (id, issuer, card_name, network, currency, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("card_1", "DBS", "DBS Visa", "Visa", "SGD", 1);
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
    repositories.incomeStreams.create({
      id: "income_1",
      profileId: "profile_1",
      label: "Salary",
      incomeType: "salary",
      annualAmountMinor: 18_000_000,
      annualBonusMinor: 2_000_000,
      growthRateBasisPoints: 300,
    });
    repositories.assetLiabilityAccounts.create({
      id: "asset_1",
      profileId: "profile_1",
      accountLabel: "Brokerage",
      accountKind: "asset",
      assetClass: "brokerage",
      balanceMinor: 25_000_000,
      expectedReturnBasisPoints: 550,
      liquidity: "liquid",
    });
    repositories.cpfAccounts.create({
      id: "cpf_1",
      profileId: "profile_1",
      oaBalanceMinor: 6_000_000,
      saBalanceMinor: 8_000_000,
      maBalanceMinor: 3_000_000,
      asOfDate: "2026-06-30",
    });
    repositories.propertyProfiles.create({
      id: "property_1",
      profileId: "profile_1",
      propertyType: "hdb",
      estimatedValueMinor: 70_000_000,
      outstandingMortgageMinor: 20_000_000,
      monthlyPaymentMinor: 220_000,
    });
    repositories.healthcareAssumptions.create({
      id: "healthcare_1",
      profileId: "profile_1",
      annualPremiumMinor: 240_000,
      annualOutOfPocketMinor: 100_000,
      escalationRateBasisPoints: 400,
    });
    repositories.financialGoals.create({
      id: "goal_1",
      profileId: "profile_1",
      goalType: "emergency_fund",
      label: "Emergency fund",
      targetAmountMinor: 36_000_000,
      currentAmountMinor: 20_000_000,
      targetDate: "2027-06-30",
      priority: 1,
    });
    repositories.decisionTraces.create({
      id: "trace_1",
      profileId: "profile_1",
      sourceModule: "trust_score",
      sourceRecordId: "transaction_1",
      sourceRecordIdsJson: JSON.stringify(["transaction_1"]),
      ruleVersion: "trust-v1",
      inputFactsJson: JSON.stringify({ parserConfidence: 0.92 }),
      outputValueJson: JSON.stringify({ label: "high_trust" }),
      confidenceScore: 0.91,
      explanationText: "Trust score uses parser confidence.",
      caveatJson: "[]",
    });
    repositories.projectionRuns.create({
      id: "projection_run_1",
      profileId: "profile_1",
      runType: "baseline",
      inputHash: "input_hash_1",
      assumptionsJson: JSON.stringify({ swr: 0.035 }),
      resultSummaryJson: JSON.stringify({ fiAge: 45 }),
      confidenceScore: 0.88,
      calculatedAt: "2026-06-30T00:00:00.000Z",
    });
    repositories.projectionYears.create({
      id: "projection_year_1",
      profileId: "profile_1",
      projectionRunId: "projection_run_1",
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
      id: "insight_1",
      profileId: "profile_1",
      projectionRunId: "projection_run_1",
      insightType: "savings_gap",
      severity: "warning",
      title: "Monthly savings gap",
      body: "Increase monthly savings to hit the target retirement age.",
      recommendedAction: "Review spending and goal timing.",
      confidenceScore: 0.82,
      traceId: "trace_1",
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
    repositories.statementReconciliations.create({
      id: "reconciliation_1",
      profileId: "profile_1",
      statementImportId: "import_1",
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
      id: "trust_1",
      profileId: "profile_1",
      statementImportId: "import_1",
      transactionId: "transaction_1",
      score: 0.91,
      label: "high_trust",
      driverJson: JSON.stringify(["Trust score 91%."]),
    });
    repositories.refundTimelines.create({
      id: "refund_timeline_1",
      profileId: "profile_1",
      originalTransactionId: "transaction_1",
      status: "none",
      expectedRefundMinor: 0,
      receivedRefundMinor: 0,
      remainingEligibleSpendMinor: 1840,
      milesReversal: 0,
      confidenceScore: 1,
      eventJson: "[]",
      caveatJson: "[]",
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });
    repositories.cardPeriodSummaries.create({
      id: "card_period_1",
      profileId: "profile_1",
      cardId: "card_1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      eligibleSpendMinor: 1840,
      excludedSpendMinor: 0,
      capUsedMinor: 1840,
      milesEarned: 7,
      milesMissed: 20,
      confidenceScore: 0.9,
      calculatedAt: "2026-06-26T00:00:00.000Z",
    });
    repositories.milesLeakageItems.create({
      id: "leakage_1",
      profileId: "profile_1",
      transactionId: "transaction_1",
      cardId: "card_1",
      periodSummaryId: "card_period_1",
      reason: "wrong_card",
      spendMinor: 1840,
      milesMissed: 20,
      recoverable: true,
      confidenceScore: 0.9,
    });
    repositories.plannedPurchases.create({
      id: "planned_1",
      profileId: "profile_1",
      merchantText: "haidilao",
      mccCode: "5812",
      amountMinor: 12_000,
      currency: "SGD",
      channel: "contactless",
      plannedDate: "2026-06-28",
      recommendedCardId: "card_1",
      status: "planned",
      confidenceScore: 0.9,
      caveatJson: "[]",
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
    expect(repositories.incomeStreams.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.assetLiabilityAccounts.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.cpfAccounts.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.propertyProfiles.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.healthcareAssumptions.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.financialGoals.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.projectionRuns.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.projectionYears.listForRun("projection_run_1")).toHaveLength(1);
    expect(repositories.advisorInsights.listOpenForProfile("profile_1")).toHaveLength(1);
    expect(repositories.decisionTraces.listForSourceRecord("transaction_1")).toHaveLength(1);
    expect(repositories.transactions.listReviewItems("profile_1")).toHaveLength(1);
    expect(repositories.statementReconciliations.getByImportId("import_1")?.status).toBe(
      "verified",
    );
    expect(repositories.transactionTrustScores.getByTransactionId("transaction_1")?.label).toBe(
      "high_trust",
    );
    expect(repositories.refundTimelines.getByOriginalTransactionId("transaction_1")?.status).toBe(
      "none",
    );
    expect(repositories.cardPeriodSummaries.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.milesLeakageItems.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.plannedPurchases.listForProfile("profile_1")).toHaveLength(1);
    expect(repositories.rewardLedger.listForProfile("profile_1")).toHaveLength(1);
  });

  it("stores planner rates as integer basis points and rejects invalid enums", () => {
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
      safeWithdrawalRateBasisPoints: 350,
      expectedReturnRateBasisPoints: 550,
      inflationRateBasisPoints: 250,
    });

    const plannerColumns = connection.sqlite
      .prepare("PRAGMA table_info(planner_profiles)")
      .all() as Array<{ name: string; type: string }>;
    const rateColumns = plannerColumns
      .filter((column) => column.name.includes("rate"))
      .map((column) => ({ name: column.name, type: column.type }));

    expect(rateColumns).toEqual([
      { name: "safe_withdrawal_rate_basis_points", type: "INTEGER" },
      { name: "expected_return_rate_basis_points", type: "INTEGER" },
      { name: "inflation_rate_basis_points", type: "INTEGER" },
    ]);

    expect(() =>
      connection.sqlite
        .prepare(
          `INSERT INTO statement_imports
           (id, profile_id, source_file_hash, source_filename, bank_name, parser_name, parser_version, import_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "import_invalid",
          "profile_1",
          "hash_invalid",
          "dbs.pdf",
          "DBS",
          "Parser",
          "0.1.0",
          "unknown",
        ),
    ).toThrow(/constraint/i);

    expect(() =>
      connection.sqlite
        .prepare(
          `INSERT INTO transactions
           (id, profile_id, posted_date, description_raw, description_normalized, amount_minor, currency,
            direction, transaction_kind, transaction_fingerprint)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "transaction_invalid_direction",
          "profile_1",
          "2026-06-20",
          "Test",
          "test",
          -100,
          "SGD",
          "outflow",
          "purchase",
          "fingerprint_invalid_direction",
        ),
    ).toThrow(/constraint/i);

    expect(() =>
      connection.sqlite
        .prepare(
          `INSERT INTO transactions
           (id, profile_id, posted_date, description_raw, description_normalized, amount_minor, currency,
            direction, transaction_kind, transaction_fingerprint)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "transaction_invalid_kind",
          "profile_1",
          "2026-06-20",
          "Test",
          "test",
          -100,
          "SGD",
          "debit",
          "bonus",
          "fingerprint_invalid_kind",
        ),
    ).toThrow(/constraint/i);

    connection.sqlite
      .prepare(
        `INSERT INTO transactions
         (id, profile_id, posted_date, description_raw, description_normalized, amount_minor, currency,
          direction, transaction_kind, transaction_fingerprint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "transaction_purchase",
        "profile_1",
        "2026-06-20",
        "Purchase",
        "purchase",
        -100,
        "SGD",
        "debit",
        "purchase",
        "fingerprint_purchase",
      );
    connection.sqlite
      .prepare(
        `INSERT INTO transactions
         (id, profile_id, posted_date, description_raw, description_normalized, amount_minor, currency,
          direction, transaction_kind, transaction_fingerprint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "transaction_refund",
        "profile_1",
        "2026-06-21",
        "Refund",
        "refund",
        100,
        "SGD",
        "credit",
        "refund",
        "fingerprint_refund",
      );

    expect(() =>
      connection.sqlite
        .prepare(
          `INSERT INTO refund_matches
           (id, profile_id, refund_transaction_id, original_transaction_id, matched_amount_minor,
            match_confidence, match_method, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "refund_match_invalid",
          "profile_1",
          "transaction_refund",
          "transaction_purchase",
          100,
          1,
          "exact",
          "closed",
        ),
    ).toThrow(/constraint/i);

    expect(() =>
      connection.sqlite
        .prepare(
          `INSERT INTO reward_ledger
           (id, profile_id, ledger_type, points, miles_equivalent, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("ledger_invalid_type", "profile_1", "bonus", 1, 1, "pending"),
    ).toThrow(/constraint/i);

    expect(() =>
      connection.sqlite
        .prepare(
          `INSERT INTO reward_ledger
           (id, profile_id, ledger_type, points, miles_equivalent, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("ledger_invalid_status", "profile_1", "earn", 1, 1, "closed"),
    ).toThrow(/constraint/i);
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
