# Current milestone

MASTER A–D implementation complete. Remaining work is physical-device verification of the implemented flows; no additional product phase is authorized automatically.

## Required source files

Read AGENTS.md, CODEBASE_MAP.md, MASTER_IMPLEMENTATION.md and the MASTER A–D section of ORDERS_ANDROID_CHECKLIST.md. For reproduced issues, inspect only the mapped screen/domain/repository owner. Checkout sequencing remains in ORDERS_DESIGN.md.

## Acceptance criteria

Record actual pass/fail for the 16 Android scenarios, device/OS/runtime and tested commit. Preserve checkout crash recovery, frozen receipts, FIRST100, explicit reviewed cart import, separate simulated tracking/care/mock state and privacy-conscious best-effort reminders. Do not substitute automated/export evidence for native QA.

## Known risks

Expo Go skips Android native reminders. A compatible existing development build is needed to verify scheduling; no automatic build is authorized. Native Back/keyboard/font scaling/TalkBack remain unobserved. Local AsyncStorage is unencrypted and not backend authority. OS scheduling failures can leave a stale generic reminder until reconciliation. Preserve app.json SHA-256 `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6` and master `70f2065da481e42fc4db7c262ad29d93140aec77`. No push/build/upgrades.

## Verification commands

For reproduced changes, targeted Jest tests plus npm run typecheck / npm run lint / git diff --check. Final regression: npm run check; npm run check:demo; npm run bundle:android. Do not repeat unchanged completed checks without a verification need.

## Remaining work

No A–D implementation items remain. Automated final gate: 547 tests / 47 suites, including all 491 baseline cases and checkout failure injection; typecheck/lint/static preflight pass. Android Hermes export: 3.5 MB, 1,525 modules, 32 assets. Device checklist remains pending. Existing scheduled delivery is an ASAP/scheduled preference, not a reserved slot; refill dates and mock preview schedules are separate. Fix only observed defects; request a new scope before further features.
