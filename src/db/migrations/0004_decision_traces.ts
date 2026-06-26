export const migration0004 = {
  id: "0004",
  name: "decision_traces",
  sql: `
CREATE TABLE decision_traces (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_record_ids_json TEXT NOT NULL DEFAULT '[]',
  rule_version TEXT NOT NULL,
  input_facts_json TEXT NOT NULL DEFAULT '{}',
  output_value_json TEXT NOT NULL DEFAULT '{}',
  confidence_score REAL NOT NULL,
  explanation_text TEXT NOT NULL,
  caveat_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX decision_traces_profile_module_idx ON decision_traces(profile_id, source_module);
CREATE INDEX decision_traces_source_record_idx ON decision_traces(source_record_id);
`,
} as const;
