export const migration0007 = {
  id: "0007",
  name: "planned_purchases",
  sql: `
CREATE TABLE planned_purchases (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_text TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  mcc_code TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SGD',
  channel TEXT NOT NULL CHECK (channel IN ('online', 'offline', 'contactless')),
  planned_date TEXT NOT NULL,
  recommended_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'matched', 'cancelled')) DEFAULT 'planned',
  matched_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  confidence_score REAL NOT NULL,
  caveat_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX planned_purchases_profile_status_idx ON planned_purchases(profile_id, status);
CREATE INDEX planned_purchases_match_idx ON planned_purchases(matched_transaction_id);
`,
} as const;
