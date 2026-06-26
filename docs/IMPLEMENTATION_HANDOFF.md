# Implementation Handoff: FIRE Planner With Statement Ingestion And Miles Engine

## 1. Objective

Build a FIRE planner that ingests bank and credit-card statements, normalizes transactions, categorizes spend, handles refunds, calculates Singapore credit-card miles, and feeds net spending into FIRE projections.

The product should combine the useful parts of:

- `RemarkRemedy/fireplanner`: React/Vite/TypeScript planner with projection logic, CPF modeling, Monte Carlo support, import/export, and local persistence patterns.
- `benjamin-awd/StatementSensei`: Python/Streamlit statement ingestion using `monopoly-core`, bank detection, PDF parsing, OCR fallback, and transaction normalization.

The target experience has:

- Mobile app first: FIRE progress and next actions on the landing page.
- Cards/Miles tab: miles vault, redeemable chunks, pending miles, reversed miles, and spend-to-next-redeemable chunk.
- Desktop dashboard: dense planning workspace with review inbox, FI impact, miles overview, and expense snapshot.

## 2. Specialist Assumptions

Use two specialist perspectives throughout implementation:

- Fintech product architect: owns domain boundaries, data model, security, and planner/miles integration.
- Singapore credit-card rewards specialist: owns card rule accuracy, MCC eligibility, refund treatment, and source verification.

## 3. Source References

Reference repositories:

- FIRE planner: https://github.com/RemarkRemedy/fireplanner
- Statement ingestion: https://github.com/benjamin-awd/StatementSensei

Rewards and MCC research starting points:

- Milelion card guide: https://milelion.com/credit-cards/guide/
- Milelion MCC lookup guide: https://milelion.com/2023/11/13/how-to-check-merchant-category-codes-mccs-before-making-a-purchase/
- Milelion general-spend formulas: https://milelion.com/2024/06/08/how-do-banks-calculate-credit-card-points-general-spending/
- Milelion specialised-spend formulas: https://milelion.com/2024/06/09/how-do-banks-calculate-credit-card-points-specialised-spending/

Important implementation rule: treat Milelion as a research accelerator and bank T&Cs as the legal source of truth. Store source URL, source type, verification date, and effective date on every card rule.

## 4. Core Product Decisions

### 4.0 V1 Runtime Decision

Use this as the v1 implementation target unless the product owner explicitly changes packaging:

- App shell: React, Vite, TypeScript, Tailwind.
- Local app runtime for v1 alpha: browser UI served by Vite plus a local Node API process.
- Database access: Node API owns SQLite access through Drizzle and a native SQLite driver.
- Parser execution: Node API invokes the Python parser bridge as a child process with a strict JSON contract.
- Mobile app work in v1: implement responsive mobile screens in the web UI and validate at mobile breakpoints.
- Native packaging: defer until domain logic, parser bridge, database schema, and UI flows pass acceptance tests.

Reasoning:

- Browser-only Vite cannot reliably provide native SQLite, SQLCipher, local file access, and Python execution.
- A local Node API gives the implementation team one authoritative database writer and a practical bridge to the Python parser.
- Responsive mobile UI can still be built and tested early without committing to Capacitor, React Native, or Tauri packaging.

Future packaging decision points:

- Desktop packaging candidate: Tauri or Electron with native SQLite and bundled parser sidecar.
- Mobile packaging candidate: Capacitor or React Native only after the parser strategy is revisited.
- If native mobile becomes a hard v1 requirement, replace the local Python parser with a server-side parser or a portable parser module.

### 4.1 Database

Use SQLite as the primary local database.

Recommended stack:

- SQLite for local-first transactional storage.
- SQLCipher or platform encrypted storage for builds that handle real financial data.
- Drizzle ORM for TypeScript app access and migrations.
- Python parser service returns normalized payloads through an API or command bridge; the TypeScript app owns database writes to avoid two write paths.
- Zustand only for in-memory screen state, filters, selected profile, active imports, and optimistic UI state.

Rationale:

- This is a personal finance app with private local data and strong offline value.
- SQLite supports relational joins needed for transactions, merchant rules, MCC taxonomy, card rules, and reward ledger entries.
- It avoids early cloud complexity while preserving a future sync path.

Future cloud sync:

- Keep SQLite as local source of truth.
- Add a sync ledger and server later if multi-device sync becomes required.
- Encrypt sensitive fields before sync.

### 4.2 Statement Storage

Default policy:

- Do not store original PDF statements.
- Store file hash, parser version, bank detector result, extracted transactions, warnings, and import audit metadata.
- Allow users to explicitly attach source files later only if encrypted storage and deletion controls are implemented.

### 4.3 Refunds

Refunds are first-class transactions.

Rules:

- A refund nets off against the original spend category and FIRE expense totals.
- Miles should not be earned on refunded value.
- If the original transaction already earned miles, create a reversal ledger entry.
- If the refund cannot be confidently matched, mark it for review and exclude refunded value from new miles calculation until resolved.

### 4.4 Miles Definitions

Use these definitions consistently in UI and database:

- Accumulated miles: miles earned over time, net of reversals, including pending and posted ledger entries.
- Redeemable miles: miles currently transferable or usable after applying bank conversion blocks, minimum transfer rules, expiry constraints, and program-specific rounding.
- Pending miles: miles estimated from transactions but not confirmed by statement or reward posting.
- Reversed miles: miles clawed back or negated because of refund, chargeback, adjustment, or ineligible spend correction.
- Spend to next chunk: the minimum eligible spend required, on a specific card or category, to reach the next redeemable conversion block.

### 4.5 Data Ownership And Recalculation

Authoritative data owners:

- Parser bridge owns extracted parser output only. It never writes to SQLite.
- Ingestion module owns import validation, duplicate detection, and normalized transaction creation.
- Transactions module owns canonical transactions, signs, categories, merchant links, MCC links, refund matches, and review states.
- MCC module owns MCC taxonomy, merchant heuristics, confidence scores, and user-corrected heuristic rules.
- Rewards module owns reward ledger entries, card-rule evaluation, reversal entries, accumulated miles, redeemable miles, and spend-to-next calculations.
- Planner module owns FIRE assumptions, user overrides, expense snapshots accepted into the plan, and scenario results.
- UI state owns filters, selected rows, pending forms, and optimistic interactions only.

Recalculation rules:

- Canonical transactions are immutable after import except for user-owned metadata fields such as category, MCC, merchant, card, and review status.
- Corrections create audit events and trigger recalculation jobs.
- Reward ledger entries are append-only. Refunds and corrections create reversal or adjustment entries instead of editing historical earn entries.
- Expense snapshots are versioned. A new accepted snapshot supersedes the prior active snapshot for a period.
- Card rule changes never silently rewrite history. Users must choose whether to recalculate historical estimates under a newer rule version.

Recalculation triggers:

- Transaction committed.
- Category corrected.
- MCC corrected.
- Merchant heuristic corrected.
- Refund matched, partially matched, unmatched, or rejected.
- Card assignment changed.
- Card rule version added, expired, or corrected.
- Expense snapshot accepted into the FIRE plan.

## 5. UI Direction

### 5.1 Mobile Home

Use the refined Concept E direction.

Required screen behavior:

- The top hero shows the FIRE percentage prominently.
- Remove the duplicate FIRE Progress card because the hero already carries the percentage.
- Avoid a percentage line chart on the landing page unless user testing shows it changes decisions.
- Show corpus progress and runway in compact modules.
- Show actionable cards: net worth, CPF, net spend, miles bank, review queue, and apply snapshot CTA.

Information hierarchy:

- Above the fold: FIRE percentage, target corpus progress, FI date estimate, runway, and the next recommended action.
- Primary CTA: review latest import or apply latest expense snapshot, depending on pending state.
- Secondary actions: open Plan, open Transactions, open Cards.
- Empty state: show setup checklist for profile, first statement import, and first card setup.
- Review-empty state: replace review queue with "No review items" plus last import summary.

Mobile interaction rules:

- Home cards deep link to the relevant tab and preserve back navigation.
- Bottom tab badges show unresolved review count and stale card-rule count.
- Touch targets must be at least 44px high.
- Financial deltas and miles deltas must use text labels in addition to color.

Generated mockup reference:

- `/Users/gilbertmak/.codex/generated_images/019edebd-4a0a-7503-b9f4-2294fe106d1f/ig_06fe7bcd71ff1f59016a3540fb4d04819184acb31d410e8dc3.png`

### 5.2 Mobile Cards/Miles Tab

Use the refined Concept F direction.

Required screen behavior:

- Treat this as a tab within the app, not the landing page.
- Show miles vault, redeemable miles, accumulated miles, pending miles, reversed miles, best card now, and spend-to-next chunk.
- Show card-level and category-level recommendations.
- Display MCC confidence and refund reversals inline in transaction activity, not as top-level dashboard cards.

Information hierarchy:

- Primary metric: redeemable miles.
- Primary recommendation: best card/category action for the next eligible spend.
- Supporting metrics: accumulated, pending, reversed, and expiry risk.
- Diagnostic detail: calculation traces, MCC confidence, cap usage, and refund reversals stay expandable.

Gamification guardrails:

- Use progress toward redeemable chunks as decision support.
- Do not reward spend volume without showing opportunity cost and eligibility caveats.
- Label recommendations as estimates until statement rewards are confirmed.

Generated mockup reference:

- `/Users/gilbertmak/.codex/generated_images/019edebd-4a0a-7503-b9f4-2294fe106d1f/ig_06fe7bcd71ff1f59016a35414da5a88191a94e6fd9c27eafae.png`

### 5.3 Desktop Dashboard

Use Concept G: the layout density of the earlier option 3 with the modern visual treatment of option 4.

Required screen behavior:

- Left navigation, top KPI row, central review inbox, and right insight column.
- Do not create standalone KPI cards for MCC confidence or refund matched. Surface those as row badges inside the review inbox because they are diagnostic details.
- Right-side panels should include FI impact, miles overview, and expense snapshot.
- The review inbox is the operational center for imported statements, uncertain categorizations, refund matches, and miles eligibility exceptions.

Desktop layout rules:

- Target width: 1440px.
- Dense fallback width: 1280px.
- Sidebar: fixed width between 220px and 260px.
- Main center column: flexible, minimum 640px.
- Right insight column: fixed width between 320px and 380px.
- Review inbox header and filters stay sticky within the center column.
- Right insight column scrolls independently only when viewport height requires it.
- Mobile and tablet widths collapse desktop right-column insights into stacked panels below the review inbox.

Generated mockup reference:

- `/Users/gilbertmak/.codex/generated_images/019edebd-4a0a-7503-b9f4-2294fe106d1f/ig_06fe7bcd71ff1f59016a35419df58c8191813ddeb375a8dfc7.png`

### 5.4 Review Inbox UI Requirements

Row anatomy:

- Merchant and raw statement description.
- Amount, date, account/card, and direction.
- Category, MCC, miles eligibility, and refund status.
- Confidence badge with plain-language label.
- Suggested correction and impact preview.
- Row action: accept, edit, split, match refund, ignore, or mark reviewed.

Required states:

- First import.
- Import parsing.
- Parser failed.
- Duplicate import warning.
- No review items.
- Many review items.
- Stale card rules.
- Unmatched refund.
- Miles exception.
- Correction saved.

Accessibility requirements:

- Keyboard navigation for review rows and correction dialogs.
- Visible focus states.
- Semantic table or list structure for review inbox.
- WCAG AA contrast for text and state badges.
- Reduced-motion support for progress and gamified elements.
- Screen-reader labels for financial and miles deltas.

### 5.5 Figma Handoff Requirements

Before UI implementation is considered complete, create Figma frames for:

- Mobile Home at 390px and 430px widths.
- Mobile Cards tab at 390px and 430px widths.
- Desktop dashboard at 1280px and 1440px widths.
- Review inbox correction dialog.
- Empty, loading, error, review-needed, and success states.

Figma handoff must include:

- Component names and variants.
- Design tokens for color, typography, spacing, radius, and elevation.
- Responsive annotations.
- Content rules for uncertainty labels.
- Accessibility annotations for focus order, contrast, and labels.

## 6. Proposed Architecture

### 6.1 Runtime Components

- Frontend app: React, Vite, TypeScript, Tailwind, Zustand, Drizzle.
- Local database: SQLite with migrations.
- Parser service: Python package or local service adapted from StatementSensei.
- Domain modules:
  - `planner`: FIRE projections, CPF, drawdown, scenarios.
  - `ingestion`: statement import, parser bridge, import audit.
  - `transactions`: normalization, categories, refunds, merchant rules.
  - `mcc`: MCC taxonomy, merchant heuristics, confidence scoring.
  - `cards`: card catalogue, card rules, reward formulas.
  - `rewards`: miles estimation, reward ledger, redeemable chunk projection.
- `ui`: mobile shell, desktop shell, review inbox, cards tab.

### 6.2 Module Boundaries

Use these import rules:

- `domain/*` contains pure business logic and cannot import UI, database drivers, or parser process code.
- `db/*` contains schema, migrations, repositories, and transaction boundaries.
- `parser/*` contains the Python bridge client, parser payload validation, and parser error mapping.
- `state/*` contains Zustand stores for UI session state only.
- `ui/*` imports domain services through application hooks or use-case functions.
- `rewards` consumes resolved transaction views and card rules; it must not read raw parser payloads.
- `planner` consumes accepted expense snapshots and profile assumptions; it must not read raw transactions directly except through a projection input builder.
- `ingestion` can create transactions but cannot calculate rewards or planner projections directly.

### 6.3 Data Flow

```mermaid
flowchart LR
  A["Statement PDF or CSV"] --> B["Python parser bridge"]
  B --> C["Normalized import payload"]
  C --> D["Import validation"]
  D --> E["SQLite transactions"]
  E --> F["Categorization engine"]
  F --> G["Refund matcher"]
  G --> H["MCC and merchant resolver"]
  H --> I["Miles engine"]
  E --> J["Expense snapshot"]
  J --> K["FIRE projection engine"]
  I --> L["Reward ledger and redeemable projection"]
  K --> M["Mobile and desktop dashboards"]
  L --> M
```

### 6.4 Parser Bridge Contract

The parser bridge is a local child process invoked by the Node API.

Request shape:

```json
{
  "requestId": "parse_2026_0001",
  "profileId": "profile_001",
  "sourceType": "pdf",
  "sourceFilename": "statement.pdf",
  "sourceFilePath": "/tmp/fire-planner/imports/statement.pdf",
  "sourceFileSha256": "hexhash",
  "parserOptions": {
    "ocrEnabled": true,
    "passwordProvided": false,
    "locale": "en-SG"
  }
}
```

Success result shape:

```json
{
  "requestId": "parse_2026_0001",
  "status": "success",
  "parserName": "StatementSenseiBridge",
  "parserVersion": "0.1.0",
  "bankName": "DBS",
  "accountHints": [
    {
      "accountType": "credit_card",
      "maskedIdentifier": "**** 1234",
      "currency": "SGD"
    }
  ],
  "transactions": [
    {
      "externalId": "stable-parser-row-id",
      "postedDate": "2026-06-20",
      "transactionDate": "2026-06-19",
      "descriptionRaw": "GRAB *TRIP SINGAPORE",
      "amount": "-18.40",
      "currency": "SGD",
      "direction": "debit",
      "accountHint": "**** 1234",
      "confidenceScore": 0.92
    }
  ],
  "warnings": [
    {
      "code": "OCR_USED",
      "message": "OCR fallback used for two pages.",
      "severity": "info"
    }
  ]
}
```

Failure result shape:

```json
{
  "requestId": "parse_2026_0001",
  "status": "failed",
  "parserName": "StatementSenseiBridge",
  "parserVersion": "0.1.0",
  "error": {
    "code": "PASSWORD_REQUIRED",
    "message": "Statement could not be parsed without password.",
    "retryable": true
  },
  "warnings": []
}
```

Parser requirements:

- Timeout: default 60 seconds per file, configurable for OCR.
- Temp files: store under app-controlled temp directory and delete after parse.
- Logging: no raw transaction descriptions, account numbers, file paths, or full hashes in logs.
- Versioning: every result includes parser name, parser version, and parser options.
- Errors: map to stable codes such as `UNSUPPORTED_BANK`, `PASSWORD_REQUIRED`, `OCR_FAILED`, `NO_TRANSACTIONS_FOUND`, `DUPLICATE_FILE`, and `INTERNAL_ERROR`.

## 7. Initial Database Model

Create migrations for these tables first. Field names can be adjusted to match project conventions, but preserve the entities and relationships.

### 7.1 Profiles And Planner

- `profiles`
  - `id`
  - `name`
  - `currency`
  - `created_at`
  - `updated_at`

- `planner_profiles`
  - `profile_id`
  - `current_age`
  - `target_retirement_age`
  - `current_net_worth`
  - `target_fire_number`
  - `annual_expenses`
  - `safe_withdrawal_rate_basis_points`
  - `expected_return_rate_basis_points`
  - `inflation_rate_basis_points`
  - `cpf_settings_json`
  - `scenario_settings_json`

- `expense_snapshots`
  - `id`
  - `profile_id`
  - `period_start`
  - `period_end`
  - `gross_spend`
  - `refunds`
  - `net_spend`
  - `annualized_expenses`
  - `source`
  - `created_at`

### 7.2 Imports And Transactions

- `statement_imports`
  - `id`
  - `profile_id`
  - `source_file_hash`
  - `source_filename`
  - `bank_name`
  - `parser_name`
  - `parser_version`
  - `import_status`
  - `warning_json`
  - `created_at`

- `accounts`
  - `id`
  - `profile_id`
  - `institution_name`
  - `account_label`
  - `account_type`
  - `masked_identifier`
  - `currency`

- `transactions`
  - `id`
  - `profile_id`
  - `account_id`
  - `statement_import_id`
  - `posted_date`
  - `transaction_date`
  - `description_raw`
  - `description_normalized`
  - `merchant_id`
  - `amount`
  - `currency`
  - `direction`
  - `transaction_kind`
  - `category_id`
  - `mcc_id`
  - `card_id`
  - `eligible_for_miles`
  - `confidence_score`
  - `needs_review`
  - `created_at`

- `refund_matches`
  - `id`
  - `profile_id`
  - `refund_transaction_id`
  - `original_transaction_id`
  - `matched_amount`
  - `match_confidence`
  - `match_method`
  - `status`
  - `created_at`

### 7.3 Categories, Merchants, And MCC

- `categories`
  - `id`
  - `name`
  - `parent_id`
  - `fire_expense_group`
  - `is_discretionary`

- `mcc_codes`
  - `id`
  - `code`
  - `title`
  - `network_description`
  - `default_category_id`
  - `default_miles_eligibility`

- `merchants`
  - `id`
  - `canonical_name`
  - `default_category_id`
  - `default_mcc_id`
  - `country`

- `merchant_heuristics`
  - `id`
  - `merchant_id`
  - `pattern_type`
  - `pattern_value`
  - `mcc_id`
  - `category_id`
  - `confidence_score`
  - `source`
  - `verified_at`

### 7.4 Cards And Rewards

- `cards`
  - `id`
  - `issuer`
  - `card_name`
  - `network`
  - `currency`
  - `is_active`

- `card_rules`
  - `id`
  - `card_id`
  - `rule_name`
  - `effective_from`
  - `effective_to`
  - `source_url`
  - `source_type`
  - `verified_at`
  - `cap_period`
  - `cap_amount`
  - `base_formula_json`
  - `bonus_formula_json`
  - `eligibility_json`
  - `exclusion_json`
  - `transfer_rule_json`

- `reward_ledger`
  - `id`
  - `profile_id`
  - `transaction_id`
  - `card_id`
  - `rule_id`
  - `ledger_type`
  - `points`
  - `miles_equivalent`
  - `status`
  - `calculation_trace_json`
  - `created_at`

- `redemption_programs`
  - `id`
  - `issuer`
  - `program_name`
  - `points_name`
  - `miles_conversion_ratio`
  - `minimum_transfer_points`
  - `transfer_block_points`
  - `fee`
  - `source_url`
  - `verified_at`

### 7.5 Implementation-Grade Schema Rules

Migration requirements:

- Every table has a text primary key, `created_at`, and `updated_at` unless it is an append-only audit table.
- Use integer minor units for money, for example cents, plus `currency`.
- Never use floating-point storage for money, points, miles, or rates.
- Store dates as ISO `YYYY-MM-DD` for transaction and statement dates.
- Store timestamps as UTC ISO strings.
- Define enum values centrally for `direction`, `transaction_kind`, `import_status`, `match_status`, `ledger_type`, and `ledger_status`.
- Add foreign keys and indexes for every relationship used by review inbox, card calculations, and planner snapshots.
- Add unique constraints for source file hash per profile and transaction fingerprint per profile/account/date/amount/description.
- Add source lineage fields on derived records: `source_module`, `source_record_id`, `source_version`, and `calculated_at` where applicable.
- Add seeded-data version tables for MCC taxonomy, merchant heuristics, card rules, and redemption programs.

Required indexes:

- `transactions(profile_id, posted_date)`
- `transactions(profile_id, needs_review)`
- `transactions(profile_id, merchant_id)`
- `transactions(profile_id, mcc_id)`
- `transactions(profile_id, card_id, posted_date)`
- `refund_matches(profile_id, refund_transaction_id)`
- `refund_matches(profile_id, original_transaction_id)`
- `reward_ledger(profile_id, card_id, created_at)`
- `reward_ledger(profile_id, transaction_id)`
- `merchant_heuristics(pattern_type, pattern_value)`
- `card_rules(card_id, effective_from, effective_to)`

## 8. Formula Engine Requirements

Implement card formulas as data plus a restricted evaluator. Avoid embedding formulas as arbitrary JavaScript.

### 8.1 Formula JSON Shape

Use a small expression tree DSL. Example:

```json
{
  "version": 1,
  "eligibility": {
    "all": [
      { "field": "currency", "op": "eq", "value": "SGD" },
      { "field": "mcc", "op": "notIn", "value": ["6012", "9399"] }
    ]
  },
  "base": {
    "op": "multiply",
    "left": { "op": "floor", "value": { "field": "amountMajor" } },
    "right": { "const": 1 }
  },
  "bonus": {
    "op": "multiply",
    "left": { "op": "floor", "value": { "field": "amountMajor" } },
    "right": { "const": 9 }
  },
  "cap": {
    "period": "statement_month",
    "amountMinor": 100000
  },
  "conversion": {
    "pointsToMilesRatio": "1:0.4"
  },
  "rounding": {
    "transaction": "floor",
    "aggregate": "floor"
  }
}
```

Evaluator rules:

- Validate formulas with Zod before storing.
- Reject unknown operations and unknown input fields.
- Produce a calculation trace for every transaction.
- Evaluate eligibility before points.
- Apply exclusions before caps.
- Apply caps before transfer-block projection.
- Refunds do not run earn formulas. They create reversal entries linked to the original earned ledger entries.

Required operations:

- `floor`
- `round`
- `ceil`
- `min`
- `max`
- multiplication
- division
- addition
- subtraction
- period cap
- transaction-level rounding
- aggregate-period rounding

Formula input fields:

- `amount`
- `currency`
- `mcc`
- `merchant`
- `postedDate`
- `transactionDate`
- `category`
- `channel`
- `wallet`
- `periodEligibleSpend`
- `periodRemainingCap`

Formula output:

- base points
- bonus points
- total points
- miles equivalent
- cap consumed
- calculation trace
- eligibility result
- exclusion reason

Seed rules should start with a small verified set:

- Citi Rewards
- DBS Woman's World
- HSBC Revolution
- UOB Lady's

Do not bulk seed many cards until the rule format has tests for rounding, caps, exclusions, refunds, and spend-to-next-redeemable chunk.

## 9. Epics, Tasks, And Subtasks

### Epic FP-1: App Foundation And Database

Goal: Establish the local-first application foundation.

Tasks:

- FP-1.1 Scaffold app shell
  - Create React/Vite/TypeScript app.
  - Add Tailwind, Zustand, Drizzle, Vitest, Playwright.
  - Add linting, formatting, and test scripts.

- FP-1.2 Add SQLite database layer
  - Add migration runner.
  - Add schema for profiles, imports, transactions, merchants, MCC, cards, rules, reward ledger, and snapshots.
  - Add typed repositories.
  - Add implementation-grade keys, constraints, indexes, enum definitions, and money/date storage rules.

- FP-1.3 Add import/export foundation
  - Export all local app data as versioned JSON.
  - Import with schema validation and migration checks.
  - Redact or omit source PDFs.

Acceptance criteria:

- App starts locally.
- SQLite migrations run from empty database.
- Repository tests cover create/read/update paths for core tables.
- Duplicate file and duplicate transaction constraints are tested.
- Export/import round-trip restores seeded data versions and user data.

### Epic FP-2: UI System And Navigation

Goal: Implement the core visual direction and navigation model.

Tasks:

- FP-2.1 Add design tokens
  - Define colors, typography, spacing, radius, shadows, and chart colors.
  - Use deep emerald, dark neutral surfaces, gold accents, blue progress, amber warnings, and red reversals.

- FP-2.2 Build mobile shell
  - Add bottom tabs: Home, Plan, Transactions, Cards, Profile.
  - Implement mobile Home based on Concept E.
  - Implement Cards tab based on Concept F.

- FP-2.3 Build desktop shell
  - Add sidebar navigation.
  - Add dashboard layout based on Concept G.
  - Add central review inbox and right insight column.

Acceptance criteria:

- Desktop and mobile layouts render without clipping.
- Cards are purposeful and avoid duplicated metrics.
- Review diagnostics appear inline, not as redundant KPI cards.
- Keyboard navigation, focus order, 44px mobile targets, contrast, and reduced-motion checks pass.
- Figma frames and component variants exist for the required responsive states.

### Epic FP-3: FIRE Planner Core

Goal: Port and adapt FIRE projections.

Tasks:

- FP-3.1 Port projection engine
  - Bring over projection, CPF, withdrawal, inflation, and Monte Carlo concepts from `fireplanner`.
  - Keep calculations pure and covered by tests.

- FP-3.2 Connect expense snapshots
  - Derive annualized expense inputs from imported transaction net spend.
  - Preserve manual override for users.

- FP-3.3 Add scenario comparison
  - Support baseline, optimistic, conservative, and custom scenarios.
  - Show FI date and target corpus impact.

Acceptance criteria:

- Projection tests match known fixture outputs.
- Imported net spend can update planner assumptions after user confirmation.

### Epic FP-4: Statement Ingestion

Goal: Adapt StatementSensei into the product ingestion pipeline.

Tasks:

- FP-4.1 Create parser bridge
  - Wrap StatementSensei bank detection and parsing.
  - Return normalized JSON payloads.
  - Include parser warnings and bank metadata.
  - Implement the parser bridge request, success, and failure schemas.
  - Add timeout, temp-file cleanup, and stable error codes.

- FP-4.2 Add import workflow
  - Upload or select statement.
  - Parse and preview transactions.
  - Commit accepted transactions to SQLite.

- FP-4.3 Add duplicate detection
  - Use file hash and transaction fingerprint.
  - Warn on duplicate imports.

Acceptance criteria:

- At least one fixture statement imports end to end.
- Parser failures show recoverable errors.
- Import audit rows are stored.
- Multi-bank fixtures cover sign correctness, malformed files, duplicate imports, OCR fallback, and date/currency edge cases.
- Parser logs and temp directories contain no retained sensitive data after import.

### Epic FP-5: Transactions, Refunds, And Categorization

Goal: Normalize transactions and produce net spending.

Tasks:

- FP-5.1 Build category engine
  - Apply user rules first.
  - Apply merchant heuristics second.
  - Apply MCC defaults third.
  - Fall back to review queue.

- FP-5.2 Build refund matcher
  - Match by amount, merchant similarity, account/card, and time window.
  - Support partial refunds.
  - Mark uncertain matches for review.

- FP-5.3 Calculate net spend
  - Gross spend minus matched refunds.
  - Feed expense snapshots.
  - Preserve audit trail.

- FP-5.4 Build minimal review inbox model
  - Create review item statuses needed for categorization, refund, MCC, and miles exceptions.
  - Add accept/edit/reject actions at the data layer.
  - Add correction audit events and recalculation triggers.

Acceptance criteria:

- Refund tests cover full refund, partial refund, unmatched refund, and cross-statement refund.
- Refunded transactions do not produce net miles.
- Net spend matches transaction ledger fixtures.

### Epic FP-6: MCC And Merchant Intelligence

Goal: Create a reusable merchant and MCC database.

Tasks:

- FP-6.1 Seed MCC taxonomy
  - Add MCC codes, titles, default categories, and default miles eligibility.
  - Store source and version.

- FP-6.2 Seed merchant heuristics
  - Add canonical merchant records.
  - Add text patterns for common Singapore merchants.
  - Tag likely MCC and category.

- FP-6.3 Add learning loop
  - When users correct a category or MCC, create or update heuristic rules.
  - Track confidence and source.

Acceptance criteria:

- Merchant resolver returns category, MCC, confidence, and explanation.
- User corrections affect future imports.

### Epic FP-7: Card Rules And Miles Engine

Goal: Calculate accumulated miles, redeemable miles, and spend-to-next chunks.

Tasks:

- FP-7.1 Implement card rule catalogue
  - Store card rules with effective dates and source metadata.
  - Start with Citi Rewards, DBS Woman's World, HSBC Revolution, and UOB Lady's.

- FP-7.2 Implement formula evaluator
  - Support transaction-level and aggregate-period rounding.
  - Support caps, exclusions, MCC eligibility, wallet/channel eligibility, and transfer blocks.
  - Implement formula DSL validation and golden calculation traces.

- FP-7.3 Implement reward ledger
  - Create pending ledger entries for estimated miles.
  - Create reversal entries for refunds.
  - Update ledger status after statement confirmation.

- FP-7.4 Implement redeemable projection
  - Calculate accumulated miles.
  - Calculate redeemable miles by program transfer block.
  - Calculate spend to next redeemable chunk by card and category.

Acceptance criteria:

- Formula tests cover each seeded card.
- Refund reversal tests pass.
- Cards tab shows accumulated, redeemable, pending, reversed, and spend-to-next values.
- Effective dates, expired rules, cap reset periods, exclusion precedence, rounding order, wallet/channel eligibility, and source verification freshness are tested.

### Epic FP-8: Review Inbox And User Corrections

Goal: Make uncertainty visible and correctable.

Tasks:

- FP-8.1 Build review inbox model
  - Transaction row statuses: clean, needs category, needs MCC, refund match review, miles exception.
  - Reuse the minimal review model introduced in FP-5 and expand it into the full UI workflow.

- FP-8.2 Build correction UI
  - Let user change category, merchant, MCC, card, refund match, and miles eligibility.
  - Persist correction and optionally create heuristic.

- FP-8.3 Add impact preview
  - Show effect on monthly net spend, annualized expenses, FI date, and miles.

Acceptance criteria:

- User can resolve every review item type.
- Corrections update planner and rewards projections.
- Empty, loading, error, duplicate import, stale card-rule, unmatched refund, and miles-exception states are implemented.

### Epic FP-9: Quality, Security, And Traceability

Goal: Keep implementation auditable and safe for financial data.

Tasks:

- FP-9.1 Add test coverage
  - Unit tests for planner, parser bridge, categorization, refunds, MCC, formulas, and redeemable chunks.
  - Integration tests for import to projection flow.
  - Playwright tests for mobile home, Cards tab, desktop dashboard, and review workflow.
  - Golden fixtures for parser output, refund matching, card formulas, reward ledger, and planner snapshots.

- FP-9.2 Add security controls
  - Do not store PDFs by default.
  - Redact sensitive logs.
  - Add encryption plan and platform-specific validation.

- FP-9.3 Add traceability matrix
  - Map each requirement to epic, tests, and UI surface.
  - Include requirement ID, source, data rule, acceptance criteria ID, automated test ID, manual evidence, release gate, and owner.

Acceptance criteria:

- Each business rule has a test.
- Import flow can be demonstrated with synthetic fixture data.
- Security decisions are documented.

## 10. Build Sequence

Implement in this order:

1. Confirm v1 runtime decision and parser bridge contract.
2. FP-1 Foundation and database.
3. FP-4 parser bridge with fixture import.
4. FP-5 transactions, categorization, refunds, and minimal review model.
5. FP-6 MCC and merchant intelligence.
6. FP-7 card rules and miles engine.
7. FP-3 FIRE planner integration.
8. FP-2 UI shell and static dashboards using real view models where available.
9. FP-8 full review inbox and corrections.
10. FP-9 hardening, traceability, and end-to-end tests.

Reasoning:

- The database schema must exist before ingestion and rewards can be reliable.
- The UI shell should start from agreed designs, but final implementation should bind to real view models as early as possible.
- Refund and MCC handling should precede the miles engine because both affect miles eligibility.
- Planner integration should use net expense snapshots from real imported data.
- Traceability and test fixtures start in FP-1 and continue through every epic, even though FP-9 owns final release readiness.

## 11. Traceability Matrix

| Requirement | Epic | Primary Tests | UI Surface |
| --- | --- | --- | --- |
| FIRE projection from user assumptions | FP-3 | Projection unit tests | Mobile Home, Desktop FI panel |
| Statement ingestion | FP-4 | Parser bridge integration tests | Import workflow |
| Transaction categorization | FP-5, FP-6 | Category engine tests | Review Inbox, Transactions |
| Refunds net off existing amount | FP-5 | Refund matching tests | Review Inbox, Expense Snapshot |
| Refunded transactions earn no miles | FP-5, FP-7 | Reward reversal tests | Cards tab, Review Inbox |
| Miles accumulated by card rules | FP-7 | Formula tests | Cards tab, Desktop Miles panel |
| Redeemable miles | FP-7 | Transfer block tests | Cards tab |
| Spend to next redeemable chunk | FP-7 | Projection tests | Cards tab |
| MCC merchant heuristics | FP-6 | Resolver tests | Review Inbox row badges |
| Mobile landing page | FP-2 | Playwright mobile test | Mobile Home |
| Desktop modern dashboard | FP-2, FP-8 | Playwright desktop test | Desktop Dashboard |
| Database solution | FP-1 | Migration and repository tests | All |

### 11.1 UI Source Data Map

| UI Element | Source Data | Derivation | Empty/Error State |
| --- | --- | --- | --- |
| FIRE percentage | `planner_profiles`, accepted `expense_snapshots` | Current net worth divided by target FIRE number | Show setup checklist if profile incomplete |
| FI date estimate | planner projection result | Projection using current assumptions and accepted expense snapshot | Show "Needs assumptions" |
| Net spend | `transactions`, `refund_matches`, `expense_snapshots` | Gross spend minus matched refunds for selected period | Show no-import state |
| Review count | `transactions.needs_review`, review statuses | Count unresolved review items | Show "No review items" |
| Redeemable miles | `reward_ledger`, `redemption_programs` | Posted and eligible miles rounded to transfer blocks | Show "Add card rules" |
| Accumulated miles | `reward_ledger` | Net earned miles including pending and posted, minus reversals | Show zero state |
| Reversed miles | `reward_ledger.ledger_type` | Sum reversal ledger entries in period | Hide if zero unless diagnostics expanded |
| Spend to next chunk | `card_rules`, `redemption_programs`, current cap usage | Minimum eligible spend to next transferable block | Show caveat if card rule stale |
| MCC confidence badge | `transactions.mcc_id`, `merchant_heuristics.confidence_score` | Highest-confidence matched heuristic or user correction | Show "Needs MCC" |
| Refund matched badge | `refund_matches.status` | Matched, partial, uncertain, rejected, or unmatched | Show review action when uncertain |

## 12. Validation Plan

Minimum validation before each merge:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- Parser service test command once Python package exists.

Domain-specific fixtures:

- `fixtures/statements/sg_bank_basic.csv`: spend, income, fees, and debit/credit sign checks.
- `fixtures/statements/sg_card_refunds.csv`: full refund, partial refund, unmatched refund, and cross-statement refund.
- `fixtures/statements/sg_card_duplicate.csv`: duplicate file and duplicate transaction scenarios.
- `fixtures/parser/ocr_fallback.json`: parser warning and OCR-used payload.
- `fixtures/parser/malformed_pdf.json`: stable parser failure code.
- `fixtures/cards/citi_rewards.json`: formula, cap, exclusion, and rounding traces.
- `fixtures/cards/dbs_wwmc.json`: formula, cap, exclusion, and rounding traces.
- `fixtures/cards/hsbc_revolution.json`: formula, cap, exclusion, and rounding traces.
- `fixtures/cards/uob_ladys.json`: formula, cap, exclusion, and rounding traces.
- `fixtures/planner/base_projection.json`: deterministic FIRE assumptions and expected outputs.
- `fixtures/security/export_redaction.json`: export/import without raw PDFs or sensitive logs.

Fixture rules:

- Synthetic fixtures are allowed in the repo.
- Real statements require explicit consent, anonymization, and no raw account numbers.
- Golden expected outputs must include net spend, refund matches, reward ledger rows, redeemable miles, and planner snapshot deltas.
- Fixture changes require a note explaining why expected financial outputs changed.

Manual QA:

- Import statement.
- Review uncertain rows.
- Confirm refund match.
- Confirm expense snapshot update.
- Verify FI percentage changes.
- Verify miles ledger shows pending, accumulated, redeemable, reversed, and spend-to-next values.

Release gates:

- Zero critical or high defects open.
- All domain unit tests pass.
- Parser integration tests pass for supported fixture banks.
- Reward formula golden tests pass for every seeded card.
- Export/import restore test passes.
- Security log scan finds no raw statement text, account numbers, full file paths, or full hashes.
- Temp parser directory is empty after successful and failed parse attempts.
- Accessibility smoke tests pass for mobile Home, Cards tab, desktop dashboard, and review inbox.
- Manual UAT evidence exists for first import, correction, refund match, expense snapshot acceptance, card miles review, export/import, and delete data.

## 13. Documentation Required During Implementation

Maintain these docs as the product is built:

- `docs/IMPLEMENTATION_HANDOFF.md`: source of truth for scope and traceability.
- `docs/ARCHITECTURE.md`: actual architecture once the app exists.
- `docs/DATABASE.md`: schema, migrations, encryption notes, and data retention policy.
- `docs/CARD_RULES.md`: card formula format, seeded cards, sources, and verification dates.
- `docs/PARSER_BRIDGE.md`: parser API contract, supported banks, errors, and fixture policy.
- `docs/UI_DECISIONS.md`: selected mobile and desktop UI direction, rejected card redundancies, and Figma links once created.
- `docs/TESTING.md`: commands, fixtures, coverage expectations, and manual QA checklist.

## 14. Handoff Prompt For The Next Implementation Model

Use this prompt when assigning implementation:

```text
You are implementing a local-first FIRE planner with statement ingestion and Singapore credit-card miles calculation.

Read docs/IMPLEMENTATION_HANDOFF.md first. Implement in the build sequence. Keep each change small and reviewable. Do not skip tests. Treat SQLite as the local source of truth, Zustand as screen state, and the Python parser as a bridge that returns normalized payloads while TypeScript owns database writes.

Prioritize:
1. App foundation and SQLite migrations.
2. Static mobile and desktop UI shells using the selected concepts.
3. Statement import with synthetic fixtures.
4. Refund-aware categorization.
5. MCC and merchant heuristics.
6. Card rules and miles ledger.
7. FIRE projection integration.

For card rules, verify Milelion summaries against bank T&Cs and store source URL, source type, effective date, and verification date. Do not encode formulas as arbitrary JavaScript. Use a restricted formula evaluator with tests.

Before completion, run lint, typecheck, unit tests, and E2E tests. If a command cannot run, state the exact blocker and the strongest validation performed.
```

## 15. Open Decisions

- Final app packaging target: web-only PWA, Tauri desktop, Capacitor mobile, React Native, or a staged path.
- Encryption implementation by platform.
- Whether to include cloud sync in v1.
- Whether card rules should support community updates or only curated admin updates.
- Whether original statement files can be optionally stored after encryption is complete.

Recommended default:

- Start as a Vite web/PWA app with local SQLite-compatible development path.
- Keep mobile UI responsive inside web/PWA first.
- Defer native packaging until domain logic, ingestion, and rewards calculations stabilize.

## 16. Confidence And Caveats

Confidence: 0.86.

Key caveats:

- Singapore card earn rules change often. Verify seeded card rules against bank T&Cs immediately before coding tests.
- SQLCipher integration depends on final runtime target. Validate early if native mobile or desktop packaging is selected.
- Parser accuracy depends on real statement layouts. Use synthetic fixtures first, then add real anonymized fixtures only with explicit consent.
- UI mockups are bitmap references. Translate them into Figma or code components with real spacing, tokens, and responsive constraints.
