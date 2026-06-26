import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { createRepositories } from "../../src/db/repositories";
import {
  buildImportPreview,
  commitImportPreview,
  type ImportPreview,
} from "../../src/ingestion/importWorkflow";
import type {
  ParseStatementRequest,
  ParseStatementSuccess,
} from "../../src/ingestion/parserBridge";

describe("statement import workflow", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabaseConnection();
    runMigrations(connection);
    createRepositories(connection).profiles.create({
      id: "profile_001",
      name: "Primary",
      currency: "SGD",
    });
  });

  afterEach(() => {
    connection.close();
  });

  it("builds a preview from a successful parser result", () => {
    const preview = buildImportPreview(request, successResult);

    expect(preview.statementImport).toMatchObject({
      profileId: "profile_001",
      sourceFileHash: request.sourceFileSha256,
      sourceFilename: "statement.pdf",
      bankName: "DBS",
      parserName: "StatementSenseiBridge",
      parserVersion: "0.1.0",
    });
    expect(preview.accountHints).toHaveLength(1);
    expect(preview.transactions).toEqual([
      expect.objectContaining({
        descriptionNormalized: "grab *trip singapore",
        amountMinor: -1840,
        transactionKind: "purchase",
        eligibleForMiles: true,
      }),
      expect.objectContaining({
        descriptionNormalized: "apple refund",
        amountMinor: 12900,
        transactionKind: "refund",
        eligibleForMiles: false,
      }),
    ]);
  });

  it("commits accepted preview rows to SQLite with import audit metadata", () => {
    const preview = buildImportPreview(request, successResult);
    const result = commitImportPreview(connection, preview);
    const repositories = createRepositories(connection);

    expect(result.statementImportId).toBe(preview.statementImport.id);
    expect(result.accountIds).toHaveLength(1);
    expect(result.transactionIds).toHaveLength(2);
    expect(result.reconciliationId).toMatch(/^reconciliation_/);
    expect(result.trustScoreIds).toHaveLength(2);
    expect(
      repositories.statementImports.getByProfileAndHash("profile_001", request.sourceFileSha256)
        ?.bankName,
    ).toBe("DBS");
    expect(repositories.accounts.listForProfile("profile_001")).toHaveLength(1);
    expect(repositories.transactions.listReviewItems("profile_001")).toHaveLength(1);
    expect(
      repositories.statementReconciliations.getByImportId(result.statementImportId),
    ).toMatchObject({
      rowCount: 2,
      status: "mostly_verified",
      issueJson: JSON.stringify(["Statement balances unavailable; row-level checks only."]),
    });
    expect(
      repositories.transactionTrustScores.listForImport(result.statementImportId),
    ).toHaveLength(2);
  });

  it("persists verified reconciliation when statement balances are supplied", () => {
    const preview = buildImportPreview(request, successResult);
    const result = commitImportPreview(connection, preview, {
      reconciliation: {
        openingBalanceMinor: 100_000,
        closingBalanceMinor: 111_060,
      },
    });

    expect(
      createRepositories(connection).statementReconciliations.getByImportId(
        result.statementImportId,
      ),
    ).toMatchObject({
      openingBalanceMinor: 100_000,
      closingBalanceMinor: 111_060,
      unexplainedDeltaMinor: 0,
      status: "verified",
    });
  });

  it("rolls back the import if transaction persistence fails", () => {
    const preview: ImportPreview = {
      ...buildImportPreview(request, successResult),
      transactions: [
        {
          ...buildImportPreview(request, successResult).transactions[0],
          transactionFingerprint: "same",
        },
        {
          ...buildImportPreview(request, successResult).transactions[1],
          transactionFingerprint: "same",
        },
      ],
    };

    expect(() => commitImportPreview(connection, preview)).toThrow(/unique/i);
    expect(
      createRepositories(connection).statementImports.getByProfileAndHash(
        "profile_001",
        request.sourceFileSha256,
      ),
    ).toBeUndefined();
  });
});

const request: ParseStatementRequest = {
  requestId: "parse_2026_0001",
  profileId: "profile_001",
  sourceType: "pdf",
  sourceFilename: "statement.pdf",
  sourceFilePath: "/tmp/fire-planner/imports/statement.pdf",
  sourceFileSha256: "b".repeat(64),
  parserOptions: {
    ocrEnabled: true,
    passwordProvided: false,
    locale: "en-SG",
  },
};

const successResult: ParseStatementSuccess = {
  requestId: request.requestId,
  status: "success",
  parserName: "StatementSenseiBridge",
  parserVersion: "0.1.0",
  bankName: "DBS",
  accountHints: [{ accountType: "credit_card", maskedIdentifier: "**** 1234", currency: "SGD" }],
  transactions: [
    {
      externalId: "row_1",
      postedDate: "2026-06-20",
      transactionDate: "2026-06-19",
      descriptionRaw: "GRAB *TRIP SINGAPORE",
      amount: "-18.40",
      currency: "SGD",
      direction: "debit",
      accountHint: "**** 1234",
      confidenceScore: 0.92,
    },
    {
      externalId: "row_2",
      postedDate: "2026-06-21",
      transactionDate: "2026-06-20",
      descriptionRaw: "APPLE REFUND",
      amount: "129.00",
      currency: "SGD",
      direction: "credit",
      accountHint: "**** 1234",
      confidenceScore: 0.82,
    },
  ],
  warnings: [{ code: "OCR_USED", message: "OCR fallback used.", severity: "info" }],
};
