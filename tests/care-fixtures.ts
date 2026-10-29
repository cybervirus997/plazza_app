import type { CarePlan, CareRecipient } from '../src/domain/carePlans';
import type { MockMandate } from '../src/domain/mockMandates';
export const recipientFixture = (patch: Partial<CareRecipient> = {}): CareRecipient => ({
  kind: 'recipient', id: 'recipient-1', name: 'Demo Parent', relationship: 'Parent', addressId: 'address-1',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1, ...patch,
});
export const planFixture = (patch: Partial<CarePlan> = {}): CarePlan => ({
  kind: 'plan', id: 'plan-1', recipientId: 'recipient-1', items: [{ medicineId: 'a', quantity: 2 }],
  cadence: { unit: 'month', every: 1, anchorDay: 31, hour: 9, minute: 0 }, nextReviewAt: '2027-01-31T03:30:00.000Z', timeZone: 'Asia/Kolkata',
  reminders: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1, ...patch,
});

export const mandateFixture = (patch: Partial<MockMandate> = {}): MockMandate => ({
  id: 'mandate-1', version: 1, planId: 'plan-1', simulationOnly: true, optIn: false, frequency: { unit: 'month', every: 1 },
  maximumSimulatedAmount: 1000, nextReviewAt: '2027-01-31T03:30:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1, status: 'inactive', ...patch,
});
