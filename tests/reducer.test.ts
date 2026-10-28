import { createAppReducer, initialAppState } from '../src/state/appReducer';
import { emptyShoppingState } from '../src/domain/types';
import { catalog } from './fixtures';

const reduce = createAppReducer(catalog);
const hydrated = () => reduce(initialAppState(), { type: 'hydrate', snapshot: emptyShoppingState() });
const withItems = () => reduce(reduce(hydrated(), { type: 'add', id: 'a' }), { type: 'add', id: 'b' });

test('actions cannot race initial hydration', () => expect(reduce(initialAppState(), { type: 'add', id: 'a' }).cart).toEqual([]));
test('applying FIRST100 does not consume it', () => {
  const state = reduce(withItems(), { type: 'apply-coupon', code: 'FIRST100' });
  expect(state.activeCouponCode).toBe('FIRST100');
  expect(state.usedCouponCodes).toEqual([]);
});
test('successful order consumes FIRST100 and clears the cart and coupon', () => {
  const state = reduce(reduce(withItems(), { type: 'apply-coupon', code: 'FIRST100' }), { type: 'place-order' });
  expect(state.usedCouponCodes).toEqual(['FIRST100']);
  expect(state.cart).toEqual([]);
  expect(state.activeCouponCode).toBeNull();
  expect(state.notice?.kind).toBe('order');
});
test('only one coupon can be active; applying another replaces it', () => {
  const state = reduce(reduce(withItems(), { type: 'apply-coupon', code: 'FLAT50' }), { type: 'apply-coupon', code: 'SAVE10' });
  expect(state.activeCouponCode).toBe('SAVE10');
});
test('invalid application preserves an existing valid coupon', () => {
  const state = reduce(reduce(withItems(), { type: 'apply-coupon', code: 'SAVE10' }), { type: 'apply-coupon', code: 'wrong' });
  expect(state.activeCouponCode).toBe('SAVE10');
  expect(state.notice?.kind).toBe('error');
});
test('ineligible coupon auto-removes and emits an explanatory toast event', () => {
  const state = reduce(reduce(withItems(), { type: 'apply-coupon', code: 'FLAT50' }), { type: 'remove', id: 'b' });
  expect(state.activeCouponCode).toBeNull();
  expect(state.notice).toMatchObject({ kind: 'auto-removal', message: expect.stringContaining('at least ₹300') });
});
test('valid coupon remains active after an eligible cart change', () => {
  const state = reduce(reduce(withItems(), { type: 'apply-coupon', code: 'FLAT50' }), { type: 'increase', id: 'a' });
  expect(state.activeCouponCode).toBe('FLAT50');
});
test.each(['remove', 'decrease', 'clear'] as const)('%s of final item cannot retain a coupon', (type) => {
  const state = reduce(reduce(reduce(hydrated(), { type: 'add', id: 'a' }), { type: 'apply-coupon', code: 'SAVE10' }), { type, id: 'a' });
  expect(state.activeCouponCode).toBeNull();
});
test('empty order is a no-op', () => {
  const state = hydrated();
  expect(reduce(state, { type: 'place-order' })).toBe(state);
});
test('other coupons are not recorded as one-time uses', () => {
  const state = reduce(reduce(withItems(), { type: 'apply-coupon', code: 'SAVE10' }), { type: 'place-order' });
  expect(state.usedCouponCodes).toEqual([]);
});
test('used FIRST100 cannot be applied to a later order', () => {
  let state = reduce(reduce(withItems(), { type: 'apply-coupon', code: 'FIRST100' }), { type: 'place-order' });
  state = reduce(reduce(state, { type: 'add', id: 'a' }), { type: 'apply-coupon', code: 'FIRST100' });
  expect(state.activeCouponCode).toBeNull();
});
test('hydration revalidates an ineligible saved coupon with an explanation', () => {
  const state = reduce(initialAppState(), { type: 'hydrate', snapshot: { ...emptyShoppingState(), cart: [{ medicineId: 'b', quantity: 1 }], activeCouponCode: 'FIRST100' } });
  expect(state.activeCouponCode).toBeNull();
  expect(state.notice?.kind).toBe('auto-removal');
});
test('late duplicate hydration cannot overwrite user actions', () => {
  const state = withItems();
  expect(reduce(state, { type: 'hydrate', snapshot: emptyShoppingState() })).toBe(state);
});
