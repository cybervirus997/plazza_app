import { addMedicine, cartCount, clearCart, decreaseQuantity, getItemTotal, increaseQuantity, removeMedicine } from '../src/domain/cart';
import type { Cart } from '../src/domain/types';
import { catalog } from './fixtures';

describe('cart operations', () => {
  test('adds a known medicine', () => {
    expect(addMedicine([], 'a', catalog)).toEqual([{ medicineId: 'a', quantity: 1 }]);
  });
  test('increments an existing medicine immutably', () => {
    const original: Cart = Object.freeze([Object.freeze({ medicineId: 'a', quantity: 1 })]);
    expect(increaseQuantity(original, 'a', catalog)).toEqual([{ medicineId: 'a', quantity: 2 }]);
    expect(original[0].quantity).toBe(1);
  });
  test('decrements quantities', () => {
    expect(decreaseQuantity([{ medicineId: 'a', quantity: 2 }], 'a')[0].quantity).toBe(1);
  });
  test('decrementing one removes the entry', () => {
    expect(decreaseQuantity([{ medicineId: 'a', quantity: 1 }], 'a')).toEqual([]);
  });
  test('removes only the requested medicine', () => {
    expect(removeMedicine([{ medicineId: 'a', quantity: 1 }, { medicineId: 'b', quantity: 2 }], 'a'))
      .toEqual([{ medicineId: 'b', quantity: 2 }]);
  });
  test('clears the cart', () => expect(clearCart()).toEqual([]));
  test('enforces maxQty at the boundary', () => {
    expect(addMedicine([{ medicineId: 'a', quantity: 3 }], 'a', catalog)[0].quantity).toBe(3);
  });
  test('repeated taps never exceed maxQty', () => {
    let cart: Cart = [];
    for (let i = 0; i < 100; i++) cart = increaseQuantity(cart, 'a', catalog);
    expect(cart).toEqual([{ medicineId: 'a', quantity: 3 }]);
  });
  test('unknown IDs do not alter the cart', () => {
    const cart = addMedicine([], 'a', catalog);
    expect(addMedicine(cart, 'unknown', catalog)).toBe(cart);
  });
  test('decreasing an absent item leaves other entries alone', () => {
    const cart = addMedicine([], 'a', catalog);
    expect(decreaseQuantity(cart, 'unknown')).toEqual(cart);
  });
  test('counts units and totals from catalog metadata', () => {
    const cart: Cart = [{ medicineId: 'a', quantity: 2 }, { medicineId: 'b', quantity: 1 }];
    expect(cartCount(cart)).toBe(3);
    expect(getItemTotal(cart, catalog)).toBe(500);
  });
});
