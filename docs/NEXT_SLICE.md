# Current milestone

B — independent simulated Tracking and illustrative map. A completed: compact cart/coupons, stable short references/selectable IDs and compact feedback. Master request authorizes A → B → C → D sequentially.

## Required source files

domain/tracking; TrackingRepository/local adapter; independent versioned-record storage; features/tracking; tracking route and finalized-order entries.

## Acceptance criteria

Independent durable event transitions, invalid/duplicate/corrupt/unsupported safeguards; finalized-order eligibility; stage-aware demo ETA; accessible dummy map; unchanged receipts.

## Known risks

Native keyboard/Back/font scaling remain device-only. Preserve app.json SHA-256 `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6` and master `70f2065da481e42fc4db7c262ad29d93140aec77`. No push/build/upgrades.

## Verification commands

Targeted affected Jest cases; npm run typecheck; npm run lint; git diff --check. Final: npm run check; npm run check:demo; npm run bundle:android.

## Remaining work

A gate passed: typecheck/lint/diff and 91 affected tests / 6 suites, including recovery injection. Complete B, then Family Care/reminders C and Mock AutoPay/final audit D. Preserve 491 baseline tests and all crash injection cases. Update this file at each gate.
