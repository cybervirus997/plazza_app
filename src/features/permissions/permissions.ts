import { isRunningInExpoGo, type PermissionResponse } from 'expo';
import * as Location from 'expo-location';
import type { NotificationPermissionsStatus } from 'expo-notifications';
import { Platform } from 'react-native';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied' | 'blocked' | 'unavailable';
export interface PermissionSnapshot {
  location: PermissionStatus;
  notifications: PermissionStatus;
  coordinates: { latitude: number; longitude: number } | null;
  locationMessage: string;
}

export const initialPermissions: PermissionSnapshot = {
  location: 'undetermined', notifications: 'undetermined', coordinates: null,
  locationMessage: 'Finding your delivery location…',
};

export function permissionStatus(response: Pick<PermissionResponse, 'status' | 'granted' | 'canAskAgain'>): PermissionStatus {
  if (response.granted) return 'granted';
  if (!response.canAskAgain) return 'blocked';
  return response.status === 'undetermined' ? 'undetermined' : 'denied';
}

function notificationStatus(response: NotificationPermissionsStatus, grantedIosStatuses: readonly number[]): PermissionStatus {
  if (response.ios && grantedIosStatuses.includes(response.ios.status)) return 'granted';
  return permissionStatus(response);
}

type RequestMode = 'initial' | 'refresh' | 'request';
const shouldRequest = (response: PermissionResponse, mode: RequestMode) =>
  response.canAskAgain && !response.granted && (mode === 'request' || (mode === 'initial' && response.status === 'undetermined'));

async function getCoordinates(): Promise<NonNullable<PermissionSnapshot['coordinates']>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Location timed out')), 8000);
      }),
    ]);
    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  } finally { clearTimeout(timer); }
}

export async function readPermissions(mode: RequestMode): Promise<PermissionSnapshot> {
  if (Platform.OS === 'web') return {
    location: 'unavailable', notifications: 'unavailable', coordinates: null,
    locationMessage: 'Use the Android app to set your delivery location.',
  };
  let location: PermissionStatus = 'unavailable';
  let notifications: PermissionStatus = 'unavailable';
  // Permission failures are isolated: a failed location request must not skip notifications.
  try {
    let response = await Location.getForegroundPermissionsAsync();
    if (shouldRequest(response, mode)) response = await Location.requestForegroundPermissionsAsync();
    location = permissionStatus(response);
  } catch { /* The unavailable status is visible in the permission panel. */ }
  // Expo Go lacks the topic module loaded by SDK 58's notifications entry point.
  // Detect it before import; custom development clients still use native permissions.
  if (Platform.OS !== 'android' || !isRunningInExpoGo()) {
    try {
      const notificationsApi = await import('expo-notifications');
      if (Platform.OS === 'android') {
        await notificationsApi.setNotificationChannelAsync('orders', {
          name: 'Order updates', importance: notificationsApi.AndroidImportance.DEFAULT,
        });
      }
      let response = await notificationsApi.getPermissionsAsync();
      if (shouldRequest(response, mode)) response = await notificationsApi.requestPermissionsAsync();
      notifications = notificationStatus(response, [notificationsApi.IosAuthorizationStatus.AUTHORIZED,
        notificationsApi.IosAuthorizationStatus.PROVISIONAL, notificationsApi.IosAuthorizationStatus.EPHEMERAL]);
    } catch { /* Shopping remains available without notification permission. */ }
  }

  let coordinates: PermissionSnapshot['coordinates'] = null;
  let locationMessage = location === 'blocked' ? 'Location access is blocked. Enable it in Settings.'
    : location === 'unavailable' ? 'Location is unavailable. You can still browse medicines.'
      : 'Location access is off. You can still browse medicines.';
  if (location === 'granted') {
    try {
      if (await Location.hasServicesEnabledAsync()) {
        coordinates = await getCoordinates();
        locationMessage = `Delivering to: ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
      } else locationMessage = 'Location services are off. Turn on GPS and refresh.';
    } catch { locationMessage = 'Could not find your location. Move outdoors or refresh to try again.'; }
  }
  return { location, notifications, coordinates, locationMessage };
}

// One native prompt sequence per JS session, including React development remounts.
let firstLaunch: Promise<PermissionSnapshot> | undefined;
export function requestInitialPermissions(): Promise<PermissionSnapshot> {
  firstLaunch ??= readPermissions('initial');
  return firstLaunch;
}
