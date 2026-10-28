import { cartCount, getItemTotal } from './cart';
import { evaluateCoupon } from './coupons';
import type { Cart, Medicine } from './types';

export interface Bill {
  readonly itemTotal: number;
  readonly discount: number;
  readonly deliveryFee: number;
  readonly grandTotal: number;
}

export function calculateBill(
  cart: Cart,
  catalog: readonly Medicine[],
  activeCouponCode: string | null = null,
  usedCouponCodes: readonly string[] = [],
): Bill {
  const itemTotal = getItemTotal(cart, catalog);
  const itemCount = cartCount(cart);
  const coupon = activeCouponCode
    ? evaluateCoupon(activeCouponCode, { itemTotal, itemCount, usedCouponCodes })
    : null;
  const discount = coupon?.valid ? coupon.discount : 0;
  const baseDeliveryFee = itemTotal > 0 && itemTotal < 499 ? 40 : 0;
  const deliveryFee = coupon?.valid && coupon.waiveDelivery ? 0 : baseDeliveryFee;
  return {
    itemTotal,
    discount,
    deliveryFee,
    grandTotal: Math.max(0, Math.round((itemTotal - discount + deliveryFee) * 100) / 100),
  };
}
