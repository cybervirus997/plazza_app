import { createLocalOrderRepository, decodeOrderHistory, ORDER_STORAGE_KEY } from '../src/repositories/local/LocalOrderRepository';
import { OrderConflictError, OrderHistoryRecoveryError, UnsupportedOrderVersionError } from '../src/repositories/OrderRepository';
import { deferred, orderStorage, testOrder } from './order-fixtures';

const secondOrder = () => testOrder({ id: 'order-2', checkoutId: 'checkout-2', placedAt: '2026-10-29T09:01:00.000Z' });

test('an absent history loads explicitly empty, with no writes or fabricated orders', async () => {
  const { port } = orderStorage();
  const repository = createLocalOrderRepository(port);
  expect(await repository.load()).toEqual({ orders: [], warning: null, canWrite: true });
  expect(await repository.getById('missing')).toBeNull();
  expect(port.setItem).not.toHaveBeenCalled();
});

test('creation persists purchase-time snapshots and a new adapter restores immutable receipts after restart', async () => {
  const { port, data } = orderStorage();
  const order = testOrder();
  expect(await createLocalOrderRepository(port).create(order)).toEqual({ order, created: true });
  const restarted = createLocalOrderRepository(port);
  expect(await restarted.load()).toEqual({ orders: [order], warning: null, canWrite: true });
  const restored = await restarted.getById(order.id);
  expect(restored).toEqual(order);
  expect(restored).not.toBe(order);
  expect(Object.isFrozen(restored?.items[0])).toBe(true);
  expect(Object.isFrozen(restored?.deliveryAddress.address.coordinates)).toBe(true);
  expect(data.get(ORDER_STORAGE_KEY)).toBe(JSON.stringify({ version: 1, orders: [order] }));
});

test('identical checkout retries return the original receipt and do not append, reorder or write again', async () => {
  const { port } = orderStorage();
  const repository = createLocalOrderRepository(port);
  await repository.create(testOrder());
  await repository.create(secondOrder());
  expect(await repository.create(testOrder())).toEqual({ order: testOrder(), created: false });
  expect((await repository.load()).orders.map((order) => order.id)).toEqual(['order-1', 'order-2']);
  expect(port.setItem).toHaveBeenCalledTimes(2);
});

test('conflicting checkout payloads and order-ID collisions are rejected without altering history', async () => {
  const { port, data } = orderStorage();
  const repository = createLocalOrderRepository(port);
  const order = testOrder();
  await repository.create(order);
  const raw = data.get(ORDER_STORAGE_KEY);
  await expect(repository.create({ ...order, id: 'other-id' })).rejects.toBeInstanceOf(OrderConflictError);
  await expect(repository.create({ ...order, checkoutId: 'other-checkout' })).rejects.toBeInstanceOf(OrderConflictError);
  await expect(repository.create({ ...order, placedAt: '2026-10-29T10:00:00.000Z' })).rejects.toBeInstanceOf(OrderConflictError);
  expect(port.setItem).toHaveBeenCalledTimes(1);
  expect(data.get(ORDER_STORAGE_KEY)).toBe(raw);
});

test('simultaneous duplicate creates across adapters using the same port produce exactly one order', async () => {
  const { port } = orderStorage();
  const results = await Promise.all([createLocalOrderRepository(port).create(testOrder()), createLocalOrderRepository(port).create(testOrder())]);
  expect(results.map((result) => result.created)).toEqual([true, false]);
  expect((await createLocalOrderRepository(port).load()).orders).toHaveLength(1);
  expect(port.setItem).toHaveBeenCalledTimes(1);
});

test('writes and reads are serialized across adapters, with no lost updates', async () => {
  const { port, data } = orderStorage();
  const entered = deferred<void>();
  const release = deferred<void>();
  const events: string[] = [];
  jest.mocked(port.setItem).mockImplementationOnce(async (key, value) => {
    events.push('first-start'); entered.resolve(); await release.promise;
    data.set(key, value); events.push('first-end');
  });
  const a = createLocalOrderRepository(port);
  const b = createLocalOrderRepository(port);
  const first = a.create(testOrder());
  await entered.promise;
  const second = b.create(secondOrder());
  const read = a.load();
  await Promise.resolve();
  expect(port.getItem).toHaveBeenCalledTimes(1);
  expect(port.setItem).toHaveBeenCalledTimes(1);
  release.resolve();
  await Promise.all([first, second]);
  expect((await read).orders.map((order) => order.id)).toEqual(['order-1', 'order-2']);
  expect(events).toEqual(['first-start', 'first-end']);
  expect(port.setItem).toHaveBeenCalledTimes(2);
});

test('a pending create copies its input before waiting in the storage queue', async () => {
  const { port, data } = orderStorage();
  const entered = deferred<void>();
  const release = deferred<void>();
  jest.mocked(port.setItem).mockImplementationOnce(async (key, value) => { entered.resolve(); await release.promise; data.set(key, value); });
  const repository = createLocalOrderRepository(port);
  const first = repository.create(testOrder());
  await entered.promise;
  const source = secondOrder();
  const candidate = { ...source, items: source.items.map((item) => ({ ...item })) };
  const second = repository.create(candidate);
  candidate.items[0].name = 'Changed while waiting'; candidate.items[0].unitPrice = 999;
  release.resolve();
  await first;
  expect((await second).order.items[0]).toMatchObject({ name: 'Test Relief', unitPrice: 200 });
});

test('failed writes do not poison the queue, and retry with the same checkout identity succeeds', async () => {
  const { port } = orderStorage();
  const repository = createLocalOrderRepository(port);
  jest.mocked(port.setItem).mockRejectedValueOnce(new Error('disk full'));
  await expect(repository.create(testOrder())).rejects.toThrow('same checkout ID');
  expect((await repository.load()).orders).toEqual([]);
  expect(await repository.create(testOrder())).toMatchObject({ created: true });
  expect((await repository.load()).orders).toHaveLength(1);
});

test('a write that commits but loses its acknowledgement is recovered by an identical retry', async () => {
  const { port, data } = orderStorage();
  const repository = createLocalOrderRepository(port);
  jest.mocked(port.setItem).mockImplementationOnce(async (key, value) => { data.set(key, value); throw new Error('lost acknowledgement'); });
  await expect(repository.create(testOrder())).rejects.toThrow('same checkout ID');
  expect(await createLocalOrderRepository(port).create(testOrder())).toMatchObject({ created: false });
  expect(port.setItem).toHaveBeenCalledTimes(1);
  expect((await repository.load()).orders).toHaveLength(1);
});

test('a failed read never becomes an empty successful history or overwrites an existing receipt', async () => {
  const { port, data } = orderStorage();
  const repository = createLocalOrderRepository(port);
  await repository.create(testOrder());
  const before = data.get(ORDER_STORAGE_KEY);
  jest.mocked(port.getItem).mockRejectedValueOnce(new Error('read failed'));
  await expect(repository.create(secondOrder())).rejects.toThrow('could not be read');
  expect(data.get(ORDER_STORAGE_KEY)).toBe(before);
  expect(port.setItem).toHaveBeenCalledTimes(1);
  expect(await repository.create(secondOrder())).toMatchObject({ created: true });
  expect((await repository.load()).orders).toHaveLength(2);
});

test.each(['', '{broken', 'null', '[]', '{"version":1,"orders":{}}'])('corruption %s is visible and read-only, without overwriting bytes', async (raw) => {
  const { port, data } = orderStorage();
  data.set(ORDER_STORAGE_KEY, raw);
  const repository = createLocalOrderRepository(port);
  expect(await repository.load()).toEqual({ orders: [], warning: expect.any(String), canWrite: false });
  await expect(repository.getById('missing')).rejects.toBeInstanceOf(OrderHistoryRecoveryError);
  await expect(repository.create(testOrder())).rejects.toBeInstanceOf(OrderHistoryRecoveryError);
  expect(data.get(ORDER_STORAGE_KEY)).toBe(raw);
  expect(port.setItem).not.toHaveBeenCalled();
});

test.each([0, 2, 99])('unsupported envelope version %s is never overwritten', async (version) => {
  const { port, data } = orderStorage();
  const raw = JSON.stringify({ version, orders: [testOrder()] });
  data.set(ORDER_STORAGE_KEY, raw);
  const repository = createLocalOrderRepository(port);
  await expect(repository.load()).rejects.toBeInstanceOf(UnsupportedOrderVersionError);
  await expect(repository.getById('order-1')).rejects.toBeInstanceOf(UnsupportedOrderVersionError);
  await expect(repository.create(secondOrder())).rejects.toBeInstanceOf(UnsupportedOrderVersionError);
  expect(port.setItem).not.toHaveBeenCalled();
  expect(data.get(ORDER_STORAGE_KEY)).toBe(raw);
});

test('invalid records leave readable receipts visible but block lookup/create until explicit recovery', async () => {
  const { port, data } = orderStorage();
  const order = testOrder();
  const raw = JSON.stringify({ version: 1, orders: [order, { ...secondOrder(), grandTotal: -1 }] });
  data.set(ORDER_STORAGE_KEY, raw);
  const repository = createLocalOrderRepository(port);
  expect(await repository.load()).toEqual({ orders: [order], warning: expect.any(String), canWrite: false });
  await expect(repository.getById(order.id)).rejects.toBeInstanceOf(OrderHistoryRecoveryError);
  await expect(repository.create(secondOrder())).rejects.toBeInstanceOf(OrderHistoryRecoveryError);
  expect(data.get(ORDER_STORAGE_KEY)).toBe(raw);
  expect(port.setItem).not.toHaveBeenCalled();
  // Simulate an explicit external repair, not an automatic repository reset.
  data.set(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, orders: [order] }));
  expect(await repository.create(secondOrder())).toMatchObject({ created: true });
});

test.each(['id', 'checkoutId'] as const)('duplicate persisted %s values make history read-only', async (field) => {
  const order = testOrder();
  const result = decodeOrderHistory(JSON.stringify({ version: 1, orders: [order, { ...secondOrder(), [field]: order[field] }] }));
  expect(result).toMatchObject({ orders: [order], canWrite: false, warning: expect.any(String) });
});

test('structurally invalid input is rejected before storage access', async () => {
  const { port } = orderStorage();
  await expect(createLocalOrderRepository(port).create({ ...testOrder(), grandTotal: 1 })).rejects.toThrow('invalid receipt');
  expect(port.getItem).not.toHaveBeenCalled(); expect(port.setItem).not.toHaveBeenCalled();
});

test('persisting an order cannot redeem FIRST100 or change shopping/address keys', async () => {
  const { port, data } = orderStorage();
  const shopping = JSON.stringify({ version: 1, cart: [{ medicineId: 'a', quantity: 2 }], activeCouponCode: 'FIRST100', usedCouponCodes: [], recentSearches: [] });
  data.set('plazza.shopping.v1', shopping); data.set('plazza.addresses.v1', 'independent addresses');
  await createLocalOrderRepository(port).create(testOrder());
  expect(data.get('plazza.shopping.v1')).toBe(shopping);
  expect(data.get('plazza.addresses.v1')).toBe('independent addresses');
  expect(jest.mocked(port.getItem).mock.calls.every(([key]) => key === ORDER_STORAGE_KEY)).toBe(true);
  expect(jest.mocked(port.setItem).mock.calls.every(([key]) => key === ORDER_STORAGE_KEY)).toBe(true);
});
