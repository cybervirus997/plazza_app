import { evaluateCoupon, type CouponContext, type CouponRule } from '../src/domain/coupons';

const context = (itemTotal: number, usedCouponCodes: string[] = []): CouponContext =>
  ({ itemTotal, itemCount: 1, usedCouponCodes });

test('FLAT50 is rejected below ₹300', () => expect(evaluateCoupon('FLAT50', context(299)).valid).toBe(false));
test('FLAT50 is accepted at ₹300', () => expect(evaluateCoupon('FLAT50', context(300))).toMatchObject({ valid: true, discount: 50 }));
test('SAVE10 calculates 10%', () => expect(evaluateCoupon('SAVE10', context(400))).toMatchObject({ valid: true, discount: 40 }));
test('SAVE10 is capped at ₹100', () => expect(evaluateCoupon('SAVE10', context(2000))).toMatchObject({ valid: true, discount: 100 }));
test('FIRST100 is rejected below ₹200', () => expect(evaluateCoupon('FIRST100', context(199)).valid).toBe(false));
test('FIRST100 is accepted at ₹200', () => expect(evaluateCoupon('FIRST100', context(200))).toMatchObject({ valid: true, discount: 100 }));
test('FIRST100 is rejected after redemption', () => {
  expect(evaluateCoupon('FIRST100', context(200, ['FIRST100']))).toMatchObject({ valid: false, reason: expect.stringContaining('already been redeemed') });
});
test('codes ignore case and surrounding whitespace', () => expect(evaluateCoupon('  flat50  ', context(300)).valid).toBe(true));
test('unknown code has a clear reason', () => expect(evaluateCoupon('INVALID', context(300))).toMatchObject({ valid: false, reason: expect.stringContaining('not valid') }));
test('empty carts reject every coupon', () => {
  for (const code of ['FLAT50', 'SAVE10', 'FREEDEL', 'FIRST100']) {
    expect(evaluateCoupon(code, { ...context(0), itemCount: 0 }).valid).toBe(false);
  }
});
test('discounts cannot exceed item total even for a new registry rule', () => {
  const registry: readonly CouponRule[] = [{ code: 'HUGE', description: 'Test rule', evaluate: () => ({ valid: true, discount: 999, waiveDelivery: false }) }];
  expect(evaluateCoupon('HUGE', context(5), registry)).toMatchObject({ discount: 5 });
});
test('negative rule effects cannot increase the bill', () => {
  const registry: readonly CouponRule[] = [{ code: 'NEGATIVE', description: 'Test rule', evaluate: () => ({ valid: true, discount: -50, waiveDelivery: false }) }];
  expect(evaluateCoupon('NEGATIVE', context(5), registry)).toMatchObject({ discount: 0 });
});
test('FREEDEL is valid when delivery is already free', () => expect(evaluateCoupon('FREEDEL', context(500)).valid).toBe(true));
