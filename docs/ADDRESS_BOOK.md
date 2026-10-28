# P1: Delivery location and address book

Implemented on `feat/plazza-commerce-mvp`. This slice adds saved delivery addresses; existing mock checkout is unchanged. It does not create orders, persist standalone checkout snapshots, request Contacts access, call recipients, connect to society apps, or provide real fulfillment.

## Modules and ownership

| Module | Responsibility |
| --- | --- |
| `src/domain/addresses.ts` | Address types, validation, default/selected invariants, formatting and immutable versioned snapshot factory |
| `src/repositories/AddressRepository.ts` | Version 1 asynchronous load/save/delete/default/select contract |
| `src/repositories/local/LocalAddressRepository.ts` | Serialized local transactions, schema recovery and `plazza.addresses.v1` storage |
| `src/features/addresses/AddressBookProvider.tsx` | Loaded book and mutation state, repository injection and future-order snapshot boundary |
| `AddressBookScreen.tsx` / `AddressFormScreen.tsx` | Saved cards, selection, add/edit form, deletion confirmation and unsaved-navigation guard |
| `useAddressLocation.ts` | Optional coordinate suggestions with permission, concurrency, lifetime and edit-revision guards |
| `DeliveryAddressEntry.tsx` | Shared selector entry in Home and Cart |
| `src/app/addresses.tsx` / `address-form.tsx` | Expo Router routes |
| `src/app/_layout.tsx` | Independent address provider under the existing app provider, alongside permission state |

No coupon, catalog, pricing, shopping reducer, shopping persistence or P0 permission implementation was modified. Existing UI tests now include the root address provider. No dependencies, native configuration or permission declarations were added.

## Address semantics

- Required: label, address line/building, city, state and a six-digit Indian PIN not starting with zero. PIN validation checks format only, not postal existence or delivery coverage. See [India Post's PIN lookup](https://www.indiapost.gov.in/locate-postoffice).
- Optional: flat/house, tower/block, society, landmark, recipient name/phone/relationship, delivery instructions and coordinates. Latitude/longitude must be supplied together within valid ranges. Phone entry accepts 7–15 digits with an optional leading `+`, with common spaces/parentheses/hyphens normalized.
- Home, Work, Dad's Home, Mom's Place, Friend and Other are label shortcuts; the label is always editable. A label never infers a recipient name or relationship. Phone and relationship remain optional manual fields.
- Gate preferences: none, MyGate, NoBrokerHood, other app (with its name), or call recipient at gate. Delivery preference is Door or Gate, with an independent Call Before Arrival flag. These are instructions only; no integration, approval or call is represented as having occurred.
- Every nonempty book has exactly one default ID and one selected-delivery ID. The first address becomes both. Adding a place explicitly selects it for the current delivery; existing defaults stay unchanged unless the user chooses otherwise. Editing preserves ID/selection. Setting a default does not change the current delivery choice.
- Deleting the default promotes the first remaining address. Deleting the selected address selects the valid default. An empty book has null IDs. Current delivery selection is restored after restart, independently of the default.

## Storage and failure behavior

The repository writes one versioned address-book document to `plazza.addresses.v1`, independently of `plazza.shopping.v1` and OS permission state. Mutations read the latest document, validate, and serialize writes; the provider publishes the new book only after a successful write. Concurrent native location operations cannot clear addresses because they never own this state.

Initial loads do not write. Corrupt JSON can recover to an explicit empty warning; malformed or duplicate address records are discarded while valid records survive. Missing default/selected IDs are repaired and flagged for review. Home/Cart show a review message; the book allows confirming a recovered selection. Future snapshot capture rejects unresolved recovery warnings. A later explicit save/selection stores the reviewed, normalized book. Unsupported schema versions and failed reads are not overwritten. Failed writes retain the previous visible book and editable form draft for retry.

Addresses are stored locally in AsyncStorage, which is not encrypted storage. Only the listed fields and IDs are stored; there are no address analytics events or address-payload console logs. Deleting an address removes it from the persisted book. No automatic location history or standalone checkout history is retained.

## GPS and manual entry

Manual entry works with denied, blocked, unavailable or disabled GPS and does not call the location API. Use Current Location is enabled only when the existing foreground permission is granted and ready; its handler checks again to protect stale presses. App Settings is available to manage access without adding a second permission-prompt workflow. P0's existing Home permission flow remains intact.

The form reuses `fetchDeliveryLocation`, including native permission rechecks, disabled-services handling, timeouts and locks for uncancellable pending native calls. Results only suggest editable coordinates. Street, city and PIN remain manual: reverse geocoding is intentionally omitted so address text entry is fully offline and no geocoding service receives coordinates. Nothing is saved until Save is pressed.

Manual edits, permission revalidation/revocation and unmount invalidate pending suggestions. A late response cannot overwrite newer typing or change saved addresses. Revoking GPS clears P0 live-coordinate display as before; saved addresses, including coordinates previously saved by the user, remain personal address data and are retained.

## Future order boundary

`snapshotDeliveryAddress(book)` returns a detached, frozen `DeliveryAddressSnapshot { version: 1, address }`, including recipient and gate instructions, or null for an empty book. Nested coordinates are copied and frozen too.

`await useAddressBook().snapshotForOrder()` reads the persisted selection through the repository. It rejects loading/saving/inactive state and unreconciled recovery warnings. Reading persistence also avoids capturing an older React render immediately after an awaited address edit. The API only returns data; it does not persist a snapshot or place an order.

The Orders phase must atomically persist the order and this snapshot in its own order repository **before** clearing the cart. It must reject a missing required delivery address and render historical receipts from the frozen order snapshot, never by looking up the mutable address-book ID. That order implementation is not part of this slice.

## UI and verification

The Address Book uses one vertical FlatList. Label/gate choices are horizontal strips; the form uses a single vertical ScrollView with stable field components. iOS uses keyboard padding; Android relies on the existing resize configuration rather than adding a second height adjustment. Expo Router's SDK 58 `usePreventRemove` handles unsaved edits for toolbar/system Back; Save disables prevention only after successful persistence. Failed writes retain the draft.

`npm run check` passed on 29 October 2026: strict TypeScript, ESLint and **237 tests / 22 suites**, including all 195 P0 baseline cases and 42 additional address cases. Tests cover CRUD, default/selection independence, PIN/coordinate/phone validation, restart persistence, serialized writes, corruption/review, I/O failures, snapshots, denied/blocked manual entry, editable/stale GPS results, permission revocation, unmount, stable field identity, navigation guards and Home/Cart access. Initial lint failures from synchronous effect state resets were corrected by deriving load readiness and moving refresh resets into user actions; no lint rules or test assertions were disabled.

An Android Hermes export also checks route/module bundling; it does not verify a native binary or device UI. Follow [the physical-device checklist](ADDRESS_BOOK_ANDROID_CHECKLIST.md). No physical Android verification or new APK is claimed.

References: [Expo SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [React Native keyboard avoidance](https://reactnative.dev/docs/keyboardavoidingview).
