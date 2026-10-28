import { isRecord } from '../domain/validation';
import { normalizeCouponCode } from '../domain/coupons';
import { addRecentSearch } from '../domain/search';
import { emptyShoppingState, type CartEntry, type Medicine, type ShoppingState } from '../domain/types';

export { isRecord } from '../domain/validation';

export const STORAGE_KEY = 'plazza.shopping.v1';

export function decodeSnapshot(raw: string | null, catalog: readonly Medicine[]): ShoppingState {
  if (!raw) return emptyShoppingState();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return emptyShoppingState(); }
  if (!isRecord(value) || value.version !== 1) return emptyShoppingState();

  const cart = new Map<string, CartEntry>();
  if (Array.isArray(value.cart)) {
    for (const entry of value.cart) {
      if (!isRecord(entry) || typeof entry.medicineId !== 'string'
        || typeof entry.quantity !== 'number' || !Number.isFinite(entry.quantity)) continue;
      const medicine = catalog.find((item) => item.id === entry.medicineId);
      if (!medicine) continue;
      const quantity = Math.min(medicine.maxQty, Math.floor(entry.quantity));
      if (quantity > 0) cart.set(medicine.id, { medicineId: medicine.id, quantity });
    }
  }
  const usedCouponCodes = Array.isArray(value.usedCouponCodes)
    ? [...new Set(value.usedCouponCodes.filter((code): code is string => typeof code === 'string')
      .map(normalizeCouponCode).filter(Boolean))] : [];
  let recentSearches: readonly string[] = [];
  if (Array.isArray(value.recentSearches)) {
    for (const query of [...value.recentSearches].reverse()) {
      if (typeof query === 'string') recentSearches = addRecentSearch(recentSearches, query);
    }
  }
  return {
    cart: [...cart.values()], usedCouponCodes, recentSearches,
    ...(typeof value.lastFinalizedCheckoutId === 'string' ? { lastFinalizedCheckoutId: value.lastFinalizedCheckoutId } : {}),
    activeCouponCode: typeof value.activeCouponCode === 'string'
      ? normalizeCouponCode(value.activeCouponCode) || null : null,
  };
}

export interface StoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function snapshotFields(state: ShoppingState) {
  return { cart: state.cart, activeCouponCode: state.activeCouponCode,
    recentSearches: state.recentSearches, usedCouponCodes: state.usedCouponCodes,
    ...(state.lastFinalizedCheckoutId ? { lastFinalizedCheckoutId: state.lastFinalizedCheckoutId } : {}) };
}
export function snapshotKey(state: ShoppingState): string { return JSON.stringify(snapshotFields(state)); }

export function decodeCheckoutShopping(raw: string | null): ShoppingState {
  if (raw === null) return emptyShoppingState();
  const fail = (): never => { throw new Error('Saved shopping data needs recovery. It has not been overwritten.'); };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return fail(); }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.cart)
    || (value.activeCouponCode !== null && typeof value.activeCouponCode !== 'string')
    || !Array.isArray(value.usedCouponCodes) || !value.usedCouponCodes.every((code: unknown) => typeof code === 'string')
    || !Array.isArray(value.recentSearches) || !value.recentSearches.every((query: unknown) => typeof query === 'string')
    || (value.lastFinalizedCheckoutId !== undefined && value.lastFinalizedCheckoutId !== null
      && (typeof value.lastFinalizedCheckoutId !== 'string' || !value.lastFinalizedCheckoutId.trim()))) return fail();
  const ids = new Set<string>();
  const cart = Array.from(value.cart, (entry: unknown): CartEntry => {
    if (!isRecord(entry) || typeof entry.medicineId !== 'string' || !entry.medicineId.trim() || ids.has(entry.medicineId)
      || typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) return fail();
    ids.add(entry.medicineId);
    return { medicineId: entry.medicineId, quantity: entry.quantity };
  });
  return { cart, activeCouponCode: value.activeCouponCode === null ? null : normalizeCouponCode(value.activeCouponCode),
    usedCouponCodes: [...new Set(value.usedCouponCodes.map(normalizeCouponCode))], recentSearches: [...value.recentSearches],
    ...(typeof value.lastFinalizedCheckoutId === 'string' ? { lastFinalizedCheckoutId: value.lastFinalizedCheckoutId } : {}) };
}

export interface CheckoutReceiptSource {
  readonly checkoutId: string;
  readonly couponCode: string | null;
  readonly items: readonly { readonly productId: string; readonly quantity: number }[];
}
export function matchesCheckout(state: ShoppingState, order: CheckoutReceiptSource): boolean {
  return state.activeCouponCode === order.couponCode && state.cart.length === order.items.length
    && state.cart.every((entry) => order.items.some((item) => item.productId === entry.medicineId && item.quantity === entry.quantity));
}

const stores = new WeakMap<StoragePort, ReturnType<typeof buildSnapshotStore>>();
export function createSnapshotStore(storage: StoragePort) {
  let store = stores.get(storage);
  if (!store) { store = buildSnapshotStore(storage); stores.set(storage, store); }
  return store;
}
function buildSnapshotStore(storage: StoragePort) {
  let pending: Promise<void> = Promise.resolve();
  let locked = false;
  let checkpoint: string | null = null;
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.then(() => undefined, () => undefined);
    return result;
  }
  async function readStrict() {
    const snapshot = decodeCheckoutShopping(await storage.getItem(STORAGE_KEY));
    checkpoint = snapshot.lastFinalizedCheckoutId ?? null;
    return snapshot;
  }
  const encode = (state: ShoppingState) => JSON.stringify({ version: 1, ...snapshotFields(state) });
  return {
    lockCheckout() { locked = true; },
    unlockCheckout() { locked = false; },
    isCheckoutLocked: () => locked,
    flush: () => pending,
    readForCheckout: () => enqueue(readStrict),
    async restore(catalog: readonly Medicine[]) {
      await pending;
      try {
        const snapshot = decodeSnapshot(await storage.getItem(STORAGE_KEY), catalog);
        checkpoint = snapshot.lastFinalizedCheckoutId ?? null;
        return { snapshot };
      } catch {
        return { snapshot: emptyShoppingState(), warning: 'Saved shopping data could not be read. You can still shop, but it may not be saved.' };
      }
    },
    save(state: ShoppingState): Promise<boolean> {
      if (locked) return Promise.resolve(false);
      const serialized = encode(state);
      const expectedCheckpoint = state.lastFinalizedCheckoutId ?? null;
      return enqueue(async () => {
        if (expectedCheckpoint !== checkpoint) return false;
        try { await storage.setItem(STORAGE_KEY, serialized); return true; }
        catch { return false; }
      });
    },
    prepareCheckout(state: ShoppingState): Promise<void> {
      const captured = decodeCheckoutShopping(encode(state));
      return enqueue(async () => {
        const current = await readStrict();
        if ((captured.lastFinalizedCheckoutId ?? null) !== (current.lastFinalizedCheckoutId ?? null)) {
          throw new Error('The shopping checkpoint changed. Recover checkout before continuing.');
        }
        if (current.usedCouponCodes.some((code) => !captured.usedCouponCodes.includes(code))) {
          throw new Error('Saved coupon redemption changed. Restart to review shopping data before checkout.');
        }
        if (snapshotKey(current) === snapshotKey(captured)) return;
        await storage.setItem(STORAGE_KEY, encode(captured));
      });
    },
    finalizeCheckout(order: CheckoutReceiptSource, oneTimeCouponCode: string | null): Promise<ShoppingState> {
      return enqueue(async () => {
        const current = await readStrict();
        if (current.lastFinalizedCheckoutId === order.checkoutId) {
          if (oneTimeCouponCode && !current.usedCouponCodes.includes(oneTimeCouponCode)) {
            throw new Error('The checkout checkpoint is missing its coupon redemption. Recovery needs review.');
          }
          return current;
        }
        if (!matchesCheckout(current, order)) throw new Error('The saved cart differs from the pending checkout. No cart was cleared.');
        if (oneTimeCouponCode && current.usedCouponCodes.includes(oneTimeCouponCode)) {
          throw new Error('The one-time coupon was already redeemed by a different checkout. Recovery needs review.');
        }
        const next: ShoppingState = { ...current, cart: [], activeCouponCode: null,
          usedCouponCodes: oneTimeCouponCode ? [...new Set([...current.usedCouponCodes, oneTimeCouponCode])] : current.usedCouponCodes,
          lastFinalizedCheckoutId: order.checkoutId };
        await storage.setItem(STORAGE_KEY, encode(next));
        checkpoint = order.checkoutId;
        return next;
      });
    },
  };
}
export type SnapshotStore = ReturnType<typeof createSnapshotStore>;
