export const migration0006 = {
  id: "0006",
  name: "miles_leakage_monitor",
  sql: `
CREATE TABLE card_period_summaries (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  eligible_spend_minor INTEGER NOT NULL,
  excluded_spend_minor INTEGER NOT NULL,
  cap_used_minor INTEGER NOT NULL,
  miles_earned INTEGER NOT NULL,
  miles_missed INTEGER NOT NULL,
  confidence_score REAL NOT NULL,
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX card_period_summaries_card_period_unique ON card_period_summaries(card_id, period_start, period_end);
CREATE INDEX card_period_summaries_profile_period_idx ON card_period_summaries(profile_id, period_start, period_end);

CREATE TABLE miles_leakage_items (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  period_summary_id TEXT REFERENCES card_period_summaries(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('wrong_card', 'cap_exhausted', 'excluded_mcc', 'refund_reversal', 'low_confidence_mcc', 'missing_card_assignment')),
  spend_minor INTEGER NOT NULL,
  miles_missed INTEGER NOT NULL,
  recoverable INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL,
  trace_id TEXT REFERENCES decision_traces(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX miles_leakage_items_profile_reason_idx ON miles_leakage_items(profile_id, reason);
CREATE INDEX miles_leakage_items_transaction_idx ON miles_leakage_items(transaction_id);
`,
} as const;
