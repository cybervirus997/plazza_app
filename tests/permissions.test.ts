import { PermissionStatus as NativeStatus, type PermissionResponse } from 'expo';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { permissionStatus, readPermissions, requestInitialPermissions } from '../src/features/permissions/permissions';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 }, getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(), hasServicesEnabledAsync: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 }, IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), setNotificationChannelAsync: jest.fn(),
}));

const response = (status: NativeStatus, canAskAgain = true): PermissionResponse =>
  ({ status, granted: status === NativeStatus.GRANTED, canAskAgain, expires: 'never' });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.UNDETERMINED));
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(response(NativeStatus.UNDETERMINED));
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  jest.mocked(Notifications.setNotificationChannelAsync).mockResolvedValue(null);
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
});
afterEach(() => { jest.useRealTimers(); });

test.each([
  [NativeStatus.UNDETERMINED, true, 'undetermined'],
  [NativeStatus.GRANTED, true, 'granted'],
  [NativeStatus.DENIED, true, 'denied'],
  [NativeStatus.DENIED, false, 'blocked'],
] as const)('OS response %s, canAskAgain %s maps to %s', (status, canAskAgain, expected) => {
  expect(permissionStatus(response(status, canAskAgain))).toBe(expected);
});
test('first launch requests both permissions and configures the channel first', async () => {
  await readPermissions('initial');
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(jest.mocked(Notifications.setNotificationChannelAsync).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(Notifications.requestPermissionsAsync).mock.invocationCallOrder[0]);
});
test('denied permissions are not automatically requested on each launch', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  await readPermissions('initial');
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('returning from Settings rechecks statuses without prompting', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  expect(await readPermissions('refresh')).toMatchObject({ location: 'granted', notifications: 'granted' });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('blocked responses never attempt another native prompt', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED, false));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED, false));
  expect(await readPermissions('request')).toMatchObject({ location: 'blocked', notifications: 'blocked', coordinates: null });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('manual enable can re-request a denied permission when the OS allows it', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  await readPermissions('request');
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
});
test('location failure does not skip notification permission', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockRejectedValue(new Error('native unavailable'));
  expect(await readPermissions('initial')).toMatchObject({ location: 'unavailable', notifications: 'denied' });
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
});
test('GPS off uses a meaningful fallback without inventing coordinates', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  expect(await readPermissions('refresh')).toMatchObject({ coordinates: null, locationMessage: expect.stringContaining('GPS') });
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});
test('refresh reads real coordinates after location becomes available', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    timestamp: 1, coords: { latitude: 12.345678, longitude: 76.54321, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
  });
  const result = await readPermissions('refresh');
  expect(result.coordinates).toEqual({ latitude: 12.345678, longitude: 76.54321 });
  expect(result.locationMessage).toBe('Delivering to: 12.3457, 76.5432');
});
test('a location timeout preserves shopping access', async () => {
  jest.useFakeTimers();
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  jest.mocked(Location.getCurrentPositionAsync).mockImplementation(() => new Promise(() => undefined));
  const result = readPermissions('refresh');
  await jest.advanceTimersByTimeAsync(8000);
  expect(await result).toMatchObject({ location: 'granted', coordinates: null, locationMessage: expect.stringContaining('Could not find') });
});
test('web does not invoke native permission APIs', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  expect(await readPermissions('initial')).toMatchObject({ location: 'unavailable', notifications: 'unavailable' });
  expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
});
test('development remounts share one initial prompt sequence', async () => {
  await Promise.all([requestInitialPermissions(), requestInitialPermissions()]);
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});
