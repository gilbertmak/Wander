import { createHash } from "node:crypto";

import type { DatabaseConnection } from "../db/client";
import { createRepositories } from "../db/repositories";
import type { ParseStatementRequest, ParseStatementSuccess } from "./parserBridge";

export type ImportPreviewTransaction = {
  externalId: string;
  postedDate: string;
  transactionDate?: string;
  descriptionRaw: string;
  descriptionNormalized: string;
  amountMinor: number;
  currency: string;
  direction: "debit" | "credit";
  accountHint?: string;
  transactionKind: "purchase" | "refund";
  eligibleForMiles: boolean;
  confidenceScore: number;
  transactionFingerprint: string;
};

export type ImportPreview = {
  statementImport: {
    id: string;
    profileId: string;
    sourceFileHash: string;
    sourceFilename: string;
    bankName: string;
    parserName: string;
    parserVersion: string;
    warningJson: string;
  };
  accountHints: Array<{
    id: string;
    accountType: string;
    accountLabel: string;
    maskedIdentifier?: string;
    currency: string;
  }>;
  transactions: ImportPreviewTransaction[];
};

export type CommitImportResult = {
  statementImportId: string;
  accountIds: string[];
  transactionIds: string[];
};

export function buildImportPreview(
  request: ParseStatementRequest,
  result: ParseStatementSuccess,
): ImportPreview {
  const statementImportId = stableId("import", request.profileId, request.sourceFileSha256);

  return {
    statementImport: {
      id: statementImportId,
      profileId: request.profileId,
      sourceFileHash: request.sourceFileSha256,
      sourceFilename: request.sourceFilename,
      bankName: result.bankName,
      parserName: result.parserName,
      parserVersion: result.parserVersion,
      warningJson: JSON.stringify(result.warnings),
    },
    accountHints: result.accountHints.map((hint, index) => ({
      id: stableId("account", request.profileId, result.bankName, hint.maskedIdentifier ?? `${index}`),
      accountType: hint.accountType,
      accountLabel: `${result.bankName} ${hint.accountType}`,
      maskedIdentifier: hint.maskedIdentifier,
      currency: hint.currency,
    })),
    transactions: result.transactions.map((transaction) => {
      const amountMinor = parseAmountMinor(transaction.amount);
      const transactionKind = transaction.direction === "credit" ? "refund" : "purchase";
      const fingerprint = stableId(
        "txn",
        request.profileId,
        transaction.postedDate,
        transaction.amount,
        transaction.descriptionRaw,
        transaction.accountHint ?? "",
      );

      return {
        externalId: transaction.externalId,
        postedDate: transaction.postedDate,
        transactionDate: transaction.transactionDate,
        descriptionRaw: transaction.descriptionRaw,
        descriptionNormalized: normalizeDescription(transaction.descriptionRaw),
        amountMinor,
        currency: transaction.currency,
        direction: transaction.direction,
        accountHint: transaction.accountHint,
        transactionKind,
        eligibleForMiles: transactionKind === "purchase",
        confidenceScore: transaction.confidenceScore,
        transactionFingerprint: fingerprint,
      };
    }),
  };
}

export function commitImportPreview(
  connection: DatabaseConnection,
  preview: ImportPreview,
): CommitImportResult {
  const repositories = createRepositories(connection);
  const accountIds: string[] = [];
  const transactionIds: string[] = [];

  connection.sqlite.transaction(() => {
    repositories.statementImports.create({
      ...preview.statementImport,
      importStatus: "committed",
    });

    for (const accountHint of preview.accountHints) {
      repositories.accounts.create({
        id: accountHint.id,
        profileId: preview.statementImport.profileId,
        institutionName: preview.statementImport.bankName,
        accountLabel: accountHint.accountLabel,
        accountType: accountHint.accountType,
        maskedIdentifier: accountHint.maskedIdentifier,
        currency: accountHint.currency,
      });
      accountIds.push(accountHint.id);
    }

    for (const transaction of preview.transactions) {
      const accountId = resolveAccountId(preview, transaction.accountHint);
      const id = stableId("transaction", preview.statementImport.id, transaction.externalId);

      repositories.transactions.create({
        id,
        profileId: preview.statementImport.profileId,
        accountId,
        statementImportId: preview.statementImport.id,
        postedDate: transaction.postedDate,
        transactionDate: transaction.transactionDate,
        descriptionRaw: transaction.descriptionRaw,
        descriptionNormalized: transaction.descriptionNormalized,
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        direction: transaction.direction,
        transactionKind: transaction.transactionKind,
        eligibleForMiles: transaction.eligibleForMiles,
        confidenceScore: transaction.confidenceScore,
        needsReview: transaction.confidenceScore < 0.9,
        transactionFingerprint: transaction.transactionFingerprint,
      });
      transactionIds.push(id);
    }
  })();

  return {
    statementImportId: preview.statementImport.id,
    accountIds,
    transactionIds,
  };
}

function resolveAccountId(preview: ImportPreview, accountHint: string | undefined) {
  const exactMatch = preview.accountHints.find((hint) => hint.maskedIdentifier === accountHint);
  return exactMatch?.id ?? preview.accountHints[0]?.id;
}

function parseAmountMinor(amount: string) {
  return Math.round(Number(amount) * 100);
}

function normalizeDescription(description: string) {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

function stableId(prefix: string, ...parts: string[]) {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `${prefix}_${digest}`;
}
