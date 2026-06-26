# FP-9.2 Security Controls

## Decisions

| Control Area | Decision | Implementation Evidence | Release Gate |
|---|---|---|---|
| Source statement retention | Do not persist original PDF or CSV source files by default. Store import hash, filename, parser metadata, warnings, and normalized transactions only. | `src/security/securityControls.ts`, `src/ingestion/importWorkflow.ts`, `src/db/schema.ts`, `src/db/exportImport.ts` | Source file retention remains disabled unless consent, encrypted storage, and deletion controls all exist. |
| Export safety | Local exports exclude source files and declare `sourceFilesIncluded=false`. | `src/db/exportImport.ts`, `tests/db/exportImport.test.ts` | Export schema must continue to reject artifacts that imply source files are included. |
| Log redaction | Parser and application security logs redact file paths, long hashes, account-like values, card numbers, email addresses, and raw transaction descriptions. | `src/ingestion/parserBridge.ts`, `src/security/securityControls.ts`, `tests/security/securityControls.test.ts` | Log scans must contain no raw statement paths, full hashes, account numbers, card numbers, emails, or raw descriptions. |
| Encryption readiness | Real-data mode requires encrypted local database storage and platform key protection validation. | `buildEncryptionReadinessPlan()` in `src/security/securityControls.ts` | Web and unknown-platform builds stay demo-only until an encrypted storage design is approved. |
| Parser temp files | Parser requests use temporary directories and remove them in the bridge `finally` block. | `src/ingestion/parserBridge.ts`, `tests/ingestion/parserBridge.test.ts` | Timeout and failure paths must continue to clean temporary parser input files. |

## Platform Encryption Plan

| Platform | Storage Target | Real-Data Mode | Required Validation |
|---|---|---:|---|
| macOS | SQLCipher database with keys protected by macOS Keychain | Allowed after validation | Keychain access, encrypted database open, locked-profile behavior, backup/export behavior. |
| Windows | SQLCipher database with keys protected by Windows Credential Manager or DPAPI | Allowed after validation | User profile isolation, installer permissions, encrypted database open, backup/export behavior. |
| Linux | SQLCipher database with keys protected by a libsecret-compatible keyring | Allowed after validation | Keyring availability, headless fallback behavior, encrypted database open, backup/export behavior. |
| Web | Browser storage disabled for real financial data | Demo-only | Approved encrypted storage design and browser threat model. |
| Unknown | Unvalidated platform storage | Demo-only | Platform-specific encryption and key lifecycle validation. |

## Automated Validation

- `tests/security/securityControls.test.ts` verifies source file retention defaults, retention preconditions, log redaction, and encryption readiness gates.
- `tests/db/exportImport.test.ts` verifies exports exclude source file bytes.
- `tests/ingestion/parserBridge.test.ts` verifies parser log sanitization and temp directory cleanup behavior.

## Caveats

- SQLCipher and native keychain integration are planned controls, not implemented runtime dependencies in this epic.
- Optional encrypted source statement attachment remains out of scope until deletion controls and encryption validation are implemented.
