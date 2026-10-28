import { useMemo } from 'react';
import type { DeliveryAddress } from '../../domain/addresses';
import { createCheckoutReview } from '../../domain/checkoutReview';
import type { DeliveryPreference } from '../../domain/orders';
import { useShopping } from '../../state/AppStateProvider';

export function useCheckoutReview(address: DeliveryAddress | null, deliveryPreference: DeliveryPreference) {
  const { state, catalog } = useShopping();
  return useMemo(() => {
    try {
      const review = createCheckoutReview({ snapshot: { cart: state.cart, activeCouponCode: state.activeCouponCode,
        usedCouponCodes: state.usedCouponCodes, recentSearches: [] }, products: catalog,
        address: address ? { version: 1, address } : null, deliveryPreference });
      return { review, error: null };
    } catch (error: unknown) {
      return { review: null, error: error instanceof Error ? error.message : 'Review your cart and address before continuing.' };
    }
  }, [state.cart, state.activeCouponCode, state.usedCouponCodes, catalog, address, deliveryPreference]);
}
