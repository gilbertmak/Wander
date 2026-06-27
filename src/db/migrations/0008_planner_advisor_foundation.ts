export const migration0008 = {
  id: "0008",
  name: "planner_advisor_foundation",
  sql: `
PRAGMA foreign_keys = ON;

CREATE TABLE income_streams (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  income_type TEXT NOT NULL CHECK (income_type IN ('salary', 'bonus', 'business', 'rental', 'dividend', 'cpf_life', 'other')),
  annual_amount_minor INTEGER NOT NULL,
  annual_bonus_minor INTEGER NOT NULL DEFAULT 0,
  growth_rate_basis_points INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  source TEXT NOT NULL DEFAULT 'user_input',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX income_streams_profile_type_idx ON income_streams(profile_id, income_type);

CREATE TABLE asset_liability_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_label TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('asset', 'liability')),
  asset_class TEXT NOT NULL CHECK (asset_class IN ('cash', 'brokerage', 'cpf', 'srs', 'property', 'debt', 'other')),
  balance_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SGD',
  expected_return_basis_points INTEGER NOT NULL DEFAULT 0,
  liquidity TEXT NOT NULL CHECK (liquidity IN ('liquid', 'locked', 'illiquid')),
  source TEXT NOT NULL DEFAULT 'user_input',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX asset_liability_accounts_profile_class_idx ON asset_liability_accounts(profile_id, asset_class);

CREATE TABLE cpf_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  oa_balance_minor INTEGER NOT NULL DEFAULT 0,
  sa_balance_minor INTEGER NOT NULL DEFAULT 0,
  ma_balance_minor INTEGER NOT NULL DEFAULT 0,
  ra_balance_minor INTEGER NOT NULL DEFAULT 0,
  as_of_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user_input',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX cpf_accounts_profile_date_idx ON cpf_accounts(profile_id, as_of_date);

CREATE TABLE property_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_type TEXT NOT NULL CHECK (property_type IN ('hdb', 'condo', 'landed', 'investment', 'other')),
  estimated_value_minor INTEGER NOT NULL,
  outstanding_mortgage_minor INTEGER NOT NULL DEFAULT 0,
  monthly_payment_minor INTEGER NOT NULL DEFAULT 0,
  annual_rental_income_minor INTEGER NOT NULL DEFAULT 0,
  lease_end_year INTEGER,
  is_primary_residence INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX property_profiles_profile_type_idx ON property_profiles(profile_id, property_type);

CREATE TABLE healthcare_assumptions (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  annual_premium_minor INTEGER NOT NULL DEFAULT 0,
  annual_out_of_pocket_minor INTEGER NOT NULL DEFAULT 0,
  medisave_use_minor INTEGER NOT NULL DEFAULT 0,
  escalation_rate_basis_points INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'user_input',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX healthcare_assumptions_profile_idx ON healthcare_assumptions(profile_id);

CREATE TABLE financial_goals (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('emergency_fund', 'home', 'education', 'car', 'wedding', 'travel', 'parent_support', 'custom')),
  label TEXT NOT NULL,
  target_amount_minor INTEGER NOT NULL,
  current_amount_minor INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  priority INTEGER NOT NULL DEFAULT 3,
  funding_source TEXT NOT NULL DEFAULT 'cash',
  inflation_adjusted INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'funded', 'paused', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX financial_goals_profile_status_idx ON financial_goals(profile_id, status);
CREATE INDEX financial_goals_profile_priority_idx ON financial_goals(profile_id, priority);

CREATE TABLE projection_runs (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scenario_id TEXT,
  run_type TEXT NOT NULL CHECK (run_type IN ('baseline', 'scenario', 'stress', 'monte_carlo')),
  input_hash TEXT NOT NULL,
  assumptions_json TEXT NOT NULL DEFAULT '{}',
  result_summary_json TEXT NOT NULL DEFAULT '{}',
  confidence_score REAL NOT NULL DEFAULT 0,
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX projection_runs_profile_type_idx ON projection_runs(profile_id, run_type);
CREATE INDEX projection_runs_profile_calculated_idx ON projection_runs(profile_id, calculated_at);

CREATE TABLE projection_years (
  id TEXT PRIMARY KEY NOT NULL,
  projection_run_id TEXT NOT NULL REFERENCES projection_runs(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year_index INTEGER NOT NULL,
  calendar_year INTEGER NOT NULL,
  age INTEGER NOT NULL,
  liquid_assets_minor INTEGER NOT NULL,
  cpf_balance_minor INTEGER NOT NULL,
  property_equity_minor INTEGER NOT NULL,
  annual_income_minor INTEGER NOT NULL,
  annual_expenses_minor INTEGER NOT NULL,
  annual_savings_minor INTEGER NOT NULL,
  fire_target_minor INTEGER NOT NULL,
  fire_progress_basis_points INTEGER NOT NULL,
  event_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX projection_years_run_year_unique ON projection_years(projection_run_id, year_index);
CREATE INDEX projection_years_profile_age_idx ON projection_years(profile_id, age);

CREATE TABLE advisor_insights (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  projection_run_id TEXT REFERENCES projection_runs(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('on_track', 'savings_gap', 'expense_drift', 'cpf_shortfall', 'goal_conflict', 'sequence_risk', 'emergency_reserve', 'retirement_spending_risk')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  trace_id TEXT REFERENCES decision_traces(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'applied')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX advisor_insights_profile_status_idx ON advisor_insights(profile_id, status);
CREATE INDEX advisor_insights_profile_type_idx ON advisor_insights(profile_id, insight_type);
`,
} as const;
