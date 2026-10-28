# Plazza

**Medicine delivery, made simple.** A focused, offline-first React Native Android app built for the Plazza frontend take-home assessment.

[![CI](https://github.com/cybervirus997/plazza_app/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/cybervirus997/plazza_app/actions/workflows/ci.yml)
![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000000?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Android 13+](https://img.shields.io/badge/Android-13%2B-3DDC84?logo=android&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-144%20passing-22a06b)

Plazza demonstrates a complete **discover → search → cart → coupon → mock checkout** experience, with Android permission handling, persistent shopping state, deterministic billing and an extensible promotion engine. Everything runs on-device; no API, payment integration or backend is required.

**Explore:** [Features](#features) · [Quick start](#quick-start) · [Demo walkthrough](#demo-walkthrough) · [Architecture](#architecture) · [Testing--ci](#testing--ci) · [Android builds](#android-builds) · [Decisions & limitations](#decisions--limitations)

## Features

| Area | What is implemented |
| --- | --- |
| **Native permissions** | Foreground location and Android 13+ notification permission flows; granted/denied/blocked states; App Settings shortcut; recheck when returning to the app; a Home debug-status panel and coordinate-based delivery label. |
| **Discover & search** | Home previews real catalog items; Browse lists the complete local catalog; name **and** ingredient/salt search; live suggestions, matching results and empty/loading/no-results states. |
| **Recent searches** | Five most recent committed searches, deduplicated and restored after relaunch. |
| **Cart** | Add, increment, decrement and remove; per-medicine `maxQty` enforcement; Rx badges; synchronized controls across Home, Browse and Cart. |
| **Coupons & billing** | Four coupon types, one active at a time, automatic revalidation on cart changes and an explanatory Android toast when an applied coupon becomes invalid. |
| **Mock checkout** | Order confirmation, cart reset and local redemption of one-time coupons—without a real order or payment backend. |
| **Reliability** | Versioned AsyncStorage, defensive restoration of corrupted data, serialized writes, strict TypeScript and accessibility-minded controls. |

The navigation intentionally has **two bottom tabs—Home and Cart**. Browse is a separate stack screen, so medicine discovery does not add a third tab.

### Coupon rules

| Code | Benefit | Eligibility |
| --- | --- | --- |
| `FLAT50` | ₹50 off | Item total ≥ ₹300 |
| `SAVE10` | 10% off | Discount capped at ₹100 |
| `FREEDEL` | Free delivery | Waives the delivery fee |
| `FIRST100` | ₹100 off | Item total ≥ ₹200; redeemable once after a successful mock order |

Only one coupon may be active. When a cart change breaks eligibility, the coupon is **automatically removed** and an explanatory notice is emitted.

**Bill calculation:** ₹40 delivery for a **positive item total below ₹499**; free delivery at ₹499 and above. Eligibility uses the item total *before* discounts, and the monetary discount never exceeds that total. Empty carts incur no delivery charge.

## Demo walkthrough

A quick sequence for reviewing the key requirements:

1. **Open Home:** review the delivery coordinates and permission debug panel; allow or deny access without blocking shopping.
2. **Discover:** browse all 15 catalog records without typing. Notice ingredient names, prices and Rx badges.
3. **Search:** try `Dolo` (medicine name) and `Paracetamol` (salt); observe suggestions and recent-search behavior.
4. **Build a cart:** add **2 × Allegra 120** (₹360), then open Cart to inspect quantity controls and the live bill.
5. **Test coupon invalidation:** apply `FLAT50`; reduce Allegra to 1 (₹180). The coupon no longer meets the ₹300 minimum and is removed with an explanation.
6. **Place a mock order:** add eligible items, apply `FIRST100` and place the order. The cart clears, and a later attempt to reuse `FIRST100` is rejected.
7. **Check persistence:** restart the app to confirm the cart/recent-search state and one-time coupon redemption are restored as applicable.

For the **native Android permission lifecycle and actual toast**, use a custom APK on an Android 13+ phone; Expo Go is not an equivalent verification environment.

## Tech stack

| Layer | Choice |
| --- | --- |
| Application | Expo SDK 58 · React Native 0.88 · React 19.3 |
| Language | TypeScript (strict) |
| Navigation | Expo Router |
| Shared state | React Context + `useReducer` |
| Persistence | `@react-native-async-storage/async-storage` |
| Device APIs | `expo-location` · `expo-notifications` · React Native AppState/Linking |
| Testing | Jest + `jest-expo` |
| CI & cloud builds | GitHub Actions · EAS Build |

## Quick start

**Requirements:** Node.js **22.13+** (Node 24 recommended), npm and a physical Android device for final native verification. **Android Studio is not required** when using Expo Go or EAS cloud builds.

```bash
git clone https://github.com/cybervirus997/plazza_app.git
cd plazza_app
npm ci
npm run check
npm start -- --go --clear
```

Scan the QR code using **Expo Go** on Android. Expo Go is useful for shopping and location-flow development. To avoid an unsupported Expo Go native-module load, this project marks **notification permission as unavailable in Expo Go**; test notification permission requests with the custom APK instead.

### Local catalog

The app loads `src/data/catalog.json` and ships its contents locally; no external API is used. Catalog preparation runs through npm lifecycle scripts and generates an ignored static TypeScript import for Metro/EAS.

```bash
npm run prepare:catalog -- --required   # require and validate a local catalog
npm run check:demo                     # local preflight / configuration checks
```

After changing the JSON, restart Metro with `--clear`.

> **Catalog provenance:** The checked-in 15-record catalog was reconstructed from the medicine table in the assignment PDF because the separately attached original `catalog.json` was not available. It is a documented demo substitute, **not** a claim that the required original file was supplied. See [NOTES.md](NOTES.md).

## Architecture

```text
src/
├── app/                # Expo Router layouts; Home/Cart tabs + Browse route
├── features/           # Search, cart and permission screens/flows
├── components/         # Shared medicine cards, quantity controls and UI
├── domain/             # Pure search, cart, coupon and bill calculations
├── state/              # Shared reducer, Context and user notices
├── storage/            # Versioned, validated AsyncStorage snapshots
├── data/               # Local catalog and catalog loader
└── theme/              # Design tokens
tests/                  # Domain, state, storage, permissions and UI tests
scripts/                # Catalog preparation and demo preflight
```

**Key decisions**

- **One cart source of truth:** reducer actions enforce quantity limits independent of UI disabled states. Home, Browse and Cart read the same state.
- **Pure, testable business logic:** coupon eligibility and bill calculations live in `src/domain/`, not in JSX. New coupon types are added through the coupon-rule registry.
- **Derived totals:** item total, discount, fee and grand total are calculated from current cart state rather than persisted.
- **Defensive persistence:** versioned snapshots validate saved data, recover safely from missing/corrupt records and serialize writes.
- **Permission isolation:** Expo Go skips unsupported Android notifications-module loading; custom builds retain notification channel and permission support.

Detailed trade-offs and decisions are recorded in [NOTES.md](NOTES.md).

## Testing & CI

Run the same core checks used by the GitHub workflow:

```bash
npm run check                       # TypeScript + ESLint + Jest
npm test -- --coverage              # domain/state/storage coverage
npm run check:demo                  # local preflight
npx expo install --check            # Expo-compatible dependency versions
npx expo-doctor                     # project health checks
npm run bundle:android              # JS/Hermes export; NOT an APK
```

**Last reported local verification (28 October 2026):** **144 tests passed across 16 suites**, TypeScript and ESLint passed, and Expo Doctor reported **20/20**. GitHub Actions [also passed on commit `70f2065`](https://github.com/cybervirus997/plazza_app/actions/runs/40705032679). These checks validate code and mocked UI behavior, **not** native permission dialogs or real-device interactions.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on **push**, **pull request** and **manual dispatch**, using Node.js 24, `npm ci`, required catalog preparation, TypeScript, lint and tests. No emulator or EAS credentials are required.

## Android builds

The repository includes two EAS profiles:

| Profile | Output | Usage |
| --- | --- | --- |
| `debug` | Gradle `:app:assembleDebug` APK with development client | Requested debug artifact; typically connects to Metro |
| `preview` | Installable standalone release APK | Independent demo without Metro |

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile debug
# Optional standalone demo build:
npx eas-cli@latest build --platform android --profile preview
```

The project is already configured for EAS under the Android package `com.plazza.rninterview`. View actual artifacts and build-specific commit IDs in the [EAS build history](https://expo.dev/accounts/cybervirus/projects/rn-interview/builds). A [debug APK build succeeded for an earlier repository snapshot](https://expo.dev/accounts/cybervirus/projects/rn-interview/builds/172a036d-8fd6-4298-93db-8ec2bd276ab6); confirm the commit associated with any APK before treating it as the latest source.

After installing a **debug** APK, run:

```bash
npm start -- --dev-client --clear
```

Connect the device to Metro (typically over the same Wi-Fi). For a USB-connected Android device with ADB configured, `adb reverse tcp:8081 tcp:8081` is another option. See the [Android device test checklist](docs/ANDROID_CHECKLIST.md).

## Decisions & limitations

This is an **assessment prototype**, not a production pharmacy or real delivery service.

- The currently bundled catalog is a **PDF-derived substitute**; the separately supplied original catalog remains an outstanding input.
- Checkout is **mock-only**. There is no order API, payment, prescription upload, real delivery estimate, or tracking.
- One-time coupon use is **local to this installation**. Clearing app data or uninstalling resets it.
- Native permission dialogs, blocked → Settings → return behavior, Android toast visibility, force-close persistence and accessibility on a physical device require recorded device verification. Automated tests alone do not establish those outcomes.
- A debug APK may require Metro. The preview profile is intended for a standalone demonstration.

See the [complete requirements audit](docs/REQUIREMENTS_AUDIT.md) for requirement-by-requirement implementation and verification status. [NOTES.md](NOTES.md) covers assumptions, architecture trade-offs, testing evidence, AI-assisted implementation/review, and improvements with more time.

---

**Built as an AI-assisted take-home exercise.** All application data is local; the codebase is intentionally structured so that product behavior, edge cases and changes can be explained and tested independently.
