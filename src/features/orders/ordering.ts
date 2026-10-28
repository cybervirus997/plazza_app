import type { DeliveryAddressSnapshot } from '../../domain/addresses';
import { allowsDemoCod, createCheckoutReview, sameReview } from '../../domain/checkoutReview';
import { parseOrder, type Order } from '../../domain/orders';
import { localPaymentSimulator, paidOrder, parsePaymentAttempt, unresolvedPayment, type PaymentAttempt, type PaymentMethod, type PaymentScenario, type PaymentSimulator } from '../../domain/payments';
import type { ShoppingState } from '../../domain/types';
import type { Product } from '../catalog/products';
import type { PaymentRepository } from '../../repositories/PaymentRepository';
import type { OrderRepository } from '../../repositories/OrderRepository';
import { createLocalPaymentRepository } from '../../repositories/local/LocalPaymentRepository';
import { createLocalOrderRepository } from '../../repositories/local/LocalOrderRepository';
import { createSnapshotStore, matchesCheckout, type StoragePort } from '../../storage/persistence';
import { CHECKOUT_STORAGE_KEY, CheckoutCancelledError, createCheckoutCoordinator, decodeCheckoutIntent, type CheckoutCoordinator, type CheckoutLifecycle, type CheckoutResult } from './checkout';

export interface OrderingResult extends CheckoutResult { attempt: PaymentAttempt | null }
export interface StartPaymentInput {
  review: Order;
  snapshot: ShoppingState;
  products: readonly Product[];
  address(): Promise<DeliveryAddressSnapshot | null>;
  isReviewCurrent(): boolean;
  method: PaymentMethod;
  scenario: PaymentScenario;
}
let sequence = 0;
function identity() {
  const token = `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return { id: `payment-${token}`, orderId: `order-${token}`, checkoutId: `checkout-${token}`, placedAt: new Date().toISOString() };
}
const queues = new WeakMap<StoragePort, Promise<void>>();
export function createOrderingService(storage: StoragePort, options: {
  checkout?: CheckoutCoordinator; payments?: PaymentRepository; orders?: OrderRepository;
  simulator?: PaymentSimulator; identity?: typeof identity; now?: () => string;
} = {}) {
  const checkout = options.checkout ?? createCheckoutCoordinator(storage);
  const shopping = createSnapshotStore(storage);
  const payments = options.payments ?? createLocalPaymentRepository(storage);
  const orders = options.orders ?? createLocalOrderRepository(storage);
  const simulator = options.simulator ?? localPaymentSimulator;
  const now = options.now ?? (() => new Date().toISOString());
  let operations = 0;
  let retained: PaymentAttempt | null = null;
  const check = (lifecycle: CheckoutLifecycle) => { if (lifecycle.isCurrent && !lifecycle.isCurrent()) throw new CheckoutCancelledError(); };
  function run(operation: () => Promise<OrderingResult>, recovering = false): Promise<OrderingResult> {
    if (operations && !recovering) return Promise.reject(new Error('A payment operation is already in progress.'));
    operations += 1;
    shopping.lockCheckout();
    const result = (queues.get(storage) ?? Promise.resolve()).then(() => { shopping.lockCheckout(); return operation(); });
    queues.set(storage, result.then(() => undefined, () => undefined));
    return result.finally(() => { operations -= 1; });
  }
  async function journal() { return decodeCheckoutIntent(await storage.getItem(CHECKOUT_STORAGE_KEY)); }
  async function finish(attempt: PaymentAttempt, lifecycle: CheckoutLifecycle): Promise<OrderingResult> {
    check(lifecycle);
    const result = await checkout.commit(paidOrder(attempt), lifecycle);
    shopping.lockCheckout();
    check(lifecycle);
    const completed = await payments.finalize(attempt.id);
    check(lifecycle);
    shopping.unlockCheckout();
    return { ...result, attempt: completed };
  }
  async function restore(lifecycle: CheckoutLifecycle): Promise<OrderingResult> {
    check(lifecycle);
    await shopping.flush();
    let attempt = await payments.load();
    check(lifecycle);
    if (retained) {
      if (attempt && attempt.id !== retained.id && unresolvedPayment(attempt)) throw new Error('A different payment attempt needs recovery.');
      if (!attempt || attempt.id !== retained.id) attempt = await payments.create(retained);
      retained = null;
      check(lifecycle);
    }
    const pending = await journal();
    check(lifecycle);
    if (unresolvedPayment(attempt)) {
      if (!attempt) throw new Error('Payment recovery is unavailable.');
      if (pending && (attempt.status !== 'succeeded' || JSON.stringify(pending.order) !== JSON.stringify(paidOrder(attempt)))) {
        throw new Error('Payment and checkout recovery records conflict. Existing data has not been changed.');
      }
      if (attempt.status === 'succeeded') return finish(attempt, lifecycle);
      // A pending/initiated payment can validate storage, never finalize an order.
      const restored = await checkout.recover(lifecycle);
      shopping.lockCheckout();
      check(lifecycle);
      if (await orders.getById(attempt.order.id)) throw new Error('An unconfirmed payment conflicts with a saved receipt. Recovery needs review.');
      check(lifecycle);
      if (!matchesCheckout(restored.snapshot, attempt.order) || restored.snapshot.lastFinalizedCheckoutId === attempt.order.checkoutId
        || (attempt.order.couponCode === 'FIRST100' && restored.snapshot.usedCouponCodes.includes('FIRST100'))) {
        throw new Error('The cart conflicts with the unresolved payment. Cancel or reconcile before shopping.');
      }
      return { ...restored, order: null, attempt };
    }
    if (pending && attempt && pending.order.checkoutId === attempt.order.checkoutId && attempt.status !== 'succeeded') {
      throw new Error('A failed or cancelled payment conflicts with the checkout journal. Recovery needs review.');
    }
    if (pending?.order.payment && (!attempt || !attempt.finalized
      || JSON.stringify(pending.order) !== JSON.stringify(paidOrder(attempt)))) {
      throw new Error('The paid checkout has no matching successful payment evidence. Recovery needs review.');
    }
    const result = await checkout.recover(lifecycle);
    shopping.lockCheckout();
    check(lifecycle);
    if (attempt?.finalized) {
      const receipt = await orders.getById(attempt.order.id);
      check(lifecycle);
      if (!receipt || JSON.stringify(receipt) !== JSON.stringify(paidOrder(attempt))) throw new Error('The finalized payment has no matching receipt. Recovery needs review.');
    } else if (attempt) {
      const receipt = await orders.getById(attempt.order.id);
      check(lifecycle);
      if (receipt || result.snapshot.lastFinalizedCheckoutId === attempt.order.checkoutId) {
        throw new Error('A failed or cancelled payment conflicts with a saved order. Recovery needs review.');
      }
    }
    shopping.unlockCheckout();
    return { ...result, attempt };
  }
  async function requireAttempt(id: string, lifecycle: CheckoutLifecycle) {
    check(lifecycle);
    const attempt = await payments.load();
    check(lifecycle);
    if (!attempt || attempt.id !== id) throw new Error('This payment attempt is no longer current. Reopen checkout.');
    return attempt;
  }
  return {
    orders,
    inspectPayment: payments.load,
    isWorking: () => operations > 0,
    isLocked: shopping.isCheckoutLocked,
    recover: (lifecycle: CheckoutLifecycle = {}) => run(() => restore(lifecycle), true),
    start(input: StartPaymentInput, lifecycle: CheckoutLifecycle = {}): Promise<OrderingResult> {
      return run(async () => {
        check(lifecycle);
        await shopping.flush();
        const existing = await payments.load();
        check(lifecycle);
        if (retained || unresolvedPayment(existing)) throw new Error('Reopen the existing payment attempt instead of starting another.');
        if (await journal()) throw new Error('Finish the pending checkout recovery before starting payment.');
        check(lifecycle);
        let attempt: PaymentAttempt;
        try {
          const address = await input.address();
          check(lifecycle);
          const currentReview = createCheckoutReview({ snapshot: input.snapshot, products: input.products, address,
            deliveryPreference: input.review.deliveryPreference ?? 'asap' });
          if (!input.isReviewCurrent() || !sameReview(currentReview, input.review)) throw new Error('Checkout details changed. Review the updated address, items and total before continuing.');
          if (input.method === 'cod' && !allowsDemoCod(currentReview)) throw new Error('Mock COD is available only for demo totals up to ₹2,000.');
          const ids = (options.identity ?? identity)();
          const order = parseOrder({ ...currentReview, id: ids.orderId, checkoutId: ids.checkoutId, placedAt: ids.placedAt });
          attempt = parsePaymentAttempt({ version: 1, id: ids.id, order, method: input.method,
            scenario: input.method === 'cod' ? 'success' : input.scenario, status: 'initiated', updatedAt: ids.placedAt, finalized: false });
        } catch (error: unknown) {
          if (!(error instanceof CheckoutCancelledError)) shopping.unlockCheckout();
          throw error;
        }
        const history = await orders.load();
        check(lifecycle);
        if (!history.canWrite) throw new Error(history.warning ?? 'Order history needs recovery.');
        await shopping.prepareCheckout(input.snapshot);
        check(lifecycle);
        retained = attempt;
        const saved = await payments.create(attempt);
        retained = null;
        check(lifecycle);
        return { snapshot: input.snapshot, order: null, attempt: saved };
      });
    },
    advance(id: string, action: 'pay' | 'check', lifecycle: CheckoutLifecycle = {}): Promise<OrderingResult> {
      return run(async () => {
        let attempt = await requireAttempt(id, lifecycle);
        if (attempt.finalized) {
          const result = await restore(lifecycle);
          return { ...result, order: await orders.getById(attempt.order.id) };
        }
        if (attempt.status === 'succeeded') return finish(attempt, lifecycle);
        if (attempt.status === 'initiated' || attempt.status === 'pending') {
          // Duplicate Pay callbacks do not resolve a pending attempt; only Check Status does.
          if (attempt.status !== 'pending' || action === 'check') {
            const status = await (action === 'check' ? simulator.check(attempt) : simulator.initiate(attempt));
            check(lifecycle);
            attempt = await payments.transition(id, status, now());
            check(lifecycle);
          }
        }
        if (attempt.status === 'succeeded') return finish(attempt, lifecycle);
        const snapshot = await shopping.readForCheckout();
        check(lifecycle);
        if (!unresolvedPayment(attempt)) shopping.unlockCheckout();
        return { snapshot, order: null, attempt };
      });
    },
    cancel(id: string, lifecycle: CheckoutLifecycle = {}): Promise<OrderingResult> {
      return run(async () => {
        const attempt = await requireAttempt(id, lifecycle);
        if (attempt.status === 'succeeded' || attempt.finalized) throw new Error('A successful simulation needs order reconciliation, not cancellation.');
        if (await journal()) throw new Error('Checkout recovery must finish before cancellation.');
        check(lifecycle);
        const cancelled = await payments.transition(id, 'cancelled', now());
        check(lifecycle);
        const snapshot = await shopping.readForCheckout();
        check(lifecycle);
        shopping.unlockCheckout();
        return { snapshot, order: null, attempt: cancelled };
      });
    },
  };
}
export type OrderingService = ReturnType<typeof createOrderingService>;
