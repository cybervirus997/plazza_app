import type { DeliveryAddressSnapshot } from './addresses';
import { calculateBill } from './bill';
import { createOrderDraft, type DeliveryPreference, type Order } from './orders';
import type { Medicine, ShoppingState } from './types';

interface CheckoutProduct extends Medicine { readonly isAvailable: boolean }

// Review identities are never persisted. Real identities are allocated on confirmation.
const reviewIdentity = { id: 'review', checkoutId: 'review', placedAt: '1970-01-01T00:00:00.000Z' };
export function createCheckoutReview(input: {
  snapshot: ShoppingState; products: readonly CheckoutProduct[]; address: DeliveryAddressSnapshot | null;
  deliveryPreference: DeliveryPreference;
}): Order {
  for (const entry of input.snapshot.cart) {
    const product = input.products.find((item) => item.id === entry.medicineId);
    if (!product) throw new Error('An item is no longer in the catalog. Edit your cart before checkout.');
    if (!product.isAvailable) throw new Error(`${product.name} is unavailable in this demo. Remove it before checkout.`);
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > product.maxQty) {
      throw new Error(`Review the quantity of ${product.name} in your cart.`);
    }
  }
  return createOrderDraft({ ...reviewIdentity, cart: input.snapshot.cart, products: input.products,
    bill: calculateBill(input.snapshot.cart, input.products, input.snapshot.activeCouponCode, input.snapshot.usedCouponCodes),
    couponCode: input.snapshot.activeCouponCode, usedCouponCodes: input.snapshot.usedCouponCodes,
    deliveryAddress: input.address, deliveryPreference: input.deliveryPreference });
}
export const sameReview = (left: Order, right: Order): boolean => JSON.stringify(left) === JSON.stringify(right);
export const allowsDemoCod = (order: Order): boolean => order.grandTotal <= 2000;
export const demoServiceability = 'Offline demo: saved Indian PIN codes are accepted for simulation only. Actual stock, coverage and delivery times are not checked.';
