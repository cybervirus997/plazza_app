import { isRecord } from './validation';
export function record(value: unknown): Record<string, unknown> { if (!isRecord(value)) throw new Error('Invalid record.'); return value; }
export function text(value: unknown): string { if (typeof value !== 'string' || !value.trim() || value.length > 500) throw new Error('Enter a nonempty value (up to 500 characters).'); return value; }
export function timestamp(value: unknown): string { const result = text(value); if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) throw new Error('Use a valid ISO timestamp.'); return result; }
export function integer(value: unknown, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error('Invalid whole number.'); return value;
}
