import { Alert, Platform, ToastAndroid } from 'react-native';
import type { Notice } from './appReducer';

export function announceNotice(notice: Notice): void {
  if (notice.kind === 'auto-removal' && Platform.OS === 'android') {
    ToastAndroid.show(notice.message, ToastAndroid.LONG);
  }
  if (notice.kind === 'order') Alert.alert('Order placed', notice.message);
}
