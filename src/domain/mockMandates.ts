import type { CarePlan } from './carePlans';
import { careProposal } from './carePlans';
import type { Medicine } from './types';
import { record, text, timestamp, integer } from './recordFields';
export type MockMandateStatus = 'inactive' | 'active' | 'paused' | 'cancelled';
export interface MockMandate {
  readonly id: string; readonly version: 1; readonly planId: string; readonly simulationOnly: true; readonly optIn: boolean;
  readonly frequency: { readonly unit: 'day' | 'week' | 'month'; readonly every: number };
  readonly maximumSimulatedAmount: number; readonly nextReviewAt: string; readonly createdAt: string; readonly updatedAt: string;
  readonly status: MockMandateStatus; readonly revision: number;
}
export function parseMockMandate(value: unknown): MockMandate {
  const input = record(value); const frequency = record(input.frequency);
  const maximum = input.maximumSimulatedAmount;
  if (input.version !== 1 || input.simulationOnly !== true || typeof input.optIn !== 'boolean' || typeof input.status !== 'string' || !['inactive', 'active', 'paused', 'cancelled'].includes(input.status)
    || typeof frequency.unit !== 'string' || !['day', 'week', 'month'].includes(frequency.unit) || typeof maximum !== 'number' || !Number.isFinite(maximum) || maximum <= 0
    || !Number.isSafeInteger(Math.round(maximum * 100)) || Math.abs(maximum * 100 - Math.round(maximum * 100)) > 0.000001) throw new Error('Invalid mock mandate or simulated spending cap.');
  if ((input.status === 'active' || input.status === 'paused') && !input.optIn) throw new Error('Explicit demo opt-in is required.');
  if ((input.status === 'inactive' || input.status === 'cancelled') && input.optIn) throw new Error('Inactive/cancelled previews cannot retain active opt-in.');
  const createdAt = timestamp(input.createdAt); const updatedAt = timestamp(input.updatedAt);
  if (updatedAt < createdAt) throw new Error('Invalid mock mandate timestamps.');
  return Object.freeze({ id: text(input.id), version: 1, planId: text(input.planId), simulationOnly: true, optIn: input.optIn,
    frequency: Object.freeze({ unit: frequency.unit as MockMandate['frequency']['unit'], every: integer(frequency.every, 1, 365) }),
    maximumSimulatedAmount: maximum, nextReviewAt: timestamp(input.nextReviewAt), createdAt, updatedAt, status: input.status as MockMandateStatus, revision: integer(input.revision) });
}
export type MockMandateAction = 'activate' | 'pause' | 'resume' | 'cancel';
export function transitionMockMandate(current: MockMandate, action: MockMandateAction, optedIn: boolean, at: string): MockMandate {
  if (timestamp(at) < current.updatedAt) throw new Error('Mock preview time cannot move backwards.');
  const target: Record<MockMandateAction, MockMandateStatus> = { activate: 'active', pause: 'paused', resume: 'active', cancel: 'cancelled' };
  if (current.status === 'cancelled') { if (action === 'cancel') return current; throw new Error('Cancelled previews cannot resume. Create a new explicit demo preview.'); }
  if ((action === 'activate' || action === 'resume') && !optedIn) throw new Error('Explicit demo opt-in is required.');
  if (current.status === target[action]) return current;
  if ((action === 'activate' && current.status !== 'inactive') || (action === 'pause' && current.status !== 'active') || (action === 'resume' && current.status !== 'paused')) throw new Error('Invalid mock preview transition.');
  return parseMockMandate({ ...current, status: target[action], optIn: action === 'cancel' ? false : current.optIn || optedIn, updatedAt: at, revision: current.revision + 1 });
}
export function mockChargePreview(plan: CarePlan, catalog: readonly (Medicine & { isAvailable?: boolean })[], mandate: MockMandate) {
  const rows = careProposal(plan.items, catalog);
  const itemSubtotal = rows.reduce((total, row) => total + (row.product ? Math.round(row.product.price * 100) * row.item.quantity : 0), 0) / 100;
  const problems = rows.filter((row) => row.problem).map((row) => row.problem!);
  return { itemSubtotal, withinCap: !problems.length && itemSubtotal <= mandate.maximumSimulatedAmount, problems, requiresRx: rows.some((row) => row.product?.rx) };
}
