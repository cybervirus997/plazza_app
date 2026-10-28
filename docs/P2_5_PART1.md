# P2.5 Part 1 — navigation, native headers and design foundation

Completed on 29 October 2026 on `feat/plazza-commerce-mvp`, using local `31f9702` plus the prior continuation working tree as the starting point. Part 1 only; Parts 2–4 are not implemented.

## Evidence and corrections

Earlier stabilization already corrected Back-as-replace, repeated tabs entries, stale asynchronous completion, transition/reduced-motion policy and Cart's duplicate Android keyboard adjustment. Those corrections and their tests are retained; checkout recovery before hydration is unchanged. No repeating root-remount or redirect loop was found. Physical shaking is not reproduced or certified fixed.

Two remaining navigation source issues were addressed:

- Address Form's no-history return used a replacement without returning options. Shared `backTo('/addresses')` now provides a bounded fallback, and the destination has returning replacement direction. Existing dirty/saving protection and durable-save return remain covered.
- Home's search/category/collection Browse actions still used unconditional `push`. The installed Router reducer reproduces two Browse entries from repeated pushes; `navigate` reuses one entry and Back retains the original tabs key. UI tests preserve the original destination/query/category assertions.

The header inconsistency was also concrete: detail screens built Back buttons and large titles inside scroll/list content, using screen-specific rows and top insets. They now configure the **native Stack header**, with a left-aligned title, opaque matching background and no heavy shadow. The shared native `headerLeft` slot uses a labelled IconButton to retain no-history fallback behavior and the form's disabled saving state; it dispatches the same guarded Router actions. There is no custom header container or animation workaround.

- Browse, Checkout, Payment, Confirmation, History, Receipt, Address Book and all Address Form states use one native title/Back. Browse's Cart action moves into the native header's right slot.
- Detail content retains left/right/bottom safe areas and gives top/status-bar ownership to the native header. Home/Cart keep their existing purpose-built headers, with headers hidden on both root tabs and nested Tabs.
- Android keyboard avoidance is explicitly disabled in Cart and Address Form because the existing native configuration uses resize. The form's iOS padding uses actual native header height through the installed SDK 58 public `expo-router/react-navigation` entry.
- `tokens.ts` extends the existing palette with semantic status treatments, typography, radii, control/icon sizes and the existing content-width constraint. Button and reused Back/clear IconButton use 48-point minimum targets; quantity steps also meet 48 points. StatusPanel consumes the same palette values, preserving its presentation. No Home discovery, receipt, History card, payment-result or snackbar redesign was performed.
- Engineering standards now describe native header/safe-area ownership and the single token source alongside the existing state, persistence, accessibility and measured-performance rules. AGENTS.md is unchanged.

## Verification

| Command | Actual result |
| --- | --- |
| `npm run typecheck` | Passed; also passed in final combined check |
| `npm run lint` | Passed without errors/warnings; also passed in final combined check |
| `npm test` | **478 tests / 36 suites passed** |
| `npm run check` | Passed typecheck, lint and **478 tests / 36 suites** |
| `npm run check:demo` | Passed static preflight; sandbox `adb devices` warning |
| `npm run bundle:android` | Passed: **3.4 MB Hermes, 1,486 modules, 32 assets**, ignored `dist/`; non-blocking NO_COLOR/FORCE_COLOR warnings |
| `git diff --check` | Passed |

All 432 reported baseline cases remain, alongside subsequent stabilization coverage: **46 additional cases overall**, including five from the address fallback continuation and eleven for Part 1 header/safe-area/lifecycle/route reuse. No tests were removed or skipped. Screen tests render configured native-header slots through a test adapter; they do not simulate native geometry, animations or hardware Back. The React layout test establishes retained navigator identity after hydration/reduced-motion updates, not device frame-rate behavior.

Known phone evidence remains the user's Home/reload smoke pass in Expo Go on Samsung S20 FE / **SM-G781B, Android 13 / API 33**, with Metro confirming that session. There is no ADB-exposed device. New header appearance, transition direction/shaking, system Back, form keyboard behavior, enlarged text/TalkBack and restart flows still require the [ten-step Android pass](ORDERS_ANDROID_CHECKLIST.md#p25-part-1--quick-navigationheader-pass). iOS header/keyboard behavior also needs runtime observation. Browser visual QA remains blocked by its runtime's restricted `node:process` import. No screenshot or smoothness sign-off is claimed.

## Local commits and boundaries

- `a11acdf` — bounded address-form returns and Back-guard regressions.
- `66250f8` — native headers, Browse route reuse, minimal shared design tokens/primitives and header/lifecycle regressions.
- Documentation/checklist follow in a separate local commit; use `git log` for its hash.

`master` stays at `70f2065da481e42fc4db7c262ad29d93140aec77`. The user's uncommitted `app.json` remains excluded from commits and retains SHA-256 `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6`. No schema, shopping/cart/coupon/address/payment/order state owner, recovery/journal/FIRST100 logic, dependency version or generated native folder was changed. No push, EAS/APK build, backend, P3 or Parts 2–4 work was started.

API references used narrowly for this change: [Expo SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [native Stack options](https://docs.expo.dev/router/advanced/stack/), [safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/), [React Native keyboard avoidance](https://reactnative.dev/docs/keyboardavoidingview). The installed SDK's public entry/type declarations confirm header-height access; no internal package path or added dependency is used.
