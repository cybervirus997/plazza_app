# Plazza · React Native take-home

Expo SDK 58, React Native 0.88, React 19.3, strict TypeScript, and Expo Router. Android 13+ is the intended demo platform. The installed Expo and React Native versions are preserved.

**Submission is not complete:** the original assignment `catalog.json` was not supplied, EAS is not logged in, and no physical device was available to the agent. The app reports catalog unavailability and never substitutes synthetic medicines. Domain tests use isolated fixtures.

## Run

Use Node 22.13+ and npm (this repository has `package-lock.json`).

1. Add the **original, unchanged** `catalog.json` at `src/data/catalog.json` (preferred) or the repository root. The loader expects the assignment's medicine array.
2. Install and start:

```sh
npm ci
npm run check
npm start -- --clear
```

Catalog preparation runs automatically for npm start/test/typecheck and installation. After adding the file while Metro is running, restart with `npm start -- --clear`. Before using Expo CLI directly, run `npm run prepare:catalog`.

Use a custom development APK for native permission testing. An Expo Go client connected to the server reported a missing `ExpoTopicSubscriptionModule` in SDK 58's notifications package. The app catches that optional import failure, keeps shopping available, and marks notifications unavailable. A regression test covers this fallback; physical-device verification is outstanding.

## Check

```sh
npm run check                 # strict TypeScript, ESLint, Jest
npm test -- --coverage
npx expo install --check
npx expo-doctor
npm run bundle:android        # Hermes JavaScript export, not an APK
```

Latest checks: **112 tests in 10 suites**, TypeScript and lint passed, Expo Doctor **20/20**, and online SDK dependency validation passed. Android Hermes and web server/client exports passed. Visual QA was blocked by the Browser integration's module restriction. See [NOTES.md](NOTES.md) for verification scope and gaps.

## Build APKs with EAS

First supply the original catalog, then:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile debug
npx eas-cli@latest build --platform android --profile preview
```

`debug` runs **`:app:assembleDebug`** with a development client. After installing, run `npm start -- --dev-client --clear` and connect the phone to Metro. USB users can run `adb reverse tcp:8081 tcp:8081`.

`preview` produces an internally distributed, standalone **release APK** for a demo without Metro. It is not called a debug build. The EAS post-install hook rejects builds without the original catalog. Both profiles use `com.plazza.rninterview`. No EAS build has completed and no APK artifact is available.

Download the actual completed build from the URL EAS prints. Install directly on the phone, or run `adb install -r /absolute/path/to/downloaded.apk`. Follow [the Android checklist](docs/ANDROID_CHECKLIST.md); Android Studio is not required.

## Code map

- `src/app/(tabs)` — exactly Home and Cart; route files re-export screens.
- `src/domain` — immutable cart operations, search, coupon registry, and bills.
- `src/state` — shared reducer/context and native notices.
- `src/storage` — versioned snapshot validation and serialized writes.
- `src/features` — search, cart, and foreground permission lifecycle.
- `src/components` and `src/theme` — reusable UI and styling tokens.
- `scripts/prepare-catalog.cjs` — generates an ignored import of the original; never creates medicines.
- `tests` — synthetic fixtures and automated boundary/regression tests.

The previously edited starter Home file is preserved byte-for-byte in [docs/starter-home.tsx.txt](docs/starter-home.tsx.txt), outside Router and TypeScript compilation. Nothing was pushed.
