import type { DeliveryAddressSnapshot } from '../../domain/addresses';
import { calculateBill } from '../../domain/bill';
import { createOrderDraft, parseOrder, type Order } from '../../domain/orders';
import type { Medicine, ShoppingState } from '../../domain/types';
import type { OrderRepository } from '../../repositories/OrderRepository';
import { createLocalOrderRepository } from '../../repositories/local/LocalOrderRepository';
import { createSnapshotStore, isRecord, matchesCheckout, type StoragePort } from '../../storage/persistence';

export const CHECKOUT_STORAGE_KEY = 'plazza.checkout.v1';
export interface CheckoutIntent { readonly order: Order; readonly oneTimeCouponCode: string | null }
export interface CheckoutResult { readonly snapshot: ShoppingState; readonly order: Order | null }
interface Lifecycle {
  isCurrent?(): boolean;
  onFinalized?(snapshot: ShoppingState, order: Order): void;
}
export class CheckoutCancelledError extends Error {
  constructor() { super('Checkout was interrupted. Its saved intent will be recovered.'); this.name = 'CheckoutCancelledError'; }
}
class CheckoutValidationError extends Error {}

export function decodeCheckoutIntent(raw: string | null): CheckoutIntent | null {
  if (raw === null) return null;
  const fail = (): never => { throw new Error('The checkout journal needs recovery. It has not been discarded.'); };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return fail(); }
  if (!isRecord(value) || value.version !== 1) return fail();
  if (value.pending === null) return null;
  if (!isRecord(value.pending)) return fail();
  const order = parseOrder(value.pending.order);
  const code = value.pending.oneTimeCouponCode;
  // v1 has exactly one one-time benefit; reject missing or forged obligations.
  const expectedCode = order.couponCode === 'FIRST100' ? 'FIRST100' : null;
  if (code !== expectedCode) return fail();
  return Object.freeze({ order, oneTimeCouponCode: expectedCode });
}

const queues = new WeakMap<StoragePort, Promise<void>>();
function serialize<T>(storage: StoragePort, operation: () => Promise<T>): Promise<T> {
  const result = (queues.get(storage) ?? Promise.resolve()).then(operation);
  queues.set(storage, result.then(() => undefined, () => undefined));
  return result;
}
let identityCounter = 0;
function defaultIdentity() {
  const token = `${Date.now().toString(36)}-${(++identityCounter).toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return { id: `order-${token}`, checkoutId: `checkout-${token}`, placedAt: new Date().toISOString() };
}
export function createCheckoutCoordinator(storage: StoragePort, options: {
  orders?: OrderRepository;
  identity?: typeof defaultIdentity;
} = {}) {
  const shopping = createSnapshotStore(storage);
  const orders = options.orders ?? createLocalOrderRepository(storage);
  let retained: CheckoutIntent | null = null;
  let cleanupReceipt: Order | null = null;
  let beginning = false;
  const check = (lifecycle: Lifecycle) => { if (lifecycle.isCurrent && !lifecycle.isCurrent()) throw new CheckoutCancelledError(); };
  async function readIntent() { return decodeCheckoutIntent(await storage.getItem(CHECKOUT_STORAGE_KEY)); }
  async function saveIntent(intent: CheckoutIntent) {
    await storage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({ version: 1, pending: intent }));
  }
  async function finish(intent: CheckoutIntent, lifecycle: Lifecycle): Promise<CheckoutResult> {
    check(lifecycle);
    const before = await shopping.readForCheckout();
    check(lifecycle);
    if (before.lastFinalizedCheckoutId !== intent.order.checkoutId && !matchesCheckout(before, intent.order)) {
      throw new Error('The saved cart differs from the pending checkout. No cart was cleared.');
    }
    if (before.lastFinalizedCheckoutId !== intent.order.checkoutId && intent.oneTimeCouponCode
      && before.usedCouponCodes.includes(intent.oneTimeCouponCode)) throw new Error('The one-time coupon was already redeemed by a different checkout. Recovery needs review.');
    if (before.lastFinalizedCheckoutId === intent.order.checkoutId && intent.oneTimeCouponCode
      && !before.usedCouponCodes.includes(intent.oneTimeCouponCode)) throw new Error('The checkout checkpoint is missing its coupon redemption. Recovery needs review.');
    const saved = await orders.create(intent.order);
    check(lifecycle);
    const snapshot = await shopping.finalizeCheckout(saved.order, intent.oneTimeCouponCode);
    check(lifecycle);
    cleanupReceipt = saved.order;
    lifecycle.onFinalized?.(snapshot, saved.order);
    check(lifecycle);
    await storage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({ version: 1, pending: null }));
    check(lifecycle);
    retained = null;
    cleanupReceipt = null;
    shopping.unlockCheckout();
    return { snapshot, order: saved.order };
  }
  async function recoverClearedJournal(lifecycle: Lifecycle): Promise<CheckoutResult> {
    const history = await orders.load();
    if (!history.canWrite) throw new Error(history.warning ?? 'Order history needs recovery.');
    const snapshot = await shopping.readForCheckout();
    check(lifecycle);
    const receipt = history.orders.find((order) => order.checkoutId === snapshot.lastFinalizedCheckoutId);
    if (snapshot.lastFinalizedCheckoutId) {
      if (!receipt) throw new Error('The shopping checkpoint has no matching receipt. Recovery needs review.');
      if (receipt.couponCode === 'FIRST100' && !snapshot.usedCouponCodes.includes('FIRST100')) {
        throw new Error('The checkout checkpoint is missing its coupon redemption. Recovery needs review.');
      }
    }
    if (cleanupReceipt && (!receipt || JSON.stringify(receipt) !== JSON.stringify(cleanupReceipt))) {
      throw new Error('The finalized checkout changed during cleanup. Recovery needs review.');
    }
    const order = cleanupReceipt ? receipt ?? null : null;
    if (order) lifecycle.onFinalized?.(snapshot, order);
    check(lifecycle);
    cleanupReceipt = null;
    shopping.unlockCheckout();
    return { snapshot, order };
  }
  return {
    shopping,
    isLocked: shopping.isCheckoutLocked,
    recover(lifecycle: Lifecycle = {}): Promise<CheckoutResult> {
      shopping.lockCheckout();
      return serialize(storage, async () => {
        shopping.lockCheckout();
        check(lifecycle);
        await shopping.flush();
        const intent = await readIntent();
        check(lifecycle);
        if (intent) { retained = null; cleanupReceipt = null; return finish(intent, lifecycle); }
        // An in-memory intent survives an uncertain journal-write acknowledgement.
        if (retained) { const intent = retained; await saveIntent(intent); retained = null; check(lifecycle); return finish(intent, lifecycle); }
        return recoverClearedJournal(lifecycle);
      });
    },
    begin(input: { snapshot: ShoppingState; products: readonly Medicine[]; address(): Promise<DeliveryAddressSnapshot | null> }, lifecycle: Lifecycle = {}): Promise<CheckoutResult> {
      if (beginning) return Promise.reject(new Error('Checkout is already in progress.'));
      beginning = true;
      shopping.lockCheckout();
      return serialize(storage, async () => {
        shopping.lockCheckout();
        check(lifecycle);
        await shopping.flush();
        const pending = await readIntent();
        check(lifecycle);
        if (!pending && cleanupReceipt) return recoverClearedJournal(lifecycle);
        if (pending || retained) {
          const intent = pending ?? retained;
          if (!intent) throw new Error('Checkout intent is unavailable.');
          if (!pending) { await saveIntent(intent); check(lifecycle); }
          retained = null;
          cleanupReceipt = null;
          return finish(intent, lifecycle);
        }
        let order: Order;
        try {
          const address = await input.address();
          check(lifecycle);
          order = createOrderDraft({ ...(options.identity ?? defaultIdentity)(), cart: input.snapshot.cart,
            products: input.products, bill: calculateBill(input.snapshot.cart, input.products, input.snapshot.activeCouponCode, input.snapshot.usedCouponCodes),
            couponCode: input.snapshot.activeCouponCode, usedCouponCodes: input.snapshot.usedCouponCodes, deliveryAddress: address });
        } catch (error: unknown) {
          if (error instanceof CheckoutCancelledError) throw error;
          shopping.unlockCheckout();
          throw new CheckoutValidationError(error instanceof Error ? error.message : 'Check your cart and delivery address.');
        }
        const history = await orders.load();
        check(lifecycle);
        if (!history.canWrite) throw new Error(history.warning ?? 'Order history needs recovery.');
        await shopping.prepareCheckout(input.snapshot);
        check(lifecycle);
        const intent = Object.freeze({ order, oneTimeCouponCode: order.couponCode === 'FIRST100' ? 'FIRST100' : null });
        retained = intent;
        await saveIntent(intent);
        retained = null;
        check(lifecycle);
        return finish(intent, lifecycle);
      }).finally(() => { beginning = false; });
    },
  };
}
export type CheckoutCoordinator = ReturnType<typeof createCheckoutCoordinator>;
