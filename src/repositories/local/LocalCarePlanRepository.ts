import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseCareRecord, type CareRecord } from '../../domain/carePlans';
import { nextReview } from '../../domain/careRecurrence';
import { versionedRecords } from '../../storage/versionedRecords';
import type { StoragePort } from '../../storage/persistence';
import type { CarePlanRepository } from '../CarePlanRepository';
export const CARE_STORAGE_KEY = 'plazza.care.v1';
function links(records: readonly CareRecord[]) {
  for (const item of records) if (item.kind === 'plan' && !records.some((recipient) => recipient.kind === 'recipient' && recipient.id === item.recipientId)) throw new Error('A care plan has a missing recipient. Saved data has not been reset.');
  return records;
}
function payload(value: CareRecord) { const { revision: _revision, updatedAt: _updated, ...rest } = value; return JSON.stringify(rest); }
export function createLocalCarePlanRepository(port: StoragePort = AsyncStorage, clock = () => new Date().toISOString()): CarePlanRepository {
  const store = versionedRecords(port, CARE_STORAGE_KEY, parseCareRecord);
  return {
    async load() { return links(await store.load()); },
    save(value, expectedRevision) { return store.change((raw) => {
      const records = links(raw); const candidate = parseCareRecord(value); const old = records.find((item) => item.id === candidate.id);
      if (old && payload(old) === payload(candidate)) return records;
      if ((old?.revision ?? 0) !== expectedRevision || (old && old.kind !== candidate.kind)) throw new Error('Care data changed. Reload before saving.');
      const next = parseCareRecord({ ...candidate, createdAt: old?.createdAt ?? candidate.createdAt, updatedAt: clock(), revision: (old?.revision ?? 0) + 1 });
      return links([...records.filter((item) => item.id !== next.id), next]);
    }); },
    remove(id, expectedRevision) { return store.change((records) => {
      links(records); const current = records.find((item) => item.id === id); if (!current) return records;
      if (current.revision !== expectedRevision) throw new Error('Care data changed. Reload before deleting.');
      return records.filter((item) => item.id !== id && !(item.kind === 'plan' && item.recipientId === id));
    }); },
    action(id, action, expectedRevision) { return store.change((records) => {
      links(records); const current = records.find((item) => item.id === id);
      if (!current || current.kind !== 'plan') throw new Error('Care plan not found.');
      if (current.revision !== expectedRevision) throw new Error('Care plan changed. Reload before continuing.');
      const next = parseCareRecord({ ...current, revision: current.revision + 1, updatedAt: clock(),
        status: action === 'pause' ? 'paused' : action === 'resume' ? 'active' : current.status,
        nextReviewAt: action === 'skip' ? nextReview(current.nextReviewAt, current.cadence, current.timeZone) : current.nextReviewAt });
      return records.map((item) => item.id === id ? next : item);
    }); },
  };
}
export const localCarePlanRepository = createLocalCarePlanRepository();
