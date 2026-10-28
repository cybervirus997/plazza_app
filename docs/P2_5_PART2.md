# P2.5 Part 2 — Home, search, delivery destination, permissions and scan demo

Implemented on 29 October 2026 on `feat/plazza-commerce-mvp`, starting from local Part 1 commit `78c7b61` and **478 tests / 36 suites**. Source commit: **`2a29d62`**. Documentation/smoke checklist follows in a separate local commit. Part 2 only; Parts 3–4 are not started.

## Confirmed issues and resulting behavior

- Home showed both a saved delivery-address entry and a GPS block labelled **YOUR DELIVERY LOCATION**. The permission adapter described coordinates as **Delivering to**, although those coordinates do not select the checkout destination. Home now shows only the Address Book's **selected** saved address with label, concise location, and visible Change/Choose action. The default address and device GPS do not substitute for that selection. Empty books offer **Choose Delivery Address**; manual entry remains independent of GPS. The accessible hint includes the complete selected address even when the visible Home summary is abbreviated.
- Permission-provider startup previously requested eligible permissions and could acquire GPS solely from its initial grant observation. Startup now only reads OS status, including a first foreground observation after a background launch. Explicit Enable access, later grant transitions/Settings returns, Update Location, status refreshes, revocation, concurrency and stale-result/unmount guards remain. The low-level initial-request compatibility helper stays exported but is no longer called by provider startup. No permission request occurs merely because Home renders.
- The large permissions panel occupied the shopping hierarchy and squeezed details/actions into a compact horizontal layout. The Home gear now opens **App Permissions** (`/app-permissions`), containing readable status rows, errors, Enable/Settings/Refresh/Update Location, runtime notification-module information and optional device GPS. Panels constrain width, status/action rows wrap, latitude/longitude occupy separate scalable text rows, and shared text actions can wrap within their container. Authorized coordinates remain gated while status is being verified. This addresses the source width constraints; device text layout is still unverified.
- Home now leads with a compact Plazza header, selected delivery destination and prominent search, followed by categories, a lighter catalog entry, the existing promotional hero and existing shelves. Duplicate introductory surfaces and developer panels are removed. The existing saved-payment recovery entry stays actionable; denied GPS alone does not create a Home warning. The existing single vertical FlatList and horizontal categories/shelves, product IDs, catalog repository and cart integration remain.
- `MedicineSearchBar` is a stable feature-owned component, with a nominal **56dp** field, flexible width, shorter name/salt placeholder, Clear and a separate **Scan medicine** control. Text can grow with font scale. Name/salt queries, six suggestions, committed results, recents, loading/error/empty states, Add/quantity limits and existing local-search debounce are preserved. No keyboard-dependent key or input remount is introduced.
- `/scan-medicine` is an isolated native Stack modal using existing navigation and reduced-motion policy. **Try sample scan** displays a fictional pack/company, synthetic batch and placeholder expiry. **Demo only — no authenticity verification** remains explicit before and after the sample. Close/Back returns to the actual origin or bounded Home fallback. It has no camera/scanner import, permission request, real scan, manufacturer/batch lookup, certification or shopping-state write.

Key owners: `features/home/HomeScreen.tsx`, `HomeHeader.tsx`, `features/search/MedicineSearchBar.tsx`, the existing `features/addresses/DeliveryAddressEntry.tsx`, `features/permissions/{AppPermissionsScreen,PermissionPanel,PermissionProvider}.tsx`, `permissions.ts`, and `features/scan/ScanDemoScreen.tsx`. New route files remain one-line exports. Existing Button/IconButton and Part 1 tokens are extended/reused; no second design system or generic Home framework was introduced.

## Actual verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed; also passed in final combined check |
| `npm run lint` | Passed without errors/warnings; also passed in final combined check |
| `npm test` | **491 tests / 37 suites passed** |
| `npm run check` | Passed typecheck, lint and **491 tests / 37 suites** |
| `npm run check:demo` | Passed static preflight; sandbox ADB discovery warning |
| `npm run bundle:android` | Passed: **3.4 MB Hermes, 1,492 modules, 32 assets** in ignored `dist/`; non-blocking NO_COLOR/FORCE_COLOR warnings |
| `git diff --check` | Passed |

All 478 baseline cases remain; **13 new cases** cover selected-versus-default/GPS semantics, denied GPS with shopping, empty address selection, Home hierarchy, diagnostics access/refresh/explicit grant/coordinate display, scan launch/sample/reset/dismissal and no permission requests, retained query/input identity, passive startup including background launch, and native Router route reuse. Existing native-header/reduced-motion tests now include the scan modal. A forbidden camera-module test stub fails if that module is loaded. Existing provider lifecycle cases now explicitly acquire GPS where their setup needs a fix; none of those scenarios was removed. The adapter's coordinate wording assertion intentionally changes to Device GPS.

Test adapters render configured native-header slots and keep covered Home mounted. They verify component/navigation intent and state retention, not real modal appearance, keyboard geometry, TalkBack focus or Android smoothness. No new browser screenshots or physical Android UX checks were performed for Part 2. The earlier user-reported Home reload on Samsung S20 FE / SM-G781B, Android 13, Expo Go predates this UI and does not sign it off.

## Android smoke checklist — pending actual observation

Use the existing compatible Expo Go/development session; record device, OS, runtime/commit and pass/fail. Do not reset existing storage or start a build automatically.

1. **Home hierarchy:** verify compact Plazza/Orders/gear, delivery destination and prominent search before categories/promotions. Scroll shelves; add a medicine/demo product and confirm quantities and existing Cart badge still agree. No developer panel or repeated GPS-denial warning should dominate Home.
2. **Destination:** choose an address different from the default. Verify its label/location and Change action. Deny/revoke GPS or acquire another fix: the selected/default address must stay unchanged. With an empty test book, Choose Delivery Address must allow manual entry without GPS. Do not clear the user's book just to make an empty state.
3. **Search/keyboard:** try `Dolo`, `Paracetamol`, case/whitespace, suggestions, selection, submission, recents, clear and no matches. Rapidly type/clear. Open/close the keyboard and switch tabs; retain query/input focus when appropriate and avoid jumping/overlap. Results and Add controls remain reachable without an overlay covering them.
4. **Scan:** type a query, tap the separate scan icon twice quickly; expect one native modal. Try sample scan and Start again. Read the demo/authenticity disclaimer and clearly synthetic fields. No camera or OS permission prompt appears. Close and system Back return to the same Home query/cart; repeat with reduced motion enabled.
5. **Diagnostics:** gear → App Permissions. Verify status, blocked/error and notification-unavailable explanations, Refresh, Enable access, Settings and explicit Update Location. Refresh with unchanged access must not prompt or acquire GPS. In an eligible custom build, notification permission/channel checks stay behind explicit Enable; Android Expo Go remains unavailable without loading its unsupported notification module.
6. **Permission lifecycle:** cold-start/reload, including already granted access and a background launch: status may be checked, but no startup prompt or GPS acquisition. Explicitly grant access/return from Settings; verify the existing grant/refresh behavior. Revoke during acquisition; hide stale coordinates and retain saved addresses/search/cart.
7. **Small screen/font scale/TalkBack:** verify wrapping for status rows, long errors, coordinates, actions, address summaries and search. Check 48dp Back/gear/scan/clear/actions, separate scan announcement, complete destination hint, modal focus and reliable system Back. Coordinate details must remain readable in diagnostics without truncated single-line strings.

## Protected boundaries

No Orders/Payment screen redesign, snackbar, floating cart, Profile, Share, P3, backend or real verification was added. Commerce domain/repositories/storage/state, checkout journaling/recovery/FIRST100 semantics, catalog data, Address Book state ownership and persisted schemas are unchanged. No dependencies/native modules/native folders or AGENTS.md changes. No push or EAS/APK build.

`master` remains `70f2065da481e42fc4db7c262ad29d93140aec77`. The user's uncommitted `app.json` is excluded from commits and retains SHA-256 `3d0fd8c17ed6e4872c891bf90a3489e8a846a05b10a984aadfaeb7f9d307eef6`.

Narrow API references: [SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [Router modals](https://docs.expo.dev/router/advanced/modals/), [SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/). No additional architecture research or package installation was needed.
