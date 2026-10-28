# Plazza · React Native take-home

Expo SDK 58, React Native 0.88, React 19.3, strict TypeScript, and Expo Router. Android 13+ is the intended demo platform. The installed Expo and React Native versions are preserved.

**Demo catalog available:** `src/data/catalog.json` contains the user's 15 PDF-derived demo records. This is a temporary substitute, not the assignment's original attached catalog. The original-catalog submission requirement remains unresolved. The last EAS check reported no login, and physical-device verification is outstanding.

## Run

Use Node 22.13+ and npm (this repository has `package-lock.json`).

The supplied demo catalog is already in place. Install, check, and start Expo Go explicitly:

```sh
npm ci
npm run check:demo
npm run check
npm start -- --go --clear
```

Catalog preparation runs automatically for npm start/test/typecheck and installation. It generates a static import of the supplied file without changing its bytes, so Metro and EAS bundle those records locally. After replacing the file while Metro is running, restart with `npm start -- --go --clear`. Before using Expo CLI directly, run `npm run prepare:catalog`. Replace this temporary data with the original, unchanged catalog before the final assignment submission.

Android Expo Go is detected with SDK 58's `isRunningInExpoGo()` before importing `expo-notifications`; its notification status is deliberately unavailable. This avoids the missing `ExpoTopicSubscriptionModule` import. Detection does not rely on `StoreClient`, which may also identify development clients. Custom development and standalone APKs retain native notification channel and permission handling. Foreground location and Settings-return checks remain in both environments. Use a custom APK for native notification verification; no actual-device runtime result is claimed.

## Check

```sh
npm run check:demo            # supplied static preflight, not native verification
npm run check                 # strict TypeScript, ESLint, Jest
npm test -- --coverage
npx expo install --check
npx expo-doctor
npm run bundle:android        # Hermes JavaScript export, not an APK
```

Latest stabilization: **124 tests across 13 suites passed**, with clean TypeScript/lint, passing demo preflight, required catalog preparation, dependency compatibility, and Android Hermes export. The exported bundle contains all 15 medicine names. A component integration test verifies name/salt search, rendered cards, Add, and shared Home/Cart quantities using mocked native surfaces. Visual and physical-device QA remain unverified. See [NOTES.md](NOTES.md).

## Build APKs with EAS

The supplied temporary catalog can be used for a demo build. Run preflight and the required catalog preparation before EAS:

```sh
npm run check:demo
npm run prepare:catalog -- --required
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile debug
npx eas-cli@latest build --platform android --profile preview
```

`debug` runs **`:app:assembleDebug`** with a development client. After installing, run `npm start -- --dev-client --clear` and connect the phone to Metro. USB users can run `adb reverse tcp:8081 tcp:8081`.

`preview` produces an internally distributed, standalone **release APK** for a demo without Metro. It is not called a debug build. The EAS post-install hook requires a catalog file and generates its bundled import; this presence check cannot establish original-catalog provenance. Both profiles use `com.plazza.rninterview`. No completed EAS build or APK artifact is claimed.

Download the actual completed build from the URL EAS prints. Install directly on the phone, or run `adb install -r /absolute/path/to/downloaded.apk`. Follow [the Android checklist](docs/ANDROID_CHECKLIST.md); Android Studio is not required.

## Code map

- `src/app/(tabs)` — exactly Home and Cart; route files re-export screens.
- `src/domain` — immutable cart operations, search, coupon registry, and bills.
- `src/state` — shared reducer/context and native notices.
- `src/storage` — versioned snapshot validation and serialized writes.
- `src/features` — search, cart, and foreground permission lifecycle.
- `src/components` and `src/theme` — reusable UI and styling tokens.
- `scripts/prepare-catalog.cjs` — generates an ignored import of the supplied catalog; never creates medicines.
- `tests` — synthetic fixtures and automated boundary/regression tests.

The previously edited starter Home file is preserved byte-for-byte in [docs/starter-home.tsx.txt](docs/starter-home.tsx.txt), outside Router and TypeScript compilation. Nothing was pushed.
