# Release 3 Hardening

## Scope

R3-10 validates that Release 3 epics have traceability rows, eval coverage, automated tests, and browser-safe imports.

## Automated Gates

- `tests/release/releaseHardening.test.ts` checks Release 3 requirement coverage.
- `npm run evals` checks eval manifest IDs, automation layers, and blocker counts.
- `npm run build` verifies the browser bundle compiles without Node-only planner dependencies leaking into UI imports.
- `npm run test:e2e` verifies dashboard, reports, planner stress testing, onboarding, and mobile home smoke paths.

## Manual Evidence Still Required

- Desktop and mobile screenshots for command centre, Reports, and Planner stress panels.
- Product review of advisor recommendation copy and stress scenario action wording.
- CPF default assumption review for the applicable planning year.
