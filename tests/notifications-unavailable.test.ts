import { Platform } from 'react-native';
import { readPermissions } from '../src/features/permissions/permissions';

jest.mock('expo', () => {
  const actual: typeof import('expo') = jest.requireActual('expo');
  return { ...actual, isRunningInExpoGo: jest.fn(() => false) };
});
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: true, expires: 'never' }),
}));
jest.mock('expo-notifications', () => {
  throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
});

test('missing notification native modules do not prevent routes or permission checks from loading', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(await readPermissions()).toMatchObject({ location: 'denied', notifications: 'unavailable', coordinates: null });
  jest.restoreAllMocks();
});
