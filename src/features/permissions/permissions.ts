import { isRunningInExpoGo, type PermissionResponse } from 'expo';
import type { NotificationPermissionsStatus } from 'expo-notifications';
import { AppState, Linking, Platform } from 'react-native';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied' | 'blocked' | 'unavailable';
export interface PermissionSnapshot {
  location: PermissionStatus;
  notifications: PermissionStatus;
  coordinates: { latitude: number; longitude: number } | null;
  locationMessage: string;
}

type LocationSnapshot = Pick<PermissionSnapshot, 'location' | 'coordinates' | 'locationMessage'>;
type RequestMode = 'initial' | 'refresh' | 'request';
type NativeCall = 'location-module' | 'location-status' | 'location-request' | 'services' | 'position'
  | 'notification-module' | 'notification-status' | 'notification-request' | 'channel' | 'settings';

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

// A timeout stops waiting, not the native operation. Keep its lock until it settles.
const pendingCalls = new Map<NativeCall, Promise<unknown>>();
async function nativeCall<T>(key: NativeCall, call: () => Promise<T>, requireFresh = false): Promise<T> {
  const prompt = key === 'location-request' || key === 'notification-request';
  let pending = pendingCalls.get(key) as Promise<T> | undefined;
  if (pending && requireFresh) {
    // A Settings return must not adopt a status read started before the change.
    await withDeadline(pending, 8000);
    pending = pendingCalls.get(key) as Promise<T> | undefined;
  }
  if (!pending) {
    if (prompt && (pendingCalls.has('location-request') || pendingCalls.has('notification-request'))) {
      throw new Error('A permission prompt is still open.');
    }
    pending = Promise.resolve().then(call);
    pendingCalls.set(key, pending);
    const release = () => { pendingCalls.delete(key); };
    void pending.then(release, release);
  }
  return withDeadline(pending, prompt ? 30000 : 8000);
}

async function withDeadline<T>(pending: Promise<T>, timeout: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Native operation timed out.')), timeout);
    })]);
  } finally { clearTimeout(timer); }
}

const locationApi = () => nativeCall('location-module', () => import('expo-location'));
const isActive = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
const shouldRequest = (response: PermissionResponse, mode: RequestMode) =>
  isActive() && response.canAskAgain && !response.granted
  && (mode === 'request' || (mode === 'initial' && response.status === 'undetermined'));

function locationSnapshot(location: PermissionStatus): LocationSnapshot {
  return { location, coordinates: null,
    locationMessage: location === 'blocked' ? 'Location access is blocked. Enable it in Settings.'
      : location === 'granted' ? 'Location access is enabled. Tap Update Location to find your delivery location.'
        : location === 'unavailable' ? 'Location is unavailable. You can still browse medicines.'
          : 'Location access is off. You can still browse medicines.' };
}

async function collectPermissions(mode: RequestMode): Promise<PermissionSnapshot> {
  if (Platform.OS === 'web') return { ...locationSnapshot('unavailable'), notifications: 'unavailable',
    locationMessage: 'Use the Android app to set your delivery location.' };
  let location: PermissionStatus = 'unavailable';
  let notifications: PermissionStatus = 'unavailable';
  try {
    const api = await locationApi();
    let response = await nativeCall('location-status', () => api.getForegroundPermissionsAsync(), mode === 'refresh');
    if (shouldRequest(response, mode)) response = await nativeCall('location-request', () => api.requestForegroundPermissionsAsync());
    location = permissionStatus(response);
  } catch { /* A missing or failed native module remains explicitly unavailable. */ }
  // Expo Go must be detected before evaluating the notifications entry point.
  if (Platform.OS !== 'android' || !isRunningInExpoGo()) {
    try {
      const api = await nativeCall('notification-module', () => import('expo-notifications'));
      if (Platform.OS === 'android' && mode !== 'refresh') {
        await nativeCall('channel', () => api.setNotificationChannelAsync('orders', {
          name: 'Order updates', importance: api.AndroidImportance.DEFAULT,
        }));
      }
      let response = await nativeCall('notification-status', () => api.getPermissionsAsync(), mode === 'refresh');
      if (shouldRequest(response, mode)) response = await nativeCall('notification-request', () => api.requestPermissionsAsync());
      notifications = notificationStatus(response, [api.IosAuthorizationStatus.AUTHORIZED,
        api.IosAuthorizationStatus.PROVISIONAL, api.IosAuthorizationStatus.EPHEMERAL]);
    } catch { /* A location failure must not prevent the notification check. */ }
  }
  return { ...locationSnapshot(location), notifications };
}

export function readPermissions(): Promise<PermissionSnapshot> {
  return collectPermissions('refresh');
}

export function requestPermissions(mode: 'initial' | 'request' = 'request'): Promise<PermissionSnapshot> {
  return collectPermissions(mode);
}

export function openPermissionSettings(): Promise<void> {
  return nativeCall('settings', () => Linking.openSettings());
}

export async function fetchDeliveryLocation(isCurrent: () => boolean = () => true): Promise<LocationSnapshot> {
  if (Platform.OS === 'web') return locationSnapshot('unavailable');
  let location: PermissionStatus = 'unavailable';
  try {
    const api = await locationApi();
    location = permissionStatus(await nativeCall('location-status', () => api.getForegroundPermissionsAsync(), true));
    if (location !== 'granted') return locationSnapshot(location);
    if (!isCurrent() || !isActive()) return locationSnapshot(location);
    if (!await nativeCall('services', () => api.hasServicesEnabledAsync())) {
      return { ...locationSnapshot(location), locationMessage: 'Location services are off. Turn on GPS and tap Update Location.' };
    }
    if (!isCurrent() || !isActive()) return locationSnapshot(location);
    location = permissionStatus(await nativeCall('location-status', () => api.getForegroundPermissionsAsync(), true));
    if (location !== 'granted' || !isCurrent() || !isActive()) return locationSnapshot(location);
    if (pendingCalls.has('position')) return { ...locationSnapshot(location),
      locationMessage: 'The previous location request is still finishing. Try Update Location again shortly.' };
    const result = await nativeCall('position', () => api.getCurrentPositionAsync({ accuracy: api.Accuracy.Balanced }));
    if (!isCurrent() || !isActive()) return locationSnapshot(location);
    // Permission may have changed while Android was acquiring the fix.
    location = permissionStatus(await nativeCall('location-status', () => api.getForegroundPermissionsAsync(), true));
    if (location !== 'granted') return locationSnapshot(location);
    const { latitude, longitude } = result.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Invalid coordinates.');
    return { location, coordinates: { latitude, longitude },
      locationMessage: `Delivering to: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` };
  } catch {
    return { ...locationSnapshot(location), locationMessage: location === 'granted'
      ? 'Could not find your location. Move outdoors or tap Update Location to try again.' : locationSnapshot(location).locationMessage };
  }
}

// Share only the pending first prompt sequence; remounts must read fresh OS state.
let initialRequest: Promise<PermissionSnapshot> | undefined;
let initialRequested = false;
export function requestInitialPermissions(): Promise<PermissionSnapshot> {
  if (initialRequest) return initialRequest;
  if (initialRequested) return readPermissions();
  initialRequested = true;
  initialRequest = requestPermissions('initial');
  void initialRequest.then(() => { initialRequest = undefined; }, () => { initialRequest = undefined; });
  return initialRequest;
}
