import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type { CarePlan } from '../../domain/carePlans';
import { integer, record, text, timestamp } from '../../domain/recordFields';
import type { StoragePort } from '../../storage/persistence';
import { versionedRecords } from '../../storage/versionedRecords';
export interface ScheduledCareReminder { readonly id: string; readonly nativeId: string; readonly at: string; readonly revision: number }
export interface ReminderPort { list(): Promise<readonly ScheduledCareReminder[]>; schedule(reminder: ScheduledCareReminder): Promise<void>; cancel(nativeId: string): Promise<void> }
export const REMINDER_STORAGE_KEY = 'plazza.reminders.v1';
function parseReminder(value: unknown): ScheduledCareReminder {
  const input = record(value); const result = { id: text(input.id), nativeId: text(input.nativeId), at: timestamp(input.at), revision: integer(input.revision) };
  if (result.nativeId !== `plazza-care:${result.id}:${result.revision}`) throw new Error('Conflicting reminder identity.');
  return result;
}
let handlerReady = false;
async function nativeAPI() {
  if (Platform.OS === 'web' || (Platform.OS === 'android' && isRunningInExpoGo())) return null;
  const api = await import('expo-notifications');
  if (!handlerReady) {
    api.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
    handlerReady = true;
  }
  return api;
}
export const nativeReminderPort: ReminderPort = {
  async list() {
    const api = await nativeAPI(); if (!api) return [];
    const pending = await api.getAllScheduledNotificationsAsync();
    return pending.filter((item) => item.identifier.startsWith('plazza-care:')).map((item) => parseReminder({ ...item.content.data, nativeId: item.identifier }));
  },
  async schedule(reminder) {
    const api = await nativeAPI(); if (!api) throw new Error('Native reminders are unavailable here; in-app due dates still work.');
    const permission = await api.getPermissionsAsync();
    const iosGranted = permission.ios && [api.IosAuthorizationStatus.AUTHORIZED, api.IosAuthorizationStatus.PROVISIONAL, api.IosAuthorizationStatus.EPHEMERAL].includes(permission.ios.status);
    if (!permission.granted && !iosGranted) throw new Error('Notification access is off. In-app reminders remain available.');
    if (Platform.OS === 'android') await api.setNotificationChannelAsync('care-reminders', { name: 'Care plan reviews', importance: api.AndroidImportance.DEFAULT });
    await api.scheduleNotificationAsync({ identifier: reminder.nativeId,
      content: { title: 'Plazza care', body: 'Time to review your care plan', data: { id: reminder.id, at: reminder.at, revision: reminder.revision } },
      trigger: { type: api.SchedulableTriggerInputTypes.DATE, date: new Date(reminder.at), delivery: 'bestEffort', channelId: 'care-reminders' } });
  },
  async cancel(id) { const api = await nativeAPI(); if (api) await api.cancelScheduledNotificationAsync(id); },
};
const pending = new WeakMap<ReminderPort, Promise<unknown>>();
export function createReminderCoordinator(port: ReminderPort, storage: StoragePort = AsyncStorage) {
  const ledger = versionedRecords(storage, REMINDER_STORAGE_KEY, parseReminder);
  return {
    synchronize(plans: readonly CarePlan[], allowed: boolean, now = new Date().toISOString()): Promise<void> {
      const task = (pending.get(port) ?? Promise.resolve()).catch(() => {}).then(async () => {
        await ledger.load(); // Corrupt/unsupported ledger must not be silently reset.
        const wanted = allowed ? plans.filter((plan) => plan.status === 'active' && plan.reminders && plan.nextReviewAt > now).map((plan) => ({
          id: plan.id, nativeId: `plazza-care:${plan.id}:${plan.revision}`, at: plan.nextReviewAt, revision: plan.revision,
        })) : [];
        const scheduled = await port.list();
        for (const item of scheduled) if (!wanted.some((next) => next.nativeId === item.nativeId && next.at === item.at)) await port.cancel(item.nativeId);
        for (const item of wanted) if (!scheduled.some((old) => old.nativeId === item.nativeId && old.at === item.at)) await port.schedule(item);
        await ledger.change(() => wanted);
      });
      pending.set(port, task); return task;
    },
  };
}
export const careReminders = createReminderCoordinator(nativeReminderPort);
