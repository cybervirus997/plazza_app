import { createOrderingService } from '../src/features/orders/ordering';
import { CHECKOUT_STORAGE_KEY, CheckoutCancelledError } from '../src/features/orders/checkout';
import { createLocalPaymentRepository, PAYMENT_STORAGE_KEY } from '../src/repositories/local/LocalPaymentRepository';
import { createLocalOrderRepository, ORDER_STORAGE_KEY } from '../src/repositories/local/LocalOrderRepository';
import { STORAGE_KEY, decodeCheckoutShopping } from '../src/storage/persistence';
import { localPaymentSimulator, paidOrder, type PaymentScenario } from '../src/domain/payments';
import { paymentSetup } from './payment-fixtures';
import { deferred } from './order-fixtures';

const clearJournal = (key: string, value: string) => key === CHECKOUT_STORAGE_KEY && value.includes('"pending":null');
const shopping = (app: ReturnType<typeof paymentSetup>) => decodeCheckoutShopping(app.data.get(STORAGE_KEY) ?? null);
async function receipts(app: ReturnType<typeof paymentSetup>) { return (await createLocalOrderRepository(app.port).load()).orders; }

test('review initiation creates no order; successful UPI uses the existing journal/writer before final confirmation', async () => {
  const app = paymentSetup();
  const started = await app.service.start(app.start);
  expect(started.attempt?.status).toBe('initiated');
  expect(await receipts(app)).toHaveLength(0);
  expect(shopping(app).usedCouponCodes).toEqual([]);
  const published = jest.fn();
  const result = await app.service.advance('payment-1', 'pay', { onFinalized: published });
  expect(result.attempt).toMatchObject({ status: 'succeeded', finalized: true });
  expect(result.order).toMatchObject({ id: 'order-1', checkoutId: 'checkout-1', payment: { method: 'upi', status: 'succeeded', attemptId: 'payment-1' } });
  expect(published).toHaveBeenCalledTimes(1);
  expect(shopping(app)).toMatchObject({ cart: [], activeCouponCode: null, usedCouponCodes: ['FIRST100'], lastFinalizedCheckoutId: 'checkout-1' });
  expect(jest.mocked(app.port.setItem).mock.calls.map(([key]) => key)).toEqual([
    PAYMENT_STORAGE_KEY, PAYMENT_STORAGE_KEY, CHECKOUT_STORAGE_KEY, ORDER_STORAGE_KEY, STORAGE_KEY, CHECKOUT_STORAGE_KEY, PAYMENT_STORAGE_KEY,
  ]);
});
test.each(['pending-success', 'pending-failure'] as const)('pending %s survives restart and only explicit Check Status resolves it', async (scenario) => {
  const app = paymentSetup(scenario);
  await app.service.start(app.start); await app.service.advance('payment-1', 'pay');
  expect((await app.service.advance('payment-1', 'pay')).attempt?.status).toBe('pending');
  const restart = createOrderingService(app.port, app.options);
  const recovered = await restart.recover();
  expect(recovered.attempt?.status).toBe('pending');
  expect(recovered.order).toBeNull();
  expect(await receipts(app)).toHaveLength(0);
  expect(shopping(app).cart).toEqual(app.start.snapshot.cart);
  expect(shopping(app).usedCouponCodes).toEqual([]);
  expect(restart.isLocked()).toBe(true);
  const result = await restart.advance('payment-1', 'check');
  expect(result.attempt?.status).toBe(scenario === 'pending-success' ? 'succeeded' : 'failed');
  expect(await receipts(app)).toHaveLength(scenario === 'pending-success' ? 1 : 0);
  expect(shopping(app).usedCouponCodes).toEqual(scenario === 'pending-success' ? ['FIRST100'] : []);
});
test.each(['failure', 'cancel'] as PaymentScenario[])('%s never creates an order or consumes FIRST100; retry has new identity', async (scenario) => {
  const app = paymentSetup(scenario);
  await app.service.start(app.start);
  const result = await app.service.advance('payment-1', 'pay');
  expect(result.attempt?.status).toBe(scenario === 'failure' ? 'failed' : 'cancelled');
  expect(await receipts(app)).toHaveLength(0);
  expect(shopping(app)).toMatchObject({ cart: app.start.snapshot.cart, usedCouponCodes: [] });
  expect(app.service.isLocked()).toBe(false);
  const next = await app.service.start({ ...app.start, scenario: 'success' });
  expect(next.attempt).toMatchObject({ id: 'payment-2', order: { checkoutId: 'checkout-2' } });
  await app.service.advance('payment-2', 'pay');
  expect((await receipts(app))[0].checkoutId).toBe('checkout-2');
});
test('explicit cancellation unlocks a saved pending attempt and preserves cart/coupon', async () => {
  const app = paymentSetup('pending-success');
  await app.service.start(app.start); await app.service.advance('payment-1', 'pay');
  const cancelled = await app.service.cancel('payment-1');
  expect(cancelled.attempt?.status).toBe('cancelled');
  expect(app.service.isLocked()).toBe(false);
  expect(shopping(app)).toMatchObject({ cart: app.start.snapshot.cart, activeCouponCode: 'FIRST100', usedCouponCodes: [] });
  expect(await receipts(app)).toHaveLength(0);
});
test('deliberate COD confirmation uses the same durable order protocol and marks cash as uncollected', async () => {
  const app = paymentSetup();
  await app.service.start({ ...app.start, method: 'cod' });
  expect(await receipts(app)).toHaveLength(0);
  const result = await app.service.advance('payment-1', 'pay');
  expect(result.order?.payment).toMatchObject({ method: 'cod', status: 'cod-confirmed', simulated: true });
});
test('repeated taps are blocked and duplicate successful callbacks create at most one receipt/finalization', async () => {
  const app = paymentSetup();
  const address = deferred<Awaited<ReturnType<typeof app.start.address>>>();
  const first = app.service.start({ ...app.start, address: () => address.promise });
  await expect(app.service.start(app.start)).rejects.toThrow('already in progress');
  address.resolve(app.input.deliveryAddress); await first;
  const paying = app.service.advance('payment-1', 'pay');
  await expect(app.service.advance('payment-1', 'pay')).rejects.toThrow('already in progress');
  await paying;
  const duplicate = await app.service.advance('payment-1', 'pay');
  expect(duplicate.attempt?.finalized).toBe(true);
  expect(await receipts(app)).toHaveLength(1);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === ORDER_STORAGE_KEY)).toHaveLength(1);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
});
test('review changes during address capture abort without replacing the reviewed prices or address', async () => {
  const app = paymentSetup();
  await expect(app.service.start({ ...app.start, isReviewCurrent: () => false })).rejects.toThrow('details changed');
  expect(app.port.setItem).not.toHaveBeenCalled();
  expect(app.service.isLocked()).toBe(false);
  if (!app.input.deliveryAddress) throw new Error('Missing fixture');
  const changed = { ...app.input.deliveryAddress, address: { ...app.input.deliveryAddress.address, recipientName: 'Someone Else' } };
  await expect(app.service.start({ ...app.start, address: async () => changed })).rejects.toThrow('details changed');
  expect(await receipts(app)).toHaveLength(0);
});
test.each([false, true])('attempt-write acknowledgement failure committed=%s retains the same identity through recovery', async (committed) => {
  const app = paymentSetup();
  jest.mocked(app.port.setItem).mockImplementationOnce(async (key, value) => { if (committed) app.data.set(key, value); throw new Error('attempt ack'); });
  await expect(app.service.start(app.start)).rejects.toThrow('attempt ack');
  expect(await receipts(app)).toHaveLength(0);
  const result = await app.service.recover();
  expect(result.attempt?.id).toBe('payment-1');
  expect(result.attempt?.status).toBe('initiated');
  expect(app.options.identity).toHaveBeenCalledTimes(1);
  expect(shopping(app).usedCouponCodes).toEqual([]);
});
test.each(['attempt', 'success', 'intent', 'receipt', 'shopping', 'cleanup', 'completed'] as const)('restart recovers a crash after the %s persistence boundary', async (point) => {
  const app = paymentSetup(); let active = true;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    const current = key === PAYMENT_STORAGE_KEY ? JSON.parse(value).current : null;
    if ((point === 'attempt' && current?.status === 'initiated')
      || (point === 'success' && current?.status === 'succeeded' && !current?.finalized)
      || (point === 'intent' && key === CHECKOUT_STORAGE_KEY && !clearJournal(key, value))
      || (point === 'receipt' && key === ORDER_STORAGE_KEY) || (point === 'shopping' && key === STORAGE_KEY)
      || (point === 'cleanup' && clearJournal(key, value)) || (point === 'completed' && current?.finalized)) active = false;
  });
  const started = app.service.start(app.start, { isCurrent: () => active });
  if (point === 'attempt') await expect(started).rejects.toBeInstanceOf(CheckoutCancelledError);
  else { await started; await expect(app.service.advance('payment-1', 'pay', { isCurrent: () => active })).rejects.toBeInstanceOf(CheckoutCancelledError); }
  const restart = createOrderingService(app.port, app.options);
  const recovered = await restart.recover();
  if (point === 'attempt') {
    expect(await receipts(app)).toHaveLength(0);
    expect(recovered.attempt?.status).toBe('initiated');
    await restart.advance('payment-1', 'check');
  }
  expect(await receipts(app)).toHaveLength(1);
  expect(shopping(app)).toMatchObject({ cart: [], usedCouponCodes: ['FIRST100'], lastFinalizedCheckoutId: 'checkout-1' });
  expect((await createLocalPaymentRepository(app.port).load())?.finalized).toBe(true);
});
test.each(['success', 'intent', 'receipt', 'shopping', 'cleanup', 'completed'] as const)('lost acknowledgement after committed %s write recovers without duplicate receipt or redemption', async (point) => {
  const app = paymentSetup(); await app.service.start(app.start); let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    const current = key === PAYMENT_STORAGE_KEY ? JSON.parse(value).current : null;
    if (!failed && ((point === 'success' && current?.status === 'succeeded' && !current?.finalized)
      || (point === 'intent' && key === CHECKOUT_STORAGE_KEY && !clearJournal(key, value))
      || (point === 'receipt' && key === ORDER_STORAGE_KEY) || (point === 'shopping' && key === STORAGE_KEY)
      || (point === 'cleanup' && clearJournal(key, value)) || (point === 'completed' && current?.finalized))) { failed = true; throw new Error('ack lost'); }
  });
  await expect(app.service.advance('payment-1', 'pay')).rejects.toThrow();
  await app.service.recover();
  expect(await receipts(app)).toHaveLength(1);
  expect(shopping(app).usedCouponCodes).toEqual(['FIRST100']);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === ORDER_STORAGE_KEY)).toHaveLength(1);
  expect(jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
});
test.each(['receipt', 'shopping'] as const)('%s failure leaves a successful payment in reconciliation, with no false final result', async (point) => {
  const app = paymentSetup(); await app.service.start(app.start); let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (!failed && key === (point === 'receipt' ? ORDER_STORAGE_KEY : STORAGE_KEY)) { failed = true; throw new Error('disk full'); }
    app.data.set(key, value);
  });
  const finalized = jest.fn();
  await expect(app.service.advance('payment-1', 'pay', { onFinalized: finalized })).rejects.toThrow();
  expect(finalized).not.toHaveBeenCalled();
  expect((await app.service.inspectPayment())).toMatchObject({ status: 'succeeded', finalized: false });
  expect(shopping(app).cart).toEqual(app.start.snapshot.cart);
  expect(shopping(app).usedCouponCodes).toEqual([]);
  const result = await app.service.advance('payment-1', 'check');
  expect(result.attempt?.finalized).toBe(true);
  expect(app.options.identity).toHaveBeenCalledTimes(1);
});
test('a conflicting cart cannot be cleared by a successful payment; unresolved attempt bytes are retained', async () => {
  const app = paymentSetup(); await app.service.start(app.start);
  app.data.set(STORAGE_KEY, JSON.stringify({ version: 1, ...app.start.snapshot, cart: [{ medicineId: 'c', quantity: 1 }] }));
  await expect(app.service.advance('payment-1', 'pay')).rejects.toThrow('cart differs');
  expect(await receipts(app)).toHaveLength(0);
  expect(shopping(app).cart).toEqual([{ medicineId: 'c', quantity: 1 }]);
  expect((await app.service.inspectPayment())?.status).toBe('succeeded');
  await expect(app.service.recover()).rejects.toThrow('cart differs');
});
test('pending payment recovery rejects a contradictory paid checkout journal before running finalization', async () => {
  const app = paymentSetup('pending-success'); await app.service.start(app.start); await app.service.advance('payment-1', 'pay');
  const attempt = await app.service.inspectPayment(); if (!attempt) throw new Error('No attempt');
  const raw = JSON.stringify({ version: 1, pending: { order: { ...attempt.order, checkoutId: 'conflict' }, oneTimeCouponCode: 'FIRST100' } });
  app.data.set(CHECKOUT_STORAGE_KEY, raw);
  const count = jest.mocked(app.port.setItem).mock.calls.length;
  await expect(app.service.recover()).rejects.toThrow('records conflict');
  expect(app.port.setItem).toHaveBeenCalledTimes(count);
  expect(app.data.get(CHECKOUT_STORAGE_KEY)).toBe(raw);
  expect(await receipts(app)).toHaveLength(0);
});
test('corrupted payment data blocks even a valid checkout journal from being destructively recovered', async () => {
  const app = paymentSetup();
  app.data.set(PAYMENT_STORAGE_KEY, '{broken');
  app.data.set(CHECKOUT_STORAGE_KEY, JSON.stringify({ version: 1, pending: { order: app.start.review, oneTimeCouponCode: 'FIRST100' } }));
  await expect(app.service.recover()).rejects.toThrow('payment data');
  expect(app.port.setItem).not.toHaveBeenCalled();
  expect(app.data.get(PAYMENT_STORAGE_KEY)).toBe('{broken');
});
test('a slow simulator result after unmount cannot transition or finalize the saved attempt', async () => {
  const app = paymentSetup(); const result = deferred<'succeeded'>(); let active = true;
  const service = createOrderingService(app.port, { ...app.options, simulator: { ...localPaymentSimulator, initiate: async () => result.promise } });
  await service.start(app.start);
  const pending = service.advance('payment-1', 'pay', { isCurrent: () => active });
  active = false; result.resolve('succeeded');
  await expect(pending).rejects.toBeInstanceOf(CheckoutCancelledError);
  expect((await app.service.inspectPayment())?.status).toBe('initiated');
  expect(await receipts(app)).toHaveLength(0);
});
test('successful restart recovery uses frozen prices/address and rejects FIRST100 reuse', async () => {
  const app = paymentSetup('pending-success'); await app.service.start(app.start); await app.service.advance('payment-1', 'pay');
  const restarted = createOrderingService(app.port, app.options);
  await restarted.recover(); const result = await restarted.advance('payment-1', 'check');
  expect(result.order?.itemTotal).toBe(500);
  expect(result.order?.deliveryAddress.address.recipientName).toBe('Test Recipient');
  await expect(restarted.start({ ...app.start, snapshot: { ...app.start.snapshot, usedCouponCodes: ['FIRST100'], lastFinalizedCheckoutId: 'checkout-1' } })).rejects.toThrow('coupon');
  expect(await receipts(app)).toHaveLength(1);
  expect(shopping(app).usedCouponCodes).toEqual(['FIRST100']);
});

test('payment read and simulator failures retain the original attempt and never falsely finalize', async () => {
  const app = paymentSetup();
  jest.mocked(app.port.getItem).mockRejectedValueOnce(new Error('storage offline'));
  await expect(app.service.recover()).rejects.toThrow('storage offline');
  expect(app.port.setItem).not.toHaveBeenCalled();
  const simulator = { ...localPaymentSimulator, initiate: jest.fn().mockRejectedValueOnce(new Error('verification unavailable')).mockResolvedValue('succeeded') };
  const service = createOrderingService(app.port, { ...app.options, simulator });
  await service.start(app.start);
  await expect(service.advance('payment-1', 'pay')).rejects.toThrow('verification unavailable');
  expect((await service.inspectPayment())?.status).toBe('initiated');
  expect(await receipts(app)).toHaveLength(0);
  await service.advance('payment-1', 'pay');
  expect(await receipts(app)).toHaveLength(1);
  expect(app.options.identity).toHaveBeenCalledTimes(1);
});
test.each(['pending', 'failed', 'cancelled'] as const)('a contradictory %s payment with a saved receipt blocks reconciliation', async (status) => {
  const app = paymentSetup();
  await app.service.start(app.start); await app.service.advance('payment-1', 'pay');
  const attempt = await app.service.inspectPayment();
  app.data.set(PAYMENT_STORAGE_KEY, JSON.stringify({ version: 1, current: { ...attempt, status, finalized: false } }));
  const writes = jest.mocked(app.port.setItem).mock.calls.length;
  await expect(createOrderingService(app.port, app.options).recover()).rejects.toThrow('conflicts');
  expect(app.port.setItem).toHaveBeenCalledTimes(writes);
});
test('a checkpoint without its original receipt is never silently reconstructed from the payment snapshot', async () => {
  const app = paymentSetup(); await app.service.start(app.start);
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (key === PAYMENT_STORAGE_KEY && JSON.parse(value).current.finalized && !failed) { failed = true; throw new Error('completion failed'); }
    app.data.set(key, value);
  });
  await expect(app.service.advance('payment-1', 'pay')).rejects.toThrow('completion failed');
  app.data.delete(ORDER_STORAGE_KEY);
  const writes = jest.mocked(app.port.setItem).mock.calls.length;
  await expect(app.service.recover()).rejects.toThrow('no matching receipt');
  expect(app.data.has(ORDER_STORAGE_KEY)).toBe(false);
  // A same-intent journal may be restored, but missing receipt evidence is never overwritten.
  expect(jest.mocked(app.port.setItem).mock.calls.slice(writes).every(([key]) => key === CHECKOUT_STORAGE_KEY)).toBe(true);
});

test('remount recovery waits for an invalidated in-flight simulator instead of racing it', async () => {
  const app = paymentSetup(); const release = deferred<'succeeded'>(); let active = true;
  const service = createOrderingService(app.port, { ...app.options, simulator: { ...localPaymentSimulator, initiate: () => release.promise } });
  await service.start(app.start);
  const pending = service.advance('payment-1', 'pay', { isCurrent: () => active });
  active = false;
  const cancelled = expect(pending).rejects.toBeInstanceOf(CheckoutCancelledError);
  const recovery = service.recover();
  release.resolve('succeeded');
  await cancelled;
  expect((await recovery).attempt?.status).toBe('initiated');
  expect(await receipts(app)).toHaveLength(0);
});

test('a crash after source preparation but before payment creation restores only the cart', async () => {
  const app = paymentSetup();
  app.data.delete(STORAGE_KEY);
  let active = true;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    if (key === STORAGE_KEY) active = false;
  });
  await expect(app.service.start(app.start, { isCurrent: () => active })).rejects.toBeInstanceOf(CheckoutCancelledError);
  expect(app.data.has(PAYMENT_STORAGE_KEY)).toBe(false);
  expect(app.data.has(CHECKOUT_STORAGE_KEY)).toBe(false);
  expect(await receipts(app)).toHaveLength(0);
  const result = await createOrderingService(app.port, app.options).recover();
  expect(result.attempt).toBeNull();
  expect(result.snapshot).toEqual(app.start.snapshot);
  expect(result.snapshot.usedCouponCodes).toEqual([]);
});
