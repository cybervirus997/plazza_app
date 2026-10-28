# Current milestone

C — Family Care recipients, refill proposals and native reminder reconciliation. B completed with separate tracking events and stage-aware demo ETA/map. A completed: compact cart/coupons, stable short references/selectable IDs and compact feedback. Master request authorizes A → B → C → D sequentially.

## Required source files

domain/carePlans and recurrence; CarePlanRepository/local adapter; features/care provider/forms/review/reminders; explicit atomic shopping reducer proposal import.

## Acceptance criteria

Independent recipients/plans; timezone/month-end recurrence; notification denial/failure does not block in-app reminders; pause/resume/skip/delete cancel/reschedule; current-price review, missing-address checks and explicit cart collision choice; no automatic order/payment.

## Known risks

Native keyboard/Back/font scaling remain device-only. Preserve app.json SHA-256 `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6` and master `70f2065da481e42fc4db7c262ad29d93140aec77`. No push/build/upgrades.

## Verification commands

Targeted affected Jest cases; npm run typecheck; npm run lint; git diff --check. Final: npm run check; npm run check:demo; npm run bundle:android.

## Remaining work

A gate passed: typecheck/lint/diff and 91 affected tests / 6 suites, including recovery injection. B gate passed: typecheck/lint/diff and 71 tests / 4 suites. Complete C, then Mock AutoPay/final audit D. Preserve 491 baseline tests and all crash injection cases. Update this file at each gate.
