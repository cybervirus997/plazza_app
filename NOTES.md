# Implementation notes

## 1. Assumptions and missing inputs

During initial implementation, the repository, parent folder, and supplied attachments contained neither the original `catalog.json` nor the candidate PDF. The pasted brief remains the requirements source. The user has now supplied **15 PDF-derived demo records** in `src/data/catalog.json` for the urgent live demo. This is a temporary, explicitly authorized substitute; **it is not the original attached catalog required for final submission**. Synthetic `tests/fixtures.ts` remains isolated from application code.

The loader expects the stated Medicine array (`id`, `name`, `salt`, `price`, `maxQty`, `rx`). Preparation generates an ignored static TypeScript import of the supplied file, preserving its bytes and including its data in Metro/EAS bundles. The preferred path is `src/data/catalog.json`; root `catalog.json` is a fallback. Missing or invalid data produces an explicit Home error rather than a silent successful empty catalog. Snapshot writes are disabled when loading fails. The EAS post-install hook requires a catalog file; **that check verifies presence, not provenance**. Replace the temporary records with the unchanged original before final submission. Device shopping behavior remains unverified.

Prices are per unit in INR. Item totals sum integer paise. Percentage discounts round to the nearest whole rupee using `Math.round` (₹25.50 → ₹26). Delivery uses the pre-discount item total: ₹40 for positive totals below ₹499, otherwise zero. Empty/zero-valued carts have zero delivery. No tax or prescription-upload flow was specified. Orders are mock orders with no backend or payment.

## 2. Architecture and files

Expo **58.0.20**, React Native **0.88.0**, React **19.3.0**, strict TypeScript, Expo Router, npm, and `package-lock.json` are preserved. No native directories were hand-written.

`src/app` contains only layouts and tiny Home/Cart/Browse route exports. Browse is a root-stack screen outside the two bottom tabs. `src/features` holds search, cart, and permissions. `src/domain` holds pure types, cart operations, search, coupon rules, and bills. `src/state` holds the reducer/Context and native notice delivery. `src/storage` owns snapshot validation and ordered I/O. `src/components` and `src/theme` provide shared UI and design tokens.

The user's pre-existing starter Home edit was copied byte-for-byte to `docs/starter-home.tsx.txt` before replacing its route. Obsolete starter routes/components/styles/reset tooling were removed, including two starter files that failed type/lint validation. The preserved archive is documentation, outside Router and compilation. Original unused image assets were not broadly deleted. New launcher assets use an original geometric plus mark, generated locally with Node built-ins by `scripts/generate-icons.cjs`.

## 3. State management

Context + `useReducer` fits the small offline app. Every tap processes the latest state and enforces catalog quantity limits independently of disabled UI. Cart entries contain IDs and quantities; the validated catalog supplies metadata. Both tabs consume the same state.

Cart, active code, used one-time codes, and up to five submitted recent queries persist. Search input/results/loading, coupon input, permission status, coordinates, notices, and storage warnings are transient. Bill totals and resolved rows are derived in the provider/domain, never persisted or calculated in screen components.

## 4. Persistence

SDK-compatible AsyncStorage **2.2.0** stores one `version: 1` snapshot under `plazza.shopping.v1`. Parsing starts with `unknown`, validates fields, drops unknown IDs, floors/caps quantities, removes nonpositive quantities, deduplicates entries, and normalizes strings. Missing/corrupt/unknown-version snapshots safely fall back. The reducer revalidates saved coupons during hydration with an explanation for removals.

The root shows a restoring indicator until hydration finishes; shopping actions before restoration are ignored. Writes start only afterward, capture the four persisted fields, and execute through one Promise queue. A slow older write cannot overwrite newer state. A failed write resolves to a visible warning without crashing or poisoning the queue; later writes can recover. No shopping or location data is logged.

Checkout clears cart/coupon and records eligible one-time redemption in one transition. The state effect immediately queues the new snapshot. An OS kill before an asynchronous write finishes cannot be guaranteed durable, so force-close/restart checks remain required. Uninstalling or clearing app data resets local one-time usage by design.

## 5. Coupon registry and bills

Each `CouponRule` has a code, description, optional `oneTime`, and pure `evaluate(CouponContext)`. The engine normalizes codes, checks cart emptiness and prior redemption, then clamps monetary discounts to `[0, itemTotal]`. Its typed result separates monetary discount from delivery waiver. All four required coupons are registry entries.

Adding another flat, percentage, minimum-spend, delivery-waiver, or one-time rule changes only the registry. CartScreen, billing, redemption, and the registry-generated coupon picker need no code-specific switch. FIRST100 becomes used only when a nonempty mock order succeeds with that eligible coupon active.

Every cart-changing action revalidates the coupon. Valid coupons remain; invalid coupons clear and emit an explanation. A provider effect calls `ToastAndroid.show` for auto-removal on Android. A persistent live-region banner preserves the full explanation if the OS truncates its toast. Orders use a native accessible Alert plus a banner.

`calculateBill` uses item total before discounts for delivery eligibility and percentage discount base. It exposes Item Total, Discount, Delivery Fee, and nonnegative Grand Total without persisting derived amounts. FREEDEL affects only delivery.

## 6. Search and mobile UI

Local search matches partial name/salt text, case-insensitively, trimming surrounding whitespace. One **150ms debounce** makes typing responsive and loading observable without fabricating an HTTP request. Request IDs invalidate pending results immediately on input changes; effect cleanup also cancels timers/unmounted updates. Empty, loading, results, no-results, and error states are implemented. Browse filters the same small catalog directly with the canonical domain function and adds no competing debounce.

Only committed searches (submission, suggestion selection, View All, or a recent-search tap) change history. Case-insensitive duplicates move to the front; five queries are retained. Home previews four actual medicines before typing, shows up to six suggestions while typing, and reveals the selected medicine or full matching results on commitment. View All routes the query to Browse; clearing restores discovery. Browse lists the full catalog without typing. Home, Browse, and Cart share MedicineCard/QuantityControl and one cart state.

Buttons have accessible labels, disabled states, and at least 44px targets; layouts wrap on narrow screens and retain native font scaling. The permission debug panel is compact in Home's header, with wrapping status/actions. Search content stays in normal list flow rather than an overlapping popup; the input is kept in a stable position in the list header while typing, and handled keyboard taps make suggestion selection functional. Cart uses keyboard avoidance, scrolling content, and a separate checkout bar. Coupon failures/auto-removal now appear beside the form as well as the shared banner, so feedback is available after scrolling. Visual, keyboard, and TalkBack behavior still requires hardware checks.

## 7. Android permission lifecycle

Only foreground location is requested. Android notification channel creation precedes the first notification request. Initial automatic requests run only for OS-undetermined permissions; already denied/granted permissions are not repeatedly prompted. A shared initialization Promise prevents duplicate prompts during development remounts. Manual Enable access honors `canAskAgain`. Blocked is derived from the actual OS response, never a denial count.

Open Settings uses Linking. An AppState foreground transition rechecks both permissions and refreshes coordinates. Refreshes arriving during another request are queued. Location failure cannot skip the notification request. Location is a balanced-accuracy one-shot with an 8-second UI timeout; there is no geocoding, background tracking, or push registration. Coordinates remain in memory and display to four decimal places. Denied, blocked, GPS-off, and unavailable states have meaningful fallbacks.

App config sets foreground-location/notification permissions and their plugins. Introspection confirmed coarse/fine location and POST_NOTIFICATIONS, with background location, foreground location service, and activity recognition explicitly excluded. This is generated config inspection, not inspection of a completed APK's merged manifest.

A connected Expo Go client emitted a real missing `ExpoTopicSubscriptionModule` error when SDK 58's notifications package loaded. The initial guarded lazy import still attempted to load that package. Demo stabilization now checks `isRunningInExpoGo()` from the installed `expo` package **before** the Android notification import, and skips that import in Android Expo Go with notifications marked unavailable. The SDK helper detects the native ExpoGo module; it does not rely on `StoreClient`, which can also describe development clients. Custom development/standalone APKs retain native channel creation and permission requests. Foreground location, denied/blocked/granted UI, and AppState rechecking remain unchanged. Tests cover Expo Go skipping and custom-build behavior, but do not constitute physical-device verification. The existing test-only Babel dynamic-import transform remains; Metro controls application imports. No SDK version was changed.

## 8. Run and automated verification

```sh
npm ci
npm run check:demo
npm run check
npm test -- --coverage
npx expo install --check
npx expo-doctor
npm run bundle:android
npm run prepare:catalog -- --required
npm start -- --go --clear        # Expo Go shopping/location demo
# For an installed debug development APK instead:
# npm start -- --dev-client --clear
```

Before demo stabilization: **112 tests in 10 suites passed**, strict TypeScript and lint passed, online compatibility passed, and **20/20 Expo Doctor checks passed**. Android/web exports also succeeded. These results are historical; final stabilization checks must be recorded separately. A JS export verifies packaging, not a Gradle build or native startup.

The earlier 112-test coverage run measured domain/reducer/persistence at **95.36% statements, 91.4% branches, 93.47% functions, 94.64% lines**. Coverage excludes UI/native behavior; these figures have not been rerun for stabilization.

`npm audit` reported **14 findings: 11 low, 3 high, zero critical**. The high chain is the pre-existing Expo CLI → Zod dependency; Zod 3.25.76 exists in the initial lockfile. npm's proposed fix was a major downgrade to Expo 51.0.39, which was rejected to preserve SDK 58. No app-level Zod package was added. The upstream CLI advisory remains unresolved; no forced audit fix or dependency override was used.

## 9. EAS APK build and install

No prior EAS configuration or application ID existed. `eas.json` provides `debug` with development client, internal distribution, and **`:app:assembleDebug`**, plus `preview` with internal distribution and `android.buildType: "apk"`. The stable application ID is `com.plazza.rninterview`.

Debug may require Metro and development tooling. Preview is a standalone release APK for an independent demo; it is not described as a debug artifact. See [Expo APK guidance](https://docs.expo.dev/build-reference/apk/).

The last EAS `whoami` returned **Not logged in**. No completed cloud build or APK is claimed. Demo builds may use the supplied temporary catalog; the original remains mandatory for final submission. After catalog preparation and checks, sign in/link the user's EAS project if needed:

```sh
npm run check:demo
npm run prepare:catalog -- --required
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile debug
npx eas-cli@latest build --platform android --profile preview
```

EAS init links the user's own project; signing setup may be interactive. Install from the completed build's actual link, or run `adb install -r /absolute/path/to/downloaded.apk`. For debug, start `npm start -- --dev-client --clear`; USB devices can use `adb reverse tcp:8081 tcp:8081`. No local Gradle/Xcode/Android Studio build is needed.

## 10. Actual AI usage and review history

The initial prompt asked Codex to implement the take-home, preserve the SDK, use the original catalog, test boundaries, review minimalism, create commits, and report blockers honestly. That initial implementation used no sub-agents. The subsequent urgent stabilization prompt supplied temporary catalog data/preflight tooling and requested focused runtime fixes without a rewrite. Focused parallel agents checked catalog/search/cart data, audited providers/build configuration, and updated documentation while the parent handled Expo Go detection and verification. No human review is claimed.

Actual review fixes included zero-valued delivery semantics; saved-quantity sanitization; ordered storage writes; avoiding writes without catalog data; correcting the root-catalog relative import; removing obsolete starter type/lint errors; registry-driven redemption; isolating SDK 58 notification loading after observing the Expo Go failure; and transforming dynamic imports only in Jest. Test expectations were not weakened when the lazy import first exposed a Jest transform failure.

Ponytail was checked through available tools, local plugin files, and plugin search. No capability was found. **Ponytail itself was not run.** Codex manually reviewed correctness, duplicate/dead code, unnecessary packages, unsafe types, boundary coverage, state synchronization, storage ordering, and accessibility. No app `any`, ignored TypeScript errors, lint-disable comments, snapshot tests, Redux, React Query, Formik, app-level Zod, or UI framework were introduced.

Initial runtime additions were AsyncStorage, Expo Location, Expo Notifications, and Expo Dev Client. Development packages supply required Jest/lint tooling and the dynamic-import test transform. The later discovery pass removed only three proven-unused starter dependencies, as detailed below; no package upgrades were needed.

Milestone commits: `57d9bfe` configuration, `a60dcb1` domain/persistence/tests, `c977d91` UI/permissions, and `cd559b5` native-module fallback/build-input review fixes. The documentation commit follows. No push or history rewrite occurred.

References: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo index](https://docs.expo.dev/llms.txt), [Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [AsyncStorage](https://docs.expo.dev/versions/v58.0.0/sdk/async-storage/), [Router tabs](https://docs.expo.dev/router/advanced/tabs/), [Jest setup](https://docs.expo.dev/develop/unit-testing/), [Babel config](https://docs.expo.dev/versions/v58.0.0/config/babel/), [AppState](https://reactnative.dev/docs/appstate), [Linking](https://reactnative.dev/docs/linking), and [Jest transforms](https://jestjs.io/docs/code-transformation).

## 11. Limitations and improvements

The assignment's definition of done is **not satisfied** until the original catalog replaces the PDF-derived demo substitute, real shopping flows use it, an actual debug APK completes, and device checks pass. The supplied demo catalog enables data-level checks now; it does not resolve the original-file requirement. True blocked permission behavior, Settings return, force-close restoration, font-scale/TalkBack, and the final UI still require hardware checks. Follow [ANDROID_CHECKLIST.md](docs/ANDROID_CHECKLIST.md).

The Browser integration failed before navigation with `Importing module "node:process" is not allowed in node_repl`. Visual QA was not performed; web export is not visual QA. Web is a secondary preview and does not request native mobile permissions. EAS login/project linking/signing/build execution and the final APK manifest are external gaps.

With more time: obtain the original catalog and finish device/accessibility checks. No speculative network/state architecture, framework migration, or broad UI redesign is part of demo stabilization.

## Initial implementation verification · 28 October 2026

- `npm run typecheck`: passed, no TypeScript errors.
- `npm run lint`: passed, zero warnings/errors.
- `npm test -- --coverage`: **112 passed, 10 suites passed**, zero snapshots.
- `npm run bundle:android`: passed; final Hermes bundle exported into ignored `dist/` (about 3.1 MB).
- `npx expo-doctor`: **20/20 passed** after final config changes.
- `npx expo install --check`: passed using online compatibility data.
- `git diff --check`: passed.
- Missing-catalog EAS gate: verified that `--required` exits 1; development preparation still permits the explicit unavailable-data UI.
- Ponytail, visual browser QA, physical-device tests, and APK delivery: **not completed**, for the blockers above.

## Urgent demo stabilization verification · 28 October 2026

Focused production changes are the Android Expo Go guard before notification import and rejection of an empty catalog. Providers, navigation, UI design, existing dependencies, native configuration, and EAS profiles were retained. `check:demo` now runs the supplied preflight script. The user-supplied catalog/preflight files were kept unchanged; catalog SHA-256 is `6d8f0e6f7d9116754d4f152709649a5029193859f177d3a9192db685f16ba7f8`.

Root causes: the original catalog was absent and the generated import had no medicines until the supplied data was prepared; an empty array also passed schema validation without an error, now fixed. The SDK 58 notifications entry point loads `ExpoTopicSubscriptionModule`, absent in the reported Expo Go binary. Catching an attempted import was insufficient for this environment; Android Expo Go now bypasses that import entirely using the SDK helper. No other eager notification import exists in application code; its remaining top-level import is type-only. The provider hierarchy is correct and was not rewritten.

- `npm run check:demo`: passed, including the 15-record schema/count and debug/preview profiles. With ADB access, it reported no attached devices.
- `npm run check`: passed; TypeScript and lint clean, **124 tests across 13 suites**, zero failed tests and zero snapshots.
- `npm run prepare:catalog -- --required`: passed; generated static import is `./catalog.json`.
- `npm run bundle:android`: passed; all 15 supplied medicine names are present in the exported Hermes bundle.
- `npx expo install --check`: passed, dependencies are up to date.
- `npx eas-cli@latest whoami`: **Not logged in**; no APK was built or assumed to exist.
- Tests cover all 15 actual demo records, name/partial-salt matching, cart additions/limits, skipped package evaluation in Android Expo Go for initial/request/refresh, native notification requests in custom clients (including `StoreClient`), and missing-module recovery.
- A renderer integration test exercises the actual Home/Cart components, search hook, catalog, reducer, and AppStateProvider. It verifies result cards, enabled Add, name/salt searching, and synchronized Add/increment quantities. Native surfaces are mocked; this is not Android runtime verification.

Physical-device Expo Go startup, custom-APK channel/permission behavior, true blocked states, Settings return, and restart persistence still require the device checklist. EAS login/project linking/signing/build completion remain external steps. The 15 PDF-derived records are temporary demo data; the unchanged original attached catalog remains required for final assignment submission.

## Discovery, autocomplete, and compliance pass · 28 October 2026

The user requested an in-place discovery/quality pass, a truthful assignment audit, proven-safe cleanup, and Ponytail review if available, explicitly deferring EAS/Gradle/device work. Codex retained the architecture and used focused agents for Browse, cart UX regressions, search-race tests, and independent requirements/source review. The parent implemented Home, reviewed the combined diff, ran final checks, and documented the results. No human review or device verification is claimed.

Before this pass, Home required a query and offered no way to browse the whole catalog. It now previews four real products, offers Browse all medicines, and displays at most six selectable suggestions using the same canonical name/salt filter as full results and Browse. No popularity/stock metrics, remote requests, images, medical recommendations, or hardcoded product-card data were added. Catalog order remains deterministic; prefix ranking was deliberately omitted for this small data set. A selected medicine is resolved by ID, while recent history records its name. Already loaded search results are reused on submission; explicit recent taps/retries can rerun a query.

Reused abstractions: MedicineCard (with an optional accessible select action), QuantityControl, Button, shared tokens, catalogData/searchMedicines, Context/reducer, and versioned persistence. No second repository, cart state, design system, or heavy search infrastructure was introduced. The correct coupon engine, bill calculations, providers, hydration/write queue, and Expo Go native-import guard have no source changes in this pass. Cart feedback and wrapping changed only presentation.

Cleanup evidence: no source module, user archive, image asset, or configuration file was deleted. The oversized old Home promotion/illustration JSX and now-unused local styles were replaced by actionable discovery UI. `expo-device`, `expo-image`, and `expo-web-browser` had no application, script, config, test, dynamic-route, installed dependency, or peer consumers. They were removed with npm; the orphan `ua-parser-js` left the lockfile too. Router/native peers were retained and the lockfile contains no unrelated upgrades. The user's pre-existing `app.json` EAS-linking edit was left untouched and unstaged.

Ponytail tools/skills were absent and plugin search returned no match. **Ponytail did not run.** The equivalent manual audit checked source/diffs, duplicate filtering/state, unsafe types, dependency consumers, boundary tests, pending-search races, shared quantities, coupon eligibility, persistence guards, keyboard flow, and accessible labels. Findings fixed were a small stale-response window at input-change time, discovery dead ends, coupon feedback outside the scrolled form, and narrow-screen status/bill wrapping. Required native fallbacks and correctness guards were retained.

Fresh verification after the UX/review fixes:

- `npm run check`: **144 tests across 16 suites passed**, zero failed tests/snapshots; TypeScript and lint clean.
- Home: seven renderer tests cover discovery, capped suggestions/selection/history, View All/submission, clear/no matches, three-screen quantities, and explicit catalog failure.
- Browse: four renderer tests cover all 15 discoverable entries, name/salt filter/clear, Add/maxQty, back fallback, and explicit catalog failure.
- Search hook: seven deterministic tests cover one 150ms debounce, old-result races including same-event resolution, clearing, no-results, and error/retry. Canonical filtering also has an immutable/deterministic-input regression.
- Cart: two new renderer tests cover inline invalid/success feedback, coupon auto-removal, and recalculated bills. All existing cart/coupon/persistence/permission tests still pass.
- `npm run check:demo` and `npm run prepare:catalog -- --required`: passed. The preflight's ADB availability warning was sandbox-related, not a device test.
- Online Expo compatibility check: passed. Expo Doctor: **20/20 passed**. Active Node **24.22.1**, Expo **58.0.20**, React Native **0.88.0**, React **19.3.0**, TypeScript **6.0.3**.
- Web server/client JavaScript export passed into `/tmp/plazza-discovery-web`, including the Browse route; this is packaging evidence, not native/visual verification.
- Browser visual QA was retried but failed before navigation with the same browser-runtime `node:process` import restriction. No screenshots or visual verification are claimed.
- Supplied catalog checksum remains unchanged. No EAS build, Gradle command, signing change, or physical-device verification was performed.

The full [REQUIREMENTS_AUDIT.md](docs/REQUIREMENTS_AUDIT.md) covers all **67 requirements**: **50 VERIFIED**, **14 IMPLEMENTED-NOT-DEVICE-TESTED**, **2 BLOCKED**, **1 MISSING**, **0 FAILING**. Renderer/native-mock evidence is explicitly bounded. Missing original catalog provenance, an actual Debug APK, and real Android permission/Settings/restart/accessibility checks remain open or deferred. The current catalog is still the authorized 15-record PDF-derived substitute.

Local commits for this pass: `ac261c9` dependency cleanup, `e07bde3` Home/autocomplete/Browse, `4288de0` inline coupon feedback/bill wrapping, and the compact-header refinement, followed by the final documentation/audit commit. Nothing was pushed or rebased.
