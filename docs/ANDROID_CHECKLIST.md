# Android 13+ device verification

**Not executed by the agent.** Use the original catalog and an actual completed custom APK. Record Android version, device model, build ID/profile, and pass/fail notes.

1. **Fresh install:** install preview or debug. Location and notifications should request access once. Check the notification channel in Android Settings. Deny either permission; Home and Cart must remain usable. Reopen: an already denied permission must not prompt automatically.
2. **Location:** grant foreground access. Confirm `Delivering to: <latitude>, <longitude>`. Turn GPS off and tap Refresh; check the GPS fallback. Turn GPS back on and refresh. No street address or background tracking is expected.
3. **Blocked:** follow the OS denial flow until it reports `canAskAgain: false`. Do not infer blocked from a fixed number of denials. Check the blocked explanation and Open Settings. Grant access in Settings and return directly: statuses and coordinates should refresh without another prompt.
4. **Search:** search an original medicine name and a partial salt, varying case and whitespace. Check loading, results, and no-results. Rapidly edit/clear: old results must not replace the latest query. Submit six queries: only the newest five remain. Tap an existing recent query: it moves to the front. Typing alone must not save history.
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
