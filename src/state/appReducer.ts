import { addMedicine, cartCount, clearCart, decreaseQuantity, getItemTotal, removeMedicine } from '../domain/cart';
import { evaluateCoupon, normalizeCouponCode, redeemCoupon } from '../domain/coupons';
import { addRecentSearch } from '../domain/search';
import { emptyShoppingState, type Medicine, type ShoppingState } from '../domain/types';

export interface Notice {
  readonly id: number;
  readonly message: string;
  readonly kind: 'info' | 'error' | 'auto-removal' | 'order';
}

export interface AppState extends ShoppingState {
  readonly hydrated: boolean;
  readonly notice: Notice | null;
  readonly noticeSequence: number;
}

export type AppAction =
  | { type: 'hydrate'; snapshot: ShoppingState; warning?: string }
  | { type: 'add' | 'increase' | 'decrease' | 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'remove-coupon' }
  | { type: 'place-order' }
  | { type: 'apply-coupon'; code: string }
  | { type: 'search'; query: string }
  | { type: 'dismiss-notice'; id: number };

export const initialAppState = (): AppState => ({
  ...emptyShoppingState(), hydrated: false, notice: null, noticeSequence: 0,
});

function withNotice(state: AppState, message: string, kind: Notice['kind']): AppState {
  const id = state.noticeSequence + 1;
  return { ...state, noticeSequence: id, notice: { id, message, kind } };
}

export function revalidateCoupon(state: ShoppingState, catalog: readonly Medicine[]) {
  if (!state.activeCouponCode) return { snapshot: state, removalMessage: undefined };
  const result = evaluateCoupon(state.activeCouponCode, {
    itemTotal: getItemTotal(state.cart, catalog),
    itemCount: cartCount(state.cart),
    usedCouponCodes: state.usedCouponCodes,
  });
  return result.valid
    ? { snapshot: state, removalMessage: undefined }
    : {
      snapshot: { ...state, activeCouponCode: null },
      removalMessage: `${state.activeCouponCode} was removed. ${result.reason}`,
    };
}

export function createAppReducer(catalog: readonly Medicine[]) {
  return function appReducer(state: AppState, action: AppAction): AppState {
    if (action.type === 'hydrate') {
      if (state.hydrated) return state;
      const checked = revalidateCoupon(action.snapshot, catalog);
      const next = { ...state, ...checked.snapshot, hydrated: true };
      if (checked.removalMessage) return withNotice(next, checked.removalMessage, 'auto-removal');
      return action.warning ? withNotice(next, action.warning, 'error') : next;
    }
    // User actions never race ahead of restoration and get overwritten by it.
    if (!state.hydrated) return state;
    switch (action.type) {
      case 'add':
      case 'increase':
      case 'decrease':
      case 'remove':
      case 'clear': {
        const cart = action.type === 'clear' ? clearCart()
          : action.type === 'decrease' ? decreaseQuantity(state.cart, action.id)
          : action.type === 'remove' ? removeMedicine(state.cart, action.id)
          : addMedicine(state.cart, action.id, catalog);
        const checked = revalidateCoupon({ ...state, cart }, catalog);
        const next = { ...state, ...checked.snapshot };
        return checked.removalMessage
          ? withNotice(next, checked.removalMessage, 'auto-removal') : next;
      }
      case 'apply-coupon': {
        const code = normalizeCouponCode(action.code);
        const result = evaluateCoupon(code, {
          itemTotal: getItemTotal(state.cart, catalog),
          itemCount: cartCount(state.cart), usedCouponCodes: state.usedCouponCodes,
        });
        return result.valid
          ? withNotice({ ...state, activeCouponCode: code }, `${code} applied to your order.`, 'info')
          : withNotice(state, result.reason, 'error');
      }
      case 'remove-coupon':
        return { ...state, activeCouponCode: null, notice: null };
      case 'place-order': {
        if (state.cart.length === 0) return state;
        const checked = revalidateCoupon(state, catalog);
        return withNotice({
          ...state,
          cart: clearCart(),
          activeCouponCode: null,
          usedCouponCodes: redeemCoupon(checked.snapshot.activeCouponCode, state.usedCouponCodes),
        }, 'Order placed successfully. This was a demo order; no payment was taken.', 'order');
      }
      case 'search':
        return { ...state, recentSearches: addRecentSearch(state.recentSearches, action.query) };
      case 'dismiss-notice':
        return state.notice?.id === action.id ? { ...state, notice: null } : state;
    }
  };
}
