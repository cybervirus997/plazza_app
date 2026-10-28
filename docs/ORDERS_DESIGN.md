# Orders — complete P2 checkout, simulated payment and immutable receipts

Implemented on `feat/plazza-commerce-mvp`. The connected flow is Cart → Checkout → simulated Payment → durable Confirmation → Receipt, with Home → Orders → Receipt. P2A receipts and the P2B-1 shopping writer/recovery coordinator remain the foundation. Cart clearing and FIRST100 redemption still happen only after the shopping finalization write succeeds. All payment, serviceability and delivery preferences are explicitly local simulations; there is no gateway, bank transfer, pharmacy verification or fulfillment.

## Schema and snapshot ownership

`src/domain/orders.ts` defines `Order extends Bill`, `OrderItemSnapshot`, `OrderDraftInput`, `createOrderDraft` and `parseOrder`.

| Field | Meaning |
| --- | --- |
| `version: 1`, `status: 'placed'` | Receipt schema and only status supported in this slice |
| `id`, `checkoutId` | Stable order identity and separate checkout/idempotency identity |
| `placedAt` | Canonical UTC ISO timestamp, e.g. `new Date().toISOString()` |
| `items[]` | Copied product ID, purchase-time name, positive integer quantity, charged unit price and Rx flag |
| `couponCode` | Normalized applied code or null |
| `itemTotal`, `discount`, `deliveryFee`, `grandTotal` | Existing `Bill` fields, in rupees |
| `deliveryAddress` | Complete version-1 `DeliveryAddressSnapshot`, including recipient and gate instructions |

The caller supplies identities and time **once**, rather than generating them on each create/retry. `createOrderDraft` produces an unsaved, complete `Order`; there is no additional mutable draft store. It rejects empty/duplicate/unknown cart entries, ambiguous product IDs, invalid quantities or purchase-time maxQty violations, missing/invalid addresses, invalid/redeemed coupons and a bill inconsistent with existing pricing. It never mutates shopping state or calls `redeemCoupon`.

Monetary calculations validate safe integer paise internally. Unit prices use exactly the existing `getItemTotal` rule, `Math.round(price * 100)`, before quantity multiplication. Stored values are canonical rupees with at most two decimal places. Existing SAVE10 whole-rupee rounding and delivery thresholds are preserved through `calculateBill`; no coupon/bill code changed. Unsafe integer totals and fractional/negative quantities are rejected; a nonempty zero-price cart remains valid.

Every returned order, item array, item, address snapshot, address and coordinate object is copied and frozen. Historical receipts must render these values directly (the order also satisfies `BillSummary`'s `Bill` contract). Never resolve historical names/prices/Rx/limits/address fields through the current catalog or address book, and never re-evaluate old coupons.

`parseOrder(unknown)` validates stored structure, canonical address data and monetary arithmetic, then returns fresh frozen snapshots. It intentionally does not check today's catalog, promotion registry or delivery threshold: changed product prices, limits and retired coupon codes cannot rewrite purchase-time receipts. It uses the existing address validator, rejects malformed snapshots rather than repairing them, and strips unrecognized properties when constructing the receipt.

## Repository API and persistence

- `src/repositories/OrderRepository.ts`: `version: 1`, `load()`, `getById(id)`, `create(order)` and shared conflict/recovery/version errors.
- `src/repositories/local/LocalOrderRepository.ts`: `createLocalOrderRepository(storage: StoragePort)`. The checkout coordinator receives the same AsyncStorage-compatible port as the existing shopping writer. No database or package was added.
- Storage key: **`plazza.orders.v1`**. Envelope: `{ version: 1, orders: Order[] }`.
- `load()` returns `{ orders, warning, canWrite }` in insertion order (oldest insertion first). `canWrite` describes schema/recovery readiness, not a guarantee that the next device write will succeed.
- `getById()` returns a frozen order or null for a missing ID in a healthy history. It throws on unreadable/unsupported/damaged history, preventing an ambiguous lookup from being interpreted as authoritative absence.
- `create()` returns `{ order, created }`. It validates/copies before enqueueing and appends only after reading current persisted history. There is no update/delete operation for historical receipts.

Reads and writes are serialized, including across adapters sharing the **same port object in one JS runtime**. The queue survives rejected operations without poisoning later retries. There is no stale in-memory history cache. This is not a cross-process lock or a compare-and-swap API: use a shared port/single application owner, not separate wrappers or independent writers to the same key.

### Idempotency and failure behavior

An identical canonical receipt with an existing `checkoutId` returns the persisted order with `created: false`, without appending/reordering/writing. Any payload difference, including order ID or placement time, raises `OrderConflictError`. Reusing an order ID for a different checkout also conflicts. The P2B-1 journal persists the original full intent so retries do not generate fresh IDs/time or reprice the receipt.

If a write rejects, it may or may not have committed. The repository does not compensate by deleting or overwriting a receipt: retry the **same** intent. If the original write actually committed but its acknowledgement was lost, the retry finds that order and returns it once. A successful promise is a platform acknowledgement, not a guarantee against subsequent device/storage loss.

Only a missing key (`null`) is a healthy empty history. Invalid JSON/envelopes report a warning and `canWrite: false`; mixed histories expose readable receipts with a warning while retaining the original bytes. Invalid records and duplicate order/checkout IDs block all creates and authoritative lookups. Unsupported envelope versions throw `UnsupportedOrderVersionError`. Reads never write; creates never silently repair, prune, reset or overwrite damaged/unsupported history, because that could erase receipts or idempotency evidence. Recovery after ordinary I/O failure is a retry; irreparable corruption needs explicit recovery/repair outside P2A. There is no automatic backup or repair UI in this slice.

Receipt/address data stays in local, unencrypted storage. No order payloads are logged or sent to analytics. A historical receipt owns its address copy even if the saved address is later edited/deleted. Retention/export/erasure policy and server identity are future concerns; no server/payment guarantees are claimed.

## P2B-1 — underlying recovery protocol

AsyncStorage has no multi-key transactions. Saving `plazza.orders.v1` and then `plazza.shopping.v1` is **not atomic**, even when awaited or grouped in `multiSet`. This implementation uses a durable immutable intent and a shopping checkpoint, preserving the existing shopping key and writer rather than introducing a second cart store.

Journal key **`plazza.checkout.v1`** stores `{ version: 1, pending: { order: Order, oneTimeCouponCode: string | null } | null }`. The order contains the original IDs, timestamp, item prices/quantities, totals, coupon and versioned address snapshot. It is not an editable cart. Journal v1 validates the captured redemption obligation as FIRST100 for a FIRST100 receipt and null otherwise. Recovery never consults the current catalog, address book or promotion eligibility to rebuild this receipt.

Shopping remains **`plazza.shopping.v1`** with optional `lastFinalizedCheckoutId`. Old complete v1 shopping snapshots without this property restore normally. Every subsequent shopping save preserves the marker. Strict recovery decoding occurs before the existing catalog-dependent hydration/clamping/coupon revalidation. Malformed/unsupported shopping, journals and order histories block bootstrap without being overwritten or silently reset.

### Exact write and publication sequence

1. **Lock and drain.** The provider synchronously blocks duplicate checkout taps and shopping mutations. In P2, the payment service captures the review first and calls `commit(order)` only after confirmed simulation success; the legacy `begin` entry point below is retained for contract compatibility. The coordinator locks the existing shopping writer and drains already queued autosaves. It reads any pending journal first: retries use that intent, not today's cart/address. A fresh checkout requires a nonempty eligible cart and `AddressBookProvider.snapshotForOrder()`; that API supplies a durable, copied address without any GPS call. Generate IDs and timestamp once and freeze the validated receipt using `createOrderDraft`.
2. **Prepare the source cart.** Check order-history readiness and persist the latest committed UI shopping snapshot through the same writer if it differs from storage. This optional pre-intent shopping write is needed when checkout beats the autosave effect. Checkpoint consistency and previously persisted coupon redemptions must be preserved. Failure here creates neither an order nor a journal.
3. **Write the intent.** Persist the full frozen intent to the journal before calling `OrderRepository.create`. If this write rejects with an unknown commit outcome, retain its identity in memory, reread the journal on retry and use the original intent. A full process restart can recover only acknowledged or actually committed bytes; if no intent ever reached storage, there is no receipt/finalization to recover.
4. **Write the receipt idempotently.** Validate the raw shopping source against the journal before touching history. Require exact cart ID/quantity pairs and active coupon, unless the shopping checkpoint already matches. Reject FIRST100 already redeemed under another checkpoint or a matching checkpoint missing its redemption. `OrderRepository.create(intent.order)` either appends the receipt or returns the identical existing receipt. Conflicts and damaged/unsupported history block finalization.
5. **Write shopping finalization once.** Through the existing serialized shopping writer, reread and recheck the source. In one shopping JSON write, clear that cart and active coupon, set-union captured FIRST100 redemption, preserve recent searches/other used codes and set `lastFinalizedCheckoutId`. A matching checkpoint returns the existing snapshot without clearing a later cart or redeeming again. The writer rejects stale autosaves with an earlier checkpoint; no separate shopping writer or coupon write exists.
6. **Publish only the committed shopping result.** The provider records the persisted snapshot key before dispatching `checkout-finalized`. This reducer action is idempotent for the same checkout, so repeated publication cannot clear a later cart or duplicate the success notice. The autosave effect skips this already persisted snapshot: publication causes no second finalization save. The legacy pure `place-order` reducer case remains for existing contract tests, but public provider dispatch refuses it; the live Cart only calls the asynchronous coordinator.
7. **Clear the journal last.** Write `{ version: 1, pending: null }`, then unlock mutations and the next checkout. If cleanup fails, the receipt/shopping result remains committed and visible, while Cart reports recovery pending and retries that same checkout. If cleanup actually committed but its acknowledgement was lost, an in-memory receipt identifies that finalization: retry verifies its checkpoint and stored receipt, completes publication idempotently and unlocks without another write or address lookup. Never compensate by deleting an order or resetting the journal on error.

For an already persisted source cart, the normal write sequence is **journal → orders → shopping → cleared journal**. The optional preparation write is before this sequence. Any I/O failure may occur before or after native commit; retry reads durable evidence rather than assuming a rejected promise means no write happened.

### Startup and lifecycle

`AppStateProvider` runs recovery before catalog-dependent shopping hydration or any initial autosave. A pending intent follows steps 4–7. With a matching checkpoint, later shopping contents survive and only receipt verification/cleanup is necessary. With no pending journal, validate healthy order history and strict shopping state; any checkpoint must link to a stored receipt, including FIRST100 redemption evidence. Only then load the catalog and hydrate. Failures show a blocking recovery screen with Retry, without discarding the journal or overwriting history. Active hydrated recovery also publishes an already committed checkpoint through the idempotent action.

The coordinator, shopping writer and order repository serialize operations for a shared storage-port object in one JS runtime. Locks stop new autosaves and UI cart/coupon/search changes; queued old saves drain before intent capture. The provider also rejects checkout in the same event as a not-yet-committed React shopping action. Quantity/Add/Remove/coupon controls show disabled state. The address book remains independent: the captured address is immutable, and later address edits/deletion or permission revocation cannot change an unresolved receipt. Fresh checkout requires a selected address; recovery does not.

Provider lifecycle generations guard every asynchronous publication and each next persistence phase. Unmount/recovery changes invalidate old callbacks; in-flight native operations cannot be cancelled, so their completed bytes are reconciled on the next recovery. There is no polling, second state library or unrelated provider rewrite.

### Files and responsibility

| File | Responsibility |
| --- | --- |
| `src/features/orders/checkout.ts` | Checkout/recovery serialization, lifecycle checks, immutable intent and write ordering |
| `src/storage/persistence.ts`, `src/domain/types.ts` | Backward-compatible checkpoint, strict recovery decoding, shared existing writer, source matching and idempotent finalization |
| `src/state/appReducer.ts`, `src/state/AppStateProvider.tsx` | Mutation gate, idempotent publication, hydration ordering, async status and duplicate-autosave suppression |
| `src/features/cart/CartScreen.tsx`, `CouponSection.tsx` | Cart editing, entry to Checkout or saved Payment, and disabled coupon controls; the P2 screens below own review/payment feedback |
| `src/components/MedicineCard.tsx`, `src/components/ui/QuantityControl.tsx` | Disabled shopping controls while checkout is locked |
| `src/app/_layout.tsx` | Blocking startup recovery error/retry UI, preserving provider hierarchy |
| `tests/checkout-recovery.test.ts`, `tests/checkout-provider.test.tsx` | Failure injection with real local repositories/writer; provider, lifecycle, reducer and Cart integration |
| `tests/cart-ui.test.tsx` | Existing UI assertions retained; storage mock now handles shopping, orders and journal keys separately |

### Tested crash windows and failure cases

| Crash/failure point | Verified result |
| --- | --- |
| Intent write rejection before/after commit | No premature receipt/finalization; retry reuses captured identity |
| After intent, before receipt | Restart creates the exact captured receipt and finalizes once |
| Receipt write failure, crash after receipt, lost receipt acknowledgement | Identical create returns one receipt; original prices/time/address retained |
| Shopping finalization failure before/after commit | Cart/coupon publish only after acknowledged durable finalization; retry recognizes an actually committed checkpoint |
| After shopping, before cleanup; cleanup write failure/crash after commit | No second shopping finalization/redemption/notice; cleared journal or matching checkpoint reconciles safely |
| Restart with checkpoint and a later cart | Later cart survives; stale autosave cannot restore the checked-out cart |
| Different source cart without matching checkpoint | Recovery blocks before a receipt/destructive shopping write |
| Damaged/unsupported journal/history/shopping, missing receipt/redemption evidence | Visible error and byte preservation; no silent reset |
| Missing address, empty cart, duplicate taps, active mutations | No invalid order, duplicate prompt/receipt or overlapping checkout |
| Unmount after native receipt commit, changed catalog on restart | Old callbacks ignored; recovery precedes live catalog normalization |
| FIRST100 retry/restart and legacy v1 shopping restoration | Exactly one redemption, checkpoint preservation and backward compatibility |

### Guarantees, limitations and P2B-2

This is recoverable coordination, **not an atomic multi-key transaction**. A receipt can exist while finalization is pending; do not interpret its mere existence as permission to clear an arbitrary cart. Acknowledged promises reflect platform storage acknowledgement, not protection against disk loss. Single-key native write integrity, a single application owner/shared port and no older or external writers are required. The ID generator is local demo identity, not server identity. Version-1 recovery deliberately rejects missing/forged FIRST100 obligations rather than inferring them from changing promotion rules.

Conflicting carts, corrupt/unsupported data or a checkpoint without its receipt/redemption fail closed and may require explicit reconciliation. Retry fixes transient I/O, not irreparable corruption; no destructive reset/repair UI is included. Downgrades/mixed-version writers, multi-process access, multi-device sync, backup/retention, encrypted storage and real payments require a stronger storage/backend contract. No order/address payload logging or analytics was added.

The complete P2 implementation below now supplies Order History and Receipt UI from immutable snapshots. Explicit destructive repair/reconciliation for irreparable corruption remains unimplemented. Real Android force-stop/restart and storage failures still require device verification before claiming native durability.

### Android verification checklist (not performed here)

- Place a demo order with/without FIRST100 and a selected manual address; verify loading/disabled controls, durable success and restart with empty cart/redemption preserved.
- Attempt checkout without an address, tap twice rapidly, edit quantities/coupon immediately before/while checkout, and background/return during saves.
- Force-stop/relaunch at intent, receipt, shopping-finalization and cleanup boundaries using a controlled debug storage failure harness; confirm one identity/receipt/redemption and retry feedback.
- After finalization, add a different cart and relaunch with an old matching journal; confirm the later cart survives. Inject a conflicting cart or damaged journal and confirm blocking recovery without data reset.
- Edit/delete the saved address and deny location permission after intent capture; recovery must keep the original address, while normal manual address entry/permission behavior remains intact.

## Verification and review

On 29 October 2026, `npm run typecheck`, `npm run lint`, `npm test` and `npm run check` all passed: **299 tests / 24 suites**, including all 237 baseline cases and 62 new order cases. P2A tests cover receipt validity, empty/missing-address rejection, sparse arrays, item/price/address immutability, quantity and money bounds, current pricing semantics, historical restoration without live dependencies, persistence/restart, idempotency/conflicts, shared-port serialization, mutation while queued, write failure/retry/lost acknowledgements, corrupt records/envelopes, unsupported versions and isolation from FIRST100/shopping/address persistence.

Ponytail was not installed (no CLI, dependency or enabled tool); a manual source/diff review was used. Review fixes included explicit copying of Bill fields so extra properties cannot override receipt identity/items, safe aggregate quantity validation, dense item validation so sparse arrays cannot bypass empty-cart checks, and repository-level public error types that future adapters can reuse. Final command results and commit hashes are reported with the implementation. P2A does not change application UI or native APIs, start EAS builds, push commits, implement Plus/tracking/maps/payments, or claim device verification.


P2B-1 verification on 29 October 2026: `npm run typecheck`, `npm run lint`, `npm test` and `npm run check` passed with **342 tests / 26 suites**: all 299 baseline cases plus 43 focused checkout cases. Source/diff review covered lock acquisition, shared writer ordering, checkpoint evidence, uncertain acknowledgements, cleanup, same-event React actions and lifecycle invalidation. No physical Android device testing, APK build or push was performed. The pre-existing `app.json` edit is excluded from implementation commits.


## Complete P2 — Checkout, Payment, Confirmation and Receipts

### State ownership and reusable boundaries

| Owner | Responsibility |
| --- | --- |
| Existing `AppStateProvider` / shopping writer | Cart, coupons, recent searches, checkpoint, mutation gate, and recovery before hydration/autosave. No second shopping writer. |
| `useCheckoutReview` + pure `domain/checkoutReview.ts` | Validate current quantities, availability, coupon and selected address through existing pricing/order rules. Memoize the frozen review only when those inputs change. Review placeholder identities are never persisted. |
| Checkout screen | Local method, simulated delivery preference and development-only outcome choice. Continue rechecks persisted address and current shopping/catalog inputs against the displayed review; it rejects changed details instead of silently substituting them. |
| `domain/payments.ts` / injectable `PaymentSimulator` | Explicit attempt transitions and deterministic outcomes; no React, native APIs, timers, bank or network calls. |
| `PaymentRepository` / `LocalPaymentRepository` | Serialize and validate the latest versioned durable attempt. An unresolved attempt cannot be replaced. |
| `features/orders/ordering.ts` | Sequence payment persistence and the existing checkout coordinator. It reads history but never calls order creation itself. |
| `usePaymentFlow` | One provider-owned UI view of the persisted attempt, busy/error feedback, duplicate submission guard and lifecycle generations. Refresh authoritative attempt status after uncertain failures so a successful payment is described as awaiting reconciliation, not as a failed payment. |
| `useOrderHistory` / `useOrderById` | Shared focus/retry loading and error handling, newest-first copies, stale-request/unmount guards. No live pricing or address lookup. |
| `OrderPage`, `AddressSummary`, `OrderItems`, `OrderReceipt` | Shared safe areas, sticky actions, accessible controls, frozen address/instructions and receipt presentation. Long History/Receipt lists use FlatList. No animation or new dependency. |

Address Book and permissions remain independent. Manual saved addresses never need GPS permission. Changes to the book during a pending payment do not alter its frozen address; Checkout shows the saved attempt and directs the user to resume/cancel it. No address or payment payload is logged.

### Routes and review behavior

- `/cart`: edit quantities/coupons; **Proceed to Checkout →** only navigates. Pending attempts instead expose **Resume saved payment**.
- `/checkout`: selected address, recipient/gate instructions, availability/serviceability disclaimer, Rx review notice, simulated ASAP/evening preference, item summary/Edit Cart, coupon savings, existing BillSummary, UPI/COD selection, sticky Continue.
- `/payment`: frozen attempt and explicit Pay/COD confirmation, Check Status, cancellation, reconciliation/retry or deliberate new-attempt actions. Home and Cart can reopen it after restart.
- `/order-confirmation?id=…`: requires a readable receipt and matching completed-attempt/current shopping checkpoint evidence. Receipt existence alone cannot show confirmation. Shows ID, original checkout timestamp, count, frozen total, payment status, address and Rx notice.
- `/orders`: obvious Home entry, loading/empty/error/retry states, persisted receipts newest first.
- `/orders/[id]`: purchase-time items/prices/quantities/Rx, coupon, discount, delivery fee/total, optional payment metadata, frozen recipient/address/gate instructions and simulation disclaimer.

Checkout rejects empty carts, missing/invalid addresses, unavailable/unknown products, invalid quantities and invalid/redeemed coupons. Address text and PIN validity are not evidence of delivery coverage. The offline demo accepts valid saved Indian PIN formats without asserting real zones or stock. ASAP/evening choices are preferences only, without a reserved slot or promised ETA. Mock COD is allowed only for totals up to ₹2,000; the policy is pure, deterministic and displayed before selection.

Opening Checkout or navigating Back does not place an order or clear the cart. Checkout stays in the Router stack while the address selector or Edit Cart opens, preserving local choices. Cart navigates to the existing Checkout route when present, unwinding that edit rather than duplicating review screens. Payment replaces itself with Confirmation after successful durable completion. Returning to an already finalized attempt shows its saved order rather than another Pay action. The reusable `useScreenActive` focus guard prevents late asynchronous navigation after Back, blur or unmount, including covered screens that native stacks keep mounted. No input fields/remounting keyboard workaround or native configuration change was added.

### PaymentAttempt lifecycle and compatibility

Storage key **`plazza.payments.v1`**: `{ version: 1, current: PaymentAttempt | null }`.

The attempt contains `version`, stable `id`, immutable reviewed `order` (without final payment metadata), `method`, deterministic `scenario`, `status`, `updatedAt` and `finalized`. Its order holds the actual order/checkout IDs, original checkout confirmation timestamp, item prices/totals/coupon, address and optional `deliveryPreference`. That client timestamp stays unchanged during pending verification, retry and restart; it is not the later disk-commit time or a bank timestamp.

| State | Meaning / permitted action |
| --- | --- |
| No record | Not started. Review checkout before creating an attempt. |
| `initiated` | Reviewed snapshot is durable; payment has not been submitted. Explicit Pay, COD confirmation, Check Status after interruption, or Cancel. |
| `pending` | Unknown/pending verification is durable. Only explicit Check Status resolves it; repeated Pay does not. Cancel is safe because there is no real gateway/transfer. |
| `succeeded`, `finalized: false` | Simulation succeeded or COD was confirmed. Reconcile the existing order intent; do not initiate another payment or claim a completed order. |
| `succeeded`, `finalized: true` | Receipt, shopping finalization and journal cleanup completed. Show confirmation/receipt; no second Pay. |
| `failed` / `cancelled` | Cart/coupon remain intact. An explicit review/new attempt receives new payment, checkout and order identities. Terminal outcomes cannot transition to a different outcome. |

The repository retains the latest attempt. Only deliberate creation after failed/cancelled/finalized status can replace it; historical final payment evidence remains frozen in its associated receipt. There is no standalone payment audit ledger, bank refund or refund simulation. Duplicate transitions return the existing outcome without writing again; different payloads for the same identity conflict. Old callback IDs cannot mutate a different current attempt.

Regular UPI defaults to deterministic `pending-success`: Pay persists pending, Check Status succeeds. In development only, Checkout exposes `success`, `pending-success`, `pending-failure`, `failure`, `cancel`. The scenario is chosen once and persisted, never randomized per render. COD requires an explicit **Confirm mock COD order** action. Simulator/repository/clock/identity injection makes failures and transitions reproducible in tests.

Orders stay `version: 1`, `status: placed`. Optional `payment` is `{ version: 1, attemptId, method: upi | cod, status: succeeded | cod-confirmed, simulated: true }`; optional `deliveryPreference` is `asap | scheduled`. Parsers copy/freeze and validate both fields. Existing orders without these fields show a legacy-metadata message and are never rewritten on read. Unknown payment metadata versions block history writes instead of silently dropping evidence. Existing `plazza.shopping.v1`, `plazza.orders.v1`, address data and old P2B-1 journals remain compatible. Downgrades to older writers that strip new optional fields are outside this guarantee.

### Connecting successful payment to the existing coordinator

The small coordinator addition is **`commit(reviewedOrder, lifecycle)`**. It accepts the already frozen identity/prices/address and reuses journal validation, the existing order repository, shopping finalization, idempotent publication and cleanup. It does not reprice or capture a new address. It checks receipt evidence when a matching checkpoint already exists; a missing receipt is not silently reconstructed. The old `begin`/provider `checkout` contract remains deprecated for baseline compatibility; new screens exclusively use the payment flow.

Normal persistent writes (skip source preparation when already identical):

1. Optional shopping preparation through the existing writer; drain earlier autosaves.
2. **Payment attempt initiated**, including the complete reviewed snapshot and stable identity. No order, redemption or cart clearing.
3. **Payment outcome**. Pending/failed/cancelled stop here; only succeeded continues.
4. **Checkout intent journal**, containing the same order plus immutable final payment metadata.
5. **Idempotent receipt** in `plazza.orders.v1`.
6. **Shopping finalization** in one existing-writer value: cart/coupon clearing, FIRST100 set-union and checkpoint.
7. Publish the persisted result through `checkout-finalized`, with the saved-key guard suppressing a duplicate autosave.
8. **Cleared checkout journal**.
9. **Payment finalized marker**; only then return a completed flow result/navigation to Confirmation.

If step 9 fails, payment already succeeded but the flow remains in reconciliation. Retry verifies/reuses the same receipt/checkpoint and cannot clear another cart or redeem again. Locks cover the entire service operation, including gaps between coordinator completion and payment completion. Duplicate taps are blocked synchronously, and queues are shared by storage-port object. Recovery waits behind invalidated in-flight operations rather than starting a competing writer. Lifecycle guards prevent the next persistence phase or React/navigation publication after unmount/scope invalidation; an in-flight native write itself cannot be cancelled.

### Startup recovery and failure guarantees

Read/validate the payment record **before** running checkout recovery, catalog-dependent shopping hydration or initial autosave.

- Initiated/pending attempts: validate healthy history/shopping and matching raw source cart/coupon; retain the lock and show the saved attempt. Never run successful-order finalization. A contradictory checkout journal or receipt blocks recovery.
- Successful, unfinished attempt: verify matching journal if present, call `commit` with `paidOrder(attempt)`, then finalize the payment marker. Never rerun the simulator or reprice the review.
- Finalized attempt: verify matching immutable receipt and normal checkout/checkpoint evidence before allowing shopping.
- Failed/cancelled attempts: reject conflicting receipt/checkpoint/journal evidence; otherwise restore shopping without clearing/redeeming anything.
- No attempt: existing legacy P2B-1 journals without payment metadata still recover under their original contract. A paid journal without matching successful payment evidence blocks.
- Damaged/unsupported payment, journal, shopping or order data: retain bytes, block destructive work, expose error/retry. No silent journal discard, storage reset or automatic repair.

Tests inject interruption after initiated attempt, successful outcome, intent, receipt, shopping, cleanup and payment-completion writes, including committed writes whose acknowledgement rejects. Same-runtime uncertain creation keeps the attempted identity; a full process restart can recover only bytes actually persisted. Failure before any attempt commit cannot have produced an order or simulated transfer. The payment attempt remains durable evidence after the checkout journal clears, so a later payment-completion failure can still reconcile. No claim of multi-key atomicity or guaranteed protection against device/storage loss is made.

### Verification and remaining limits

All 342 P2B-1 baseline cases are retained. Existing provider tests now submit through the preserved provider contract rather than the removed Cart placement button; the missing-address disabled assertion moved to Checkout. New UI tests exercise the actual Cart → Checkout → Payment → Confirmation/Receipt routes and retain the durability/locking assertions.

The implementation adds no backend, real UPI/COD, live stock/zones/ETAs, Rx verification, tracking, Plus, Profile, Share, analytics or new dependencies. Latest-attempt local persistence is unencrypted and is not a payment ledger. A single app owner/shared port in one JS runtime and integrity of individual native writes remain assumptions; multi-process/device access, old writers, full disk loss and malicious payload tampering need a stronger backend/database contract. Irreparable corruption/conflicting evidence still requires explicit reconciliation; Retry does not repair it or provide a destructive reset. Device UI, force-stop recovery and native storage semantics remain unverified here.

Manual source review covers serialization, lifecycle/scope invalidation, duplicate callbacks, checkpoint/receipt evidence, exact-once coupon set-union, navigation after Back, safe legacy metadata, price/address immutability, and absence of competing order/shopping writers. Ponytail was not installed or available. Refer to [the complete P2 Android checklist](ORDERS_ANDROID_CHECKLIST.md) before claiming native runtime verification.

API references consulted: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/), [React Native scrolling](https://reactnative.dev/docs/scrollview).

### Complete P2 file manifest and actual verification

- Domain: `src/domain/checkoutReview.ts`, `payments.ts`, and the optional metadata extension in `orders.ts`.
- Persistence contracts/adapters: `src/repositories/PaymentRepository.ts`, `local/LocalPaymentRepository.ts`. Existing order/shopping adapters remain the owners of their keys.
- Coordination/state: `src/features/orders/ordering.ts`, `checkout.ts`, `usePaymentFlow.ts`, and `src/state/AppStateProvider.tsx`.
- Review/read/navigation hooks: `src/features/orders/useCheckoutReview.ts`, `useOrders.ts`, `src/hooks/useScreenActive.ts`.
- Screens: `src/features/orders/CheckoutScreen.tsx`, `PaymentScreen.tsx`, `OrderConfirmationScreen.tsx`, `OrderHistoryScreen.tsx`, `OrderDetailsScreen.tsx`.
- Shared presentation: `src/features/orders/OrderPage.tsx`, `AddressSummary.tsx`, `OrderItems.tsx`, `OrderReceipt.tsx`; existing `features/cart/BillSummary.tsx`, `CartScreen.tsx`, `features/home/HomeScreen.tsx`, `features/addresses/DeliveryAddressEntry.tsx`.
- Route aliases: `src/app/checkout.tsx`, `payment.tsx`, `order-confirmation.tsx`, `orders/index.tsx`, `orders/[id].tsx`.
- Tests: new `payments.test.ts`, `payment-repository.test.ts`, `ordering-integration.test.ts`, `ordering-ui.test.tsx`, `order-hooks.test.tsx`, `screen-active.test.tsx`, plus shared `payment-fixtures.ts`; existing `checkout-provider.test.tsx` retains its cases with the new submission/navigation boundary.
- Documentation: this file, `COMMERCE_MVP_ROADMAP.md`, `ORDERS_ANDROID_CHECKLIST.md`.

On 29 October 2026, `npm run typecheck`, `npm run lint`, `npm test`, `npm run check`, `npm run check:demo` and `npm run bundle:android` all exited successfully. **431 tests / 32 suites passed: all 342 baseline cases plus 89 new cases.** Lint has no errors or warnings. Demo preflight verifies the 15 original catalog records and unchanged debug/preview profiles; it warns that `adb devices` was unavailable/failed. Android export generated a 3.3 MB Hermes bundle (1,475 modules, 32 assets) in ignored `dist/`. The terminal's NO_COLOR/FORCE_COLOR warnings do not indicate a build failure.

The pre-existing `app.json` remains byte-for-byte unchanged and excluded from commits. No SDK/dependency changes, native project edits, APK/EAS build, push or physical-device verification were performed.
