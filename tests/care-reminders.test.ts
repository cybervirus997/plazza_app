import { createReminderCoordinator, REMINDER_STORAGE_KEY, type ReminderPort, type ScheduledCareReminder } from '../src/features/care/reminders';
import { orderStorage } from './order-fixtures';
import { planFixture } from './care-fixtures';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
function device() {
  const scheduled = new Map<string, ScheduledCareReminder>();
  const port: ReminderPort = { list: jest.fn(async () => [...scheduled.values()]), schedule: jest.fn(async (item) => { scheduled.set(item.nativeId, item); }), cancel: jest.fn(async (id) => { scheduled.delete(id); }) };
  return { port, scheduled };
}
const now = '2026-10-29T10:00:00.000Z';
test('duplicate reconciliations/restarts share stable OS identity without duplicate reminders', async () => {
  const storage = orderStorage(); const native = device(); let coordinator = createReminderCoordinator(native.port, storage.port);
  await Promise.all([coordinator.synchronize([planFixture()], true, now), coordinator.synchronize([planFixture()], true, now)]);
  coordinator = createReminderCoordinator(native.port, storage.port); await coordinator.synchronize([planFixture()], true, now);
  expect(native.scheduled.size).toBe(1); expect(native.port.schedule).toHaveBeenCalledTimes(1);
});
test('pause, edit, delete and denial cancel only owned schedules; due plans remain in-app without repeat scheduling', async () => {
  const storage = orderStorage(); const native = device(); const coordinator = createReminderCoordinator(native.port, storage.port);
  await coordinator.synchronize([planFixture()], true, now);
  await coordinator.synchronize([planFixture({ revision: 2, nextReviewAt: '2027-02-28T03:30:00.000Z' })], true, now);
  expect(native.port.cancel).toHaveBeenCalledTimes(1); expect(native.scheduled.size).toBe(1);
  await coordinator.synchronize([planFixture({ status: 'paused', revision: 3 })], true, now); expect(native.scheduled.size).toBe(0);
  await coordinator.synchronize([planFixture()], false, now); expect(native.scheduled.size).toBe(0);
  await coordinator.synchronize([planFixture({ nextReviewAt: '2026-01-01T00:00:00.000Z' })], true, now); expect(native.scheduled.size).toBe(0);
  await coordinator.synchronize([], true, now); expect(JSON.parse(storage.data.get(REMINDER_STORAGE_KEY)!).records).toEqual([]);
});
test('native commit with lost acknowledgement is reconciled from scheduled identifiers', async () => {
  const storage = orderStorage(); const native = device(); const coordinator = createReminderCoordinator(native.port, storage.port);
  jest.mocked(native.port.schedule).mockImplementationOnce(async (item) => { native.scheduled.set(item.nativeId, item); throw new Error('lost ack'); });
  await expect(coordinator.synchronize([planFixture()], true, now)).rejects.toThrow();
  await coordinator.synchronize([planFixture()], true, now);
  expect(native.port.schedule).toHaveBeenCalledTimes(1); expect(native.scheduled.size).toBe(1);
});
test('native scheduling failures preserve care data and can retry without an order writer', async () => {
  const storage = orderStorage(); const native = device(); const coordinator = createReminderCoordinator(native.port, storage.port);
  jest.mocked(native.port.schedule).mockRejectedValueOnce(new Error('device unavailable'));
  await expect(coordinator.synchronize([planFixture()], true, now)).rejects.toThrow();
  await coordinator.synchronize([planFixture()], true, now); expect(native.scheduled.size).toBe(1);
  expect([...storage.data.keys()]).toEqual([REMINDER_STORAGE_KEY]);
});
test('unsupported reminder ledgers are not overwritten or used to cancel native data', async () => {
  const storage = orderStorage(); const native = device(); storage.data.set(REMINDER_STORAGE_KEY, '{"version":99}');
  await expect(createReminderCoordinator(native.port, storage.port).synchronize([], true, now)).rejects.toThrow();
  expect(storage.data.get(REMINDER_STORAGE_KEY)).toBe('{"version":99}'); expect(native.port.cancel).not.toHaveBeenCalled();
});
