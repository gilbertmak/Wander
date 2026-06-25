# Implementation Team Review

## Review Summary

Four implementation-review roles reviewed `docs/IMPLEMENTATION_HANDOFF.md`:

- Solution architecture.
- Full-stack delivery.
- Product design.
- Quality assurance and release readiness.

Overall verdict: the plan is directionally sound, but required changes were needed before it could serve as a build-ready handoff for another implementation model.

## Required Changes Identified

### 1. Runtime And Packaging

Issue:

- The plan selected SQLite and Python parsing while leaving web/PWA, Tauri, Capacitor, React Native, and desktop packaging open.

Resolution added:

- V1 alpha runtime is React/Vite UI plus local Node API.
- Node API owns SQLite writes and invokes the Python parser bridge.
- Native packaging is deferred until domain logic and parser/database contracts stabilize.

### 2. Parser Bridge Contract

Issue:

- "API or command bridge" was too ambiguous for implementation.

Resolution added:

- Explicit parser request, success result, and failure result JSON shapes.
- Timeout, temp-file cleanup, logging, versioning, and stable error-code requirements.

### 3. Data Ownership And Recalculation

Issue:

- Derived data ownership was implicit, creating risk of stale projections and rewards.

Resolution added:

- Clear owners for parser output, ingestion, transactions, MCC, rewards, planner, and UI state.
- Append-only reward ledger rule.
- Versioned expense snapshots.
- Explicit recalculation triggers.

### 4. Database Schema Detail

Issue:

- The schema listed entities but lacked migration-grade constraints.

Resolution added:

- Money/date storage rules.
- Enum requirements.
- Keys, indexes, uniqueness, source lineage, and seeded-data versioning.

### 5. Formula DSL

Issue:

- Formula operations were listed, but the JSON grammar was undefined.

Resolution added:

- Formula expression-tree example.
- Evaluator ordering rules.
- Validation and trace requirements.
- Refund reversal behavior.

### 6. UI Readiness

Issue:

- UI sections described surfaces but lacked hierarchy, states, responsive rules, accessibility, and Figma handoff criteria.

Resolution added:

- Mobile Home hierarchy and interaction rules.
- Cards/Miles tab hierarchy and gamification guardrails.
- Desktop grid behavior.
- Review inbox row anatomy and states.
- Accessibility requirements.
- Figma handoff checklist.

### 7. Build Sequence

Issue:

- Static UI came too early, and review inbox arrived too late.

Resolution added:

- Parser contract and database foundation now come first.
- Minimal review model is built alongside transaction/refund work.
- Full UI binds to real view models later.

### 8. QA, Fixtures, And Release Gates

Issue:

- Validation was command-based and too thin for a financial product.

Resolution added:

- Named fixture set.
- Fixture governance rules.
- Release gates covering defects, parser tests, reward formula tests, export/import, security scans, temp cleanup, accessibility, and UAT evidence.

## Remaining Open Decisions

- Final native packaging choice.
- Platform-specific encryption implementation.
- Cloud sync scope.
- Whether card rules support community updates or only curated updates.
- Whether encrypted source statement attachment is allowed later.

## Confidence

0.88.

## Key Caveats

- Reviewers performed static document review only.
- Current bank T&Cs and platform-specific SQLCipher details still need live verification before implementation.
- Figma conversion has not yet been performed.
