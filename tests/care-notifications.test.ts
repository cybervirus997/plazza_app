import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { nativeReminderPort } from '../src/features/care/reminders';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo', () => ({ ...jest.requireActual('expo'), isRunningInExpoGo: jest.fn(() => false) }));
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => []), getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(), scheduleNotificationAsync: jest.fn(async () => 'id'), cancelScheduledNotificationAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(), requestExactAlarmPermissionsAsync: jest.fn(), AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
test('native reminders use privacy-conscious content and best-effort dates without prompts or exact alarms', async () => {
  jest.replaceProperty(Platform, 'OS', 'android'); jest.mocked(isRunningInExpoGo).mockReturnValue(false);
  await nativeReminderPort.schedule({ id: 'plan-1', nativeId: 'plazza-care:plan-1:1', revision: 1, at: '2027-01-31T03:30:00.000Z' });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    identifier: 'plazza-care:plan-1:1', content: { title: 'Plazza care', body: 'Time to review your care plan', data: { id: 'plan-1', revision: 1, at: '2027-01-31T03:30:00.000Z' } },
    trigger: expect.objectContaining({ type: 'date', delivery: 'bestEffort' }),
  }));
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled(); expect(Notifications.requestExactAlarmPermissionsAsync).not.toHaveBeenCalled();
});
test('Android Expo Go skips notification-module operations and denied permission blocks native schedules', async () => {
  jest.replaceProperty(Platform, 'OS', 'android'); jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  expect(await nativeReminderPort.list()).toEqual([]); expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false } as Notifications.NotificationPermissionsStatus);
  await expect(nativeReminderPort.schedule({ id: 'plan-1', nativeId: 'plazza-care:plan-1:1', revision: 1, at: '2027-01-31T03:30:00.000Z' })).rejects.toThrow('access is off');
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
