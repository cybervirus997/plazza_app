import { router, type Href, type NativeStackNavigationOptions } from 'expo-router';
import { Keyboard } from 'react-native';
import { colors } from '../theme/tokens';

export const stackOptions: NativeStackNavigationOptions = {
  headerShown: false, animation: 'slide_from_right', animationTypeForReplace: 'push',
  contentStyle: { backgroundColor: colors.background },
};
export const quietStackOptions: NativeStackNavigationOptions = { ...stackOptions, animation: 'none' };
export const returningScreenOptions: NativeStackNavigationOptions = { animationTypeForReplace: 'pop' };

export function backTo(fallback: Href) {
  Keyboard.dismiss();
  if (router.canGoBack()) router.back();
  else router.dismissTo(fallback);
}
export function returnToShop(tab: 'home' | 'cart' = 'home') {
  Keyboard.dismiss();
  router.dismissTo(tab === 'cart' ? '/cart' : '/');
}
export function reviewCheckout() { Keyboard.dismiss(); router.dismissTo('/checkout'); }
export function openPayment() { Keyboard.dismiss(); router.navigate('/payment'); }
export function openOrders() { router.navigate('/orders'); }
export function openReceipt(id: string) { router.navigate({ pathname: '/orders/[id]', params: { id } }); }
export function confirmOrder(id: string) { router.replace({ pathname: '/order-confirmation', params: { id } }); }
