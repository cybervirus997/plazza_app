# Plazza MASTER implementation — A–D

Completed locally on `feat/plazza-commerce-mvp`, 29 October 2026, under the user's MASTER request. This supersedes the earlier Part 2 stop boundary only for the four requested milestones. Start future work with AGENTS.md, CODEBASE_MAP.md and NEXT_SLICE.md.

## Implemented behavior and commits

| Milestone | Result | Local commit / gate |
| --- | --- | --- |
| A | Compact care bag rows/coupons/CTA/empty state; frozen receipt hierarchy; stable short references and selectable full IDs; compact timed feedback with persistent actionable errors; duplicate order banners removed | `99501a5`; 91 affected tests / 6 suites, typecheck/lint/diff pass |
| B | Explicit persisted simulated tracking stages, Rx/delay/failure transitions, illustrative accessible map/ETA; finalized-order links from Confirmation/Receipt/History | `7d5691f`; 71 affected tests / 4 suites, typecheck/lint/diff pass |
| C | Independent recipients/refill plans, timezone recurrence, pause/resume/skip/delete, best-effort private reminders, deliberate current-catalog/address/cart review | `1201a16`; 99 affected tests / 9 suites, typecheck/lint/diff pass |
| D | Independent Mock AutoPay preview with cap/frequency/date snapshot, opt-in and confirmed activate/pause/resume/cancel, read-only current-price preview and orphan cancellation; final audit/docs | Commit titled `feat(care): add explicit Mock AutoPay preview and final audit (milestone D)` |

No dependency, native project or app configuration changes. No push, EAS build, APK, backend, real gateway, mandate, medical approval, live GPS tracking or automatic order/payment.

## Domain and storage ownership

All new envelopes are `{ version: 1, records: [...] }`, validated before reads/writes; damaged/unsupported data fails closed. `storage/versionedRecords` serializes per-port/per-key operations and preserves uncertain committed bytes for retry. It does not replace original persistence.

| Key | Domain / owner |
| --- | --- |
| `plazza.tracking.v1` | `domain/tracking`, TrackingRepository/local adapter; version-1 event histories keyed by immutable order ID |
| `plazza.care.v1` | `carePlans`/`careRecurrence`, CarePlanRepository/local adapter; recipients and revision-guarded plans |
| `plazza.reminders.v1` | `features/care/reminders`; owned native scheduling IDs and revision/date metadata |
| `plazza.mock-mandates.v1` | `domain/mockMandates`, MockMandateRepository/local adapter; simulationOnly records, explicit opt-in/status/cap/schedule |

Original shopping/address/payment/checkout/order schema versions and keys remain unchanged. Receipts stay immutable. Only the existing checkout coordinator finalizes orders. Care import adds one guarded reducer action through the existing shopping writer; expected-cart checks reject stale merge/replace decisions, checkout locks remain enforced, and existing coupon rules run again. No care/mock feature redeems FIRST100 or calls ordering/payment services.

## Correctness decisions

- Tracking uses explicit controls, injectable clock and persisted ordered/idempotent events, with terminal-state and conflicting-event checks. Restored tracking must agree with receipt date/Rx metadata. Matching current attempts must be finalized; a shopping checkpoint also proves finalization. Older paid receipts require a different later attempt as evidence of completed serialized recovery. Legacy receipts lacking evidence stay ineligible. This relies on root recovery preceding route access; it is local evidence, not server fulfillment authority.
- ETA is illustrative, stage-aware and absent for Rx review/terminal failures. Delays store a revised demo estimate. Receipt `placed` status never becomes tracking state. No coordinates or map provider are used. Short `PLZ-XXXXXXXX` references are display hashes that can collide; the full selectable ID remains authoritative.
- Recurrence uses an IANA timezone and saved wall-clock anchors. Month-end dates clamp and retain the original intended day. Nonexistent DST times shift forward by the gap; ambiguous times use the earlier instant. Due plans remain visible offline. Skip advances the review date; it never buys medicines.
- Care review resolves current prices/availability/quantity/Rx, flags unknown products, permits proposal edits, requires explicit valid address confirmation, and requires merge/replace choice for a nonempty cart. Missing linked addresses never silently reuse an old destination. The final action only populates Cart; existing Checkout/payment still requires user action.
- Existing Checkout stores an ASAP/scheduled preference, not a concrete reserved delivery slot. No slot schema/recovery change was introduced. Refill reminder dates and saved mock billing previews are separate concepts.
- SDK 58 notifications use DATE triggers with `delivery: 'bestEffort'`. No permission prompts or exact-alarm requests are introduced. The existing Permissions screen remains the explicit permission entry point. Generic lock-screen text omits medicines, recipient/address/phone data; metadata contains only opaque plan ID/revision/date.
- Startup, foreground and plan changes reconcile OS pending IDs against the independent ledger. Deterministic identities recover lost native acknowledgements. Denial/unavailability/failure never prevents saving/using plans. Paused/deleted plans are persisted before native cancellation; native failure or process death can leave a stale generic reminder until reconciliation succeeds. Due records are not rescheduled automatically into new purchases.
- Android Expo Go is rejected before importing notifications. Real scheduling/channel/permission behavior needs an existing compatible development build. Reminders are not exact-minute guarantees.
- Mock preview creation is inactive first. Activation requires explicit demo opt-in plus confirmation. Every persisted mock action and charge preview has an explicit confirmation. Read-only previews use current catalog item subtotals, cap/availability/quantity/Rx checks; they do not duplicate checkout bills or persist revenue. Pausing reminders and mock previews is independent. Missing-plan previews can be cancelled. Schedule snapshots update only after explicit confirmation.

## Maintainability audit

Routes remain thin; pure rules, repository interfaces/adapters and screen workflows retain separate owners. Shared FeaturePage provides native header/safe-area/iOS keyboard handling; Android relies on resize. No new global shopping state, storage writer, UI/state/navigation framework, dependency or timer-driven tracking was added. Reminder/native ports and repository clocks are injectable. Focus-generation guards reject stale async results; form removal guards preserve drafts/saves. Callbacks are stabilized only for effects/subscribers. Existing tokens, 48-point controls, accessible labels/status text and reduced-motion navigation are reused. The static map has an accessible summary; decorative marker text does not scale independently.

Final audit tightened restored tracking/receipt consistency, stage ETA metadata, owned reminder identities, strict enum parsing, unavailable-product cap eligibility, timezone display and 16dp detail spacing, with regressions for the data-safety findings. Large-font wrapping, native Back, keyboard and TalkBack still require observation.

## Verification and remaining device work

- `npm run check`: **547 tests / 47 suites**, typecheck and lint pass. All 491 baseline cases retained, plus 56; existing payment/checkout failure-injection suites pass. No skipped/deleted baseline cases. The existing cart UI case now opens the deliberately collapsed offer list before making its original assertions.
- `npm run check:demo`: passes static checks; sandbox ADB warning remains. It does not inspect an installed binary.
- `npm run bundle:android`: Android Hermes export passes, **3.5 MB, 1,525 modules, 32 assets** in ignored `dist/`; nonblocking NO_COLOR/FORCE_COLOR warnings only. This is not an APK or native performance evidence.
- `git diff --check`: pass. Protected app.json SHA-256 remains `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6`; master remains `70f2065da481e42fc4db7c262ad29d93140aec77`.

Use the [MASTER A–D phone checklist](ORDERS_ANDROID_CHECKLIST.md#master-ad--final-phone-pass). No new physical-device or browser visual sign-off occurred. The only prior native evidence is the user's Home smoke report on Samsung S20 FE / SM-G781B, Android 13, Expo Go, before MASTER changes. ADB did not expose that device, and browser bootstrap was unavailable. Notification delivery cannot be signed off in Android Expo Go.

AsyncStorage is local and unencrypted; recipients are not authenticated family accounts. There is no multi-device synchronization, transactional guarantee across independent keys/OS schedules, server authorization, prescription verification or real financial/fulfillment integration. No new analytics/debug logs expose personal data. Preserve existing saved data during manual testing; never reset the user's data merely to repeat FIRST100.
