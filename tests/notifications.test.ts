import { Alert, Platform, ToastAndroid } from 'react-native';
import { announceNotice } from '../src/state/notifications';

afterEach(() => jest.restoreAllMocks());
test('automatic coupon removal calls the Android toast with the explanatory message', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const show = jest.spyOn(ToastAndroid, 'show');
  announceNotice({ id: 1, kind: 'auto-removal', message: 'FLAT50 was removed. Minimum item total is ₹300.' });
  expect(show).toHaveBeenCalledWith('FLAT50 was removed. Minimum item total is ₹300.', ToastAndroid.LONG);
});
test('iOS does not call an Android-only toast', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const show = jest.spyOn(ToastAndroid, 'show');
  announceNotice({ id: 1, kind: 'auto-removal', message: 'Coupon removed' });
  expect(show).not.toHaveBeenCalled();
});
test('successful demo order presents a native accessible confirmation', () => {
  const alert = jest.spyOn(Alert, 'alert');
  announceNotice({ id: 2, kind: 'order', message: 'Order placed successfully.' });
  expect(alert).toHaveBeenCalledWith('Order placed', 'Order placed successfully.');
});
