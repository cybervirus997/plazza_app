# P2 stabilization — navigation, UX and code health

Implemented on `feat/plazza-commerce-mvp`, starting at `eefd7d7`. Independently verified baseline: **432 tests / 32 suites**, TypeScript and lint passing. `master`, the pre-existing `app.json` bytes, AGENTS.md, dependency versions and native build configuration are preserved. No P3 tracking, membership, experiments, analytics or new product flow was added.

## Diagnosed navigation issues and exact corrections

These are source/API findings verified against the installed SDK 58 Router and its real stack reducer. They do not prove that the reported native shaking has been reproduced or eliminated on a device.

| Confirmed issue | Cause | Correction |
| --- | --- | --- |
| Back behaved like a forward replacement | Payment used `replace('/cart')`; Receipt used `replace('/orders')`. Native replace defaults to a push-style transition and creates a new target entry instead of popping the original. | `backTo` pops the actual origin. Payment falls back to Checkout; Receipt falls back to History. Confirmation → Receipt is forward navigation, so Back returns to Confirmation; History → Receipt returns to the original History entry. |
| Repeated tabs stacks | Edit Cart used `push('/cart')`; Continue Shopping/History Home used `replace('/')`. Those operations could leave earlier tabs/checkout entries behind. | `returnToShop` uses `dismissTo` for the existing Home/Cart tabs entry, retaining its key. Review choices move to a tiny UI-only provider so a correct pop does not lose method/delivery/simulator choices. |
| Wrong return semantics for retry | Failed/cancelled review and pending resume used unrelated replacements. | Review dismisses to Checkout; forward/resume actions use `navigate`. Payment completion is the deliberate replacement, after the existing durable result. |
| Inconsistent transition policy | Root Stack configured only `headerShown`; horizontal Android direction and replacement intent were unspecified. | Stable shared `slide_from_right` options, reverse native pops, explicit pop direction for returning replacement fallbacks, immediate tabs, matching content background and SDK 58 tabs anchor. Reduced-motion OS query/events select `none`. No per-screen animation timers. |
| Old asynchronous callbacks could navigate on a later focus visit | The old boolean focus getter became true again after blur/refocus. It did not identify the request's original visit or prevent duplicate completion redirects. | Capture a generation before awaiting. Reject inactive/older visits, allow one navigation per visit, and reuse the same guard for address selection. Keep persistence independent of screen focus. |
| Conflicting Android keyboard adjustments | Cart applied KeyboardAvoidingView `height` while the existing application configuration already used native `resize`. | Disable the extra Android adjustment; retain iOS padding and the existing native configuration. Address form avoidance and its unsaved/saving Back guard remain intact. |
| Clearing a category remounted Browse | `replace('/browse')` changed route identity, losing the local query/focus and introducing a navigation transition for a filter operation. | Update `categoryId` with `setParams` in place. A regression preserves the typed query while changing the category. |
| Duplicate forward address/P2 entries were possible | Unconditional pushes created another copy on repeated entry actions. | Address/book form and P2 forward/resume entries use `navigate`; real SDK reducer tests verify same-route reuse. |

There was no source evidence of a repeating root-remount or infinite redirect loop. The existing recovery-before-hydration gate is retained. The root Stack receives stable shared options and is not keyed/remounted for payment-status changes. Native animation smoothness, gesture direction and keyboard behavior still require device observation.

## Payment and Order UX

- Shared static StatusPanel/StatusBadge pair icon, explicit heading, explanation and tone. Pending/reconciliation use an amber clock; failure uses a red error; cancellation is neutral; only durable completion uses the positive check.
- Failed attempts offer Retry Payment and Change Method through reviewed checkout. Cancelled attempts offer Back to Checkout and Change Method. These are deliberate review actions, not automatic new attempts or simulated bank refunds.
- Payment shows its saved total/attempt. A finalized attempt shows its saved order ID, View Order and Continue Shopping. No payment-state write/order-creation protocol changed.
- History cards show actual `placed` fulfillment state, date, identifier, distinct product count/total quantity, concise frozen item preview, prominent frozen grand total and View Details. Incomplete checkout gets an additional amber reconciliation warning; failed payments are not orders.
- A former presentation bug labelled reconciliation as the order status even though the persisted fulfillment state was `placed`. Fulfillment and payment maps are now separately typed. No future dispatch/tracking state is invented.
- Receipt items share frozen line formatting outside JSX, with clearer name/quantity/price/line-total hierarchy. Existing BillSummary, immutable address/recipient instructions and legacy payment messages remain reused. No historical price/coupon/address lookup was introduced.
- Status updates are announced politely; selected choices now expose selected state and stable accessible names. Icons are decorative to screen readers. Flexible rows avoid fixed content heights and no new decorative animations were added.

## Targeted architecture and performance work

Pure `isRecord` validation moved from storage to `domain/validation.ts`; domain parsers, data validation and catalog metadata no longer depend on shopping persistence to use it. Storage retains a compatibility export, and its writer/serialization behavior is unchanged. Payment/fulfillment presentation and receipt formatting now have explicit view-layer owners. Shared focus tracking avoids duplicated subscriptions and removes unnecessary returned-callback memoization while retaining the stable subscription callback.

An actual render-work regression was reproduced before memoization: a shopping search-state update caused **one extra formatting call for an unchanged history card**. The immutable card now memoizes stable receipt/reconciliation/navigation props; the same regression produces zero extra formatting calls. This does not establish native frame-rate gains. FlatList keys remain stable.

Deliberately deferred: splitting AppStateProvider/adding a state library, generic repository/transaction abstractions, new caching/virtualization libraries, and a recovery-protocol rewrite. No demonstrated correctness/performance need justified those changes. The existing checkout coordinator, payment service, reducers, repositories, IDs, coupon rules and persisted schema semantics remain intact; only domain validator import ownership changed.

## Regression evidence and verification limits

All 432 baseline cases remain. Navigation coverage includes SDK stack actions for forward/pop/replace/dismiss semantics, retained tabs keys, ancestor review, receipt origin, bounded direct links and removal of Pay after completion. Existing address-form unsaved/saving guards remain tested. Added cases cover focus visit invalidation/duplicates, reduced-motion races/unmount, category-query retention, Checkout preference retention, Android avoidance configuration, status-specific actions/announcements, frozen totals/legacy data, fulfillment versus reconciliation and measured card work.

All pre-existing duplicate action, pending verification, journal/receipt/shopping write, FIRST100, restart, corruption and v1 restoration tests remain passing. See [engineering standards](ENGINEERING_STANDARDS.md) for future changes and [the Android checklist](ORDERS_ANDROID_CHECKLIST.md) for runtime verification.

Browser visual QA could not initialize in this session because the browser runtime import was restricted. No screenshot/layout inspection, Android animation smoothness, physical keyboard behavior, APK installation or native runtime verification is claimed. Static configuration/Jest and Hermes export cannot replace those checks. No EAS build or push was started.

References: [SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [stack transitions](https://docs.expo.dev/router/advanced/stack/), [SDK 58 anchor settings](https://docs.expo.dev/router/advanced/router-settings/), [React Native keyboard avoidance](https://reactnative.dev/docs/keyboardavoidingview), [reduced-motion events](https://reactnative.dev/docs/accessibilityinfo).


## Actual final checks

On 29 October 2026, `npm run typecheck`, `npm run lint`, `npm test`, `npm run check`, `npm run check:demo` and `npm run bundle:android` all passed. **462 tests / 35 suites**: all 432 baseline cases plus 30 new cases. Lint has no errors or warnings. Android export generated a **3.3 MB Hermes bundle, 1,483 modules and 32 assets** in ignored `dist/`. Static preflight warned that `adb devices` was unavailable/failed; Metro emitted non-blocking NO_COLOR/FORCE_COLOR warnings. These checks do not establish native animation smoothness.

Source commits: `98390f4` (navigation/keyboard/focus), `2e0567d` (payment/order UX), `f240611` (targeted architecture/render work). Engineering standards, this audit, the updated Orders documents and the [new-chat handoff](P2_STABILIZATION_HANDOFF.md) are committed together afterwards. See the handoff for remaining device checks and the address-form direct-link fallback edge case to inspect.
