import type { CartEntry, Medicine } from './types';
import { record, text, timestamp, integer } from './recordFields';
import { validTimeZone, type RepeatInterval } from './careRecurrence';
interface Metadata { readonly id: string; readonly createdAt: string; readonly updatedAt: string; readonly revision: number }
export interface CareRecipient extends Metadata { readonly kind: 'recipient'; readonly name: string; readonly relationship: string; readonly addressId: string | null }
export interface CarePlan extends Metadata {
  readonly kind: 'plan'; readonly recipientId: string; readonly items: readonly CartEntry[]; readonly cadence: RepeatInterval;
  readonly nextReviewAt: string; readonly timeZone: string; readonly reminders: boolean; readonly status: 'active' | 'paused';
}
export type CareRecord = CareRecipient | CarePlan;
export function parseCareRecord(value: unknown): CareRecord {
  const input = record(value);
  const meta = { id: text(input.id), createdAt: timestamp(input.createdAt), updatedAt: timestamp(input.updatedAt), revision: integer(input.revision) };
  if (meta.updatedAt < meta.createdAt) throw new Error('Invalid care timestamps.');
  if (input.kind === 'recipient') return Object.freeze({ ...meta, kind: 'recipient', name: text(input.name), relationship: text(input.relationship), addressId: input.addressId === null ? null : text(input.addressId) });
  if (input.kind !== 'plan' || !Array.isArray(input.items) || !input.items.length || typeof input.reminders !== 'boolean'
    || !['active', 'paused'].includes(String(input.status))) throw new Error('Invalid care plan.');
  const cadence = record(input.cadence);
  if (!['day', 'week', 'month'].includes(String(cadence.unit))) throw new Error('Invalid recurrence.');
  const items = input.items.map((raw) => { const item = record(raw); return Object.freeze({ medicineId: text(item.medicineId), quantity: integer(item.quantity, 1, 999) }); });
  if (new Set(items.map((item) => item.medicineId)).size !== items.length) throw new Error('Repeated proposed product.');
  return Object.freeze({ ...meta, kind: 'plan', recipientId: text(input.recipientId), items: Object.freeze(items),
    cadence: Object.freeze({ unit: cadence.unit as RepeatInterval['unit'], every: integer(cadence.every, 1, 365), anchorDay: integer(cadence.anchorDay, 1, 31),
      ...(cadence.hour !== undefined ? { hour: integer(cadence.hour, 0, 23) } : {}), ...(cadence.minute !== undefined ? { minute: integer(cadence.minute, 0, 59) } : {}) }),
    nextReviewAt: timestamp(input.nextReviewAt), timeZone: validTimeZone(text(input.timeZone)), reminders: input.reminders, status: input.status as CarePlan['status'] });
}
export function careProposal(items: readonly CartEntry[], catalog: readonly (Medicine & { isAvailable?: boolean })[]) {
  return items.map((item) => {
    const product = catalog.find((product) => product.id === item.medicineId);
    const problem = !product ? 'Product no longer exists.' : product.isAvailable === false ? 'Currently unavailable.'
      : item.quantity > product.maxQty ? `Quantity exceeds the current limit of ${product.maxQty}.` : null;
    return { item, product, problem };
  });
}
