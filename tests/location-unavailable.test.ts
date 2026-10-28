import { Platform } from 'react-native';
import { fetchDeliveryLocation, readPermissions } from '../src/features/permissions/permissions';

jest.mock('expo', () => {
  const actual: typeof import('expo') = jest.requireActual('expo');
  return { ...actual, isRunningInExpoGo: () => true };
});
jest.mock('expo-location', () => { throw new Error("Cannot find native module 'ExpoLocation'"); });

test('a missing location native module does not crash the provider import or native status checks', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  try {
    expect(await readPermissions()).toMatchObject({ location: 'unavailable', notifications: 'unavailable', coordinates: null });
    expect(await fetchDeliveryLocation()).toMatchObject({ location: 'unavailable', coordinates: null });
  } finally { jest.restoreAllMocks(); }
});
