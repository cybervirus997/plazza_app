# Plazza codebase map

Local source is authoritative. Read AGENTS.md and ENGINEERING_STANDARDS.md; recovery details live in ORDERS_DESIGN.md.

## Routes and owners

| Route | Screen / owner |
| --- | --- |
| `(tabs)/index`, `(tabs)/cart` | `features/home/HomeScreen`, `features/cart/CartScreen` |
| `browse` | `features/search/BrowseScreen` |
| `addresses`, `address-form` | `features/addresses/AddressBookScreen`, `AddressFormScreen` |
| `checkout`, `payment`, `order-confirmation` | Corresponding `features/orders/*Screen` |
| `orders/index`, `orders/[id]` | `OrderHistoryScreen`, `OrderDetailsScreen` |
| `care`, `care/recipient`, `care/plan`, `care/review` | `features/care`: list, recipient/plan forms and current-catalog review |
| `tracking` | `features/tracking/TrackingScreen`, useOrderTracking, TrackingTimeline, DemoRouteMap |
| `app-permissions`, `scan-medicine` | `features/permissions/AppPermissionsScreen`, `features/scan/ScanDemoScreen` |

`app/_layout` composes providers and the hydrated native stack; tabs are in `components/app-tabs`. Routes are thin exports.

## Feature, domain and persistence ownership

| Feature | View / hooks | Pure rules | Repository / adapter |
| --- | --- | --- | --- |
| Home/search/catalog | HomeHeader, MedicineSearchBar, HomeSection, CategoryStrip, useMedicineSearch | domain/search, features/catalog/products, home/sections | CatalogRepository / LocalCatalogRepository |
| Cart/coupons | CartScreen, CouponSection, BillSummary, QuantityControl | domain/cart, coupons, bill | Existing shopping writer only |
| Addresses | AddressBookProvider, DeliveryAddressEntry, useAddressLocation | domain/addresses | AddressRepository / LocalAddressRepository |
| Permissions | PermissionProvider, PermissionPanel | permissions adapter handles guarded native calls | OS status, no saved-address ownership |
| Checkout/payment | CheckoutPreferences, useCheckoutReview, usePaymentFlow | domain/checkoutReview, payments, orders | PaymentRepository / LocalPaymentRepository; feature ordering service |
| Receipts | useOrders, OrderIdentity, OrderHistoryCard, OrderItems | orders snapshots; orderPresentation/statusPresentation are view transforms | OrderRepository / LocalOrderRepository |

## Current storage keys

| Key | Schema / owner |
| --- | --- |
| `plazza.shopping.v1` | v1 cart/coupon/recents/checkpoint; storage/persistence |
| `plazza.addresses.v1` | v1 independent address book; LocalAddressRepository |
| `plazza.payments.v1` | v1 latest durable attempt; LocalPaymentRepository |
| `plazza.checkout.v1` | v1 immutable pending intent; features/orders/checkout |
| `plazza.care.v1` | v1 independent recipient/plan records, revision guards; LocalCarePlanRepository |
| `plazza.reminders.v1` | v1 native reminder identifier ledger; care/reminders |
| `plazza.tracking.v1` | v1 independent immutable tracking-event records; LocalTrackingRepository |
| `plazza.orders.v1` | v1 immutable receipts; LocalOrderRepository |

## Critical recovery boundary

`AppStateProvider` recovers before hydration/autosave. `ordering.ts` persists reviewed attempt/outcome and delegates to `checkout.ts`; the latter owns journal → receipt → shopping checkpoint/FIRST100 → journal cleanup. Payment finalized marker comes last. No screen creates orders or writes shopping storage. Missing keys differ from corruption; unknown versions/conflicts block writes. Receipts never change to represent fulfillment progress. See ORDERS_DESIGN.md for exact sequencing and crash windows.

## Shared presentation and navigation

`theme/tokens` is the single palette/type/space/control source. UI primitives: Button, IconButton, QuantityControl, StatusPanel/Badge, NoticeBanner. ProductImage provides local image/fallback. `commerceNavigation` owns forward/pop/tab-return intent and reduced-motion options; `headerOptions` owns native Back slots and content edges. `useScreenCompletion` rejects stale focus visits. Android uses native resize; no second keyboard height adjustment.

## Tests to reach for

| Area | Tests |
| --- | --- |
| Cart/catalog/search | cart*, bill, coupons, demo-ui, browse-ui, search*, commerce-catalog |
| Addresses/permissions | address*, permissions, permission-provider, expo-go-permissions, home-ux |
| Checkout/payment durability | checkout-recovery, checkout-provider, ordering-integration, payment-repository, ordering-ui |
| Immutable receipts | orders, order-repository, order-hooks, order-presentation |
| Navigation | commerce-navigation, navigation-layout, screen-active, reduced-motion |

## Planned independent owners — master implementation

Tracking implemented: `domain/tracking`, TrackingRepository/local adapter, `features/tracking`; separate versioned event history linked by orderId, never receipt edits. Tracking tests cover ordering, idempotency, corruption, restart, lost acknowledgements and eligibility; tracking-ui verifies recovery/unknown/Rx/map semantics. `storage/versionedRecords` serializes independent single-key feature writes and fails closed; it is never a shopping writer.

Family Care implemented: `domain/carePlans`, CarePlanRepository/local adapter, `features/care`; independent recipients/plans and reminder reconciliation. A proposal enters the one shopping reducer only after explicit review/cart-collision choice. Native reminders never order/pay. `careRecurrence` handles wall-clock timezone/DST/month-end anchors. `careCart` and the existing reducer validate an explicit merge/replace against the expected cart; the existing writer alone persists it. `CareProvider` reconciles OS identifiers on startup/foreground and plan changes without prompting. Due dates remain usable if scheduling fails or is denied. Care tests cover recurrence, repositories, proposal UI/locks, native best-effort/privacy and reminder recovery.

Mock AutoPay: independent versioned preview model linked to a care plan; explicit opt-in, no credentials, mandate registration, payment or order creation.
