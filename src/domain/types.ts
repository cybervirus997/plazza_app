export interface Medicine {
  readonly id: string;
  readonly name: string;
  readonly salt: string;
  readonly price: number;
  readonly maxQty: number;
  readonly rx: boolean;
}

export interface CartEntry {
  readonly medicineId: string;
  readonly quantity: number;
}

export type Cart = readonly CartEntry[];

export interface ShoppingState {
  readonly cart: Cart;
  readonly activeCouponCode: string | null;
  readonly usedCouponCodes: readonly string[];
  readonly recentSearches: readonly string[];
}

export const emptyShoppingState = (): ShoppingState => ({
  cart: [],
  activeCouponCode: null,
  usedCouponCodes: [],
  recentSearches: [],
});
