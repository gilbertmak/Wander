import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const directionValues = ["debit", "credit"] as const;
export const transactionKindValues = [
  "purchase",
  "refund",
  "fee",
  "interest",
  "payment",
  "adjustment",
] as const;
export const importStatusValues = ["parsed", "committed", "duplicate", "failed"] as const;
export const matchStatusValues = ["matched", "partial", "uncertain", "rejected"] as const;
export const ledgerTypeValues = ["earn", "reversal", "adjustment"] as const;
export const ledgerStatusValues = ["pending", "posted", "reversed", "excluded"] as const;
export const reconciliationStatusValues = ["verified", "mostly_verified", "needs_review"] as const;
export const trustLabelValues = ["high_trust", "medium_trust", "needs_review"] as const;
export const refundTimelineStatusValues = [
  "none",
  "matched",
  "partial",
  "missing",
  "unmatched",
  "rejected",
] as const;
export const milesLeakageReasonValues = [
  "wrong_card",
  "cap_exhausted",
  "excluded_mcc",
  "refund_reversal",
  "low_confidence_mcc",
  "missing_card_assignment",
] as const;
export const plannedPurchaseStatusValues = ["planned", "matched", "cancelled"] as const;
export const incomeTypeValues = [
  "salary",
  "bonus",
  "business",
  "rental",
  "dividend",
  "cpf_life",
  "other",
] as const;
export const accountKindValues = ["asset", "liability"] as const;
export const assetClassValues = [
  "cash",
  "brokerage",
  "cpf",
  "srs",
  "property",
  "debt",
  "other",
] as const;
export const liquidityValues = ["liquid", "locked", "illiquid"] as const;
export const propertyTypeValues = ["hdb", "condo", "landed", "investment", "other"] as const;
export const goalTypeValues = [
  "emergency_fund",
  "home",
  "education",
  "car",
  "wedding",
  "travel",
  "parent_support",
  "custom",
] as const;
export const goalStatusValues = ["active", "funded", "paused", "dismissed"] as const;
export const projectionRunTypeValues = ["baseline", "scenario", "stress", "monte_carlo"] as const;
export const advisorInsightTypeValues = [
  "on_track",
  "savings_gap",
  "expense_drift",
  "cpf_shortfall",
  "goal_conflict",
  "sequence_risk",
  "emergency_reserve",
  "retirement_spending_risk",
] as const;
export const advisorSeverityValues = ["info", "warning", "critical"] as const;
export const advisorInsightStatusValues = ["open", "dismissed", "applied"] as const;

const now = sql`CURRENT_TIMESTAMP`;

export const schemaMigrations = sqliteTable("schema_migrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  appliedAt: text("applied_at").notNull().default(now),
});

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("SGD"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const plannerProfiles = sqliteTable("planner_profiles", {
  profileId: text("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  currentAge: integer("current_age").notNull(),
  targetRetirementAge: integer("target_retirement_age").notNull(),
  currentNetWorthMinor: integer("current_net_worth_minor").notNull(),
  targetFireNumberMinor: integer("target_fire_number_minor").notNull(),
  annualExpensesMinor: integer("annual_expenses_minor").notNull(),
  safeWithdrawalRateBasisPoints: integer("safe_withdrawal_rate_basis_points").notNull(),
  expectedReturnRateBasisPoints: integer("expected_return_rate_basis_points").notNull(),
  inflationRateBasisPoints: integer("inflation_rate_basis_points").notNull(),
  cpfSettingsJson: text("cpf_settings_json").notNull().default("{}"),
  scenarioSettingsJson: text("scenario_settings_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const expenseSnapshots = sqliteTable(
  "expense_snapshots",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    grossSpendMinor: integer("gross_spend_minor").notNull(),
    refundsMinor: integer("refunds_minor").notNull(),
    netSpendMinor: integer("net_spend_minor").notNull(),
    annualizedExpensesMinor: integer("annualized_expenses_minor").notNull(),
    source: text("source").notNull(),
    sourceModule: text("source_module"),
    sourceRecordId: text("source_record_id"),
    sourceVersion: text("source_version"),
    calculatedAt: text("calculated_at"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("expense_snapshots_profile_period_idx").on(
      table.profileId,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const statementImports = sqliteTable(
  "statement_imports",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sourceFileHash: text("source_file_hash").notNull(),
    sourceFilename: text("source_filename").notNull(),
    bankName: text("bank_name").notNull(),
    parserName: text("parser_name").notNull(),
    parserVersion: text("parser_version").notNull(),
    importStatus: text("import_status").notNull(),
    warningJson: text("warning_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("statement_imports_profile_hash_unique").on(table.profileId, table.sourceFileHash),
    index("statement_imports_profile_status_idx").on(table.profileId, table.importStatus),
  ],
);

export const statementReconciliations = sqliteTable(
  "statement_reconciliations",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    statementImportId: text("statement_import_id")
      .notNull()
      .references(() => statementImports.id, { onDelete: "cascade" }),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    openingBalanceMinor: integer("opening_balance_minor"),
    closingBalanceMinor: integer("closing_balance_minor"),
    debitTotalMinor: integer("debit_total_minor").notNull(),
    creditTotalMinor: integer("credit_total_minor").notNull(),
    feeTotalMinor: integer("fee_total_minor").notNull(),
    rowCount: integer("row_count").notNull(),
    duplicateCount: integer("duplicate_count").notNull(),
    unexplainedDeltaMinor: integer("unexplained_delta_minor").notNull(),
    status: text("status").notNull(),
    confidenceScore: real("confidence_score").notNull(),
    issueJson: text("issue_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("statement_reconciliations_import_unique").on(table.statementImportId),
    index("statement_reconciliations_profile_status_idx").on(table.profileId, table.status),
  ],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    institutionName: text("institution_name").notNull(),
    accountLabel: text("account_label").notNull(),
    accountType: text("account_type").notNull(),
    maskedIdentifier: text("masked_identifier"),
    currency: text("currency").notNull().default("SGD"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("accounts_profile_idx").on(table.profileId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    fireExpenseGroup: text("fire_expense_group").notNull(),
    isDiscretionary: integer("is_discretionary", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("categories_parent_idx").on(table.parentId)],
);

export const mccCodes = sqliteTable(
  "mcc_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    networkDescription: text("network_description"),
    defaultCategoryId: text("default_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    defaultMilesEligibility: integer("default_miles_eligibility", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("mcc_codes_code_unique").on(table.code),
    index("mcc_codes_default_category_idx").on(table.defaultCategoryId),
  ],
);

export const merchants = sqliteTable(
  "merchants",
  {
    id: text("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    defaultCategoryId: text("default_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    defaultMccId: text("default_mcc_id").references(() => mccCodes.id, { onDelete: "set null" }),
    country: text("country").notNull().default("SG"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("merchants_category_idx").on(table.defaultCategoryId),
    index("merchants_mcc_idx").on(table.defaultMccId),
  ],
);

export const merchantHeuristics = sqliteTable(
  "merchant_heuristics",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    patternType: text("pattern_type").notNull(),
    patternValue: text("pattern_value").notNull(),
    mccId: text("mcc_id").references(() => mccCodes.id, { onDelete: "set null" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    confidenceScore: real("confidence_score").notNull(),
    source: text("source").notNull(),
    aliasText: text("alias_text"),
    categoryOverrideId: text("category_override_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    mccOverrideId: text("mcc_override_id").references(() => mccCodes.id, { onDelete: "set null" }),
    sourceTransactionId: text("source_transaction_id"),
    ruleVersion: text("rule_version").notNull().default("seed-v1"),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("merchant_heuristics_pattern_idx").on(table.patternType, table.patternValue),
    index("merchant_heuristics_merchant_idx").on(table.merchantId),
    index("merchant_heuristics_source_priority_idx").on(table.source, table.confidenceScore),
    index("merchant_heuristics_source_transaction_idx").on(table.sourceTransactionId),
  ],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    cardName: text("card_name").notNull(),
    network: text("network"),
    currency: text("currency").notNull().default("SGD"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("cards_issuer_idx").on(table.issuer)],
);

export const cardRules = sqliteTable(
  "card_rules",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    ruleName: text("rule_name").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    sourceUrl: text("source_url").notNull(),
    sourceType: text("source_type").notNull(),
    verifiedAt: text("verified_at").notNull(),
    capPeriod: text("cap_period"),
    capAmountMinor: integer("cap_amount_minor"),
    baseFormulaJson: text("base_formula_json").notNull().default("{}"),
    bonusFormulaJson: text("bonus_formula_json").notNull().default("{}"),
    eligibilityJson: text("eligibility_json").notNull().default("{}"),
    exclusionJson: text("exclusion_json").notNull().default("{}"),
    transferRuleJson: text("transfer_rule_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("card_rules_card_effective_idx").on(table.cardId, table.effectiveFrom, table.effectiveTo),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    statementImportId: text("statement_import_id").references(() => statementImports.id, {
      onDelete: "set null",
    }),
    postedDate: text("posted_date").notNull(),
    transactionDate: text("transaction_date"),
    descriptionRaw: text("description_raw").notNull(),
    descriptionNormalized: text("description_normalized").notNull(),
    merchantId: text("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("SGD"),
    direction: text("direction").notNull(),
    transactionKind: text("transaction_kind").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    mccId: text("mcc_id").references(() => mccCodes.id, { onDelete: "set null" }),
    cardId: text("card_id").references(() => cards.id, { onDelete: "set null" }),
    eligibleForMiles: integer("eligible_for_miles", { mode: "boolean" }).notNull().default(false),
    confidenceScore: real("confidence_score").notNull().default(0),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(true),
    transactionFingerprint: text("transaction_fingerprint").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("transactions_profile_fingerprint_unique").on(
      table.profileId,
      table.transactionFingerprint,
    ),
    index("transactions_profile_posted_idx").on(table.profileId, table.postedDate),
    index("transactions_profile_review_idx").on(table.profileId, table.needsReview),
    index("transactions_profile_merchant_idx").on(table.profileId, table.merchantId),
    index("transactions_profile_mcc_idx").on(table.profileId, table.mccId),
    index("transactions_profile_card_posted_idx").on(
      table.profileId,
      table.cardId,
      table.postedDate,
    ),
  ],
);

export const transactionTrustScores = sqliteTable(
  "transaction_trust_scores",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    statementImportId: text("statement_import_id")
      .notNull()
      .references(() => statementImports.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    label: text("label").notNull(),
    driverJson: text("driver_json").notNull().default("[]"),
    calculatedAt: text("calculated_at").notNull().default(now),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("transaction_trust_scores_transaction_unique").on(table.transactionId),
    index("transaction_trust_scores_profile_label_idx").on(table.profileId, table.label),
    index("transaction_trust_scores_import_idx").on(table.statementImportId),
  ],
);

export const decisionTraces = sqliteTable(
  "decision_traces",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sourceModule: text("source_module").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceRecordIdsJson: text("source_record_ids_json").notNull().default("[]"),
    ruleVersion: text("rule_version").notNull(),
    inputFactsJson: text("input_facts_json").notNull().default("{}"),
    outputValueJson: text("output_value_json").notNull().default("{}"),
    confidenceScore: real("confidence_score").notNull(),
    explanationText: text("explanation_text").notNull(),
    caveatJson: text("caveat_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("decision_traces_profile_module_idx").on(table.profileId, table.sourceModule),
    index("decision_traces_source_record_idx").on(table.sourceRecordId),
  ],
);

export const refundMatches = sqliteTable(
  "refund_matches",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    refundTransactionId: text("refund_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    originalTransactionId: text("original_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    matchedAmountMinor: integer("matched_amount_minor").notNull(),
    matchConfidence: real("match_confidence").notNull(),
    matchMethod: text("match_method").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("refund_matches_refund_idx").on(table.profileId, table.refundTransactionId),
    index("refund_matches_original_idx").on(table.profileId, table.originalTransactionId),
  ],
);

export const refundTimelines = sqliteTable(
  "refund_timelines",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    originalTransactionId: text("original_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    refundTransactionId: text("refund_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    refundMatchId: text("refund_match_id").references(() => refundMatches.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull(),
    expectedRefundMinor: integer("expected_refund_minor").notNull().default(0),
    receivedRefundMinor: integer("received_refund_minor").notNull().default(0),
    remainingEligibleSpendMinor: integer("remaining_eligible_spend_minor").notNull().default(0),
    milesReversal: integer("miles_reversal").notNull().default(0),
    confidenceScore: real("confidence_score").notNull(),
    eventJson: text("event_json").notNull().default("[]"),
    caveatJson: text("caveat_json").notNull().default("[]"),
    calculatedAt: text("calculated_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("refund_timelines_profile_status_idx").on(table.profileId, table.status),
    index("refund_timelines_original_idx").on(table.originalTransactionId),
    index("refund_timelines_refund_idx").on(table.refundTransactionId),
  ],
);

export const cardPeriodSummaries = sqliteTable(
  "card_period_summaries",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    eligibleSpendMinor: integer("eligible_spend_minor").notNull(),
    excludedSpendMinor: integer("excluded_spend_minor").notNull(),
    capUsedMinor: integer("cap_used_minor").notNull(),
    milesEarned: integer("miles_earned").notNull(),
    milesMissed: integer("miles_missed").notNull(),
    confidenceScore: real("confidence_score").notNull(),
    calculatedAt: text("calculated_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("card_period_summaries_card_period_unique").on(
      table.cardId,
      table.periodStart,
      table.periodEnd,
    ),
    index("card_period_summaries_profile_period_idx").on(
      table.profileId,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const milesLeakageItems = sqliteTable(
  "miles_leakage_items",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    cardId: text("card_id").references(() => cards.id, { onDelete: "set null" }),
    periodSummaryId: text("period_summary_id").references(() => cardPeriodSummaries.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    spendMinor: integer("spend_minor").notNull(),
    milesMissed: integer("miles_missed").notNull(),
    recoverable: integer("recoverable", { mode: "boolean" }).notNull().default(false),
    confidenceScore: real("confidence_score").notNull(),
    traceId: text("trace_id").references(() => decisionTraces.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("miles_leakage_items_profile_reason_idx").on(table.profileId, table.reason),
    index("miles_leakage_items_transaction_idx").on(table.transactionId),
  ],
);

export const plannedPurchases = sqliteTable(
  "planned_purchases",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    merchantText: text("merchant_text").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    mccCode: text("mcc_code"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("SGD"),
    channel: text("channel").notNull(),
    plannedDate: text("planned_date").notNull(),
    recommendedCardId: text("recommended_card_id").references(() => cards.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("planned"),
    matchedTransactionId: text("matched_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    confidenceScore: real("confidence_score").notNull(),
    caveatJson: text("caveat_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("planned_purchases_profile_status_idx").on(table.profileId, table.status),
    index("planned_purchases_match_idx").on(table.matchedTransactionId),
  ],
);

export const incomeStreams = sqliteTable(
  "income_streams",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    incomeType: text("income_type").notNull(),
    annualAmountMinor: integer("annual_amount_minor").notNull(),
    annualBonusMinor: integer("annual_bonus_minor").notNull().default(0),
    growthRateBasisPoints: integer("growth_rate_basis_points").notNull().default(0),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    source: text("source").notNull().default("user_input"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("income_streams_profile_type_idx").on(table.profileId, table.incomeType)],
);

export const assetLiabilityAccounts = sqliteTable(
  "asset_liability_accounts",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    accountLabel: text("account_label").notNull(),
    accountKind: text("account_kind").notNull(),
    assetClass: text("asset_class").notNull(),
    balanceMinor: integer("balance_minor").notNull(),
    currency: text("currency").notNull().default("SGD"),
    expectedReturnBasisPoints: integer("expected_return_basis_points").notNull().default(0),
    liquidity: text("liquidity").notNull(),
    source: text("source").notNull().default("user_input"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("asset_liability_accounts_profile_class_idx").on(table.profileId, table.assetClass),
  ],
);

export const cpfAccounts = sqliteTable(
  "cpf_accounts",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    oaBalanceMinor: integer("oa_balance_minor").notNull().default(0),
    saBalanceMinor: integer("sa_balance_minor").notNull().default(0),
    maBalanceMinor: integer("ma_balance_minor").notNull().default(0),
    raBalanceMinor: integer("ra_balance_minor").notNull().default(0),
    asOfDate: text("as_of_date").notNull(),
    source: text("source").notNull().default("user_input"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("cpf_accounts_profile_date_idx").on(table.profileId, table.asOfDate)],
);

export const propertyProfiles = sqliteTable(
  "property_profiles",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    propertyType: text("property_type").notNull(),
    estimatedValueMinor: integer("estimated_value_minor").notNull(),
    outstandingMortgageMinor: integer("outstanding_mortgage_minor").notNull().default(0),
    monthlyPaymentMinor: integer("monthly_payment_minor").notNull().default(0),
    annualRentalIncomeMinor: integer("annual_rental_income_minor").notNull().default(0),
    leaseEndYear: integer("lease_end_year"),
    isPrimaryResidence: integer("is_primary_residence", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("property_profiles_profile_type_idx").on(table.profileId, table.propertyType)],
);

export const healthcareAssumptions = sqliteTable(
  "healthcare_assumptions",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    annualPremiumMinor: integer("annual_premium_minor").notNull().default(0),
    annualOutOfPocketMinor: integer("annual_out_of_pocket_minor").notNull().default(0),
    medisaveUseMinor: integer("medisave_use_minor").notNull().default(0),
    escalationRateBasisPoints: integer("escalation_rate_basis_points").notNull().default(0),
    source: text("source").notNull().default("user_input"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("healthcare_assumptions_profile_idx").on(table.profileId)],
);

export const financialGoals = sqliteTable(
  "financial_goals",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    goalType: text("goal_type").notNull(),
    label: text("label").notNull(),
    targetAmountMinor: integer("target_amount_minor").notNull(),
    currentAmountMinor: integer("current_amount_minor").notNull().default(0),
    targetDate: text("target_date"),
    priority: integer("priority").notNull().default(3),
    fundingSource: text("funding_source").notNull().default("cash"),
    inflationAdjusted: integer("inflation_adjusted", { mode: "boolean" }).notNull().default(true),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("financial_goals_profile_status_idx").on(table.profileId, table.status),
    index("financial_goals_profile_priority_idx").on(table.profileId, table.priority),
  ],
);

export const projectionRuns = sqliteTable(
  "projection_runs",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    scenarioId: text("scenario_id"),
    runType: text("run_type").notNull(),
    inputHash: text("input_hash").notNull(),
    assumptionsJson: text("assumptions_json").notNull().default("{}"),
    resultSummaryJson: text("result_summary_json").notNull().default("{}"),
    confidenceScore: real("confidence_score").notNull().default(0),
    calculatedAt: text("calculated_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("projection_runs_profile_type_idx").on(table.profileId, table.runType),
    index("projection_runs_profile_calculated_idx").on(table.profileId, table.calculatedAt),
  ],
);

export const projectionYears = sqliteTable(
  "projection_years",
  {
    id: text("id").primaryKey(),
    projectionRunId: text("projection_run_id")
      .notNull()
      .references(() => projectionRuns.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    yearIndex: integer("year_index").notNull(),
    calendarYear: integer("calendar_year").notNull(),
    age: integer("age").notNull(),
    liquidAssetsMinor: integer("liquid_assets_minor").notNull(),
    cpfBalanceMinor: integer("cpf_balance_minor").notNull(),
    propertyEquityMinor: integer("property_equity_minor").notNull(),
    annualIncomeMinor: integer("annual_income_minor").notNull(),
    annualExpensesMinor: integer("annual_expenses_minor").notNull(),
    annualSavingsMinor: integer("annual_savings_minor").notNull(),
    fireTargetMinor: integer("fire_target_minor").notNull(),
    fireProgressBasisPoints: integer("fire_progress_basis_points").notNull(),
    eventJson: text("event_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("projection_years_run_year_unique").on(table.projectionRunId, table.yearIndex),
    index("projection_years_profile_age_idx").on(table.profileId, table.age),
  ],
);

export const advisorInsights = sqliteTable(
  "advisor_insights",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    projectionRunId: text("projection_run_id").references(() => projectionRuns.id, {
      onDelete: "set null",
    }),
    insightType: text("insight_type").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    confidenceScore: real("confidence_score").notNull(),
    traceId: text("trace_id").references(() => decisionTraces.id, { onDelete: "set null" }),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("advisor_insights_profile_status_idx").on(table.profileId, table.status),
    index("advisor_insights_profile_type_idx").on(table.profileId, table.insightType),
  ],
);

export const rewardLedger = sqliteTable(
  "reward_ledger",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    cardId: text("card_id").references(() => cards.id, { onDelete: "set null" }),
    ruleId: text("rule_id").references(() => cardRules.id, { onDelete: "set null" }),
    ledgerType: text("ledger_type").notNull(),
    points: integer("points").notNull(),
    milesEquivalent: integer("miles_equivalent").notNull(),
    status: text("status").notNull(),
    calculationTraceJson: text("calculation_trace_json").notNull().default("{}"),
    sourceModule: text("source_module"),
    sourceRecordId: text("source_record_id"),
    sourceVersion: text("source_version"),
    calculatedAt: text("calculated_at"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("reward_ledger_profile_card_created_idx").on(
      table.profileId,
      table.cardId,
      table.createdAt,
    ),
    index("reward_ledger_profile_transaction_idx").on(table.profileId, table.transactionId),
  ],
);

export const redemptionPrograms = sqliteTable("redemption_programs", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull(),
  programName: text("program_name").notNull(),
  pointsName: text("points_name").notNull(),
  milesConversionRatio: text("miles_conversion_ratio").notNull(),
  minimumTransferPoints: integer("minimum_transfer_points").notNull(),
  transferBlockPoints: integer("transfer_block_points").notNull(),
  feeMinor: integer("fee_minor").notNull().default(0),
  sourceUrl: text("source_url").notNull(),
  verifiedAt: text("verified_at").notNull(),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const seededDataVersions = sqliteTable("seeded_data_versions", {
  id: text("id").primaryKey(),
  datasetName: text("dataset_name").notNull(),
  datasetVersion: text("dataset_version").notNull(),
  sourceUrl: text("source_url"),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const profileRelations = relations(profiles, ({ many, one }) => ({
  plannerProfile: one(plannerProfiles),
  expenseSnapshots: many(expenseSnapshots),
  statementImports: many(statementImports),
  accounts: many(accounts),
  advisorInsights: many(advisorInsights),
  assetLiabilityAccounts: many(assetLiabilityAccounts),
  cpfAccounts: many(cpfAccounts),
  transactions: many(transactions),
  financialGoals: many(financialGoals),
  healthcareAssumptions: many(healthcareAssumptions),
  incomeStreams: many(incomeStreams),
  propertyProfiles: many(propertyProfiles),
  projectionRuns: many(projectionRuns),
  projectionYears: many(projectionYears),
  statementReconciliations: many(statementReconciliations),
  transactionTrustScores: many(transactionTrustScores),
  decisionTraces: many(decisionTraces),
  refundTimelines: many(refundTimelines),
  cardPeriodSummaries: many(cardPeriodSummaries),
  milesLeakageItems: many(milesLeakageItems),
  plannedPurchases: many(plannedPurchases),
}));
