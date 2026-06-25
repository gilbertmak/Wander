import { eq } from "drizzle-orm";

import { migrations } from "./migrations";
import { schemaMigrations } from "./schema";
import type { DatabaseConnection } from "./client";

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

export function runMigrations(connection: DatabaseConnection): MigrationResult {
  const result: MigrationResult = {
    applied: [],
    skipped: [],
  };

  connection.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  connection.sqlite.transaction(() => {
    for (const migration of migrations) {
      const existing = connection.db
        .select()
        .from(schemaMigrations)
        .where(eq(schemaMigrations.id, migration.id))
        .get();

      if (existing) {
        result.skipped.push(migration.id);
        continue;
      }

      connection.sqlite.exec(migration.sql);
      connection.db.insert(schemaMigrations).values({ id: migration.id, name: migration.name }).run();
      result.applied.push(migration.id);
    }
  })();

  return result;
}
