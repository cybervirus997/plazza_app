import { createLocalTrackingRepository, TRACKING_STORAGE_KEY } from '../src/repositories/local/LocalTrackingRepository';
import { advanceTracking, canTrackOrder, nextTrackingStages, parseTracking, trackingStage } from '../src/domain/tracking';
import { demoETA } from '../src/features/tracking/presentation';
import { orderStorage, testOrder } from './order-fixtures';
import { paymentAttempt } from './payment-fixtures';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));

test('tracking progresses deterministically across restarts and never edits a frozen receipt', async () => {
  const { port } = orderStorage(); const order = testOrder(); const before = JSON.stringify(order);
  let repo = createLocalTrackingRepository(port, () => '2027-01-01T00:00:00.000Z');
  const initial = await repo.ensure(order, true);
  expect(demoETA(initial)).toBeNull();
  for (const stage of ['rx-review-required', 'confirmed', 'packing', 'out-for-delivery', 'delivered'] as const) {
    await repo.advance(order.id, stage, stage);
    repo = createLocalTrackingRepository(port, () => '2027-01-01T00:00:00.000Z');
    expect(trackingStage((await repo.get(order.id))!)).toBe(stage);
  }
  expect(nextTrackingStages((await repo.get(order.id))!)).toEqual([]);
  await expect(repo.advance(order.id, 'packing', 'invalid')).rejects.toThrow();
  expect(JSON.stringify(order)).toBe(before);
});
test('idempotent events and duplicate control taps do not write repeated transitions', async () => {
  const { port } = orderStorage(); const order = testOrder();
  const repo = createLocalTrackingRepository(port, () => '2027-01-01T00:00:00.000Z');
  await repo.ensure(order, true); await repo.advance(order.id, 'rx-review-required', 'step');
  const count = jest.mocked(port.setItem).mock.calls.length;
  await Promise.all([repo.advance(order.id, 'rx-review-required', 'step'), repo.advance(order.id, 'rx-review-required', 'other')]);
  expect(port.setItem).toHaveBeenCalledTimes(count);
  await expect(repo.advance(order.id, 'confirmed', 'step')).rejects.toThrow('conflicts');
});
test('a committed write with a lost acknowledgement restores once and retry is idempotent', async () => {
  const { port, data } = orderStorage(); const order = testOrder();
  const repo = createLocalTrackingRepository(port, () => '2027-01-01T00:00:00.000Z');
  await repo.ensure(order, true);
  jest.mocked(port.setItem).mockImplementationOnce(async (key, value) => { data.set(key, value); throw new Error('lost ack'); });
  await expect(repo.advance(order.id, 'rx-review-required', 'step')).rejects.toThrow('lost ack');
  await repo.advance(order.id, 'rx-review-required', 'retry');
  expect((await repo.get(order.id))?.events).toHaveLength(2);
});
test.each(['{broken', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: [{ id: 'bad' }] })])('corruption/unknown versions fail closed and preserve bytes', async (bytes) => {
  const { port, data } = orderStorage(); data.set(TRACKING_STORAGE_KEY, bytes);
  const repo = createLocalTrackingRepository(port);
  await expect(repo.ensure(testOrder(), true)).rejects.toThrow('recovery');
  expect(data.get(TRACKING_STORAGE_KEY)).toBe(bytes); expect(port.setItem).not.toHaveBeenCalled();
});
test('pending orders and unknown identities cannot create tracking; reconciliation evidence is explicit', async () => {
  const { port } = orderStorage(); const order = testOrder(); const repo = createLocalTrackingRepository(port);
  await expect(repo.ensure(order, false)).rejects.toThrow('reconciliation');
  await expect(repo.advance('unknown', 'packing', 'step')).rejects.toThrow('not found');
  expect(canTrackOrder(order, null)).toBe(false);
  expect(canTrackOrder(order, null, order.checkoutId)).toBe(true);
  const pending = paymentAttempt();
  expect(canTrackOrder(pending.order, pending, pending.order.checkoutId)).toBe(false);
});
test('delay/Rx/failure suppress misleading ETAs and event timestamps remain ordered', async () => {
  const { port } = orderStorage(); const order = testOrder(); const repo = createLocalTrackingRepository(port, () => '2027-01-01T00:00:00.000Z');
  await repo.ensure(order, true);
  const delayedRx = await repo.advance(order.id, 'delayed', 'delay'); expect(demoETA(delayedRx)).toBeNull();
  await repo.advance(order.id, 'placed', 'resume'); await repo.advance(order.id, 'rx-review-required', 'rx');
  await repo.advance(order.id, 'confirmed', 'confirmed'); const delayed = await repo.advance(order.id, 'delayed', 'delay2');
  expect(demoETA(delayed)).toContain('20 min');
  const failed = await repo.advance(order.id, 'unable-to-fulfill', 'failure'); expect(demoETA(failed)).toBeNull();
  expect(() => advanceTracking(delayed, { id: 'old', stage: 'cancelled', at: '2020-01-01T00:00:00.000Z', etaMinutes: null })).toThrow();
  expect(() => parseTracking({ ...failed, events: [...failed.events].reverse() })).toThrow();
});
