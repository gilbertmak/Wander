import { z } from "zod";

import type { DatabaseConnection } from "./client";
import { migrations } from "./migrations";

export const exportFormatVersion = 1;

const tableNames = [
  "profiles",
  "planner_profiles",
  "expense_snapshots",
  "decision_traces",
  "statement_imports",
  "statement_reconciliations",
  "accounts",
  "categories",
  "mcc_codes",
  "merchants",
  "merchant_heuristics",
  "cards",
  "card_rules",
  "card_period_summaries",
  "transactions",
  "transaction_trust_scores",
  "refund_matches",
  "refund_timelines",
  "miles_leakage_items",
  "reward_ledger",
  "redemption_programs",
  "seeded_data_versions",
] as const;

const importOrder = tableNames;
const deleteOrder = [...tableNames].reverse();

const rowSchema = z.record(z.string(), z.unknown());
const tableRowsSchema = z.array(rowSchema);

const exportDataSchema = z.object(
  Object.fromEntries(tableNames.map((tableName) => [tableName, tableRowsSchema])) as Record<
    (typeof tableNames)[number],
    typeof tableRowsSchema
  >,
);

export const localDataExportSchema = z.object({
  formatVersion: z.literal(exportFormatVersion),
  exportedAt: z.string(),
  app: z.object({
    name: z.literal("Wander"),
    exportSource: z.literal("local-sqlite"),
  }),
  database: z.object({
    migrationIds: z.array(z.string()),
    sourceFilesIncluded: z.literal(false),
  }),
  data: exportDataSchema,
});

export type LocalDataExport = z.infer<typeof localDataExportSchema>;

export function exportLocalData(connection: DatabaseConnection): LocalDataExport {
  assertMigrationsCurrent(connection);

  const data = Object.fromEntries(
    tableNames.map((tableName) => [tableName, selectAllRows(connection, tableName)]),
  ) as LocalDataExport["data"];

  return {
    formatVersion: exportFormatVersion,
    exportedAt: new Date().toISOString(),
    app: {
      name: "Wander",
      exportSource: "local-sqlite",
    },
    database: {
      migrationIds: migrations.map((migration) => migration.id),
      sourceFilesIncluded: false,
    },
    data,
  };
}

export function importLocalData(connection: DatabaseConnection, candidate: unknown) {
  assertMigrationsCurrent(connection);
  const artifact = localDataExportSchema.parse(candidate);
  assertArtifactCompatible(artifact);

  connection.sqlite.transaction(() => {
    for (const tableName of deleteOrder) {
      connection.sqlite.prepare(`DELETE FROM ${tableName}`).run();
    }

    for (const tableName of importOrder) {
      insertRows(connection, tableName, artifact.data[tableName]);
    }
  })();

  return {
    importedTables: importOrder.length,
    importedRows: importOrder.reduce(
      (count, tableName) => count + artifact.data[tableName].length,
      0,
    ),
  };
}

export function assertMigrationsCurrent(connection: DatabaseConnection) {
  const migrationTable = connection.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();

  if (!migrationTable) {
    throw new Error(
      `Database migrations are not current. Missing: ${migrations
        .map((migration) => migration.id)
        .join(", ")}.`,
    );
  }

  const appliedRows = connection.sqlite
    .prepare("SELECT id FROM schema_migrations ORDER BY id")
    .all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));
  const missing = migrations.map((migration) => migration.id).filter((id) => !applied.has(id));

  if (missing.length > 0) {
    throw new Error(`Database migrations are not current. Missing: ${missing.join(", ")}.`);
  }
}

function assertArtifactCompatible(artifact: LocalDataExport) {
  const expectedMigrationIds = migrations.map((migration) => migration.id);
  const missing = expectedMigrationIds.filter((id) => !artifact.database.migrationIds.includes(id));

  if (missing.length > 0) {
    throw new Error(`Export artifact is missing required migrations: ${missing.join(", ")}.`);
  }
}

function selectAllRows(connection: DatabaseConnection, tableName: (typeof tableNames)[number]) {
  return connection.sqlite.prepare(`SELECT * FROM ${tableName}`).all() as Array<
    Record<string, unknown>
  >;
}

function insertRows(
  connection: DatabaseConnection,
  tableName: (typeof tableNames)[number],
  rows: Array<Record<string, unknown>>,
) {
  if (rows.length === 0) {
    return;
  }

  const columns = Object.keys(rows[0]);
  const columnList = columns.map((column) => `"${column}"`).join(", ");
  const parameterList = columns.map((column) => `@${column}`).join(", ");
  const statement = connection.sqlite.prepare(
    `INSERT INTO ${tableName} (${columnList}) VALUES (${parameterList})`,
  );

  for (const row of rows) {
    statement.run(row);
  }
}
