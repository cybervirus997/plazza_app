import { calculateBill } from '../src/domain/bill';
import type { Medicine } from '../src/domain/types';

function billFor(price: number, coupon: string | null = null) {
  const catalog: readonly Medicine[] = [{ id: 'x', name: 'Test', salt: 'Test', price, maxQty: 1, rx: false }];
  return calculateBill([{ medicineId: 'x', quantity: 1 }], catalog, coupon);
}

test('empty cart has zero totals', () => {
  expect(calculateBill([], [])).toEqual({ itemTotal: 0, discount: 0, deliveryFee: 0, grandTotal: 0 });
});
test.each([[498, 40], [499, 0], [500, 0]])('₹%i delivery is ₹%i', (price, delivery) => {
  expect(billFor(price).deliveryFee).toBe(delivery);
});
test('delivery threshold uses item total before discounts', () => {
  expect(billFor(500, 'FIRST100')).toEqual({ itemTotal: 500, discount: 100, deliveryFee: 0, grandTotal: 400 });
});
test('SAVE10 uses pre-delivery item total', () => {
  expect(billFor(200, 'SAVE10')).toEqual({ itemTotal: 200, discount: 20, deliveryFee: 40, grandTotal: 220 });
});
test('FREEDEL waives only delivery', () => {
  expect(billFor(200, 'FREEDEL')).toEqual({ itemTotal: 200, discount: 0, deliveryFee: 0, grandTotal: 200 });
});
test('invalid coupon does not discount the bill', () => expect(billFor(100, 'FLAT50').discount).toBe(0));
test('percentage discount rounds to the nearest whole rupee', () => expect(billFor(255, 'SAVE10').discount).toBe(26));
test('fractional prices have a stable grand total', () => expect(billFor(49.95).grandTotal).toBe(89.95));
test('small carts cannot produce negative grand totals', () => expect(billFor(1, 'SAVE10').grandTotal).toBeGreaterThanOrEqual(0));
test('zero-priced items do not incur delivery', () => expect(billFor(0).deliveryFee).toBe(0));
