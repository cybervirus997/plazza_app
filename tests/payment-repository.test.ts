import { createLocalPaymentRepository, PAYMENT_STORAGE_KEY } from '../src/repositories/local/LocalPaymentRepository';
import { parsePaymentAttempt } from '../src/domain/payments';
import { orderStorage } from './order-fixtures';
import { paymentAttempt } from './payment-fixtures';
const time = '2026-10-29T09:01:00.000Z';
test('attempt creation, pending transition and explicit success survive new repository instances', async () => {
  const app = orderStorage(); const repository = createLocalPaymentRepository(app.port);
  expect(await repository.load()).toBeNull();
  const attempt = paymentAttempt();
  await repository.create(attempt);
  await repository.transition(attempt.id, 'pending', time);
  const restarted = createLocalPaymentRepository(app.port);
  expect((await restarted.load())?.status).toBe('pending');
  await restarted.transition(attempt.id, 'succeeded', time);
  expect((await restarted.finalize(attempt.id)).finalized).toBe(true);
  expect((await createLocalPaymentRepository(app.port).load())?.finalized).toBe(true);
});
test('unresolved attempts and conflicting identities cannot be overwritten; duplicate transitions do not write', async () => {
  const app = orderStorage(); const repository = createLocalPaymentRepository(app.port); const attempt = paymentAttempt();
  await repository.create(attempt); await repository.create(attempt);
  expect(app.port.setItem).toHaveBeenCalledTimes(1);
  await expect(repository.create({ ...attempt, id: 'another' })).rejects.toThrow('existing payment');
  await expect(repository.create({ ...attempt, scenario: 'failure' })).rejects.toThrow('identity conflicts');
  await repository.transition(attempt.id, 'pending', time);
  await repository.transition(attempt.id, 'pending', time);
  expect(app.port.setItem).toHaveBeenCalledTimes(2);
  await expect(repository.transition('stale-callback', 'succeeded', time)).rejects.toThrow('no longer current');
});
test('a failed/cancelled attempt requires a deliberate retry with entirely new checkout identity', async () => {
  const app = orderStorage(); const repository = createLocalPaymentRepository(app.port); const attempt = paymentAttempt();
  await repository.create(attempt); await repository.transition(attempt.id, 'failed', time);
  await expect(repository.create({ ...attempt, id: 'payment-2' })).rejects.toThrow('new checkout identity');
  const next = parsePaymentAttempt({ ...attempt, id: 'payment-2', order: { ...attempt.order, id: 'order-2', checkoutId: 'checkout-2' } });
  await repository.create(next);
  expect((await repository.load())?.id).toBe('payment-2');
  await expect(repository.finalize(next.id)).rejects.toThrow('Only a successful');
});
test.each(['{broken', '{"version":2,"current":null}', '{"version":1}', '{"version":1,"current":{}}'])('corrupt/incompatible payments %s are never replaced', async (raw) => {
  const app = orderStorage(); app.data.set(PAYMENT_STORAGE_KEY, raw); const repository = createLocalPaymentRepository(app.port);
  await expect(repository.load()).rejects.toThrow();
  await expect(repository.create(paymentAttempt())).rejects.toThrow();
  expect(app.data.get(PAYMENT_STORAGE_KEY)).toBe(raw);
  expect(app.port.setItem).not.toHaveBeenCalled();
});
test.each([false, true])('unknown write acknowledgement (committed=%s) safely retries the same attempt', async (committed) => {
  const app = orderStorage(); const repository = createLocalPaymentRepository(app.port); const attempt = paymentAttempt();
  jest.mocked(app.port.setItem).mockImplementationOnce(async (key, value) => { if (committed) app.data.set(key, value); throw new Error('write failed'); });
  await expect(repository.create(attempt)).rejects.toThrow('write failed');
  await repository.create(attempt);
  expect(await repository.load()).toEqual(attempt);
});
test('read failures preserve bytes and shared-port instances serialize writes', async () => {
  const app = orderStorage(); const one = createLocalPaymentRepository(app.port); const two = createLocalPaymentRepository(app.port);
  jest.mocked(app.port.getItem).mockRejectedValueOnce(new Error('read failed'));
  await expect(one.create(paymentAttempt())).rejects.toThrow('read failed');
  expect(app.port.setItem).not.toHaveBeenCalled();
  await one.create(paymentAttempt());
  const results = await Promise.all([one.transition('payment-1', 'pending', time), two.transition('payment-1', 'succeeded', time)]);
  expect(results.map((attempt) => attempt.status)).toEqual(['pending', 'succeeded']);
  expect((await one.load())?.status).toBe('succeeded');
});
