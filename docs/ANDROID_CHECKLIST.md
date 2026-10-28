# Android 13+ device verification

**Not executed by the agent.** The current 15-record catalog is a user-supplied PDF-derived demo substitute. Record its provenance with device model, Android version, build ID/profile, and pass/fail notes. Repeat relevant checks with the original attached catalog before final submission.

For a quick Expo Go shopping/location check, run `npm start -- --go --clear`. Android Expo Go must report notifications **unavailable** and must not import `expo-notifications` or display the topic-module error. Notification permission/channel verification requires an actual completed custom APK. For the debug APK, use `npm start -- --dev-client --clear`.

1. **Startup and explicit access:** use an existing compatible build. Home startup reads status without permission prompts or GPS acquisition. Open the gear → App Permissions and explicitly Enable access to request eligible location/notification permissions. In a custom build, check the notification channel in Android Settings. Deny either permission; Home and Cart must remain usable. Reopen: do not prompt automatically, including on a first foreground after a background launch. Do not build or reset user data automatically for this check.
2. **Device GPS versus delivery:** in App Permissions, grant foreground access or tap **Update Location** if already granted. Coordinates must be labelled Device GPS, with readable separate latitude/longitude fields. Home must retain the selected saved address; a GPS fix must not choose/change it or its default. Refresh retains an authorized cached fix without another acquisition when access is unchanged. Turn GPS off and explicitly Update Location; check the GPS-off fallback. Turn GPS back on and explicitly update again. No address verification or background tracking is expected.
3. **Blocked:** follow the OS denial flow until it reports `canAskAgain: false`. Do not infer blocked from a fixed number of denials. Check the blocked explanation and Open Settings. Grant access in Settings and return directly: statuses and coordinates should refresh without another prompt.
4. **Search:** with the supplied demo catalog, search `Dolo` by name and `Paracetamol` by salt, then vary case and whitespace. Check loading, results, and no-results. Rapidly edit/clear: old results must not replace the latest query. Submit six queries: only the newest five remain. Tap an existing recent query: it moves to the front. Typing alone must not save history. Repeat with the original catalog for submission.
5. **Cart:** add from Home, switch to Cart, increment/decrement/remove, and return Home. Quantities and tab count must agree. Rapidly increment at maxQty: it must never exceed the catalog maximum. Decrement from one: the item disappears. Check Rx badges on both tabs.
6. **Coupons:** try invalid and mixed-case, whitespace-padded codes. Check FLAT50 below/at ₹300, FIRST100 below/at ₹200, SAVE10 at 10% and the ₹100 cap, and FREEDEL below the delivery threshold and on an already free-delivery cart. Another valid code replaces the active code. An invalid attempt preserves the existing valid code.
7. **Auto-removal:** apply FLAT50, then reduce item total below ₹300. Check removal, a persistent explanation, and the actual Android toast. Increase an eligible cart: its valid coupon remains. Empty the cart: its coupon clears.
8. **Bill:** make ₹498/₹499/₹500 item totals if the original catalog permits them. Delivery should be ₹40/₹0/₹0. Check that discounts do not change delivery eligibility. Compare each bill with a hand calculation. Automated fixtures cover exact totals even if the catalog cannot make them.
9. **Restart:** fill the cart, activate a coupon, submit recent searches, wait for storage writes, force-close, and reopen. Quantities, eligible coupon, and searches should restore without clearing app data.
10. **FIRST100:** apply and restart without ordering: it remains unused. Place a demo order with it active: check the accessible success alert, empty cart, and cleared coupon. Restart, add eligible items, and enter FIRST100 manually: it must be rejected as redeemed.
11. **Small phone/accessibility:** use enlarged fonts and TalkBack. Check button labels, Rx badges, permission messages, errors, totals, and confirmation. Open the coupon keyboard: Apply and Place Order must remain reachable. Check safe areas, scrolling, and Android back.
12. **Independent demo:** close Metro and open preview: search/cart/persistence/coupons should work. Debug may need Metro. Do not substitute preview when the evaluator requests a true debug build.

USB helpers, without Android Studio:

```sh
adb devices -l
adb shell getprop ro.build.version.release
adb install -r /absolute/path/to/downloaded.apk
adb reverse tcp:8081 tcp:8081
adb shell am force-stop com.plazza.rninterview
```

Uninstalling or clearing app storage resets FIRST100 by design; this is a local demo with no server identity.

## P0 permission lifecycle regression checklist

**Not executed on a physical device.** Use a freshly built feature-branch APK, record its commit/build ID, Android version, manufacturer, approximate/precise location setting and each result. Do not infer these outcomes from Jest. Android Expo Go and a custom debug/preview APK must be checked separately.

P2.5 Part 2 moves this UI to App Permissions and makes startup status-only. The historical P0 counts below describe that earlier verification; current Part 2 evidence and the Home/search/scan phone pass are in [P2_5_PART2.md](P2_5_PART2.md). No new APK build is authorized automatically.

Automated verification on 29 October 2026: `npm run typecheck`, `npm run lint`, `npm test` and `npm run check` passed. All 161 Stage 1 cases remain, with 34 additional permission cases: **195 tests / 20 suites**. These cover status-only refresh, grants/revocation, Settings/AppState/focus transitions, concurrency, fresh reads after pending native calls, stale GPS/status/Settings results, unmount/StrictMode, missing modules, failures and timeouts.

- **Explicit permission sequence:** startup must not prompt or acquire GPS. In App Permissions, choose Enable access, then grant foreground location and notifications. Expect one prompt per eligible permission, the `orders` channel in a custom build, and one location attempt after the explicit grant. A previously granted installation waits for Update Location. Repeat with approximate access; no background-location permission is requested.
- **Denial and blocking:** deny location, then Refresh repeatedly. No prompt or coordinates should appear. Enable access may prompt only while `canAskAgain` is true. For blocked access, Open Settings must be available; Update Location must be absent. Denying notifications must not disable shopping or location.
- **Status-only Refresh:** with location already granted and a displayed fix, move or wait and tap Refresh repeatedly. It must not start another position request or open a prompt. In a debug session, trace/break on `getCurrentPositionAsync` to verify the call count. Update Location should start one request; rapid duplicate taps should not add requests.
- **Settings grant:** block location, open Settings, grant foreground access, and return directly. Status should become granted without a second prompt and start one new location attempt. Returning again with unchanged permission should preserve the authorized cached fix and avoid GPS acquisition.
- **Settings revocation:** while coordinates are displayed, revoke location in Settings and return. Coordinates must remain hidden until the OS check completes, then remain cleared with denied/blocked status. Repeat while a location fix is still pending; a late result must not restore coordinates.
- **Background/focus transitions:** rapidly switch apps during checks and during a location update. Also open/close the Android notification drawer without leaving the app. Check that return/focus rechecks coalesce, old results stay hidden, no extra prompts appear, and the panel leaves Checking/Updating when the relevant operation finishes.
- **GPS services:** disable GPS in Quick Settings, return, and tap Update Location. Expect a GPS-off message and no position acquisition. Enable GPS and explicitly Update Location to recover. Permission Refresh alone must not acquire a fix.
- **Slow/failed acquisition:** test poor indoor reception and a native error if reproducible. The UI must leave Updating after the timeout and shopping must remain usable. If Android is still finishing the timed-out request, another update must report that state rather than start an overlapping request. Once it settles, explicit retry should work. A permanently hung, uncancellable native call can require an app restart.
- **Notifications:** custom Android 13+ APK must create the channel before requesting permission. Check grant, denial, blocking, Settings grant/revocation and return without an automatic repeat prompt. Android Expo Go must show notifications unavailable and never load the unsupported notification module. A missing native module should report unavailable rather than crash.
- **Settings launch failure:** if no Settings activity or a launch timeout can be reproduced, the panel must show the manual Settings fallback and recover on retry/Refresh. A delayed launch error after returning must not overwrite newer state.
- **Unmount/reload:** navigate around Home/Cart/Browse, reload during a pending request and remount in development. Check for duplicate prompts, stale-coordinate flashes and React updates after unmount. Permission operations must not alter the 57-product catalog, cart quantities, coupons or saved shopping state.

Implementation follows [Expo SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [SDK 58 Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) and [React Native AppState](https://reactnative.dev/docs/appstate).
