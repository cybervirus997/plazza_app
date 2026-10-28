import { normalizeCouponCode } from '../domain/coupons';
import { addRecentSearch } from '../domain/search';
import { emptyShoppingState, type CartEntry, type Medicine, type ShoppingState } from '../domain/types';

export const STORAGE_KEY = 'plazza.shopping.v1';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
    activeCouponCode: typeof value.activeCouponCode === 'string'
      ? normalizeCouponCode(value.activeCouponCode) || null : null,
  };
}

export interface StoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createSnapshotStore(storage: StoragePort) {
  let pendingWrite: Promise<boolean> = Promise.resolve(true);
  return {
    async restore(catalog: readonly Medicine[]) {
      await pendingWrite;
      try {
        return { snapshot: decodeSnapshot(await storage.getItem(STORAGE_KEY), catalog) };
      } catch {
        return {
          snapshot: emptyShoppingState(),
          warning: 'Saved shopping data could not be read. You can still shop, but it may not be saved.',
        };
      }
    },
    save(state: ShoppingState): Promise<boolean> {
      // Capture only persisted fields now, then serialize writes in invocation order.
      const serialized = JSON.stringify({
        version: 1, cart: state.cart, activeCouponCode: state.activeCouponCode,
        recentSearches: state.recentSearches, usedCouponCodes: state.usedCouponCodes,
      });
      pendingWrite = pendingWrite.then(async () => {
        try { await storage.setItem(STORAGE_KEY, serialized); return true; }
        catch { return false; }
      });
      return pendingWrite;
    },
  };
}
