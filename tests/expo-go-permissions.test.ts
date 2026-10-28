import { isRunningInExpoGo } from 'expo';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { readPermissions, requestPermissions } from '../src/features/permissions/permissions';

const mockNotificationImport = jest.fn(() => {
  throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
});

jest.mock('expo', () => {
  const actual: typeof import('expo') = jest.requireActual('expo');
  return { ...actual, isRunningInExpoGo: jest.fn(() => true) };
});
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' })),
  hasServicesEnabledAsync: async () => false,
}));
jest.mock('expo-notifications', () => mockNotificationImport());

afterEach(() => { jest.restoreAllMocks(); });

test.each(['initial', 'refresh', 'request'] as const)('Android Expo Go %s never evaluates the notification package', async (mode) => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(await (mode === 'refresh' ? readPermissions() : requestPermissions(mode))).toMatchObject({ location: 'granted', notifications: 'unavailable' });
  expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
  expect(mockNotificationImport).not.toHaveBeenCalled();
});

test('a custom Android build attempts the native import and handles a missing module', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
  expect(await readPermissions()).toMatchObject({ location: 'granted', notifications: 'unavailable' });
  expect(mockNotificationImport).toHaveBeenCalledTimes(1);
});
