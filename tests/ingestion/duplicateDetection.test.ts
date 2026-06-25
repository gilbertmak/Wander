import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { createRepositories } from "../../src/db/repositories";
import { detectImportDuplicates } from "../../src/ingestion/duplicateDetection";
import { buildImportPreview, commitImportPreview } from "../../src/ingestion/importWorkflow";
import type { ParseStatementRequest, ParseStatementSuccess } from "../../src/ingestion/parserBridge";

describe("import duplicate detection", () => {
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

  it("reports no warnings for a fresh import preview", () => {
    const preview = buildImportPreview(request, successResult);

    expect(detectImportDuplicates(connection, preview)).toEqual({
      duplicateFile: false,
      duplicateStatementImportId: undefined,
      duplicateTransactionFingerprints: [],
      warnings: [],
    });
  });

  it("warns on duplicate file hash and duplicate transaction fingerprints", () => {
    const preview = buildImportPreview(request, successResult);
    commitImportPreview(connection, preview);

    const report = detectImportDuplicates(connection, preview);

    expect(report.duplicateFile).toBe(true);
    expect(report.duplicateStatementImportId).toBe(preview.statementImport.id);
    expect(report.duplicateTransactionFingerprints).toHaveLength(2);
    expect(report.warnings.map((warning) => warning.code)).toEqual([
      "DUPLICATE_FILE",
      "DUPLICATE_TRANSACTION",
    ]);
  });

  it("blocks duplicate commits before database constraints throw", () => {
    const preview = buildImportPreview(request, successResult);
    commitImportPreview(connection, preview);

    expect(() => commitImportPreview(connection, preview)).toThrow(/duplicate check failed/i);
  });
});

const request: ParseStatementRequest = {
  requestId: "parse_2026_0001",
  profileId: "profile_001",
  sourceType: "pdf",
  sourceFilename: "statement.pdf",
  sourceFilePath: "/tmp/fire-planner/imports/statement.pdf",
  sourceFileSha256: "c".repeat(64),
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
  warnings: [],
};
