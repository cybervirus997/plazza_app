import { addressDraft, emptyAddressBook, saveAddress, snapshotDeliveryAddress, validateAddress } from '../src/domain/addresses';
import { calculateBill } from '../src/domain/bill';
import { createOrderDraft, type OrderDraftInput } from '../src/domain/orders';
import type { StoragePort } from '../src/storage/persistence';
import { catalog } from './fixtures';

export function orderInput(patch: Partial<OrderDraftInput> = {}): OrderDraftInput {
  const address = validateAddress({ ...addressDraft(), addressLine: '42 Garden Road', flatNumber: '101', tower: 'A',
    society: 'Garden Society', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001', recipientName: 'Test Recipient',
    recipientPhone: '+919876543210', relationship: 'Parent', gateAccess: 'mygate', instructions: 'Call at the gate', latitude: '12', longitude: '77' });
  if (!address.valid) throw new Error('Invalid test address');
  const input: OrderDraftInput = {
    id: 'order-1', checkoutId: 'checkout-1', placedAt: '2026-10-29T09:00:00.000Z',
    cart: [{ medicineId: 'a', quantity: 2 }, { medicineId: 'b', quantity: 1 }], products: catalog.map((product) => ({ ...product })),
    couponCode: 'FIRST100', usedCouponCodes: [],
    deliveryAddress: snapshotDeliveryAddress(saveAddress(emptyAddressBook(), { id: 'address-1', ...address.value })),
    bill: { itemTotal: 500, discount: 100, deliveryFee: 0, grandTotal: 400 }, ...patch,
  };
  return { ...input, bill: patch.bill ?? calculateBill(input.cart, input.products, input.couponCode, input.usedCouponCodes) };
}
export const testOrder = (patch: Partial<OrderDraftInput> = {}) => createOrderDraft(orderInput(patch));
export function orderStorage() {
  const data = new Map<string, string>();
  const port: StoragePort = { getItem: jest.fn(async (key) => data.get(key) ?? null), setItem: jest.fn(async (key, value) => { data.set(key, value); }) };
  return { port, data };
}
export function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Not initialized'); };
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
