import { parseOrder, type Order } from './orders';
import { allowsDemoCod } from './checkoutReview';
import { isRecord } from '../storage/persistence';

export type PaymentMethod = 'upi' | 'cod';
export type PaymentStatus = 'initiated' | 'pending' | 'succeeded' | 'failed' | 'cancelled';
export const paymentScenarios = ['success', 'pending-success', 'pending-failure', 'failure', 'cancel'] as const;
export type PaymentScenario = typeof paymentScenarios[number];
export interface PaymentAttempt {
  readonly version: 1;
  readonly id: string;
  readonly order: Order;
  readonly method: PaymentMethod;
  readonly scenario: PaymentScenario;
  readonly status: PaymentStatus;
  readonly updatedAt: string;
  readonly finalized: boolean;
}
export const unresolvedPayment = (attempt: PaymentAttempt | null): boolean => !!attempt
  && (attempt.status === 'initiated' || attempt.status === 'pending' || (attempt.status === 'succeeded' && !attempt.finalized));

export function parsePaymentAttempt(value: unknown): PaymentAttempt {
  const invalid = (): never => { throw new Error('The saved payment attempt needs recovery. It has not been overwritten.'); };
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== 'string' || !value.id.trim()
    || (value.method !== 'upi' && value.method !== 'cod') || !paymentScenarios.some((scenario) => scenario === value.scenario)
    || !['initiated', 'pending', 'succeeded', 'failed', 'cancelled'].includes(String(value.status))
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
    || new Date(value.updatedAt).toISOString() !== value.updatedAt || typeof value.finalized !== 'boolean'
    || (value.finalized && value.status !== 'succeeded')) return invalid();
  const order = parseOrder(value.order);
  if (order.payment || (value.method === 'cod' && (!allowsDemoCod(order) || value.scenario !== 'success' || value.status === 'pending'))
    || Date.parse(value.updatedAt) < Date.parse(order.placedAt)) return invalid();
  return Object.freeze({ version: 1, id: value.id, order, method: value.method,
    scenario: value.scenario as PaymentScenario, status: value.status as PaymentStatus, updatedAt: value.updatedAt, finalized: value.finalized });
}
export function transitionPayment(attempt: PaymentAttempt, status: PaymentStatus, updatedAt: string): PaymentAttempt {
  if (attempt.status === status) return attempt;
  if (!['initiated', 'pending'].includes(attempt.status) || status === 'initiated') {
    throw new Error('This payment outcome is already final. Start a new attempt from checkout if needed.');
  }
  return parsePaymentAttempt({ ...attempt, status, updatedAt });
}
export function paidOrder(attempt: PaymentAttempt): Order {
  if (attempt.status !== 'succeeded') throw new Error('A confirmed simulated payment or COD confirmation is required.');
  return parseOrder({ ...attempt.order, payment: { version: 1, attemptId: attempt.id, method: attempt.method,
    status: attempt.method === 'cod' ? 'cod-confirmed' : 'succeeded', simulated: true } });
}
export interface PaymentSimulator {
  initiate(attempt: PaymentAttempt): Promise<PaymentStatus>;
  check(attempt: PaymentAttempt): Promise<PaymentStatus>;
}
export const localPaymentSimulator: PaymentSimulator = {
  async initiate(attempt) {
    return attempt.method === 'cod' || attempt.scenario === 'success' ? 'succeeded'
      : attempt.scenario === 'failure' ? 'failed' : attempt.scenario === 'cancel' ? 'cancelled' : 'pending';
  },
  async check(attempt) {
    if (attempt.status === 'initiated') return localPaymentSimulator.initiate(attempt);
    return attempt.scenario === 'pending-failure' ? 'failed' : 'succeeded';
  },
};
