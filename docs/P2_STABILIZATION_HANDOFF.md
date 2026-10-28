# Plazza — new chat handoff

Saved on 29 October 2026 at the user's request to continue in a fresh chat. Start here instead of replaying the long conversation.

## Current state and constraints

- Workspace: `/Users/soumyaranjanpurohit/Desktop/untitled folder 2/plazza/rn-interview`.
- Branch: **`feat/plazza-commerce-mvp`**. Never modify `master`; its verified SHA is `70f2065da481e42fc4db7c262ad29d93140aec77`.
- The user's pre-existing **uncommitted `app.json` edit must remain untouched and excluded from commits**. Its SHA-256 is `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6`. It contains the user's EAS owner/project linking and formatting changes. It is expected to be the only dirty file after the handoff commit.
- Expo `~58.0.20`, React Native `0.88.0`, strict TypeScript, Expo Router, Context/useReducer, versioned AsyncStorage. No SDK/dependency upgrades, new state library, native config changes or AGENTS.md changes were made.
- No push, APK/EAS build or physical-device verification. Do not start them automatically.
- Do not implement P3 tracking, Plus, experiments, analytics, Profile, Share, backend, real payments or fulfillment without a new explicit request.
- Read [AGENTS.md](../AGENTS.md) before code. Fetch installed-version Expo docs before native/Router changes. SDK 58 uses layout `anchor`; `initialRouteName` layout settings are deprecated.

## Completed product foundation

The app already has 57 products (15 original PDF-derived medicines plus 42 demo products), search/categories/Home, cart/quantity/coupon rules, Android permission lifecycle and Expo Go safeguards, and an independent saved Address Book with recipient/gate instructions.

Complete P2 connects Cart → Checkout → simulated Payment → durable Confirmation → immutable Receipt, plus Home → Order History → Receipt. UPI simulations support initiated/pending/succeeded/failed/cancelled states; COD is explicitly mock confirmation, allowed up to ₹2,000. Pending attempts persist and require Check Status. Failed/cancelled attempts keep cart/FIRST100 and require a deliberate new attempt. Historical prices, totals and addresses remain frozen.

The recovery protocol is implemented and extensively tested. **Do not rewrite it for cleanup.** See [ORDERS_DESIGN.md](ORDERS_DESIGN.md).

## Commits and verified baseline

Previous complete-P2 commits:

- `caff150` — payment persistence and recovery integration.
- `825e633` — connected screens and reusable hooks.
- `23e9e77` — P2 architecture/checklist documentation.
- `eefd7d7` — interrupted source-preparation regression; stabilization started here with **432 tests / 32 suites**.

This stabilization's completed source commits:

1. **`98390f4`** — navigation/keyboard/focus correctness and regressions.
2. **`2e0567d`** — payment-result, History, receipt and accessibility polish.
3. **`f240611`** — pure validation boundaries, shared focus tracking and measured history-card optimization.
4. The following documentation/handoff commit contains this file, engineering standards, stabilization findings and updated Orders/checklist docs. Read `git log -4 --oneline` for its hash; a file cannot include its own final commit hash.

Latest actual verification:

- `npm run typecheck` — passed.
- `npm run lint` — passed with no errors/warnings.
- `npm test` — **462 tests / 35 suites passed**.
- `npm run check` — passed, same 462 cases: **432 preserved + 30 new**.
- `npm run check:demo` — passed; valid 15-original-medicine catalog and existing debug/preview profiles. Warned `adb devices` unavailable/failed.
- `npm run bundle:android` — passed; ignored `dist/` contains a **3.3 MB Hermes export, 1,483 modules, 32 assets**. Non-blocking NO_COLOR/FORCE_COLOR warnings.
- `git diff --check` — passed.

No screenshots/device runtime checks were performed. Browser visual QA was attempted through the Browser skill but initialization failed because its runtime import of `node:process` was restricted. Do not claim web visual QA or native smoothness from Jest/export.

## Findings and fixes

### Navigation and keyboard

- **Back was implemented as forward replacement:** Payment used `replace('/cart')`, Receipt `replace('/orders')`. Replacements default to push-style animation and do not pop the original screen. New `backTo(fallback)` pops the actual origin, using a bounded fallback without history.
- **Tabs accumulated in the stack:** Checkout Edit Cart pushed another `/cart`; Continue Shopping/History Home replaced the top with another tabs entry. `returnToShop` now dismisses to the existing Home/Cart tabs route and retains its key.
- **Review choices would be lost by the correct pop:** A small `CheckoutPreferencesProvider` retains only ephemeral method/delivery/simulator choices. It owns no cart, bill, address, outcome or storage. It sits under the existing providers in the root layout.
- **Transition policy was unspecified:** shared native `slide_from_right`, reverse pops, stable background/options, returning replacement `pop` settings, immediate tabs and SDK 58 `(tabs)` anchor are now explicit. OS reduced-motion queries/events disable transitions; races/unmount are tested.
- **Boolean focus was insufficient:** an old async callback could become valid again after blur/refocus, or navigate twice. `useScreenCompletion` captures a focus generation before awaiting and permits one navigation per visit. Checkout, Payment and address selection use it. Persistence may finish while a screen is covered; stale navigation must not.
- **Double Android resize:** Cart applied KeyboardAvoidingView height adjustment in addition to the existing native resize configuration. The extra Android adjustment is disabled; iOS padding is retained. `app.json` and address-form Back protection are unchanged.
- **Filter reset remounted Browse:** clearing category used `replace('/browse')`. It now uses `setParams`, preserving typed query/input identity and avoiding a transition.
- **Unconditional forward pushes:** P2/address entries use `navigate` to reuse an already active destination. Payment → Confirmation remains the intentional replacement after durable completion. Receipt opens forward; Back returns to History or Confirmation according to origin.
- There was **no source evidence of repeated root remounts or an infinite redirect loop**. Do not invent a fix for those. The recovery-before-hydration gate is intentionally retained.

Navigation owners: `src/navigation/commerceNavigation.ts`, root `_layout.tsx`, `components/app-tabs.tsx`, `hooks/useScreenActive.ts`, `hooks/useReducedMotion.ts`.

### Payment, History and receipt UX

- Shared StatusPanel/StatusBadge pair icon, heading, text and tone. Pending/reconciliation: amber clock. Failure: red error. Cancellation: neutral. Durable confirmation: positive check.
- A successful payment awaiting order persistence remains **reconciliation required**, not an order success. Saved total/attempt are visible; order ID/success actions appear only after finalization.
- Failure offers Retry Payment / Change Method through reviewed checkout; cancellation offers Back to Checkout / Change Method. These do not initiate a new attempt until review/confirmation.
- History cards show actual `placed` fulfillment state, date/ID, frozen total, product count/quantity, concise preview and View Details. Reconciliation is an additional warning, not a fulfillment status. Failed payments are not orders.
- **An actual presentation bug was fixed:** previously `OrderIdentity` labelled checkout reconciliation as the order status despite persisted fulfillment being `placed`.
- Receipt formatting lives outside JSX and uses immutable snapshot values. Existing BillSummary/address components and legacy metadata messaging are reused.
- Checkout choices have stable accessible names and selected state. Changing statuses have polite announcements; icons are decorative to screen readers. No new decorative animations or false fulfillment/Rx/payment promises.

Presentation owners: `components/ui/StatusPanel.tsx`, `features/orders/statusPresentation.ts`, `orderPresentation.ts`, `OrderHistoryCard.tsx`, `OrderReceipt.tsx`, `OrderItems.tsx`, and the existing P2 screens.

### Architecture and performance

- Domain parsers imported generic object validation from shopping storage. `isRecord` now lives in **`domain/validation.ts`**; domain/data/catalog validation imports it directly. Storage retains its compatibility export. Validator logic, schemas and writer behavior are identical.
- Focus tracking is shared by the current-focus and captured-completion hooks. Unnecessary returned-callback memoization was removed; the subscription callback stays stable. No lint/Compiler rules were disabled.
- A real render-work regression was reproduced: an unrelated shopping search-state update caused **one extra formatting call for an unchanged history card**. Memoizing that immutable card, with stable props/navigation handler, reduces that case to zero. This is not a device FPS benchmark.
- Deliberately deferred: global provider splitting, another state library, generic repositories/transactions, speculative caching/virtualization and any recovery rewrite. No measured need justified them.

## Persistence invariants to preserve

- `plazza.shopping.v1`: existing writer only, with `lastFinalizedCheckoutId`; old v1 remains readable.
- `plazza.payments.v1`: latest durable reviewed attempt; unresolved attempts cannot be overwritten.
- `plazza.checkout.v1`: full immutable pending intent, cleared last after receipt/shopping finalization.
- `plazza.orders.v1`: idempotent immutable receipts, optional legacy-safe payment/preference metadata.
- Address Book storage remains independent of shopping and OS permissions; GPS revocation never deletes saved addresses/receipts.
- Normal successful path: source preparation → initiated attempt → successful simulated outcome → intent → receipt → one shopping finalization/checkpoint/FIRST100 write → journal cleanup → payment finalized marker → confirmation navigation.
- Pending/failed/cancelled payment never places an order or consumes FIRST100. Retry reuses existing identity after uncertain writes. A deliberate new attempt after failure/cancellation gets new identities.
- Corruption/conflicting evidence fails closed without silent reset. AsyncStorage is not multi-key atomic. Irreparable corruption requires explicit reconciliation; automatic destructive repair is not implemented.
- The checkout coordinator, ordering service, reducers and repository writer sequencing were not changed by stabilization. Domain/storage edits only relocated the same validator and retained its export.

## Remaining work and future plan

### Immediate continuation — P2 verification, not another feature phase

1. Inspect branch/status/log and verify the protected `app.json` bytes. Read [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) and [P2_STABILIZATION.md](P2_STABILIZATION.md). Do not reread the entire conversation or rewrite completed work.
2. Review the focused source diff from `eefd7d7`. Re-run checks only when new edits/failures or a verification need justify it; do not repeatedly run the same full suite without a reason.
3. **Perform actual Android checks** using an existing compatible build/device if available. No EAS/APK build is authorized automatically. Follow [ORDERS_ANDROID_CHECKLIST.md](ORDERS_ANDROID_CHECKLIST.md): push/pop direction, immediate tabs, no duplicate tabs, payment completion Back, reduced motion, keyboard once, unsaved address guard, font scaling/TalkBack, pending restart, errors and FIRST100.
4. **Review a direct-link address-form Back edge case:** `AddressFormScreen.returnToBook()` still uses `replace('/addresses')` when there is no Back history. Normal Back/unsaved guards are preserved and the root anchor usually supplies history. Inspect whether the no-history fallback needs a returning replacement direction or shared fallback; this case was noted at handoff and was not separately changed/tested. Preserve the form guard and keyboard behavior in any fix.
5. If Browser becomes usable, visual QA can assess spacing/overflow, but still cannot prove Android animation smoothness. Browser setup was blocked in this session; do not claim it occurred.
6. Fix only reproduced remaining issues with focused tests. Source/API intent is corrected; the reported physical shaking has **not** been observed or certified eliminated on Android.

### After P2 device sign-off — proposals only

- Resolve any device-specific transition/keyboard/accessibility defects before adding product scope.
- Consider explicit safe reconciliation UX for irreparable/conflicting local data if requested; do not implement a silent reset.
- Profile larger order histories before broader context/caching/virtualization changes.
- Choose the next roadmap slice with the user. Simulated tracking/status progression is a possible future P3, but it is **not authorized by the stabilization task**. Plus, offers/experiments, analytics, Profile/Share and real backend/payments remain future work.

## Suggested first message in the new chat

“Continue Plazza on `feat/plazza-commerce-mvp`. Read `docs/P2_STABILIZATION_HANDOFF.md` and `AGENTS.md` first. Preserve the uncommitted `app.json` edit and `master`. Review the remaining P2 verification items and propose the next focused step; do not start P3, push or build an APK automatically.”
