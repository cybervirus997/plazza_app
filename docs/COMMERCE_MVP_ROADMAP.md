# Plazza Commerce MVP — Post-Submission Roadmap

Status: **Design proposal / implementation plan**, not a claim that these features are built.
Branch: `feat/plazza-commerce-mvp` (created from submitted `master`).
Keep `master` and existing take-home requirements, tests, routes, and business rules intact. Build incrementally and review generated code.

## Product objective

Demo an end-to-end Android, offline-first health/quick-commerce journey:
Discover -> Category/Search -> Cart/Offers/Plus -> Place mock order -> Order tracking -> Delivery -> Receipt/Feedback -> Order history. 
Everything except WhatsApp external sharing is simulated/local. No payments, real fulfillment, actual live GPS tracking, claims of real stock/ETAs, or user backend.

## Navigation & home screen

Bottom tabs: **Home | Cart | Share**. The Share tab opens an in-app share screen with a WhatsApp deep link, system-share and copy-link fallbacks; no automatic external navigation on tab selection. Profile icon in Home header; Orders accessible from Profile and active-order banner. Keep existing Browse screen accessible.

Home (single vertically scrolling list, horizontal strips nested only for categories/carousels):
1. safe-area location, demo delivery promise/ETA and active-order status banner (not misleading live delivery claim);
2. brand + Profile / permission status entry;
3. search input;
4. horizontally scrolling categories;
5. configured A/B promotional hero;
6. 'Popular nearby' cards;
7. 'Cold & cough', 'Pain relief', 'Daily wellness', 'Skin & hair', 'Baby care' shelves;
8. Plus membership callout and recent searches.

Use stable product cards, sensible loading/empty/image fallback, stock/mock labels, Rx badges, and safe-area spacing. Build sections from typed configuration, not hardcoded screen conditional branches.

## Catalog & assets

Preserve the original 15 medicine IDs and price/maxQty/rx rules. Add approximately 40-60 **clearly demo** items for healthcare / quick-commerce categories as a separate fixture with stable IDs. Product model can extend Medicine via adapter rather than breaking domain contracts: `Product { id, name, subtitle?, categoryIds, price, maxQty, rx, imageKey?, tags?, isAvailable }`.

Choose legitimately reusable/locally bundled or explicitly licensed imagery; do not scrape Plazza's product photos or misrepresent branded products. Prefer `expo-image` on SDK 58 for caching/placeholder/transitions. Stock and images have fallbacks. Start with local fixtures and a `CatalogRepository` interface; later implementation swaps in an API adapter.

## Orders & delivery

Add mock checkout, order history, detail/receipt, tracking and delivery-feedback screens.

Order snapshot includes `id, placedAt, items (id/name/qty/unitPrice), itemTotal, couponDiscount, deliveryBeforeMembership, membershipDeliverySavings, deliveryFeePaid, grandTotal, plusAtCheckout, status, mockEta, deliveryEvents, feedback?`. Prices/discounts on past receipts MUST remain frozen even when catalog or membership changes.

Mock status state machine: `placed -> confirmed -> packed -> out_for_delivery -> delivered`. A deterministic simulator/manual progression is preferable to background timers; clearly label tracking and ETA as **simulated**. Show stable progress/times even after restart. Allow feedback only after delivered and one response per order, with an edit rule documented. Add customer help: `tel:` with a confirmed support number only; otherwise use a clearly labelled demo help UI / copy support contact fallback. Never invent a real Plazza support phone.

Tracking map: begin with a stylized static route and markers from local demo coordinates; don't request continuous location or pretend to track a rider. A map SDK can be considered later if the demo needs pinch/zoom/interactivity.

## Plazza Plus (mock toggle)

Profile and/or Cart offers a local opt-in/opt-out toggle; do not charge or imply real subscription. Plus waives eligible delivery fee; preserve coupon compatibility. For an order calculate the delivery charge from item total, then apply FREEDEL and/or Plus. The two benefits **must not stack**. `plusSavingsThisOrder = baseDeliveryFee - finalDeliveryFee` ONLY if Plus is the reason delivery becomes free; with FREEDEL independently waiving delivery, attribute no extra savings to Plus. All paid amounts must be derived once by a pure pricing function. Don't persist bill totals except an immutable order receipt. Show 'saved with Plus' as the sum of attributable savings in completed/placed local mock orders, not estimated hypothetical savings, and label demo results.

## Offers and local A/B experiments

Local config models:
- `OfferConfig { id, slot, title, subtitle, imageKey, cta, eligibility?, priority, validFrom?, validTo? }`
- `ExperimentConfig { id, enabled, salt, variants:[{ id, weight, offerId }], audience? }`
- `Assignment { experimentId, variantId, assignedAt }`

Persist anonymous guest ID and stable assignment. Deterministic hash on guest ID + experiment ID + salt (no `Math.random()` per render). Overrides for debug QA in Profile/Developer Settings, without affecting standard users. Configurable remote adapter later; fail safe to a known control. Log exposures when a banner becomes visible, not at config load; log clicks and resulting mock purchases. Do not over-engineer statistical inference in the app: analyze exposures, click-through, and downstream orders later. Real pricing entitlements remain deterministic and separate from promotional banner experiments.

## UI events & permission audit

Create `Analytics.track(eventName, properties)` with a typed allowlisted schema, event id, event timestamp, session id, guest id (anonymous), screen, experiment/variant when relevant. Example event names: `screen_viewed`, `category_opened`, `product_viewed`, `add_to_cart`, `coupon_applied`, `offer_exposed`, `offer_clicked`, `plus_toggled`, `order_placed`, `order_status_viewed`, `feedback_submitted`, `share_initiated`, `permission_state_changed`.
- Do not store exact location, notification tokens, prescription/medical details, phone numbers, or message text in analytics.
- Permissions audit stores permission type, previous/current state, and timestamp; avoid logging repeated unchanged checks.
- In `AsyncStorage`, keep a versioned bounded queue (e.g. last 300-500 entries or capped bytes) and support clearing/exporting local logs in Developer Settings.
- Analytics failures never block UI, checkout or permission flows. No third-party upload until consent/privacy design exists.

## Architecture / data boundaries

```text
src/
  app/                   # Expo Router tabs + orders/profile/tracking routes
  features/
    home/                # composable home sections
    catalog/             # categories/search/listing
    cart/                # existing cart/coupon UI + plus
    offers/              # offer slots & experiment assignment
    membership/          # Plus toggle and savings
    orders/              # checkout, history, receipt, state machine
    tracking/            # simulated map & progress
    feedback/            # delivered-order feedback
    profile/
    share/
    developer/           # inspect experiments/events/permissions
  domain/                # pure pricing, eligibility, orders, experiments
  repositories/          # Catalog, Orders, Config, Analytics interfaces
    local/               # initial adapters
    api/                 # future API adapters (NOT built now)
  storage/               # versioned namespaces, migrations
  data/                  # original catalog + demo products/categories/offers
  components/ui/         # design system, overlays, bottom sheets, toast
  theme/
```

Maintain existing `ShoppingState` snapshot compatibility (currently `plazza.shopping.v1`). Prefer distinct versioned storage keys for orders/Plus/analytics/assignments to avoid accidental reset. Only migrate existing state in a tested, backwards-compatible way. Keep navigation/rendering separate from data and domain rules. Default to no new state library for this MVP.

## Keyboard / overlays / performance

Current `app.json` uses Android `softwareKeyboardLayoutMode: resize` and Cart uses Android `KeyboardAvoidingView` with `height`; test for double resizing/jumping. Try Expo's documented `pan` + tab-hide-on-keyboard pattern or scoped keyboard avoidance, verify on real Android. Use `KeyboardAwareScrollView`/`react-native-keyboard-controller` only if actually needed, with correct SDK-compatible installation and development build. Avoid keyboard-height JS state driving the entire Home list, nested vertical ScrollViews and remounting search on focus.

Use a single overlay provider for drawers/sheets/modals; support Android back, focus, accessibility, keyboard avoidance and safe area. Retain one vertical FlatList/FlashList for shelves when scaling, stable keys, controlled image sizes, memoize only after profiling. Prefer skeletons/placeholder imagery and visual continuity over extra animations.

## Prioritized delivery slices + acceptance

1. **Foundation** — branch, data model & repositories, category fixture, tests still green.
   - No change to submitted `master`; all original 15 medicines still searchable/cartable.
2. **Commerce Home** — horizontal categories, configured sections, images, new Share tab and Profile route.
   - Category filters correct; missing image fallback; search/cart work; tab bar sane with keyboard.
3. **Plus + pricing + offers** — mock toggle, cart bill, savings, stable A/B assignments and debug override.
   - No double savings with FREEDEL, deterministic variant, tests for pricing boundaries.
4. **Orders** — order snapshot, history, receipt, simulated ETA/status, feedback and help.
   - Receipt survives restarts and changing prices, status transitions valid, feedback gated on delivered.
5. **Analytics & UX polish** — event log, permission audit, developer viewer, overlays, keyboard/device testing.
   - Versioned bounded events, no PII, reproducible experiment assignments, Android back/keyboard.
6. **Verification** — typecheck/lint/tests/CI; build a standalone preview APK; real-device smoke video.
   - No test suite regressions. All simulated features labelled as demo.

## Critical demo checks

- Android 13+ permissions, Settings return flow, search name/salt, Rx badge and maxQty stay correct.
- 15 original medicines unaffected; multi-category items display and search.
- Place order with Plus on/off, FREEDEL and FLAT50; bill totals and saved amount correct.
- Restart after order -> intact history/receipt/Plus membership and experiment variant.
- Promote an order through each state -> tracking progress; mark delivered -> feedback.
- Share via WhatsApp if installed; graceful fallback if not.
- Offline, no images/permissions, slow Android keyboard open/close, Android back from overlay.
- Open Developer Settings -> inspect variant assignment and a bounded, non-sensitive event log.

## Suggested first Codex implementation boundary

Only implement **Slice 1 and Slice 2** at first. Inspect/reuse existing code before changing anything. Keep all existing tests, write new tests for category filtering and home section config, run `npm run check`. Do not refactor coupon/bill or add a map SDK in this first slice. Commit incremental logical units; leave a short change summary and trade-offs in documentation.
