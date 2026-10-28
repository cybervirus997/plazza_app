# P2A — Immutable mock-order foundation

Implemented on `feat/plazza-commerce-mvp`. P2A adds pure receipt creation and an injectable local repository. **The current Cart button/reducer still clears the cart and redeems the active one-time coupon immediately; it is unchanged and does not use this repository.** Durable checkout and history UI belong to P2B.

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
- `src/repositories/local/LocalOrderRepository.ts`: `createLocalOrderRepository(storage: StoragePort)`. Pass the existing AsyncStorage-compatible port at the future composition boundary; P2A adds no provider, UI wiring, database or package.
- Storage key: **`plazza.orders.v1`**. Envelope: `{ version: 1, orders: Order[] }`.
- `load()` returns `{ orders, warning, canWrite }` in insertion order (oldest insertion first). `canWrite` describes schema/recovery readiness, not a guarantee that the next device write will succeed.
- `getById()` returns a frozen order or null for a missing ID in a healthy history. It throws on unreadable/unsupported/damaged history, preventing an ambiguous lookup from being interpreted as authoritative absence.
- `create()` returns `{ order, created }`. It validates/copies before enqueueing and appends only after reading current persisted history. There is no update/delete operation for historical receipts.

Reads and writes are serialized, including across adapters sharing the **same port object in one JS runtime**. The queue survives rejected operations without poisoning later retries. There is no stale in-memory history cache. This is not a cross-process lock or a compare-and-swap API: use a shared port/single application owner, not separate wrappers or independent writers to the same key.

### Idempotency and failure behavior

An identical canonical receipt with an existing `checkoutId` returns the persisted order with `created: false`, without appending/reordering/writing. Any payload difference, including order ID or placement time, raises `OrderConflictError`. Reusing an order ID for a different checkout also conflicts. Persist the original full intent in P2B so retries do not generate fresh IDs/time or reprice the receipt.

If a write rejects, it may or may not have committed. The repository does not compensate by deleting or overwriting a receipt: retry the **same** intent. If the original write actually committed but its acknowledgement was lost, the retry finds that order and returns it once. A successful promise is a platform acknowledgement, not a guarantee against subsequent device/storage loss.

Only a missing key (`null`) is a healthy empty history. Invalid JSON/envelopes report a warning and `canWrite: false`; mixed histories expose readable receipts with a warning while retaining the original bytes. Invalid records and duplicate order/checkout IDs block all creates and authoritative lookups. Unsupported envelope versions throw `UnsupportedOrderVersionError`. Reads never write; creates never silently repair, prune, reset or overwrite damaged/unsupported history, because that could erase receipts or idempotency evidence. Recovery after ordinary I/O failure is a retry; irreparable corruption needs explicit recovery/repair outside P2A. There is no automatic backup or repair UI in this slice.

Receipt/address data stays in local, unencrypted storage. No order payloads are logged or sent to analytics. A historical receipt owns its address copy even if the saved address is later edited/deleted. Retention/export/erasure policy and server identity are future concerns; no server/payment guarantees are claimed.

## P2B reliability choice — immutable intent plus shopping checkpoint

AsyncStorage has no multi-key transactions. Saving `plazza.orders.v1` and then writing `plazza.shopping.v1` is **not atomic**, even when awaited or grouped in `multiSet`.

| Option | Assessment |
| --- | --- |
| Save order, then call today's `place-order` | Small, but a crash can leave a receipt with an uncleared cart/unredeemed coupon; retry has no durable identity. Reject. |
| Move cart, coupon state and history into one new aggregate key | Larger migration, competes with the current shopping writer and risks `plazza.shopping.v1` compatibility. Reject for P2B. |
| Durable checkout intent plus an idempotent shopping checkpoint | Adds one small recovery document and one optional shopping metadata field, keeps the existing cart store and gives deterministic retry. **Chosen proposal.** |

Proposed `plazza.checkout.v1`: `{ version: 1, pending: { order: Order, oneTimeCouponCode: string | null } | null }`. It is a frozen confirmed intent, **not another active/editable cart**. The receipt already contains product IDs/quantities and coupon code for exact source-cart comparison; do not persist a second live cart. `oneTimeCouponCode` captures the redemption obligation once, without applying later promotion rules during recovery. No redundant phase flags are needed: the order and shopping checkpoint determine progress.

Keep `plazza.shopping.v1` and its current fields. Add optional `lastFinalizedCheckoutId` metadata, defaulting to null for old snapshots, and preserve it on every subsequent shopping write. Existing payloads remain readable. Older binaries do not understand/preserve this metadata or the intent journal; mixed-version writers/downgrades during unfinished checkout are outside the recovery guarantee.

### Exact P2B implementation sequence

1. **Add startup recovery before shopping hydration/autosave and checkout input.** Use one coordinator and the existing shopping store/writer. Block a second checkout and cart/coupon/address changes during an unresolved intent. Allow read-only browsing; expose retry/recovery failures instead of pretending checkout completed.
2. **Capture one confirmed intent.** Drain outstanding shopping writes, await `AddressBookProvider.snapshotForOrder()`, validate a non-null address, and freeze current cart/products/bill/coupon using `createOrderDraft`. Generate and retain order ID, checkout ID and placement time once. Record the one-time coupon obligation without redeeming it. Persist the intent before attempting order creation. An uncertain intent write must be reread/retried, not replaced with a new checkout identity.
3. **Persist the order/address receipt together in the orders value.** Call `OrderRepository.create(intent.order)`; both `created: true` and an identical `created: false` count as the same confirmed receipt. Conflicts or damaged history block further finalization. Never re-run live pricing or address lookup for an existing pending intent.
4. **Finalize shopping through its existing serialized writer.** Verify the raw persisted cart ID/quantity pairs and active coupon match the intent, unless its checkpoint already matches. In one `plazza.shopping.v1` value write, clear that cart/active coupon, set-union the captured one-time coupon into used codes and set `lastFinalizedCheckoutId`. Preserve recent searches and other used codes. Drain/coordinate autosaves so a late pre-checkout write cannot restore the old cart. No second cart store and no separate coupon-redemption write.
5. **Publish the persisted result.** Only after that shopping write succeeds, use a new idempotent reducer action to publish the committed shopping snapshot and success notice. Do not reuse today's immediate `place-order` action before durability; never display a successful durable checkout or clear the visible cart solely because the order write succeeded.
6. **Clear the journal last.** Write `{ version: 1, pending: null }`, then unlock the next checkout. Cleanup failure must not roll back either committed value; show pending cleanup and retry. Keep the shopping checkpoint even after cleanup so a stale intent cannot clear a later cart.
7. **On restart, reconcile before normal state restoration.** Validate the pending journal. Idempotently ensure its order exists. If the shopping checkpoint matches, retain current shopping contents and only finish cleanup—do not clear/redeem again. Otherwise compare raw persisted cart/coupon with the intent and perform step 4. Perform this comparison before catalog-dependent quantity clamping or coupon revalidation, which could otherwise hide the original intent after an app/catalog change. If the cart differs, or any data/schema is damaged/unsupported, block destructive recovery and require explicit reconciliation; never clear an unrelated/new cart.

Planned P2B code boundaries (not implemented here):

| File | Change |
| --- | --- |
| New `src/features/orders/checkout.ts` | Single checkout/recovery coordinator and immutable intent journal; use the P2A repository |
| `src/storage/persistence.ts` | Preserve optional checkpoint metadata in v1; expose queue draining and one-value shopping finalization through the existing writer |
| `src/state/appReducer.ts` / `AppStateProvider.tsx` | Add idempotent `checkout-finalized` publication; recover before hydration/autosave; enforce the checkout mutation gate |
| `src/features/cart/CartScreen.tsx` | Call the coordinator, retain cart on failure, and show pending/retry states instead of dispatching immediate `place-order` |
| New checkout-recovery tests plus persistence/reducer/Cart tests | Inject each crash/acknowledgement failure below; verify exactly one receipt, checkpoint-aware cart retention and one-time coupon set-union |

### Required P2B crash/retry tests

| Crash/failure point | Expected recovery |
| --- | --- |
| Before a confirmed intent is stored | No order/finalization; persisted cart and coupon untouched |
| After intent, before order write | Recreate from the exact intent, then finalize shopping |
| After order commit / lost order acknowledgement | Identical create returns the same receipt; finalize once |
| Before/after shopping write or its lost acknowledgement | Read checkpoint; retry the whole shopping value only if not finalized |
| After shopping commit, before journal cleanup | Matching checkpoint prevents duplicate redemption and re-clearing |
| Cleanup failure or duplicate taps | Same intent, no second order; preserve checkpoint and retry cleanup |
| Later cart differs from an old intent | Matching checkpoint means cleanup only; absent/mismatching checkpoint means block, never wipe that cart |
| Catalog, address or coupon rules changed after capture | Recover the stored receipt; never rebuild/reprice from live sources |
| Corrupt/unsupported journal, shopping or order history | Visible recovery state; no silent reset or destructive write |

The proposal is recoverable coordination, not a claim that separate storage writes are atomic. Process crashes, full device storage loss, native write semantics and old/concurrent writers limit guarantees. A future backend/database transaction would be needed for stronger multi-device durability or real payments.

## Verification and review

On 29 October 2026, `npm run typecheck`, `npm run lint`, `npm test` and `npm run check` all passed: **299 tests / 24 suites**, including all 237 baseline cases and 62 new order cases. P2A tests cover receipt validity, empty/missing-address rejection, sparse arrays, item/price/address immutability, quantity and money bounds, current pricing semantics, historical restoration without live dependencies, persistence/restart, idempotency/conflicts, shared-port serialization, mutation while queued, write failure/retry/lost acknowledgements, corrupt records/envelopes, unsupported versions and isolation from FIRST100/shopping/address persistence.

Ponytail was not installed (no CLI, dependency or enabled tool); a manual source/diff review was used. Review fixes included explicit copying of Bill fields so extra properties cannot override receipt identity/items, safe aggregate quantity validation, dense item validation so sparse arrays cannot bypass empty-cart checks, and repository-level public error types that future adapters can reuse. Final command results and commit hashes are reported with the implementation. P2A does not change application UI or native APIs, start EAS builds, push commits, implement Plus/tracking/maps/payments, or claim device verification.
