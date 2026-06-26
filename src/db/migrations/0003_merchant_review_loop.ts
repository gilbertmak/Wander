export const migration0003 = {
  id: "0003",
  name: "merchant_confidence_review_loop",
  sql: `
ALTER TABLE merchant_heuristics ADD COLUMN alias_text TEXT;
ALTER TABLE merchant_heuristics ADD COLUMN category_override_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE merchant_heuristics ADD COLUMN mcc_override_id TEXT REFERENCES mcc_codes(id) ON DELETE SET NULL;
ALTER TABLE merchant_heuristics ADD COLUMN source_transaction_id TEXT;
ALTER TABLE merchant_heuristics ADD COLUMN rule_version TEXT NOT NULL DEFAULT 'seed-v1';

CREATE INDEX merchant_heuristics_source_priority_idx ON merchant_heuristics(source, confidence_score);
CREATE INDEX merchant_heuristics_source_transaction_idx ON merchant_heuristics(source_transaction_id);
`,
} as const;
