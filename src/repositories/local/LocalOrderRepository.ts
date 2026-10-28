import { parseOrder, type Order } from '../../domain/orders';
import { isRecord, type StoragePort } from '../../storage/persistence';
import { OrderConflictError, OrderHistoryRecoveryError, UnsupportedOrderVersionError, type OrderHistoryResult, type OrderRepository } from '../OrderRepository';

export const ORDER_STORAGE_KEY = 'plazza.orders.v1';
const recoveryWarning = 'Order history needs recovery. Readable receipts are shown, but existing data has not been changed and new orders cannot be saved.';

export function decodeOrderHistory(raw: string | null): OrderHistoryResult {
  if (raw === null) return { orders: Object.freeze([]), warning: null, canWrite: true };
  let source: unknown;
  try { source = JSON.parse(raw); } catch { return { orders: Object.freeze([]), warning: recoveryWarning, canWrite: false }; }
  if (!isRecord(source)) return { orders: Object.freeze([]), warning: recoveryWarning, canWrite: false };
  if (source.version !== 1) throw new UnsupportedOrderVersionError();
  if (!Array.isArray(source.orders)) return { orders: Object.freeze([]), warning: recoveryWarning, canWrite: false };
  const ids = new Set<string>();
  const checkoutIds = new Set<string>();
  const orders: Order[] = [];
  let damaged = false;
  for (const value of source.orders) {
    try {
      const order = parseOrder(value);
      if (ids.has(order.id) || checkoutIds.has(order.checkoutId)) { damaged = true; continue; }
      ids.add(order.id); checkoutIds.add(order.checkoutId); orders.push(order);
    } catch { damaged = true; }
  }
  return { orders: Object.freeze(orders), warning: damaged ? recoveryWarning : null, canWrite: !damaged };
}

// Share the queue across adapters using the same port, including reads after writes.
const queues = new WeakMap<StoragePort, Promise<void>>();
function serialize<T>(storage: StoragePort, operation: () => Promise<T>): Promise<T> {
  const result = (queues.get(storage) ?? Promise.resolve()).then(operation);
  queues.set(storage, result.then(() => undefined, () => undefined));
  return result;
}

export function createLocalOrderRepository(storage: StoragePort): OrderRepository {
  async function read(): Promise<OrderHistoryResult> {
    let raw: string | null;
    try { raw = await storage.getItem(ORDER_STORAGE_KEY); }
    catch { throw new Error('Order history could not be read. Existing data has not been changed.'); }
    return decodeOrderHistory(raw);
  }
  return {
    version: 1,
    load: () => serialize(storage, read),
    getById: (id) => serialize(storage, async () => {
      const result = await read();
      if (!result.canWrite) throw new OrderHistoryRecoveryError();
      return result.orders.find((order) => order.id === id) ?? null;
    }),
    async create(input) {
      // Copy before entering the queue: callers cannot change a pending receipt.
      const candidate = parseOrder(input);
      return serialize(storage, async () => {
        const history = await read();
        if (!history.canWrite) throw new OrderHistoryRecoveryError();
        const existing = history.orders.find((order) => order.checkoutId === candidate.checkoutId);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(candidate)) throw new OrderConflictError();
          return { order: existing, created: false };
        }
        if (history.orders.some((order) => order.id === candidate.id)) throw new OrderConflictError();
        try {
          await storage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, orders: [...history.orders, candidate] }));
        } catch { throw new Error('The order could not be confirmed as saved. Retry with the same checkout ID.'); }
        return { order: candidate, created: true };
      });
    },
  };
}
