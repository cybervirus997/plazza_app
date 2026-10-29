import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseMockMandate, transitionMockMandate, type MockMandate } from '../../domain/mockMandates';
import type { MockMandateRepository } from '../MockMandateRepository';
import type { StoragePort } from '../../storage/persistence';
import { versionedRecords } from '../../storage/versionedRecords';
export const MOCK_MANDATE_STORAGE_KEY = 'plazza.mock-mandates.v1';
function payload(value: MockMandate) { const { revision: _revision, updatedAt: _updated, ...rest } = value; return JSON.stringify(rest); }
export function createLocalMockMandateRepository(port: StoragePort = AsyncStorage, clock = () => new Date().toISOString()): MockMandateRepository {
  const store = versionedRecords(port, MOCK_MANDATE_STORAGE_KEY, parseMockMandate);
  return {
    load: store.load,
    save(value, expectedRevision) { return store.change((records) => {
      const candidate = parseMockMandate(value); const old = records.find((item) => item.id === candidate.id);
      if (old && payload(old) === payload(candidate)) return records;
      if ((old?.revision ?? 0) !== expectedRevision || (old && (old.planId !== candidate.planId || old.status !== candidate.status || old.optIn !== candidate.optIn))) throw new Error('Mock preview changed. Reload before saving.');
      if (!old && (candidate.status !== 'inactive' || candidate.optIn)) throw new Error('Create an inactive preview before explicit activation.');
      if (records.some((item) => item.id !== candidate.id && item.planId === candidate.planId && item.status !== 'cancelled')) throw new Error('This plan already has a mock preview.');
      if (old?.status === 'cancelled') throw new Error('Cancelled previews cannot be edited.');
      const next = parseMockMandate({ ...candidate, createdAt: old?.createdAt ?? candidate.createdAt, updatedAt: clock(), revision: (old?.revision ?? 0) + 1 });
      return [...records.filter((item) => item.id !== candidate.id), next];
    }); },
    action(id, action, optIn, expectedRevision) { return store.change((records) => {
      const current = records.find((item) => item.id === id); if (!current) throw new Error('Mock preview not found.');
      if (current.revision !== expectedRevision) throw new Error('Mock preview changed. Reload before continuing.');
      const next = transitionMockMandate(current, action, optIn, clock());
      return records.map((item) => item.id === id ? next : item);
    }); },
  };
}
export const localMockMandateRepository = createLocalMockMandateRepository();
