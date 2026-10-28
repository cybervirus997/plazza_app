import { parsePaymentAttempt, transitionPayment, unresolvedPayment, type PaymentAttempt } from '../../domain/payments';
import { isRecord, type StoragePort } from '../../storage/persistence';
import type { PaymentRepository } from '../PaymentRepository';

export const PAYMENT_STORAGE_KEY = 'plazza.payments.v1';
const queues = new WeakMap<StoragePort, Promise<void>>();
function serialize<T>(storage: StoragePort, operation: () => Promise<T>): Promise<T> {
  const result = (queues.get(storage) ?? Promise.resolve()).then(operation);
  queues.set(storage, result.then(() => undefined, () => undefined));
  return result;
}
export function createLocalPaymentRepository(storage: StoragePort): PaymentRepository {
  async function read(): Promise<PaymentAttempt | null> {
    const raw = await storage.getItem(PAYMENT_STORAGE_KEY);
    if (raw === null) return null;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error('Saved payment data is damaged. It has not been reset.'); }
    if (!isRecord(value) || value.version !== 1 || value.current === undefined) {
      throw new Error('Saved payment data is damaged or uses an unsupported version. It has not been reset.');
    }
    return value.current === null ? null : parsePaymentAttempt(value.current);
  }
  async function write(attempt: PaymentAttempt) {
    await storage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify({ version: 1, current: attempt }));
    return attempt;
  }
  async function requireAttempt(id: string) {
    const attempt = await read();
    if (!attempt || attempt.id !== id) throw new Error('This payment attempt is no longer current. No order was placed.');
    return attempt;
  }
  return {
    version: 1,
    load: () => serialize(storage, read),
    create(input) {
      const candidate = parsePaymentAttempt(input);
      return serialize(storage, async () => {
        const previous = await read();
        if (previous?.id === candidate.id) {
          if (JSON.stringify(previous) !== JSON.stringify(candidate)) throw new Error('Payment identity conflicts with its saved review.');
          return previous;
        }
        if (unresolvedPayment(previous)) throw new Error('Resolve or cancel the existing payment attempt before starting another.');
        if (previous?.order.checkoutId === candidate.order.checkoutId || previous?.order.id === candidate.order.id) {
          throw new Error('A new payment attempt requires a new checkout identity.');
        }
        if (candidate.status !== 'initiated' || candidate.finalized) throw new Error('A payment attempt must start as initiated.');
        return write(candidate);
      });
    },
    transition: (id, status, updatedAt) => serialize(storage, async () => {
      const previous = await requireAttempt(id);
      const next = transitionPayment(previous, status, updatedAt);
      return next === previous ? previous : write(next);
    }),
    finalize: (id) => serialize(storage, async () => {
      const previous = await requireAttempt(id);
      if (previous.status !== 'succeeded') throw new Error('Only a successful payment can finalize an order.');
      return previous.finalized ? previous : write(parsePaymentAttempt({ ...previous, finalized: true }));
    }),
  };
}
