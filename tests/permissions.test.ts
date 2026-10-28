import { isRunningInExpoGo, PermissionStatus as NativeStatus, type PermissionResponse } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { fetchDeliveryLocation, permissionStatus, readPermissions, requestInitialPermissions, requestPermissions } from '../src/features/permissions/permissions';

jest.mock('expo', () => {
  const actual: typeof import('expo') = jest.requireActual('expo');
  return { ...actual, isRunningInExpoGo: jest.fn(() => false) };
});
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true, default: { currentState: 'active', addEventListener: jest.fn() },
}));
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
  jest.replaceProperty(AppState, 'currentState', 'active');
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
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
  await requestPermissions('initial');
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(jest.mocked(Notifications.setNotificationChannelAsync).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(Notifications.requestPermissionsAsync).mock.invocationCallOrder[0]);
});
test('Android Expo Go skips notification APIs while preserving foreground location', async () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  expect(await requestPermissions('initial')).toMatchObject({ location: 'denied', notifications: 'unavailable' });
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('a custom client marked StoreClient still requests native notification permission', async () => {
  jest.replaceProperty(Constants, 'executionEnvironment', ExecutionEnvironment.StoreClient);
  expect(await requestPermissions('initial')).toMatchObject({ notifications: 'denied' });
  expect(isRunningInExpoGo).toHaveBeenCalled();
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});
test('denied permissions are not automatically requested on each launch', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  await requestPermissions('initial');
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('returning from Settings rechecks statuses without prompting', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  expect(await readPermissions()).toMatchObject({ location: 'granted', notifications: 'granted' });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('blocked responses never attempt another native prompt', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED, false));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED, false));
  expect(await requestPermissions('request')).toMatchObject({ location: 'blocked', notifications: 'blocked', coordinates: null });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('manual enable can re-request a denied permission when the OS allows it', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED));
  await requestPermissions('request');
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
});
test('location failure does not skip notification permission', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockRejectedValue(new Error('native unavailable'));
  expect(await requestPermissions('initial')).toMatchObject({ location: 'unavailable', notifications: 'denied' });
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
});
test('GPS off uses a meaningful fallback without inventing coordinates', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  expect(await fetchDeliveryLocation()).toMatchObject({ coordinates: null, locationMessage: expect.stringContaining('GPS') });
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});
test('explicit location retrieval reads real coordinates after location becomes available', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    timestamp: 1, coords: { latitude: 12.345678, longitude: 76.54321, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
  });
  const result = await fetchDeliveryLocation();
  expect(result.coordinates).toEqual({ latitude: 12.345678, longitude: 76.54321 });
  expect(result.locationMessage).toBe('Device GPS: 12.3457, 76.5432');
});
test('a location timeout preserves shopping access', async () => {
  jest.useFakeTimers();
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  let finish: (value: Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>) => void = () => {};
  jest.mocked(Location.getCurrentPositionAsync).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const result = fetchDeliveryLocation();
  await jest.advanceTimersByTimeAsync(8000);
  expect(await result).toMatchObject({ location: 'granted', coordinates: null, locationMessage: expect.stringContaining('Could not find') });
  finish({ timestamp: 1, coords: { latitude: 1, longitude: 2, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null } });
  await Promise.resolve();
});
test('web does not invoke native permission APIs', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  expect(await requestPermissions('initial')).toMatchObject({ location: 'unavailable', notifications: 'unavailable' });
  expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
});
test('development remounts share one initial prompt sequence', async () => {
  await Promise.all([requestInitialPermissions(), requestInitialPermissions()]);
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('status-only Refresh never accesses GPS, services, channels or permission requests', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  expect(await readPermissions()).toMatchObject({ location: 'granted', coordinates: null });
  expect(Location.hasServicesEnabledAsync).not.toHaveBeenCalled();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
});

test.each([true, false])('coordinate retrieval with denied access (canAskAgain %s) never checks GPS', async (canAskAgain) => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED, canAskAgain));
  expect(await fetchDeliveryLocation()).toMatchObject({ location: canAskAgain ? 'denied' : 'blocked', coordinates: null });
  expect(Location.hasServicesEnabledAsync).not.toHaveBeenCalled();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('a timed-out position stays locked until the native call settles, and retry then acquires a fresh fix', async () => {
  jest.useFakeTimers();
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  const nativeFix = { timestamp: 1, coords: { latitude: 1, longitude: 2, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null } };
  let finish: (value: typeof nativeFix) => void = () => {};
  jest.mocked(Location.getCurrentPositionAsync).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = fetchDeliveryLocation();
  await jest.advanceTimersByTimeAsync(8000);
  expect(await first).toMatchObject({ coordinates: null });
  expect(await fetchDeliveryLocation()).toMatchObject({ coordinates: null, locationMessage: expect.stringContaining('still finishing') });
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  finish(nativeFix);
  await Promise.resolve();
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue(nativeFix);
  expect(await fetchDeliveryLocation()).toMatchObject({ coordinates: { latitude: 1, longitude: 2 } });
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
});

test('permission revoked while services are being checked prevents a new position call', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync)
    .mockResolvedValueOnce(response(NativeStatus.GRANTED)).mockResolvedValue(response(NativeStatus.DENIED, false));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  expect(await fetchDeliveryLocation()).toMatchObject({ location: 'blocked', coordinates: null });
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('a fix obtained after permission was revoked is discarded after a fresh OS check', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync)
    .mockResolvedValueOnce(response(NativeStatus.GRANTED)).mockResolvedValueOnce(response(NativeStatus.GRANTED))
    .mockResolvedValue(response(NativeStatus.DENIED, false));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    timestamp: 1, coords: { latitude: 1, longitude: 2, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
  });
  expect(await fetchDeliveryLocation()).toMatchObject({ location: 'blocked', coordinates: null });
});

test('invalid coordinates and native GPS failures use a meaningful fallback', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    timestamp: 1, coords: { latitude: NaN, longitude: 200, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
  });
  expect(await fetchDeliveryLocation()).toMatchObject({ coordinates: null, locationMessage: expect.stringContaining('Could not find') });
  jest.mocked(Location.getCurrentPositionAsync).mockRejectedValue(new Error('GPS failed'));
  expect(await fetchDeliveryLocation()).toMatchObject({ coordinates: null, locationMessage: expect.stringContaining('Could not find') });
});

test('an invalidated location attempt cannot start GPS after a pending services response', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  let finish: (value: boolean) => void = () => {};
  jest.mocked(Location.hasServicesEnabledAsync).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  let current = true;
  const result = fetchDeliveryLocation(() => current);
  // Drain the lazy module and OS status microtasks without starting any timers.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(Location.hasServicesEnabledAsync).toHaveBeenCalledTimes(1);
  current = false;
  finish(true);
  expect(await result).toMatchObject({ coordinates: null });
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('a permission-read timeout isolates failure, retains the native lock and recovers without overlap', async () => {
  jest.useFakeTimers();
  let finish: (value: PermissionResponse) => void = () => {};
  jest.mocked(Location.getForegroundPermissionsAsync).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = readPermissions();
  await jest.advanceTimersByTimeAsync(8000);
  expect(await first).toMatchObject({ location: 'unavailable', notifications: 'undetermined' });
  const retry = readPermissions();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  finish(response(NativeStatus.GRANTED));
  expect(await retry).toMatchObject({ location: 'granted' });
  expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(2);
});

test('a timed-out OS dialog never overlaps another prompt; late completion requires a fresh status read', async () => {
  jest.useFakeTimers();
  let finish: (value: PermissionResponse) => void = () => {};
  jest.mocked(Location.requestForegroundPermissionsAsync).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = requestPermissions();
  await jest.advanceTimersByTimeAsync(30000);
  expect(await first).toMatchObject({ location: 'unavailable', notifications: 'unavailable' });
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  finish(response(NativeStatus.GRANTED));
  await Promise.resolve();
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  expect(await readPermissions()).toMatchObject({ location: 'granted', notifications: 'undetermined' });
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('an initial-request cache does not reuse a completed snapshot after permission revocation', async () => {
  await requestInitialPermissions();
  jest.clearAllMocks();
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.DENIED, false));
  expect(await requestInitialPermissions()).toMatchObject({ location: 'blocked', coordinates: null });
  expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

test('concurrent requests share native reads and prompts rather than opening duplicate dialogs', async () => {
  await Promise.all([requestPermissions(), requestPermissions()]);
  expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('background calls read status without requesting permission or starting GPS', async () => {
  jest.replaceProperty(AppState, 'currentState', 'background');
  await requestPermissions();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(response(NativeStatus.GRANTED));
  await fetchDeliveryLocation();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(Location.hasServicesEnabledAsync).not.toHaveBeenCalled();
});

test('a fresh status refresh waits for an old OS read to settle, then reads again without overlapping it', async () => {
  let finish: (value: PermissionResponse) => void = () => {};
  jest.mocked(Location.getForegroundPermissionsAsync).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
    .mockResolvedValue(response(NativeStatus.DENIED, false));
  const old = readPermissions();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const fresh = readPermissions();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  finish(response(NativeStatus.GRANTED));
  expect(await old).toMatchObject({ location: 'granted' });
  expect(await fresh).toMatchObject({ location: 'blocked', coordinates: null });
  expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(2);
});
