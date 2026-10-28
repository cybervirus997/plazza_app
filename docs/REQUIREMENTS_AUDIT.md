# Plazza requirements audit

Audit date: 28 October 2026. This audit uses the complete checklist in the user's pasted assignment/request. No `Frontend_Take_Home.pdf` was found in the repository, so no unseen PDF wording is treated as verified.

The application keeps Expo SDK 58, React Native 0.88, Expo Router, Context/useReducer, AsyncStorage, and the local JSON catalog. The supplied 15-record catalog is a **PDF-derived temporary demo substitute**. It is not the original attached assignment catalog.

## Status and evidence scope

- **VERIFIED** — supported by the stated source inspection and executed deterministic tests or local command. This does not imply device verification.
- **IMPLEMENTED-NOT-DEVICE-TESTED** — native/device-dependent behavior is implemented, with any mocked test evidence stated separately. Actual Android behavior is unverified.
- **MISSING** — the required deliverable or input is absent.
- **FAILING** — a current check reproduces failure.
- **BLOCKED** — verification cannot finish without the stated external input or deferred work.

Fresh final audit evidence: `npm run check` passed with **144 tests across 16 suites**, zero failures, clean strict TypeScript, and clean lint. This includes existing domain/persistence/native-mock regressions and the new Home, Browse, cart-feedback, and search-race tests. Historical completion claims in README/NOTES are not substituted for this run. The audit agent also separately executed the 123-test/12-suite non-UI baseline successfully before the UX changes settled.

Checklist totals: **67 requirements — 50 VERIFIED, 14 IMPLEMENTED-NOT-DEVICE-TESTED, 2 BLOCKED, 1 MISSING, 0 FAILING.** The blocked/missing items concern original-catalog fidelity/provision and the deferred APK deliverable.

Native builds, signing, EAS execution, and physical Android verification are explicitly deferred by the user in this pass. No APK or hardware success is claimed.

## Mandatory 1 — native permissions

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| First-launch foreground location request | IMPLEMENTED-NOT-DEVICE-TESTED | `src/features/permissions/permissions.ts`, `PermissionProvider.tsx` | `tests/permissions.test.ts` verifies initial undetermined requests and no repeat automatic prompts for denied responses. Verify the actual first-launch OS prompt on a custom APK/device. |
| First-launch notification permission request | IMPLEMENTED-NOT-DEVICE-TESTED | `permissions.ts`, `app.json` | Mocked tests verify channel creation before permission request in a custom build. Android Expo Go deliberately skips the unsupported notification package; verify native prompts in a completed custom APK. |
| Granted state | IMPLEMENTED-NOT-DEVICE-TESTED | `permissionStatus`, `notificationStatus`, `PermissionPanel.tsx` | Mocked granted mapping and refreshed granted statuses pass; actual OS response/UI requires hardware. |
| Denied state | IMPLEMENTED-NOT-DEVICE-TESTED | `permissions.ts`, `PermissionPanel.tsx` | Denied mapping and request handling covered by permission tests; verify both OS denial flows. Shopping remains available. |
| Blocked state | IMPLEMENTED-NOT-DEVICE-TESTED | `permissionStatus`, `PermissionPanel.tsx` | Tests use `canAskAgain: false`; code does not infer blocking from denial counts. True permanently denied behavior still needs Android verification. |
| Blocked rationale | IMPLEMENTED-NOT-DEVICE-TESTED | `PermissionPanel.tsx`, `permissions.ts` | Source shows a blocked explanation and continued-shopping fallback. Confirm wording, wrapping, and TalkBack on the device. |
| Deep link to OS App Settings | IMPLEMENTED-NOT-DEVICE-TESTED | `PermissionProvider.tsx` | `Linking.openSettings()` is wired to the blocked-state action, with a failure explanation. An actual OS Settings round trip is not verified. |
| Refresh permissions on app foreground | IMPLEMENTED-NOT-DEVICE-TESTED | `PermissionProvider.tsx` | AppState foreground listener invokes refresh; overlapping work queues a refresh. Permission read tests verify refresh without requesting again, but do not exercise a real Settings/app lifecycle transition. |
| Home permission debug banner | IMPLEMENTED-NOT-DEVICE-TESTED | `PermissionPanel.tsx`, `HomeScreen.tsx` | The status panel is composed into Home; device state changes, layout, and accessibility remain unverified on hardware. |
| Generic delivery latitude/longitude text | IMPLEMENTED-NOT-DEVICE-TESTED | `permissions.ts`, `DeliveryLocation` | Tests verify formatting real response coordinates to four decimal places and meaningful GPS/timeout fallbacks. Actual positioning requires hardware; no geocoding or tracking is added. |

## Mandatory 2 — medicine search

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| Exactly Home and Cart bottom tabs | VERIFIED | `src/components/app-tabs.tsx`, `src/app/(tabs)/_layout.tsx` | Source declares exactly `index` and `cart`. Browse is a separate root-stack route, not a third tab. Native navigation transitions remain device work. |
| Search name and salt fields | VERIFIED | `src/domain/search.ts`, `src/data/catalog.ts` | `tests/search.test.ts` and `tests/demo-catalog.test.ts` pass for partial name/salt matching, case, and whitespace across all 15 demo records. |
| Search empty state | VERIFIED | `HomeScreen.tsx`, `useMedicineSearch.ts` | Search-hook tests verify initial/whitespace idle state; `tests/demo-ui.test.tsx` verifies real catalog previews and Browse access without typing, plus clearing back to discovery. |
| Search loading state | VERIFIED | `useMedicineSearch.ts`, `HomeScreen.tsx` | `tests/search-hook.test.tsx` verifies a single 150ms debounce and loading during new work; Home autocomplete test checks the rendered loading message. No fake network request exists. |
| Search no-results state | VERIFIED | `search.ts`, `HomeScreen.tsx` | Domain and hook no-match tests pass; Home renderer verifies the helpful no-results state, no View All action for zero matches, and clear-to-discovery behavior. |
| Search result list | VERIFIED | `HomeScreen.tsx`, `MedicineCard.tsx` | Stable-ID FlatList uses the canonical filter. Home renderer verifies named/salt results and committed/full-result modes; stale-response hook tests pass. |
| Add-to-Cart from results | VERIFIED | `MedicineCard.tsx`, `QuantityControl.tsx`, `appReducer.ts` | Real-catalog tests cover every ID; Home renderer presses Add/increment and verifies actual shared reducer/provider quantities on Home and Cart. |
| Recent searches maximum 5 | VERIFIED | `addRecentSearch`, reducer `search` action | `tests/search.test.ts` verifies newest-first cap, blank handling, and case-insensitive deduplication/move-to-front. |
| Recent searches persistence | IMPLEMENTED-NOT-DEVICE-TESTED | `AppStateProvider.tsx`, `storage/persistence.ts` | Snapshot restoration/deduplication tests pass. AsyncStorage force-close/restart durability requires a device check. |

## User-requested discovery improvements

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| Autocomplete medicine suggestions | VERIFIED | `HomeScreen.tsx`, `useMedicineSearch.ts` | Home renderer verifies typed partial queries, loading, and a maximum of 6 selectable suggestions. Seven hook tests verify cancellation, races, clear, no-match, error, and retry behavior. |
| Suggestions include name/salt | VERIFIED | `HomeScreen.tsx`, `MedicineCard.tsx` | Shared cards display actual name, salt, price, and conditional Rx label. Renderer locates `Show Dolo 650, Paracetamol, ₹30`; catalog/Rx card rendering is checked in Home/Browse tests. |
| Suggestions can be selected | VERIFIED | `HomeScreen.tsx`, `MedicineCard.onSelect` | Home renderer presses a Dolo suggestion, verifies the selected medicine, and checks persisted history contains only the committed medicine name. Typing does not record history; tapping a recent query reruns it. |
| View all matching results | VERIFIED | `HomeScreen.tsx`, `src/app/browse.tsx`, `BrowseScreen.tsx` | Home renderer verifies routed canonical query `para`; Browse renderer verifies routed name/salt filtering and all matches. Keyboard submission commits the same filtering behavior. Actual native navigation remains bounded by device deferral. |
| Browse all medicines screen | VERIFIED | `src/app/browse.tsx`, `BrowseScreen.tsx` | Four Browse renderer tests verify the 15-record count, every entry via filtering, card fields/Rx/Add, maxQty disablement, routed filtering, no-results, clear, back/Home fallback, and explicit catalog-error behavior. It is a root-stack screen rather than a third tab. |
| Browse without typing | VERIFIED | `HomeScreen.tsx`, `BrowseScreen.tsx` | Home renderer verifies a real-catalog preview and Browse CTA without writing a recent search; Browse renderer verifies the unfiltered 15-record catalog is its initial data source. |
| Search and Browse share the catalog/search logic | VERIFIED | `searchMedicines`, `searchCatalog`, `BrowseScreen.tsx`, `catalogData` | Source inspection shows one canonical `searchMedicines` function and one catalog loader; Browse does not add a repository or independent cart state. |
| Quantity updates synchronize across screens | VERIFIED | `AppStateProvider.tsx`, shared `MedicineCard` / `QuantityControl` | A renderer integration mounts actual Home, Browse, and Cart under the same actual provider, presses Add/increment, and verifies all three quantity labels update together. Native surfaces are mocked. |

## Mandatory 3 — cart

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| Add medicine | VERIFIED | `src/domain/cart.ts`, reducer, `QuantityControl` | Cart tests plus all-15 demo catalog tests pass for ID-based addition and metadata resolution. |
| Increment quantity | VERIFIED | `addMedicine` / `increaseQuantity`, reducer | Immutable increment tests pass; repeated additions/increments enforce catalog limits. |
| Decrement quantity | VERIFIED | `decreaseQuantity`, reducer | Tests verify decrement and removing an entry when decreasing from one. |
| Remove item | VERIFIED | `removeMedicine`, `MedicineCard` | Tests verify only the requested item is removed; Cart exposes a labelled Remove action. |
| Enforce maxQty | VERIFIED | `addMedicine`, `QuantityControl` | Boundary and 100-tap tests pass; all 15 supplied limits are tested. Disabled UI complements, rather than replaces, the domain invariant. |
| Rx badge in results | VERIFIED | `MedicineCard.tsx` | Shared card conditionally renders the Rx label for true catalog flags. Current catalog has 3 Rx records; Home/Browse renderer tests check the visible label. Accuracy against the original file remains blocked separately. |
| Rx badge in cart | VERIFIED | `CartScreen.tsx`, `MedicineCard.tsx` | Cart reuses the same Rx-aware card with unmodified catalog metadata. The field/condition is inspected; visual/device appearance remains outside deterministic test scope. |
| Cart persistence | IMPLEMENTED-NOT-DEVICE-TESTED | `AppStateProvider.tsx`, `storage/persistence.ts` | Port-based tests verify restoration, sanitization, sequential writes, and failure recovery. Actual AsyncStorage restart behavior requires hardware. |
| Item Total | VERIFIED | `getItemTotal`, `calculateBill`, `BillSummary` | Billing tests pass; integer paise are summed from catalog prices/quantities. UI renders the derived amount. |
| Discount | VERIFIED | `evaluateCoupon`, `calculateBill`, `BillSummary` | Percentage, flat, capped, invalid-coupon, and clamping tests pass. |
| Delivery Fee | VERIFIED | `calculateBill`, `BillSummary` | Empty/zero-priced carts, ₹498, ₹499, ₹500, and FREEDEL cases pass. |
| Grand Total | VERIFIED | `calculateBill`, `BillSummary` | Tests verify pre-delivery percentage base, fractional-price rounding, and nonnegative total. |
| ₹40 delivery when item total < ₹499 | VERIFIED | `calculateBill` | ₹498 test passes. Applies to positive nonempty item totals; empty/zero-valued carts explicitly have zero delivery. Threshold uses pre-discount item total. |
| Free delivery when item total >= ₹499 | VERIFIED | `calculateBill` | ₹499/₹500 tests pass, including post-discount total falling below the threshold. |
| Place Order clears cart | VERIFIED | reducer `place-order`, `CartScreen` | Reducer tests confirm cart and active code clear; empty orders are a no-op. Native success Alert is mocked, not device-tested. |
| Place Order records one-time coupon use | VERIFIED | reducer `place-order`, registry-driven `redeemCoupon` | FIRST100 is recorded only after a nonempty successful mock order, never on application. Order/restart/reuse rejection test passes. |

## Mandatory 3 — coupons

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| Only one active coupon | VERIFIED | `ShoppingState.activeCouponCode`, reducer | Replacement by another valid code and preservation on an invalid attempt pass. |
| FLAT50 rules | VERIFIED | `couponRules` | ₹299 rejection and ₹300 acceptance with ₹50 discount pass. |
| SAVE10 rules | VERIFIED | `couponRules`, `calculateBill` | 10% of item total tests pass. Nearest-whole-rupee percentage rounding is documented in NOTES. |
| SAVE10 maximum ₹100 | VERIFIED | `couponRules` | ₹2,000 item-total case caps at ₹100. |
| FREEDEL rules | VERIFIED | delivery-waiver coupon result, `calculateBill` | ₹40 waiver affects only delivery; validity on an already free-delivery cart is tested. |
| FIRST100 minimum ₹200 | VERIFIED | `couponRules` | Below-₹200 rejection and exactly-₹200 acceptance pass. |
| FIRST100 one-time redemption | VERIFIED | `redeemCoupon`, reducer, persisted `usedCouponCodes` | Apply-without-consuming, successful redemption, restored used status, and later rejection pass. Actual device persistence still requires restart testing. |
| Auto-remove ineligible coupon | VERIFIED | `revalidateCoupon`, reducer cart actions | Tests verify minimum-spend invalidation, cart-empty clearing, hydration revalidation, and retention of still-valid coupons. |
| Toast explains auto-removal | IMPLEMENTED-NOT-DEVICE-TESTED | `state/notifications.ts`, provider notice effect, `NoticeBanner` | Mocked test verifies Android toast API receives the explanatory message; reducer test verifies event/message. Actual OS toast and any truncation require Android verification. Persistent banner preserves the explanation. |
| Discount never exceeds Item Total | VERIFIED | `evaluateCoupon` | Custom registry rule exceeding item total is clamped; negative effects are clamped to zero. |
| Correct dynamic bill after every cart change | VERIFIED | reducer, `AppStateProvider` derived bill, `calculateBill` | Quantity/coupon reducer and bill boundary tests pass. Totals are never persisted; eligible active coupons are re-evaluated against current quantities. |

## Mandatory 4 — catalog

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| Catalog loaded locally from JSON | VERIFIED | `src/data/catalog.json`, generated import, `catalog.ts`, `scripts/prepare-catalog.cjs` | Real-catalog tests verify the generated application import equals the supplied validated JSON. Runtime code never imports Jest fixtures. |
| 15 catalog medicines available | VERIFIED | supplied `catalog.json`, `parseCatalog`, `catalogData` | `tests/demo-catalog.test.ts` verifies all 15 and each search/add/limit; the current file contains IDs m1–m15 and 3 Rx entries. |
| Correct names/salts/prices/limits/Rx flags | BLOCKED | supplied JSON, `parseCatalog`, shared cards | All fields validate and match the supplied demo file unchanged. Fidelity to the assignment's original data cannot be established without that file/PDF; obtain and compare the original. |
| Original attached catalog.json included | MISSING | documented in README/NOTES | The current PDF-derived substitute is explicitly labelled. Replace it with the original unchanged file; preparation/shopping logic already supports that replacement. |

## Deliverables

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| Git repository prepared | VERIFIED | existing `.git`, tracked source/config/tests/docs | Git history and status were inspected. The user's unrelated `app.json` EAS-linking change is outside this pass and must remain preserved/unstaged. |
| Installable Debug APK | BLOCKED | existing `eas.json` true `:app:assembleDebug` profile | No completed debug APK/artifact is present. Build/signing/install verification is explicitly deferred; a Metro/JS export is not an APK. |
| Automated tests | VERIFIED | Jest/jest-expo, `tests/`, npm scripts | Fresh complete post-UX run: **144 tests across 16 suites passed**, zero failures/snapshots. Includes existing coupon/persistence/native-mock regressions and new discovery/race/UI checks. |
| NOTES.md | VERIFIED | `NOTES.md` | Architecture, catalog provenance, discovery decisions, cleanup proof, actual AI/manual review history, current checks, and deferred native/build gaps are documented. |
| Meaningful incremental commits | VERIFIED | Git history | Existing milestones include configuration, domain/tests, UI/permissions, fixes, docs, and demo stabilization. The current pass keeps changes focused and records local UX/docs commits after verification. No automatic push or unrelated history rewrite is authorized. |

## Bonus

| Requirement | Status | Implementation | Evidence and outstanding work |
|---|---|---|---|
| Pluggable coupon rules | VERIFIED | `CouponRule`, `couponRules`, generic effect evaluation/redemption | New discount/delivery/one-time rules are added in the registry. Custom-rule clamping tests pass; screens and bills do not switch on coupon codes. |
| Corrupt-safe versioned persistence | VERIFIED | `decodeSnapshot`, `createSnapshotStore`, provider hydration guard | Tests cover missing/corrupt/wrong-version/wrong-schema state, invalid quantities, unknown IDs, deduplication, coupon restoration, write ordering, and recovery after failed I/O. Native durability remains separate. |
| Accessibility labels and usable touch targets | IMPLEMENTED-NOT-DEVICE-TESTED | shared Button/QuantityControl/cards, screen inputs/notices | Source has meaningful labels/roles/disabled states, 44–48dp minimum controls, live-region feedback, and unblocked text scaling. TalkBack, enlarged fonts, keyboard/small-screen layout require device verification. |
| Strict TypeScript without any | VERIFIED | `tsconfig.json`, application source | Strict mode is enabled. Static scan found no app `any` casts, ignored TypeScript diagnostics, or lint-disable comments. Final `npm run check` includes successful strict typecheck and clean lint for new UX files. |

## Review conclusions and remaining work

The existing cart/coupon/domain engine, shared provider ancestry, catalog validation, hydration guards, and storage write queue are retained because inspection and tests support their correctness. All permission-dependent shopping fallbacks remain necessary. Android Expo Go checks `isRunningInExpoGo()` before the sole runtime notification import; the top-level notification import is type-only. Tests prove package evaluation is skipped in Expo Go and custom-build request paths remain enabled even for `StoreClient`.

No native device or APK deliverable is marked complete. Original-catalog provenance is unresolved. Browser/renderer tests can check component behavior but do not establish Android layout, keyboard, TalkBack, OS permission responses, or actual disk durability. Follow `docs/ANDROID_CHECKLIST.md` later.

Ponytail plugin/tool/skill discovery found no installed capability, so **Ponytail did not run**. The parent and focused audit agents performed an equivalent manual source/diff review. Findings addressed were offscreen coupon feedback (now repeated beside its form), pending-result races (now invalidated at input-change time with a request ID), discovery dead ends (real previews and Browse), and proven-unused starter dependencies.

No source module or image asset was deleted in this pass. `expo-device`, `expo-image`, and `expo-web-browser` were removed only after app/config/script/test/import and installed dependency/peer checks showed no consumers; the now-orphaned `ua-parser-js` left the lockfile with them. Required Router/native peers were retained. No unrelated dependency upgrades, provider/domain/native rewrite, or mandatory guard deletion was needed.

## Final local verification

| Check | Result and practical limit |
|---|---|
| `npm run check` | Passed: **144 tests, 16 suites**, zero failures/snapshots, strict TypeScript and lint clean. |
| `npm run check:demo` | Passed; its ADB availability warning came from the sandbox. This is a static preflight, not physical-device verification. |
| `npm run prepare:catalog -- --required` | Passed; generated import targets the supplied local JSON. Presence does not prove original-file provenance. |
| `npx expo install --check` | Passed using online SDK compatibility data. |
| `npx expo-doctor` | **20/20 passed**. This does not verify native prompts or an APK. |
| Web server/client JavaScript export | Passed into `/tmp/plazza-discovery-web`, including the `/browse` bundle. This is packaging evidence, not browser visual or Android runtime verification. |
| Catalog integrity | SHA-256 remains `6d8f0e6f7d9116754d4f152709649a5029193859f177d3a9192db685f16ba7f8`; the supplied 15-record demo JSON was unchanged. |
| Domain/provider/native regression scope | Domain, reducer, storage, permission service, and both providers have zero source diffs in this pass; their existing behavior remains covered by the full regression run. |
| Node requirement | Active Node 24.22.1 satisfies SDK 58's Node 22.13+ minimum. |
| `git diff --check` | Passed during focused reviews; unrelated `app.json` user edits are preserved. |
| EAS / Gradle / signing / APK installation | Not run in this pass, as requested. Debug APK delivery remains BLOCKED/deferred. |
| Android physical runtime / Settings / TalkBack / restart persistence | Not performed in this pass, as requested. |
| Browser visual QA | Retried but blocked before navigation by `Importing module "node:process" is not allowed in node_repl`. No screenshot/visual QA claim is made. |

All 67 checklist requirements have a row above. Home's seven renderer tests and Browse's four include explicit catalog-error states with no silent empty product rendering; Cart's two tests cover inline coupon feedback/bill updates, and the search hook's seven cover debounce/races/errors. Device-dependent statuses remain explicitly unverified, and the original catalog is still missing. Component renderer tests use mocked native surfaces; they do not establish real Android layout, keyboard behavior, permission dialogs, or storage durability.
