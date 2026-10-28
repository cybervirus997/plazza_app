import { createCheckoutCoordinator, CHECKOUT_STORAGE_KEY, decodeCheckoutIntent, CheckoutCancelledError } from '../src/features/orders/checkout';
import { createSnapshotStore, decodeCheckoutShopping, STORAGE_KEY } from '../src/storage/persistence';
import { createLocalOrderRepository, ORDER_STORAGE_KEY } from '../src/repositories/local/LocalOrderRepository';
import type { ShoppingState } from '../src/domain/types';
import { orderInput, orderStorage, deferred, testOrder } from './order-fixtures';

function setup() {
  const input = orderInput();
  const memory = orderStorage();
  const snapshot: ShoppingState = { cart: input.cart, activeCouponCode: input.couponCode, usedCouponCodes: [], recentSearches: ['care'] };
  memory.data.set(STORAGE_KEY, JSON.stringify({ version: 1, ...snapshot }));
  const identity = jest.fn(() => ({ id: 'order-1', checkoutId: 'checkout-1', placedAt: input.placedAt }));
  const coordinator = createCheckoutCoordinator(memory.port, { identity });
  const begin = { snapshot, products: input.products, address: jest.fn(async () => input.deliveryAddress) };
  return { ...memory, coordinator, begin, identity };
}
const isFinalization = (key: string, value: string) => key === STORAGE_KEY && value.includes('lastFinalizedCheckoutId');
const isClear = (key: string, value: string) => key === CHECKOUT_STORAGE_KEY && value.includes('"pending":null');

test('success writes intent, receipt, shopping finalization, then cleanup; FIRST100 is durable once', async () => {
  const app = setup();
  const finalized = jest.fn();
  const result = await app.coordinator.begin(app.begin, { onFinalized: finalized });
  expect(app.port.setItem).toHaveBeenCalledTimes(4);
  expect(jest.mocked(app.port.setItem).mock.calls.map(([key]) => key)).toEqual([CHECKOUT_STORAGE_KEY, ORDER_STORAGE_KEY, STORAGE_KEY, CHECKOUT_STORAGE_KEY]);
  expect(result.snapshot).toMatchObject({ cart: [], activeCouponCode: null, usedCouponCodes: ['FIRST100'], recentSearches: ['care'], lastFinalizedCheckoutId: 'checkout-1' });
  expect(result.order?.items).toMatchObject([{ unitPrice: 200, quantity: 2 }, { unitPrice: 100, quantity: 1 }]);
  expect(finalized).toHaveBeenCalledWith(result.snapshot, result.order);
  expect(decodeCheckoutIntent(app.data.get(CHECKOUT_STORAGE_KEY) ?? null)).toBeNull();
  expect(app.coordinator.isLocked()).toBe(false);
});

test('double begin cannot allocate another identity or duplicate the order', async () => {
  const app = setup();
  const pending = deferred<Awaited<ReturnType<typeof app.begin.address>>>();
  app.begin.address.mockReturnValueOnce(pending.promise);
  const first = app.coordinator.begin(app.begin);
  await expect(app.coordinator.begin(app.begin)).rejects.toThrow('already in progress');
  pending.resolve(orderInput().deliveryAddress);
  await first;
  expect(app.identity).toHaveBeenCalledTimes(1);
  expect((await createLocalOrderRepository(app.port).load()).orders).toHaveLength(1);
});

test('missing address or empty cart cannot create an intent or consume FIRST100', async () => {
  const app = setup();
  const before = app.data.get(STORAGE_KEY);
  await expect(app.coordinator.begin({ ...app.begin, address: async () => null })).rejects.toThrow('delivery address');
  expect(app.coordinator.isLocked()).toBe(false);
  await expect(app.coordinator.begin({ ...app.begin, snapshot: { ...app.begin.snapshot, cart: [] } })).rejects.toThrow('Add an item');
  expect(app.data.get(STORAGE_KEY)).toBe(before);
  expect(app.port.setItem).not.toHaveBeenCalled();
});

test.each([false, true])('intent-write failure (committed=%s) retries exactly the captured identity and address', async (committed) => {
  const app = setup();
  jest.mocked(app.port.setItem).mockImplementationOnce(async (key, value) => {
    if (committed) app.data.set(key, value);
    throw new Error('intent failed');
  });
  await expect(app.coordinator.begin(app.begin)).rejects.toThrow('intent failed');
  expect(app.coordinator.isLocked()).toBe(true);
  expect(app.data.get(ORDER_STORAGE_KEY)).toBeUndefined();
  const address = jest.fn(async () => { throw new Error('Must not recapture'); });
  const result = await app.coordinator.begin({ ...app.begin, address, products: [] });
  expect(result.order?.checkoutId).toBe('checkout-1');
  expect(app.identity).toHaveBeenCalledTimes(1);
  expect(address).not.toHaveBeenCalled();
});

test('an order-write failure keeps cart/coupon intact and retry reuses the intent', async () => {
  const app = setup();
  const before = app.data.get(STORAGE_KEY);
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (key === ORDER_STORAGE_KEY && !failed) { failed = true; throw new Error('receipt failed'); }
    app.data.set(key, value);
  });
  await expect(app.coordinator.begin(app.begin)).rejects.toThrow('same checkout ID');
  expect(app.data.get(STORAGE_KEY)).toBe(before);
  expect(decodeCheckoutIntent(app.data.get(CHECKOUT_STORAGE_KEY) ?? null)?.order.checkoutId).toBe('checkout-1');
  const result = await app.coordinator.begin(app.begin);
  expect(result.snapshot.usedCouponCodes).toEqual(['FIRST100']);
  expect(app.identity).toHaveBeenCalledTimes(1);
});

test('failed shopping finalization never publishes success; retry does not append another receipt', async () => {
  const app = setup();
  const before = app.data.get(STORAGE_KEY);
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (isFinalization(key, value) && !failed) { failed = true; throw new Error('shopping failed'); }
    app.data.set(key, value);
  });
  const finalized = jest.fn();
  await expect(app.coordinator.begin(app.begin, { onFinalized: finalized })).rejects.toThrow('shopping failed');
  expect(finalized).not.toHaveBeenCalled();
  expect(app.data.get(STORAGE_KEY)).toBe(before);
  const result = await app.coordinator.begin(app.begin, { onFinalized: finalized });
  expect(finalized).toHaveBeenCalledTimes(1);
  expect(result.snapshot.usedCouponCodes).toEqual(['FIRST100']);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === ORDER_STORAGE_KEY)).toHaveLength(1);
});

test.each(['intent', 'receipt', 'shopping', 'cleanup'] as const)('restart recovers a crash immediately after the %s write', async (point) => {
  const app = setup();
  let active = true;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    if ((point === 'intent' && key === CHECKOUT_STORAGE_KEY && !isClear(key, value))
      || (point === 'receipt' && key === ORDER_STORAGE_KEY)
      || (point === 'shopping' && isFinalization(key, value)) || (point === 'cleanup' && isClear(key, value))) active = false;
  });
  const callback = jest.fn();
  await expect(app.coordinator.begin(app.begin, { isCurrent: () => active, onFinalized: callback })).rejects.toBeInstanceOf(CheckoutCancelledError);
  if (point !== 'cleanup') expect(callback).not.toHaveBeenCalled();
  const recovered = await createCheckoutCoordinator(app.port).recover();
  expect(recovered.snapshot).toMatchObject({ cart: [], activeCouponCode: null, usedCouponCodes: ['FIRST100'], lastFinalizedCheckoutId: 'checkout-1' });
  expect((await createLocalOrderRepository(app.port).load()).orders).toHaveLength(1);
  expect(decodeCheckoutIntent(app.data.get(CHECKOUT_STORAGE_KEY) ?? null)).toBeNull();
});

test('a checkpoint with a later cart only cleans up the old intent and never clears that cart', async () => {
  const app = setup();
  let active = true;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => { app.data.set(key, value); if (isFinalization(key, value)) active = false; });
  await expect(app.coordinator.begin(app.begin, { isCurrent: () => active })).rejects.toBeInstanceOf(CheckoutCancelledError);
  const later: ShoppingState = { cart: [{ medicineId: 'c', quantity: 1 }], activeCouponCode: 'SAVE10', usedCouponCodes: ['FIRST100'], recentSearches: ['later'], lastFinalizedCheckoutId: 'checkout-1' };
  app.data.set(STORAGE_KEY, JSON.stringify({ version: 1, ...later }));
  const before = jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY).length;
  expect((await createCheckoutCoordinator(app.port).recover()).snapshot).toEqual(later);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(before);
});

test('lost shopping acknowledgement is resolved from the checkpoint without redeeming again', async () => {
  const app = setup();
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    if (isFinalization(key, value) && !failed) { failed = true; throw new Error('ack lost'); }
  });
  await expect(app.coordinator.begin(app.begin)).rejects.toThrow('ack lost');
  expect((await app.coordinator.begin(app.begin)).snapshot.usedCouponCodes).toEqual(['FIRST100']);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key, value]) => isFinalization(key, value))).toHaveLength(1);
});

test('cleanup failure publishes the durable finalization once and retry does not write shopping twice', async () => {
  const app = setup();
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (isClear(key, value) && !failed) { failed = true; throw new Error('cleanup failed'); }
    app.data.set(key, value);
  });
  const finalized = jest.fn();
  await expect(app.coordinator.begin(app.begin, { onFinalized: finalized })).rejects.toThrow('cleanup failed');
  expect(finalized).toHaveBeenCalledTimes(1);
  expect(decodeCheckoutShopping(app.data.get(STORAGE_KEY) ?? null).usedCouponCodes).toEqual(['FIRST100']);
  await app.coordinator.begin({ ...app.begin, snapshot: decodeCheckoutShopping(app.data.get(STORAGE_KEY) ?? null), address: async () => null });
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
});

test('a different cart without the matching checkpoint is never cleared or silently replaced', async () => {
  const app = setup();
  const intent = { order: testOrder(), oneTimeCouponCode: 'FIRST100' };
  const journal = JSON.stringify({ version: 1, pending: intent });
  app.data.set(CHECKOUT_STORAGE_KEY, journal);
  const other = JSON.stringify({ version: 1, ...app.begin.snapshot, cart: [{ medicineId: 'c', quantity: 1 }] });
  app.data.set(STORAGE_KEY, other);
  await expect(app.coordinator.recover()).rejects.toThrow('differs');
  expect(app.data.get(STORAGE_KEY)).toBe(other);
  expect(app.data.get(CHECKOUT_STORAGE_KEY)).toBe(journal);
  expect(app.port.setItem).not.toHaveBeenCalled();
});

test.each(['{broken', '{"version":2,"pending":null}', '{"version":1}', '{"version":1,"pending":{}}'])('damaged journal %s is preserved and blocks hydration recovery', async (journal) => {
  const app = setup();
  app.data.set(CHECKOUT_STORAGE_KEY, journal);
  await expect(app.coordinator.recover()).rejects.toThrow();
  expect(app.data.get(CHECKOUT_STORAGE_KEY)).toBe(journal);
  expect(app.port.setItem).not.toHaveBeenCalled();
  expect(app.coordinator.isLocked()).toBe(true);
});

test('forged or omitted one-time obligations cannot change coupon semantics', () => {
  expect(() => decodeCheckoutIntent(JSON.stringify({ version: 1, pending: { order: testOrder(), oneTimeCouponCode: null } }))).toThrow('journal');
  expect(() => decodeCheckoutIntent(JSON.stringify({ version: 1, pending: { order: testOrder({ couponCode: 'SAVE10' }), oneTimeCouponCode: 'SAVE10' } }))).toThrow('journal');
});

test.each(['{broken', '{"version":2,"orders":[]}'])('damaged/unsupported order history %s never triggers an autosave or destructive recovery', async (raw) => {
  const app = setup();
  app.data.set(ORDER_STORAGE_KEY, raw);
  const before = app.data.get(STORAGE_KEY);
  await expect(app.coordinator.recover()).rejects.toThrow();
  expect(app.data.get(STORAGE_KEY)).toBe(before);
  expect(app.data.get(ORDER_STORAGE_KEY)).toBe(raw);
  expect(app.port.setItem).not.toHaveBeenCalled();
});

test('old shopping v1 restores without a checkpoint; subsequent saves preserve finalized checkpoints', async () => {
  const app = setup();
  expect((await app.coordinator.recover()).snapshot).toEqual(app.begin.snapshot);
  const final = await app.coordinator.begin(app.begin);
  const store = createSnapshotStore(app.port);
  expect(await store.save(app.begin.snapshot)).toBe(false);
  expect(await store.save({ ...final.snapshot, cart: [{ medicineId: 'c', quantity: 1 }] })).toBe(true);
  expect((await store.restore(app.begin.products)).snapshot.lastFinalizedCheckoutId).toBe('checkout-1');
});

test('slow queued autosaves finish first; new autosaves cannot race checkout', async () => {
  const app = setup();
  const store = createSnapshotStore(app.port);
  const entered = deferred<void>(); const release = deferred<void>();
  jest.mocked(app.port.setItem).mockImplementationOnce(async (key, value) => { entered.resolve(); await release.promise; app.data.set(key, value); });
  const save = store.save(app.begin.snapshot);
  await entered.promise;
  const checkout = app.coordinator.begin(app.begin);
  expect(await store.save({ ...app.begin.snapshot, cart: [] })).toBe(false);
  release.resolve(); await save; await checkout;
  expect(decodeCheckoutShopping(app.data.get(STORAGE_KEY) ?? null).cart).toEqual([]);
});

test('a committed receipt with a lost acknowledgement is recovered without another order write', async () => {
  const app = setup();
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    if (key === ORDER_STORAGE_KEY && !failed) { failed = true; throw new Error('receipt ack lost'); }
  });
  await expect(app.coordinator.begin(app.begin)).rejects.toThrow('same checkout ID');
  const recovered = await app.coordinator.begin(app.begin);
  expect(recovered.snapshot.usedCouponCodes).toEqual(['FIRST100']);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === ORDER_STORAGE_KEY)).toHaveLength(1);
});

test('a pre-intent cart flush interrupted by a crash creates no order and restores the saved cart', async () => {
  const app = setup();
  app.data.delete(STORAGE_KEY);
  let active = true;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => { app.data.set(key, value); if (key === STORAGE_KEY) active = false; });
  await expect(app.coordinator.begin(app.begin, { isCurrent: () => active })).rejects.toBeInstanceOf(CheckoutCancelledError);
  expect(app.data.has(CHECKOUT_STORAGE_KEY)).toBe(false);
  expect(app.data.has(ORDER_STORAGE_KEY)).toBe(false);
  const result = await createCheckoutCoordinator(app.port).recover();
  expect(result.snapshot).toEqual(app.begin.snapshot);
  expect(result.snapshot.usedCouponCodes).toEqual([]);
});

test('a different checkout redemption cannot be erased by preparation or redeemed again during recovery', async () => {
  const app = setup();
  const alreadyUsed = JSON.stringify({ version: 1, ...app.begin.snapshot, usedCouponCodes: ['FIRST100'] });
  app.data.set(STORAGE_KEY, alreadyUsed);
  await expect(app.coordinator.begin(app.begin)).rejects.toThrow('redemption changed');
  expect(app.data.get(STORAGE_KEY)).toBe(alreadyUsed);
  expect(app.data.has(CHECKOUT_STORAGE_KEY)).toBe(false);
  app.data.set(CHECKOUT_STORAGE_KEY, JSON.stringify({ version: 1, pending: { order: testOrder(), oneTimeCouponCode: 'FIRST100' } }));
  await expect(createCheckoutCoordinator(app.port).recover()).rejects.toThrow('already redeemed');
  expect(app.data.get(STORAGE_KEY)).toBe(alreadyUsed);
  expect(app.data.has(ORDER_STORAGE_KEY)).toBe(false);
});

test.each(['{broken', '{"version":2,"cart":[]}'])('corrupt or incompatible shopping %s is never replaced during recovery', async (raw) => {
  const app = setup();
  app.data.set(STORAGE_KEY, raw);
  await expect(app.coordinator.recover()).rejects.toThrow('shopping data needs recovery');
  expect(app.data.get(STORAGE_KEY)).toBe(raw);
  expect(app.port.setItem).not.toHaveBeenCalled();
});

test.each(['receipt', 'redemption'] as const)('a checkpoint with missing %s evidence blocks startup without rewriting it', async (missing) => {
  const app = setup();
  await app.coordinator.begin(app.begin);
  if (missing === 'receipt') app.data.set(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, orders: [] }));
  else {
    const snapshot = decodeCheckoutShopping(app.data.get(STORAGE_KEY) ?? null);
    app.data.set(STORAGE_KEY, JSON.stringify({ version: 1, ...snapshot, usedCouponCodes: [] }));
  }
  const writes = jest.mocked(app.port.setItem).mock.calls.length;
  const saved = app.data.get(STORAGE_KEY);
  await expect(createCheckoutCoordinator(app.port).recover()).rejects.toThrow(missing === 'receipt' ? 'no matching receipt' : 'missing its coupon');
  expect(app.port.setItem).toHaveBeenCalledTimes(writes);
  expect(app.data.get(STORAGE_KEY)).toBe(saved);
});
