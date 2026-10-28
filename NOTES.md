# Implementation notes

## 1. Assumptions and missing inputs

The repository, parent project folder, and supplied Codex attachments were searched for `catalog.json` and the candidate PDF. Neither was present. The pasted brief is the requirements source. **No replacement production catalog was invented.** Synthetic `tests/fixtures.ts` data is never imported by application code.

The loader expects the stated Medicine array (`id`, `name`, `salt`, `price`, `maxQty`, `rx`). The actual schema and end-to-end shopping behavior remain unverified until the original arrives. Put the unchanged original at `src/data/catalog.json` or root `catalog.json`. Preparation generates an ignored TypeScript import and preserves the original bytes. Missing data yields a clear Home error; snapshot writes are disabled so unavailable catalog data cannot erase a previously saved cart. The EAS post-install hook rejects builds without the original.

Prices are per unit in INR. Item totals sum integer paise. Percentage discounts round to the nearest whole rupee using `Math.round` (₹25.50 → ₹26). Delivery uses the pre-discount item total: ₹40 for positive totals below ₹499, otherwise zero. Empty/zero-valued carts have zero delivery. No tax or prescription-upload flow was specified. Orders are mock orders with no backend or payment.

## 2. Architecture and files

Expo **58.0.20**, React Native **0.88.0**, React **19.3.0**, strict TypeScript, Expo Router, npm, and `package-lock.json` are preserved. No native directories were hand-written.

`src/app` contains only layouts and tiny Home/Cart route exports. `src/features` holds search, cart, and permissions. `src/domain` holds pure types, cart operations, search, coupon rules, and bills. `src/state` holds the reducer/Context and native notice delivery. `src/storage` owns snapshot validation and ordered I/O. `src/components` and `src/theme` provide shared UI and design tokens.

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

Local search matches partial name/salt text, case-insensitively, trimming surrounding whitespace. A documented **250ms debounce/demo delay** makes loading observable without fabricating an HTTP request. Cleanup prevents stale results from replacing a new query. Empty, loading, results, no-results, and error states are implemented.

Only submission or a recent-search tap changes history. Case-insensitive duplicates move to the front; five queries are retained. Home/results and Cart use FlatList and shared medicine/quantity components. Buttons have accessible labels, disabled states, and at least 44px targets; layouts wrap on narrow screens and retain native font scaling. Cart uses keyboard avoidance, scrolling content, and a separate checkout bar. Visual, keyboard, and TalkBack behavior is still unverified on hardware.

## 7. Android permission lifecycle

Only foreground location is requested. Android notification channel creation precedes the first notification request. Initial automatic requests run only for OS-undetermined permissions; already denied/granted permissions are not repeatedly prompted. A shared initialization Promise prevents duplicate prompts during development remounts. Manual Enable access honors `canAskAgain`. Blocked is derived from the actual OS response, never a denial count.

Open Settings uses Linking. An AppState foreground transition rechecks both permissions and refreshes coordinates. Refreshes arriving during another request are queued. Location failure cannot skip the notification request. Location is a balanced-accuracy one-shot with an 8-second UI timeout; there is no geocoding, background tracking, or push registration. Coordinates remain in memory and display to four decimal places. Denied, blocked, GPS-off, and unavailable states have meaningful fallbacks.

App config sets foreground-location/notification permissions and their plugins. Introspection confirmed coarse/fine location and POST_NOTIFICATIONS, with background location, foreground location service, and activity recognition explicitly excluded. This is generated config inspection, not inspection of a completed APK's merged manifest.

A connected Expo Go client emitted a real missing `ExpoTopicSubscriptionModule` error during eager notification-module loading. The eager import was rejected and replaced with a guarded lazy import inside the permission flow. A regression test reproduces the import failure and confirms permission checks/shopping modules remain available with notifications unavailable. Jest required a test-only Babel dynamic-import transform for its CommonJS environment; Metro retains normal import handling. No SDK version was changed to work around Expo Go. A custom APK remains the target for native verification.

## 8. Run and automated verification

```sh
npm ci
# Supply the original catalog before the actual shopping demo.
npm run check
npm test -- --coverage
npx expo install --check
npx expo-doctor
npm run bundle:android
npm start -- --dev-client --clear
```

Executed: **112 tests in 10 suites passed**, strict TypeScript passed, Expo ESLint passed without warnings, online Expo compatibility validation passed, and **20/20 Expo Doctor checks passed**. Android Hermes export and web server/client export succeeded. Android export proves that Metro packages the JS, not that a Gradle build or native startup succeeds. The last verification results after review are recorded at the end of this file.

The final 112-test coverage run measured domain/reducer/persistence at **95.36% statements, 91.4% branches, 93.47% functions, 94.64% lines**. Coverage excludes UI and native behavior; the missing-module regression tests notification failure isolation separately.

`npm audit` reported **14 findings: 11 low, 3 high, zero critical**. The high chain is the pre-existing Expo CLI → Zod dependency; Zod 3.25.76 exists in the initial lockfile. npm's proposed fix was a major downgrade to Expo 51.0.39, which was rejected to preserve SDK 58. No app-level Zod package was added. The upstream CLI advisory remains unresolved; no forced audit fix or dependency override was used.

## 9. EAS APK build and install

No prior EAS configuration or application ID existed. `eas.json` provides `debug` with development client, internal distribution, and **`:app:assembleDebug`**, plus `preview` with internal distribution and `android.buildType: "apk"`. The stable application ID is `com.plazza.rninterview`.

Debug may require Metro and development tooling. Preview is a standalone release APK for an independent demo; it is not described as a debug artifact. See [Expo APK guidance](https://docs.expo.dev/build-reference/apk/).

EAS `whoami` returned **Not logged in**. No build was started for an app missing its original catalog, no signing credentials were generated, and no APK is available. After supplying and committing the original catalog:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile debug
npx eas-cli@latest build --platform android --profile preview
```

EAS init links the user's own project; signing setup may be interactive. Install from the completed build's actual link, or run `adb install -r /absolute/path/to/downloaded.apk`. For debug, start `npm start -- --dev-client --clear`; USB devices can use `adb reverse tcp:8081 tcp:8081`. No local Gradle/Xcode/Android Studio build is needed.

## 10. Actual AI usage and review history

The supplied prompt asked Codex to implement the complete take-home, preserve the SDK, use the original catalog, test boundaries, review minimalism, create commits, and honestly report blockers. Codex inspected the starter, consulted official SDK 58 docs, implemented domain/reducer/storage/UI/permissions/build tooling, created isolated test fixtures, ran the recorded checks, and wrote the handoff. No sub-agents were used; no human review is claimed.

Actual review fixes included zero-valued delivery semantics; saved-quantity sanitization; ordered storage writes; avoiding writes without catalog data; correcting the root-catalog relative import; removing obsolete starter type/lint errors; registry-driven redemption; isolating SDK 58 notification loading after observing the Expo Go failure; and transforming dynamic imports only in Jest. Test expectations were not weakened when the lazy import first exposed a Jest transform failure.

Ponytail was checked through available tools, local plugin files, and plugin search. No capability was found. **Ponytail itself was not run.** Codex manually reviewed correctness, duplicate/dead code, unnecessary packages, unsafe types, boundary coverage, state synchronization, storage ordering, and accessibility. No app `any`, ignored TypeScript errors, lint-disable comments, snapshot tests, Redux, React Query, Formik, app-level Zod, or UI framework were introduced.

New runtime packages: AsyncStorage, Expo Location, Expo Notifications, Expo Dev Client. Development packages supply required Jest/lint tooling and the dynamic-import test transform. Existing starter dependencies were preserved rather than broadly pruned.

Milestone commits: `57d9bfe` configuration, `a60dcb1` domain/persistence/tests, `c977d91` UI/permissions, and `cd559b5` native-module fallback/build-input review fixes. The documentation commit follows. No push or history rewrite occurred.

References: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo index](https://docs.expo.dev/llms.txt), [Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [AsyncStorage](https://docs.expo.dev/versions/v58.0.0/sdk/async-storage/), [Router tabs](https://docs.expo.dev/router/advanced/tabs/), [Jest setup](https://docs.expo.dev/develop/unit-testing/), [Babel config](https://docs.expo.dev/versions/v58.0.0/config/babel/), [AppState](https://reactnative.dev/docs/appstate), [Linking](https://reactnative.dev/docs/linking), and [Jest transforms](https://jestjs.io/docs/code-transformation).

## 11. Limitations and improvements

The assignment's definition of done is **not satisfied** until the original catalog is supplied, real shopping flows use it, an actual debug APK completes, and device checks pass. ADB was available but reported no attached devices. True blocked permission behavior, Settings return, force-close restoration, actual-catalog Rx/search results, font-scale/TalkBack, and the final UI were not manually verified on hardware. Follow [ANDROID_CHECKLIST.md](docs/ANDROID_CHECKLIST.md).

The Browser integration failed before navigation with `Importing module "node:process" is not allowed in node_repl`. Visual QA was not performed; web export is not visual QA. Web is a secondary preview and does not request native mobile permissions. EAS login/project linking/signing/build execution and the final APK manifest are external gaps.

With more time: obtain the catalog, finish device/accessibility checks, capture screenshots, add focused keyboard/navigation/Settings UI integration tests, measure real-catalog list performance before optimizing indexing, and address upstream advisories when an SDK-compatible fix exists. No speculative network/state architecture was added.

## Final review verification · 28 October 2026

- `npm run typecheck`: passed, no TypeScript errors.
- `npm run lint`: passed, zero warnings/errors.
- `npm test -- --coverage`: **112 passed, 10 suites passed**, zero snapshots.
- `npm run bundle:android`: passed; final Hermes bundle exported into ignored `dist/` (about 3.1 MB).
- `npx expo-doctor`: **20/20 passed** after final config changes.
- `npx expo install --check`: passed using online compatibility data.
- `git diff --check`: passed.
- Missing-catalog EAS gate: verified that `--required` exits 1; development preparation still permits the explicit unavailable-data UI.
- Ponytail, visual browser QA, physical-device tests, and APK delivery: **not completed**, for the blockers above.
