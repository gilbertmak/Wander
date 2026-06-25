import type { DatabaseConnection } from "../db/client";
import { createRepositories } from "../db/repositories";
import type { ImportPreview } from "./importWorkflow";

export type ImportDuplicateReport = {
  duplicateFile: boolean;
  duplicateStatementImportId?: string;
  duplicateTransactionFingerprints: string[];
  warnings: Array<{
    code: "DUPLICATE_FILE" | "DUPLICATE_TRANSACTION";
    message: string;
    severity: "warning";
  }>;
};

export function detectImportDuplicates(
  connection: DatabaseConnection,
  preview: ImportPreview,
): ImportDuplicateReport {
  const repositories = createRepositories(connection);
  const existingImport = repositories.statementImports.getByProfileAndHash(
    preview.statementImport.profileId,
    preview.statementImport.sourceFileHash,
  );
  const duplicateTransactionFingerprints = preview.transactions
    .filter((transaction) =>
      repositories.transactions.getByFingerprint(
        preview.statementImport.profileId,
        transaction.transactionFingerprint,
      ),
    )
    .map((transaction) => transaction.transactionFingerprint);

  const warnings: ImportDuplicateReport["warnings"] = [];

  if (existingImport) {
    warnings.push({
      code: "DUPLICATE_FILE",
      message: "This statement file hash has already been imported for the profile.",
      severity: "warning",
    });
  }

  if (duplicateTransactionFingerprints.length > 0) {
    warnings.push({
      code: "DUPLICATE_TRANSACTION",
      message: `${duplicateTransactionFingerprints.length} transaction fingerprint(s) already exist.`,
      severity: "warning",
    });
  }

  return {
    duplicateFile: Boolean(existingImport),
    duplicateStatementImportId: existingImport?.id,
    duplicateTransactionFingerprints,
    warnings,
  };
}

export function assertNoImportDuplicates(connection: DatabaseConnection, preview: ImportPreview) {
  const report = detectImportDuplicates(connection, preview);

  if (report.duplicateFile || report.duplicateTransactionFingerprints.length > 0) {
    const warningCodes = report.warnings.map((warning) => warning.code).join(", ");
    throw new Error(`Import duplicate check failed: ${warningCodes}.`);
  }

  return report;
}
