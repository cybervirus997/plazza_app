import { createSnapshotStore, decodeSnapshot, STORAGE_KEY, type StoragePort } from '../src/storage/persistence';
import { createAppReducer, initialAppState } from '../src/state/appReducer';
import { emptyShoppingState } from '../src/domain/types';
import { catalog } from './fixtures';

const encode = (fields: Record<string, unknown> = {}) => JSON.stringify({ version: 1, ...emptyShoppingState(), ...fields });

test('restores a valid snapshot', () => {
  const snapshot = { ...emptyShoppingState(), cart: [{ medicineId: 'a', quantity: 2 }], activeCouponCode: 'SAVE10', recentSearches: ['Relief'] };
  expect(decodeSnapshot(JSON.stringify({ version: 1, ...snapshot }), catalog)).toEqual(snapshot);
});
test('missing snapshot uses defaults', () => expect(decodeSnapshot(null, catalog)).toEqual(emptyShoppingState()));
test('corrupt JSON uses defaults', () => expect(decodeSnapshot('{broken', catalog)).toEqual(emptyShoppingState()));
test.each([0, 2, '1', null])('unknown version %p uses defaults', (version) => {
  expect(decodeSnapshot(JSON.stringify({ version, cart: [{ medicineId: 'a', quantity: 1 }] }), catalog)).toEqual(emptyShoppingState());
});
test.each(['null', '[]', '42', '"hello"'])('wrong top-level schema %s uses defaults', (raw) => {
  expect(decodeSnapshot(raw, catalog)).toEqual(emptyShoppingState());
});
test('invalid quantities are floored, capped, or removed and unknown IDs disappear', () => {
  expect(decodeSnapshot(encode({ cart: [
    { medicineId: 'a', quantity: 100 }, { medicineId: 'b', quantity: 2.8 },
    { medicineId: 'c', quantity: -1 }, { medicineId: 'd', quantity: 0 },
    { medicineId: 'unknown', quantity: 1 }, { medicineId: 'c', quantity: '2' },
  ] }), catalog).cart).toEqual([{ medicineId: 'a', quantity: 3 }, { medicineId: 'b', quantity: 2 }]);
});
test('duplicate persisted cart entries cannot bypass maxQty', () => {
  expect(decodeSnapshot(encode({ cart: [{ medicineId: 'a', quantity: 3 }, { medicineId: 'a', quantity: 3 }] }), catalog).cart)
    .toEqual([{ medicineId: 'a', quantity: 3 }]);
});
test('wrong field types are safely ignored', () => {
  expect(decodeSnapshot(encode({ cart: {}, activeCouponCode: 42, recentSearches: false, usedCouponCodes: null }), catalog)).toEqual(emptyShoppingState());
});
test('recent queries and used codes are normalized and deduplicated', () => {
  expect(decodeSnapshot(encode({ recentSearches: ['Care', 'Relief', 'care', 42], usedCouponCodes: [' first100 ', 'FIRST100', false] }), catalog))
    .toMatchObject({ recentSearches: ['Care', 'Relief'], usedCouponCodes: ['FIRST100'] });
});
test('FIRST100 stays used after an order, serialization, and restart', () => {
  const reduce = createAppReducer(catalog);
  let state = reduce(initialAppState(), { type: 'hydrate', snapshot: emptyShoppingState() });
  state = reduce(reduce(reduce(state, { type: 'add', id: 'a' }), { type: 'apply-coupon', code: 'FIRST100' }), { type: 'place-order' });
  const restored = decodeSnapshot(JSON.stringify({ version: 1, ...state }), catalog);
  let restart = reduce(initialAppState(), { type: 'hydrate', snapshot: restored });
  restart = reduce(reduce(restart, { type: 'add', id: 'a' }), { type: 'apply-coupon', code: 'FIRST100' });
  expect(restart.usedCouponCodes).toEqual(['FIRST100']);
  expect(restart.activeCouponCode).toBeNull();
});
test('eligible saved active coupon survives hydration', () => {
  const snapshot = decodeSnapshot(encode({ cart: [{ medicineId: 'a', quantity: 2 }], activeCouponCode: ' flat50 ' }), catalog);
  expect(createAppReducer(catalog)(initialAppState(), { type: 'hydrate', snapshot }).activeCouponCode).toBe('FLAT50');
});
test('redeemed saved active coupon is removed on hydration', () => {
  const snapshot = decodeSnapshot(encode({ cart: [{ medicineId: 'a', quantity: 1 }], activeCouponCode: 'FIRST100', usedCouponCodes: ['FIRST100'] }), catalog);
  expect(createAppReducer(catalog)(initialAppState(), { type: 'hydrate', snapshot }).activeCouponCode).toBeNull();
});
test('writes are serialized so a slow stale write cannot overwrite the latest', async () => {
  let release: (() => void) | undefined;
  let stored: string | null = null;
  const firstWrite = new Promise<void>((resolve) => { release = resolve; });
  const storage: StoragePort = {
    getItem: async () => stored,
    setItem: jest.fn(async (_key, value) => {
      if (stored === null) await firstWrite;
      stored = value;
    }),
  };
  const store = createSnapshotStore(storage);
  const first = store.save(emptyShoppingState());
  const latest = store.save({ ...emptyShoppingState(), usedCouponCodes: ['FIRST100'] });
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  release?.();
  expect(await first).toBe(true);
  expect(await latest).toBe(true);
  expect((await store.restore(catalog)).snapshot.usedCouponCodes).toEqual(['FIRST100']);
  expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
});
test('write failure does not crash or poison subsequent writes', async () => {
  const setItem = jest.fn<Promise<void>, [string, string]>().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
  const store = createSnapshotStore({ getItem: async () => null, setItem });
  expect(await store.save(emptyShoppingState())).toBe(false);
  expect(await store.save(emptyShoppingState())).toBe(true);
});
test('read failure returns defaults with a user-facing warning', async () => {
  const store = createSnapshotStore({ getItem: async () => { throw new Error('unavailable'); }, setItem: async () => undefined });
  expect(await store.restore(catalog)).toMatchObject({ snapshot: emptyShoppingState(), warning: expect.any(String) });
});
