# Stage 1: Catalog Expansion and Commerce Home

Implemented on `feat/plazza-commerce-mvp`. This stage keeps Home/Cart tabs, Browse, permissions, coupons, billing and mock checkout. Share/Profile, membership, experiments, analytics, orders, tracking, authentication and payments remain outside this implementation.

## Catalog and data boundary

- `src/data/catalog.json` is unchanged: all 15 supplied medicine IDs, names, salts, prices, prescription flags and limits survive the adapter. These are still **PDF-derived temporary records**; the missing original assignment catalog remains required as documented in `NOTES.md`.
- `src/data/demo-products.json` supplies 42 additional, explicitly labelled demo essentials. Stable `demo-` IDs cannot collide with medicine IDs. Eight categories include cross-category medicine membership. Prices, availability and illustrations are illustrative, not live stock or medical claims.
- `Product` extends the existing `Medicine` contract. For non-medicines, `salt` holds the pack/variant description so the existing name/salt search and cart can be reused. `subtitle`, category IDs, image key, tags and availability provide commerce metadata without changing persisted cart entries.
- `CatalogRepository` exposes asynchronous `load` and `search` methods. The local adapter validates and combines both fixtures. Home searches through that interface; Browse filters the loaded repository snapshot with the same pure filter. No screen imports product fixtures. A later API adapter can be injected into `AppStateProvider`.
- The provider loads the catalog before restoring `plazza.shopping.v1`; no storage migration is needed. Loading or failed catalog reads cannot overwrite a saved cart. A missing required medicine catalog fails the entire catalog rather than quietly serving only extra demo products.

## Home and imagery

`features/home/HomeScreen.tsx` keeps the original search, recent searches, permission panel and notices. One vertical FlatList renders typed section configuration from `sections.ts`; only categories and product shelves scroll horizontally. `CategoryStrip` and `HomeSection` own category navigation, the optional static promotional slot and product shelves. Configuration controls order, categories, curated IDs and limits, and can omit the banner entirely. No experiment or coupon entitlement logic was added.

Shared `MedicineCard`/`QuantityControl` still handle additions and limits across Home, Browse and Cart. Category links route to the existing Browse screen and combine with its name/ingredient filter. Missing/failed artwork retains a local fallback; catalog/search loading, unavailable, empty and no-match states remain explicit.

SDK-compatible `expo-image` renders five original bundled SVG illustrations with fixed dimensions and transitions. These are generic category illustrations, not product photographs or exact packaging. Provenance is recorded in `assets/products/README.md`. No remote image request is required. Existing custom development clients must be rebuilt to include the added native image module; Expo Go includes it.

## Verification (28 October 2026)

- `npm run check`: **161 tests / 18 suites passed**, strict TypeScript and ESLint passed. Early failures were a missing test helper import (corrected to exercise the actual snapshot store), then UI expectations for the old 15-item catalog and single medicine preview (updated for 57 items and shared category shelves).
- New tests cover fixture validation, preservation of original records, category intersections, unknown categories, section order/limits/curated selections, invalid configuration, v1 persistence, missing-catalog rejection, routed category/search behavior, demo cart limits, catalog loading/empty states and image decoding fallback.
- `npm run bundle:android`: Android Hermes export passed and includes all five SVG assets. This is a JavaScript export, not an APK or a device test.
- `npm run check:demo` and `npm run prepare:catalog -- --required`: passed.
- Online `npx expo install --check`: reports 12 newer SDK 58 patch versions for existing packages (including Expo, Router, location and notifications). `expo-image` is not flagged. Existing packages were not broadly upgraded in this feature slice; dependency alignment remains a follow-up.

Real Android/iOS rendering, image decoding, scrolling, keyboard behavior, TalkBack/font scaling, native permissions and force-close restoration still require device checks. No EAS build was started for this stage, and previous APKs do not contain these changes. The current fixtures are small, static and entirely local; no live inventory, API implementation or delivery service exists.
