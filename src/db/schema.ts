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
    verifiedAt: text("verified_at"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("merchant_heuristics_pattern_idx").on(table.patternType, table.patternValue),
    index("merchant_heuristics_merchant_idx").on(table.merchantId),
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
  transactions: many(transactions),
  statementReconciliations: many(statementReconciliations),
  transactionTrustScores: many(transactionTrustScores),
}));
