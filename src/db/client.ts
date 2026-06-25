import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export type DatabaseConnection = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: BetterSqliteDatabase;
  close: () => void;
};

export function createDatabaseConnection(path = ":memory:"): DatabaseConnection {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
