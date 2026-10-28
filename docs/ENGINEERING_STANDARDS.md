# Plazza engineering standards

Read [AGENTS.md](../AGENTS.md) first. Its Expo SDK/documentation, Router, dependency and native-project rules remain authoritative. These conventions describe this repository; they do not introduce a framework or another state library.

## Ownership and dependencies

| Location | Owns |
| --- | --- |
| `src/app` | Route composition, layout configuration and thin screen entry points |
| `src/features` | Feature screens, workflows, hooks and local UI state |
| `src/domain` | Pure types, validation, pricing and state-transition rules; no React, native, feature, repository or storage imports |
| `src/repositories` | Replaceable interfaces and data adapters; explicit schema/version handling |
| `src/storage` | Low-level storage ports, serialization and the existing shopping writer |
| `src/state` | Shared shopping state, hydration and composition of the checkout/payment services |
| `src/navigation` | Shared Router intent and stack transition policy, without persistence/business rules |
| `src/components/ui` | Presentation primitives with demonstrated reuse and no repository knowledge |
| `src/theme` | Consistent colors, spacing, typography and money display |

Keep asynchronous storage out of screens. Pass repositories/ports through existing injection boundaries. Keep shopping, payment, receipts, saved addresses and OS permission state distinct. Checkout preferences are only ephemeral method/slot/simulator UI choices: they survive an Edit Cart pop but own no cart, bill, address, payment outcome or persisted data.

Pure object validation lives in `domain/validation.ts`. The storage compatibility export remains for existing callers. Avoid importing a storage implementation merely to use a type guard. Name modules for their responsibility, not their line count; do not split a file without a clearer API/owner.

## Domain, receipts and persistence

- Preserve original medicine IDs, coupon/quantity rules and all existing shopping behavior.
- Derive live pricing through the existing domain functions. Render historical values from frozen receipts; never resolve them against current catalog/address/coupon state.
- Receipt line display uses snapshot unit prices and quantities through the shared presentation helper. Do not duplicate pricing/eligibility calculations inside JSX.
- A missing key may be healthy empty data. Damaged/unsupported history or unresolved journals must never be reset or overwritten implicitly.
- Preserve version-1 shopping/checkpoint, receipt, address and payment compatibility. Unknown versions/ambiguous outcomes block destructive writes. Add schema changes only with explicit backwards-compatibility and corruption tests.
- Use the existing serialized shopping writer. Do not add a second cart writer, parallel coupon-redemption write or storage call from a screen.
- Only the checkout coordinator creates receipts/finalizes shopping. Payment success/COD confirmation triggers it with the original immutable intent. Pending/failed/cancelled payment does not place an order or redeem FIRST100.
- Treat rejected storage acknowledgements as uncertain commit outcomes. Retry the same identity; do not compensate by deleting receipts or silently discarding journals.
- Do not refactor the crash-recovery protocol for cosmetic cleanup. Require a demonstrated correctness need and preserve all failure-injection coverage.

## Hooks and lifecycle

Use hooks for coherent state/effect ownership, not to hide unrelated operations. Keep pure transforms outside hooks. Scope async work to the provider lifetime/recovery generation; check again between persistence phases and before publishing results. Native promises already in flight may finish after unmount, so recovery must reconcile their durable bytes.

Native stacks can keep covered screens mounted. `useScreenActive` answers only current focus. For async navigation, capture `useScreenCompletion()` **before** awaiting; the returned token rejects blur/refocus results and permits one navigation per focus visit. Do not navigate directly from render or repeatedly redirect from payment status effects.

Use `useCallback` when an effect/subscriber or a measured memoized child needs stable identity. Do not add memoization everywhere, include `ref.current` as reactive state, suppress Compiler/dependency lint rules, or use timers to hide lifecycle/layout bugs. Remove manual memoization that has no consumer requiring stable identity.

## Navigation and keyboard

- Fetch installed-version Expo docs before changing Router/native APIs. SDK 58 uses `unstable_settings.anchor`; do not introduce deprecated `initialRouteName` layout settings from old examples.
- Forward to a screen with `navigate`; use `push` only when another distinct stack instance is intended. Repeated forward actions should not duplicate the same P2 route.
- Back means `backTo(fallback)`: pop the actual origin; use the bounded fallback only without history. Receipt Back must return to History or Confirmation according to its origin.
- Return to Home/Cart with `returnToShop`, which dismisses to the existing tabs route. Never push/replace a new tabs stack to edit Cart or continue shopping.
- Review a failed/cancelled payment through `reviewCheckout`; revalidate before creating a new attempt. Saved preferences preserve the user's choices through the corrected pop flow.
- Replace Payment with Confirmation only after durable finalization. Status changes within Payment update UI in place. Do not reopen Pay for an already finalized attempt.
- Share `stackOptions`: horizontal native pushes and corresponding reverse pops, consistent background, explicit returning replacement direction. Tabs switch immediately. Reduced-motion preference disables transitions; no decorative payment animations are necessary.
- Filters update route parameters/state in place; do not replace a screen and lose its focused input just to clear a category.
- Keep the address form's existing unsaved/saving `usePreventRemove` guard. Do not bypass it from toolbar/system Back.
- Android already uses native `resize`; do not add a second height adjustment in Cart. iOS retains keyboard padding. Keep inputs defined at stable component positions and preserve safe areas/sticky actions.

## UI reuse, accessibility and errors

Use shared StatusPanel/StatusBadge for icon, tone and text presentation. Keep payment-attempt and fulfillment types/maps separate. A `placed` receipt remains `placed` while checkout reconciliation is pending; show the latter as an additional warning, not a fulfillment state. Only a durably finalized order receives the positive confirmation treatment. Do not invent tracking statuses, dispatch or real payment promises.

Share layout, address, item and receipt presentation where multiple screens benefit. Feature-specific cards can own their own layout; avoid a generic configurable UI framework. Use tokens, flexible wrapping and scalable text. Keep controls at least 48 points high, provide stable accessible names plus disabled/selected states, hide decorative icons and announce changing status politely. Do not rely on color or animation alone.

Distinguish failed payment from successful simulation awaiting order reconciliation. Display the available error with a relevant retry; do not claim a real refund, bank decline or transfer. Empty/loading/error/legacy states must remain navigable and preserve saved data. Never log address text, coordinates, recipient phones or payment/receipt payloads to analytics or console output.

## Performance and verification

Prefer stable FlatList keys and immutable row inputs. Demonstrate avoidable work before optimizing: the history-card regression reproduces one repeated formatting call after an unrelated search action; memoizing the immutable card removes it. This is a render-work check, not a device FPS benchmark. Keep the shared navigation options stable. Split global providers or introduce caching/virtualization changes only with measured need.

Preserve baseline tests and meaningful assertions when UI labels/routes change. Add focused cases for state transitions, duplicate callbacks, lifecycle changes, corruption, old schemas and failures before/after persistent writes. Do not weaken tests, skip failing cases or disable lint rules. Jest/router state tests verify semantics/configuration, not native animation smoothness.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run check`, `npm run check:demo` and `npm run bundle:android` for a P2 stabilization slice. Report actual counts/failures and distinguish static preflight/Hermes export from APK or device verification. Use [the Android checklist](ORDERS_ANDROID_CHECKLIST.md) for real transitions, keyboard, Back, font scaling and restart behavior.

## Changes, reviews and documentation

Work on the requested feature branch, keep submitted `master` intact and preserve unrelated dirty files such as the user's `app.json` edit. Keep navigation, UX, architectural cleanup and documentation commits reviewable. Document proven root causes, test evidence, compatibility and deliberately deferred work; separate source findings from device-only hypotheses. Do not push, start EAS builds or broaden the product scope unless the task authorizes it.
