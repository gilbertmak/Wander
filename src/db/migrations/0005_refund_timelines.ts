export const migration0005 = {
  id: "0005",
  name: "refund_timelines",
  sql: `
CREATE TABLE refund_timelines (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  refund_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  refund_match_id TEXT REFERENCES refund_matches(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('none', 'matched', 'partial', 'missing', 'unmatched', 'rejected')),
  expected_refund_minor INTEGER NOT NULL DEFAULT 0,
  received_refund_minor INTEGER NOT NULL DEFAULT 0,
  remaining_eligible_spend_minor INTEGER NOT NULL DEFAULT 0,
  miles_reversal INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL,
  event_json TEXT NOT NULL DEFAULT '[]',
  caveat_json TEXT NOT NULL DEFAULT '[]',
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX refund_timelines_profile_status_idx ON refund_timelines(profile_id, status);
CREATE INDEX refund_timelines_original_idx ON refund_timelines(original_transaction_id);
CREATE INDEX refund_timelines_refund_idx ON refund_timelines(refund_transaction_id);
`,
} as const;
