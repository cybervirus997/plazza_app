import type { Cart, Medicine } from './types';

export function addMedicine(cart: Cart, id: string, catalog: readonly Medicine[]): Cart {
  const medicine = catalog.find((item) => item.id === id);
  if (!medicine) return cart;
  const entry = cart.find((item) => item.medicineId === id);
  if (!entry) return [...cart, { medicineId: id, quantity: 1 }];
  if (entry.quantity >= medicine.maxQty) return cart;
  return cart.map((item) => item.medicineId === id
    ? { ...item, quantity: item.quantity + 1 }
    : item);
}

export const increaseQuantity = addMedicine;

export function removeMedicine(cart: Cart, id: string): Cart {
  return cart.filter((item) => item.medicineId !== id);
}

export function decreaseQuantity(cart: Cart, id: string): Cart {
  return cart.flatMap((item) => {
    if (item.medicineId !== id) return [item];
    return item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : [];
  });
}

export const clearCart = (): Cart => [];

export const cartCount = (cart: Cart): number =>
  cart.reduce((count, item) => count + item.quantity, 0);

export function getItemTotal(cart: Cart, catalog: readonly Medicine[]): number {
  // Sum integer paise, so fractional prices do not accumulate floating-point drift.
  return cart.reduce((total, entry) => {
    const medicine = catalog.find((item) => item.id === entry.medicineId);
    return total + (medicine ? Math.round(medicine.price * 100) * entry.quantity : 0);
  }, 0) / 100;
}

export function getCartItems(cart: Cart, catalog: readonly Medicine[]) {
  return cart.flatMap((entry) => {
    const medicine = catalog.find((item) => item.id === entry.medicineId);
    return medicine ? [{ medicine, quantity: entry.quantity }] : [];
  });
}
