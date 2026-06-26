export const migration0001 = {
  id: "0001",
  name: "initial_local_first_schema",
  sql: `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SGD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE planner_profiles (
  profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_age INTEGER NOT NULL,
  target_retirement_age INTEGER NOT NULL,
  current_net_worth_minor INTEGER NOT NULL,
  target_fire_number_minor INTEGER NOT NULL,
  annual_expenses_minor INTEGER NOT NULL,
  safe_withdrawal_rate_basis_points INTEGER NOT NULL,
  expected_return_rate_basis_points INTEGER NOT NULL,
  inflation_rate_basis_points INTEGER NOT NULL,
  cpf_settings_json TEXT NOT NULL DEFAULT '{}',
  scenario_settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_spend_minor INTEGER NOT NULL,
  refunds_minor INTEGER NOT NULL,
  net_spend_minor INTEGER NOT NULL,
  annualized_expenses_minor INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_module TEXT,
  source_record_id TEXT,
  source_version TEXT,
  calculated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX expense_snapshots_profile_period_idx ON expense_snapshots(profile_id, period_start, period_end);

CREATE TABLE statement_imports (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_file_hash TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  parser_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  import_status TEXT NOT NULL CHECK (import_status IN ('parsed', 'committed', 'duplicate', 'failed')),
  warning_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX statement_imports_profile_hash_unique ON statement_imports(profile_id, source_file_hash);
CREATE INDEX statement_imports_profile_status_idx ON statement_imports(profile_id, import_status);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  account_label TEXT NOT NULL,
  account_type TEXT NOT NULL,
  masked_identifier TEXT,
  currency TEXT NOT NULL DEFAULT 'SGD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX accounts_profile_idx ON accounts(profile_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  fire_expense_group TEXT NOT NULL,
  is_discretionary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX categories_parent_idx ON categories(parent_id);

CREATE TABLE mcc_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  network_description TEXT,
  default_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  default_miles_eligibility INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX mcc_codes_code_unique ON mcc_codes(code);
CREATE INDEX mcc_codes_default_category_idx ON mcc_codes(default_category_id);

CREATE TABLE merchants (
  id TEXT PRIMARY KEY NOT NULL,
  canonical_name TEXT NOT NULL,
  default_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  default_mcc_id TEXT REFERENCES mcc_codes(id) ON DELETE SET NULL,
  country TEXT NOT NULL DEFAULT 'SG',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX merchants_category_idx ON merchants(default_category_id);
CREATE INDEX merchants_mcc_idx ON merchants(default_mcc_id);

CREATE TABLE merchant_heuristics (
  id TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  mcc_id TEXT REFERENCES mcc_codes(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  confidence_score REAL NOT NULL,
  source TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX merchant_heuristics_pattern_idx ON merchant_heuristics(pattern_type, pattern_value);
CREATE INDEX merchant_heuristics_merchant_idx ON merchant_heuristics(merchant_id);

CREATE TABLE cards (
  id TEXT PRIMARY KEY NOT NULL,
  issuer TEXT NOT NULL,
  card_name TEXT NOT NULL,
  network TEXT,
  currency TEXT NOT NULL DEFAULT 'SGD',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX cards_issuer_idx ON cards(issuer);

CREATE TABLE card_rules (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  cap_period TEXT,
  cap_amount_minor INTEGER,
  base_formula_json TEXT NOT NULL DEFAULT '{}',
  bonus_formula_json TEXT NOT NULL DEFAULT '{}',
  eligibility_json TEXT NOT NULL DEFAULT '{}',
  exclusion_json TEXT NOT NULL DEFAULT '{}',
  transfer_rule_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX card_rules_card_effective_idx ON card_rules(card_id, effective_from, effective_to);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  statement_import_id TEXT REFERENCES statement_imports(id) ON DELETE SET NULL,
  posted_date TEXT NOT NULL,
  transaction_date TEXT,
  description_raw TEXT NOT NULL,
  description_normalized TEXT NOT NULL,
  merchant_id TEXT REFERENCES merchants(id) ON DELETE SET NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SGD',
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  transaction_kind TEXT NOT NULL CHECK (transaction_kind IN ('purchase', 'refund', 'fee', 'interest', 'payment', 'adjustment')),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  mcc_id TEXT REFERENCES mcc_codes(id) ON DELETE SET NULL,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  eligible_for_miles INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 1,
  transaction_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX transactions_profile_fingerprint_unique ON transactions(profile_id, transaction_fingerprint);
CREATE INDEX transactions_profile_posted_idx ON transactions(profile_id, posted_date);
CREATE INDEX transactions_profile_review_idx ON transactions(profile_id, needs_review);
CREATE INDEX transactions_profile_merchant_idx ON transactions(profile_id, merchant_id);
CREATE INDEX transactions_profile_mcc_idx ON transactions(profile_id, mcc_id);
CREATE INDEX transactions_profile_card_posted_idx ON transactions(profile_id, card_id, posted_date);

CREATE TABLE refund_matches (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  refund_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  original_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  matched_amount_minor INTEGER NOT NULL,
  match_confidence REAL NOT NULL,
  match_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('matched', 'partial', 'uncertain', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX refund_matches_refund_idx ON refund_matches(profile_id, refund_transaction_id);
CREATE INDEX refund_matches_original_idx ON refund_matches(profile_id, original_transaction_id);

CREATE TABLE reward_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  rule_id TEXT REFERENCES card_rules(id) ON DELETE SET NULL,
  ledger_type TEXT NOT NULL CHECK (ledger_type IN ('earn', 'reversal', 'adjustment')),
  points INTEGER NOT NULL,
  miles_equivalent INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'posted', 'reversed', 'excluded')),
  calculation_trace_json TEXT NOT NULL DEFAULT '{}',
  source_module TEXT,
  source_record_id TEXT,
  source_version TEXT,
  calculated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX reward_ledger_profile_card_created_idx ON reward_ledger(profile_id, card_id, created_at);
CREATE INDEX reward_ledger_profile_transaction_idx ON reward_ledger(profile_id, transaction_id);

CREATE TABLE redemption_programs (
  id TEXT PRIMARY KEY NOT NULL,
  issuer TEXT NOT NULL,
  program_name TEXT NOT NULL,
  points_name TEXT NOT NULL,
  miles_conversion_ratio TEXT NOT NULL,
  minimum_transfer_points INTEGER NOT NULL,
  transfer_block_points INTEGER NOT NULL,
  fee_minor INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seeded_data_versions (
  id TEXT PRIMARY KEY NOT NULL,
  dataset_name TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  source_url TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`,
} as const;
