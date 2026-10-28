import type { StoragePort } from './persistence';
import { isRecord } from '../domain/validation';

export class FeatureStorageError extends Error {
  constructor(message = 'Saved feature data needs recovery. Existing data has not been changed.') { super(message); this.name = 'FeatureStorageError'; }
}
const queues = new WeakMap<StoragePort, Map<string, Promise<unknown>>>();

/** Single-key serialized storage for independent demo features, never shopping/checkout. */
export function versionedRecords<T extends { readonly id: string }>(port: StoragePort, key: string, parse: (value: unknown) => T) {
  function decode(raw: string | null): readonly T[] {
    if (raw === null) return [];
    try {
      const value: unknown = JSON.parse(raw);
      if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.records)) throw new FeatureStorageError();
      const records = value.records.map(parse);
      if (new Set(records.map((record) => record.id)).size !== records.length) throw new FeatureStorageError();
      return Object.freeze(records);
    } catch { throw new FeatureStorageError(); }
  }
  async function load() { return decode(await port.getItem(key)); }
  async function change(update: (records: readonly T[]) => readonly T[]): Promise<readonly T[]> {
    let queue = queues.get(port);
    if (!queue) { queue = new Map(); queues.set(port, queue); }
    const task = (queue.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
      const current = await load();
      const next = decode(JSON.stringify({ version: 1, records: update(current) }));
      if (JSON.stringify(current) !== JSON.stringify(next)) await port.setItem(key, JSON.stringify({ version: 1, records: next }));
      return next;
    });
    queue.set(key, task);
    return task;
  }
  return { load, change };
}
