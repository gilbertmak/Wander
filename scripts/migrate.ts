import { createDatabaseConnection } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const databasePath = process.env.DATABASE_PATH ?? "data/wander.sqlite";

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true });
}

const connection = createDatabaseConnection(databasePath);

try {
  const result = runMigrations(connection);
  console.log(
    JSON.stringify(
      {
        databasePath,
        applied: result.applied,
        skipped: result.skipped,
      },
      null,
      2,
    ),
  );
} finally {
  connection.close();
}
