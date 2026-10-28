import { nextReview, reviewInputs, reviewInstant } from '../src/domain/careRecurrence';
import { careProposal, parseCareRecord } from '../src/domain/carePlans';
import { createLocalCarePlanRepository, CARE_STORAGE_KEY } from '../src/repositories/local/LocalCarePlanRepository';
import { reviewedCareCart } from '../src/domain/careCart';
import { createAppReducer, initialAppState } from '../src/state/appReducer';
import { emptyShoppingState } from '../src/domain/types';
import { orderStorage } from './order-fixtures';
import { planFixture, recipientFixture } from './care-fixtures';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
const clock = () => '2026-10-29T10:00:00.000Z';
test('monthly recurrence clamps month end and then restores the original day', () => {
  const plan = planFixture(); const feb = nextReview(plan.nextReviewAt, plan.cadence, plan.timeZone);
  expect(feb).toBe('2027-02-28T03:30:00.000Z');
  expect(nextReview(feb, plan.cadence, plan.timeZone)).toBe('2027-03-31T03:30:00.000Z');
});
test('weekly wall time survives DST gaps without permanently drifting and ambiguous times use the earlier instant', () => {
  const cadence = { unit: 'week' as const, every: 1, anchorDay: 1, hour: 2, minute: 30 };
  const gap = nextReview('2026-03-01T07:30:00.000Z', cadence, 'America/New_York');
  expect(gap).toBe('2026-03-08T07:30:00.000Z');
  expect(nextReview(gap, cadence, 'America/New_York')).toBe('2026-03-15T06:30:00.000Z');
  expect(reviewInstant('2026-11-01', '01:30', 'America/New_York')).toBe('2026-11-01T05:30:00.000Z');
});
test('custom days, leap month ends, timezone conversion and invalid dates are explicit', () => {
  expect(nextReview('2028-01-31T00:00:00.000Z', { unit: 'month', every: 1, anchorDay: 31 }, 'UTC')).toBe('2028-02-29T00:00:00.000Z');
  expect(nextReview('2026-12-30T00:00:00.000Z', { unit: 'day', every: 3, anchorDay: 30 }, 'UTC')).toBe('2027-01-02T00:00:00.000Z');
  expect(reviewInputs(reviewInstant('2027-02-28', '09:00', 'Asia/Kolkata'), 'Asia/Kolkata')).toEqual({ date: '2027-02-28', time: '09:00' });
  expect(() => reviewInstant('2027-02-30', '09:00', 'UTC')).toThrow();
  expect(() => reviewInstant('2027-02-28', '09:00', 'invented/zone')).toThrow();
});
test('care plans/recipients persist independently, support editing, pause/resume/skip and deliberate cascade removal', async () => {
  const { port, data } = orderStorage(); let repo = createLocalCarePlanRepository(port, clock);
  await repo.save(recipientFixture(), 0); await repo.save(planFixture(), 0);
  repo = createLocalCarePlanRepository(port, clock); let records = await repo.load();
  expect(records).toHaveLength(2);
  await repo.action('plan-1', 'pause', 1); await repo.action('plan-1', 'resume', 2); records = await repo.action('plan-1', 'skip', 3);
  expect(records.find((item) => item.id === 'plan-1')).toMatchObject({ status: 'active', nextReviewAt: '2027-02-28T03:30:00.000Z', revision: 4 });
  await repo.save({ ...recipientFixture(), name: 'Updated parent' }, 1);
  await expect(repo.save({ ...recipientFixture(), name: 'Stale' }, 1)).rejects.toThrow('changed');
  expect(await repo.remove('recipient-1', 2)).toEqual([]);
  expect([...data.keys()]).toEqual([CARE_STORAGE_KEY]);
});
test('lost acknowledgement retries retain stable identities; duplicate data is not written again', async () => {
  const { port, data } = orderStorage(); const repo = createLocalCarePlanRepository(port, clock);
  jest.mocked(port.setItem).mockImplementationOnce(async (key, value) => { data.set(key, value); throw new Error('lost ack'); });
  await expect(repo.save(recipientFixture(), 0)).rejects.toThrow();
  await repo.save(recipientFixture(), 0);
  expect(await repo.load()).toHaveLength(1); expect(port.setItem).toHaveBeenCalledTimes(1);
});
test.each(['broken', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: [planFixture()] })])('care corruption/version/missing-recipient data is not reset', async (bytes) => {
  const { port, data } = orderStorage(); data.set(CARE_STORAGE_KEY, bytes); const repo = createLocalCarePlanRepository(port, clock);
  await expect(repo.save(recipientFixture(), 0)).rejects.toThrow(); expect(data.get(CARE_STORAGE_KEY)).toBe(bytes); expect(port.setItem).not.toHaveBeenCalled();
});
test('current prices/Rx/availability and quantity limits are checked before a cart import', () => {
  const product = { id: 'a', name: 'Current medicine', salt: 'Test', price: 250, maxQty: 3, rx: true, isAvailable: true };
  const proposed = planFixture().items;
  expect(careProposal(proposed, [product])[0].product).toMatchObject({ price: 250, rx: true });
  expect(careProposal(proposed, [{ ...product, isAvailable: false }])[0].problem).toContain('unavailable');
  expect(careProposal(proposed, [])[0].problem).toContain('no longer');
  expect(() => reviewedCareCart([{ medicineId: 'a', quantity: 2 }], proposed, [product], 'merge')).toThrow();
  expect(reviewedCareCart([{ medicineId: 'a', quantity: 2 }], proposed, [product], 'replace')).toEqual(proposed);
});
test('the single shopping reducer imports a reviewed proposal without placing orders or redeeming FIRST100, and honors locks', () => {
  const catalog = [{ id: 'a', name: 'Current', salt: '', price: 250, maxQty: 3, rx: false }]; const reducer = createAppReducer(catalog);
  const state = reducer(initialAppState(), { type: 'hydrate', snapshot: { ...emptyShoppingState(), cart: [{ medicineId: 'a', quantity: 1 }], activeCouponCode: 'FIRST100' } });
  const next = reducer(state, { type: 'review-care-cart', cart: [{ medicineId: 'a', quantity: 1 }], expectedCart: state.cart, mode: 'merge' });
  expect(next.cart).toEqual([{ medicineId: 'a', quantity: 2 }]); expect(next.usedCouponCodes).toEqual([]); expect(next.lastFinalizedCheckoutId).toBeUndefined();
  const locked = { ...state, checkoutLocked: true };
  expect(reducer(locked, { type: 'review-care-cart', cart: [], expectedCart: state.cart, mode: 'replace' })).toBe(locked);
  const stale = reducer(next, { type: 'review-care-cart', cart: [{ medicineId: 'a', quantity: 1 }], expectedCart: state.cart, mode: 'replace' });
  expect(stale.cart).toEqual(next.cart); expect(stale.notice?.message).toContain('cart changed');
  expect(() => parseCareRecord({ ...planFixture(), timeZone: 'bad' })).toThrow();
});
