import { createCheckoutReview, allowsDemoCod } from '../src/domain/checkoutReview';
import { parseOrder } from '../src/domain/orders';
import { localPaymentSimulator, paidOrder, parsePaymentAttempt, transitionPayment, unresolvedPayment } from '../src/domain/payments';
import { paymentAttempt, paymentSetup } from './payment-fixtures';

const time = '2026-10-29T09:01:00.000Z';
test.each(['address', 'cart', 'quantity', 'unavailable', 'coupon'] as const)('checkout explicitly rejects invalid %s', (problem) => {
  const app = paymentSetup();
  const input = { snapshot: app.start.snapshot, products: app.start.products, address: app.input.deliveryAddress, deliveryPreference: 'asap' as const };
  if (problem === 'address') input.address = null;
  if (problem === 'cart') input.snapshot = { ...input.snapshot, cart: [] };
  if (problem === 'quantity') input.snapshot = { ...input.snapshot, cart: [{ medicineId: 'a', quantity: 999 }] };
  if (problem === 'unavailable') input.products = input.products.map((item) => ({ ...item, isAvailable: item.id !== 'a' }));
  if (problem === 'coupon') input.snapshot = { ...input.snapshot, activeCouponCode: 'INVALID' };
  expect(() => createCheckoutReview(input)).toThrow();
});
test('review freezes prices, quantities, Rx and the selected recipient/address without GPS', () => {
  const app = paymentSetup();
  const review = app.start.review;
  expect(Object.isFrozen(review)).toBe(true);
  expect(Object.isFrozen(review.deliveryAddress.address)).toBe(true);
  expect(review.items).toMatchObject([{ productId: 'a', quantity: 2, unitPrice: 200, rx: false }, { productId: 'b', quantity: 1, unitPrice: 100, rx: true }]);
  const changed = app.start.products.map((item) => ({ ...item, price: 1 }));
  expect(() => createCheckoutReview({ snapshot: app.start.snapshot, products: changed, address: app.input.deliveryAddress, deliveryPreference: 'scheduled' })).toThrow('coupon');
  expect(createCheckoutReview({ snapshot: { ...app.start.snapshot, activeCouponCode: null }, products: changed,
    address: app.input.deliveryAddress, deliveryPreference: 'scheduled' }).grandTotal).not.toBe(review.grandTotal);
  expect(review.grandTotal).toBe(400);
  expect(review.deliveryAddress.address.recipientName).toBe('Test Recipient');
});
test.each([
  ['success', 'succeeded'], ['failure', 'failed'], ['cancel', 'cancelled'], ['pending-success', 'pending'], ['pending-failure', 'pending'],
] as const)('deterministic %s simulation yields %s', async (scenario, expected) => {
  const attempt = parsePaymentAttempt({ ...paymentAttempt(), scenario });
  expect(await localPaymentSimulator.initiate(attempt)).toBe(expected);
  expect(await localPaymentSimulator.initiate(attempt)).toBe(expected);
});
test.each([['pending-success', 'succeeded'], ['pending-failure', 'failed']] as const)('explicit Check Status resolves %s to %s', async (scenario, status) => {
  expect(await localPaymentSimulator.check(parsePaymentAttempt({ ...paymentAttempt(), scenario, status: 'pending' }))).toBe(status);
});
test('COD is a deliberate mock confirmation with a deterministic total limit', async () => {
  const attempt = parsePaymentAttempt({ ...paymentAttempt(), method: 'cod' });
  expect(allowsDemoCod(attempt.order)).toBe(true);
  expect(allowsDemoCod({ ...attempt.order, grandTotal: 2000.01 })).toBe(false);
  expect(await localPaymentSimulator.initiate(attempt)).toBe('succeeded');
  const order = paidOrder(transitionPayment(attempt, 'succeeded', time));
  expect(order.payment).toMatchObject({ method: 'cod', status: 'cod-confirmed', simulated: true });
});
test('terminal outcomes cannot change; pending is unresolved and duplicate callbacks are idempotent', () => {
  const initial = paymentAttempt();
  expect(unresolvedPayment(initial)).toBe(true);
  const pending = transitionPayment(initial, 'pending', time);
  expect(unresolvedPayment(pending)).toBe(true);
  const done = transitionPayment(pending, 'succeeded', time);
  expect(transitionPayment(done, 'succeeded', time)).toBe(done);
  expect(() => transitionPayment(done, 'failed', time)).toThrow('already final');
  expect(() => paidOrder(initial)).toThrow('confirmed');
  expect(unresolvedPayment(parsePaymentAttempt({ ...done, finalized: true }))).toBe(false);
});
test('optional receipt payment metadata is immutable and legacy receipts are not rewritten', () => {
  const attempt = paymentAttempt();
  const legacy = parseOrder(attempt.order);
  expect(legacy.payment).toBeUndefined();
  const paid = paidOrder(transitionPayment(attempt, 'succeeded', time));
  expect(Object.isFrozen(paid.payment)).toBe(true);
  expect(parseOrder(JSON.parse(JSON.stringify(paid)))).toEqual(paid);
  expect(() => parseOrder({ ...paid, payment: { ...paid.payment, version: 2 } })).toThrow();
  expect(() => parseOrder({ ...paid, payment: { ...paid.payment, method: 'cod' } })).toThrow();
});
test.each([{ version: 2 }, { status: 'unknown' }, { finalized: true }, { updatedAt: 'bad' }, { order: {} }])('damaged attempts fail closed: %j', (patch) => {
  expect(() => parsePaymentAttempt({ ...paymentAttempt(), ...patch })).toThrow();
});
