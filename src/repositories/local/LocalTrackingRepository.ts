import AsyncStorage from '@react-native-async-storage/async-storage';
import { advanceTracking, parseTracking } from '../../domain/tracking';
import type { TrackingRepository } from '../TrackingRepository';
import type { StoragePort } from '../../storage/persistence';
import { versionedRecords } from '../../storage/versionedRecords';
export const TRACKING_STORAGE_KEY = 'plazza.tracking.v1';
export function createLocalTrackingRepository(port: StoragePort = AsyncStorage, clock = () => new Date().toISOString()): TrackingRepository {
  const store = versionedRecords(port, TRACKING_STORAGE_KEY, parseTracking);
  return {
    async get(id) { return (await store.load()).find((item) => item.id === id) ?? null; },
    async ensure(order, finalized) {
      if (!finalized) throw new Error('Finish checkout reconciliation before tracking.');
      const records = await store.change((items) => items.some((item) => item.id === order.id) ? items : [...items,
        { id: order.id, version: 1, requiresRx: order.items.some((item) => item.rx), events: [{ id: `${order.id}:placed`, stage: 'placed', at: order.placedAt, etaMinutes: null }] }]);
      return records.find((item) => item.id === order.id)!;
    },
    async advance(id, stage, eventId) {
      const records = await store.change((items) => {
        const current = items.find((item) => item.id === id);
        if (!current) throw new Error('Tracking history not found.');
        const next = advanceTracking(current, { id: eventId, stage, at: clock(), etaMinutes: stage === 'delayed' ? 20 : null });
        return items.map((item) => item.id === id ? next : item);
      });
      return records.find((item) => item.id === id)!;
    },
  };
}
export const localTrackingRepository = createLocalTrackingRepository();
