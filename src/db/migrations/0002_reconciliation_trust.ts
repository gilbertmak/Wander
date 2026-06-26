export const migration0002 = {
  id: "0002",
  name: "statement_reconciliation_and_transaction_trust",
  sql: `
CREATE TABLE statement_reconciliations (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  statement_import_id TEXT NOT NULL REFERENCES statement_imports(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  opening_balance_minor INTEGER,
  closing_balance_minor INTEGER,
  debit_total_minor INTEGER NOT NULL,
  credit_total_minor INTEGER NOT NULL,
  fee_total_minor INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  duplicate_count INTEGER NOT NULL,
  unexplained_delta_minor INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'mostly_verified', 'needs_review')),
  confidence_score REAL NOT NULL,
  issue_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX statement_reconciliations_import_unique ON statement_reconciliations(statement_import_id);
CREATE INDEX statement_reconciliations_profile_status_idx ON statement_reconciliations(profile_id, status);

CREATE TABLE transaction_trust_scores (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  statement_import_id TEXT NOT NULL REFERENCES statement_imports(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('high_trust', 'medium_trust', 'needs_review')),
  driver_json TEXT NOT NULL DEFAULT '[]',
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX transaction_trust_scores_transaction_unique ON transaction_trust_scores(transaction_id);
CREATE INDEX transaction_trust_scores_profile_label_idx ON transaction_trust_scores(profile_id, label);
CREATE INDEX transaction_trust_scores_import_idx ON transaction_trust_scores(statement_import_id);
`,
} as const;
