# Current milestone

D — Mock AutoPay preview, maintainability audit, final regression/export and Android handoff. C completed: independent care data, timezone recurrence, best-effort reminders and explicit reviewed cart import. B completed with separate tracking events and stage-aware demo ETA/map. A completed: compact cart/coupons, stable short references/selectable IDs and compact feedback. Master request authorizes A → B → C → D sequentially.

## Required source files

domain/mockMandates; MockMandateRepository/local adapter; features/care MockAutoPay screen/link; CODEBASE_MAP, engineering standards and final Android checklist.

## Acceptance criteria

Explicit opt-in and confirmation for independent simulated mandate statuses/cap/schedule; preview uses current catalog and never writes orders/revenue; no credentials, gateway, mandate registration or automatic purchase. Final audit and all 491 baseline/crash tests preserved.

## Known risks

Native keyboard/Back/font scaling remain device-only. Preserve app.json SHA-256 `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6` and master `70f2065da481e42fc4db7c262ad29d93140aec77`. No push/build/upgrades.

## Verification commands

Targeted affected Jest cases; npm run typecheck; npm run lint; git diff --check. Final: npm run check; npm run check:demo; npm run bundle:android.

## Remaining work

A gate passed: typecheck/lint/diff and 91 affected tests / 6 suites, including recovery injection. B gate passed: typecheck/lint/diff and 71 tests / 4 suites. C gate passed: typecheck/lint/diff and 99 affected tests / 9 suites. Complete D and the full final gate. Existing scheduled delivery remains only an ASAP/scheduled preference, not a reserved slot; refill dates are independent. Preserve 491 baseline tests and all crash injection cases. Update this file at each gate.
