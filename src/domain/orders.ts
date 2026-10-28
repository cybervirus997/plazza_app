import { addressDraft, addressTextFields, deliveryOptions, gateOptions, validateAddress, type DeliveryAddressSnapshot } from './addresses';
import { calculateBill, type Bill } from './bill';
import { evaluateCoupon, normalizeCouponCode } from './coupons';
import type { Cart, Medicine } from './types';
import { isRecord } from '../storage/persistence';

export interface OrderItemSnapshot {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly rx: boolean;
}
export type DeliveryPreference = 'asap' | 'scheduled';
export interface OrderPayment {
  readonly version: 1;
  readonly attemptId: string;
  readonly method: 'upi' | 'cod';
  readonly status: 'succeeded' | 'cod-confirmed';
  readonly simulated: true;
}
export interface Order extends Bill {
  readonly version: 1;
  readonly id: string;
  readonly checkoutId: string;
  readonly placedAt: string;
  readonly items: readonly OrderItemSnapshot[];
  readonly couponCode: string | null;
  readonly deliveryAddress: DeliveryAddressSnapshot;
  readonly status: 'placed';
  readonly payment?: OrderPayment;
  readonly deliveryPreference?: DeliveryPreference;
}
export interface OrderDraftInput {
  readonly id: string;
  readonly checkoutId: string;
  readonly placedAt: string;
  readonly cart: Cart;
  readonly products: readonly Medicine[];
  readonly bill: Bill;
  readonly couponCode: string | null;
  readonly usedCouponCodes: readonly string[];
  readonly deliveryAddress: DeliveryAddressSnapshot | null;
  readonly deliveryPreference?: DeliveryPreference;
}

function invalid(): never { throw new Error('The order contains invalid receipt data.'); }
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function positiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
function minorUnits(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return invalid();
  const minor = Math.round(value * 100);
  if (!Number.isSafeInteger(minor) || value !== minor / 100) return invalid();
  return minor;
}
function safeSum(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result)) return invalid();
  return result;
}

function copyAddressSnapshot(value: unknown): DeliveryAddressSnapshot {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.address)) return invalid();
  const source = value.address;
  if (!text(source.id) || typeof source.callBeforeArrival !== 'boolean') return invalid();
  const draft = addressDraft();
  for (const key of addressTextFields) {
    const field = source[key];
    if (typeof field !== 'string') return invalid();
    draft[key] = field;
  }
  const gate = gateOptions.find((option) => option.id === source.gateAccess);
  const delivery = deliveryOptions.find((option) => option.id === source.deliveryOption);
  if (!gate || !delivery) return invalid();
  draft.gateAccess = gate.id;
  draft.deliveryOption = delivery.id;
  draft.callBeforeArrival = source.callBeforeArrival;
  if (source.coordinates !== null) {
    if (!isRecord(source.coordinates) || typeof source.coordinates.latitude !== 'number' || typeof source.coordinates.longitude !== 'number') return invalid();
    draft.latitude = String(source.coordinates.latitude);
    draft.longitude = String(source.coordinates.longitude);
  }
  const checked = validateAddress(draft);
  // Receipts are validated, never silently repaired or reformatted on restoration.
  if (!checked.valid || addressTextFields.some((key) => checked.value[key] !== source[key])) return invalid();
  return Object.freeze({ version: 1, address: Object.freeze({ id: source.id, ...checked.value,
    coordinates: checked.value.coordinates ? Object.freeze({ ...checked.value.coordinates }) : null }) });
}

/** Validates stored snapshots without consulting today's catalog or coupon registry. */
export function parseOrder(value: unknown): Order {
  if (!isRecord(value) || value.version !== 1 || value.status !== 'placed'
    || !text(value.id) || !text(value.checkoutId) || typeof value.placedAt !== 'string'
    || !Number.isFinite(Date.parse(value.placedAt)) || new Date(value.placedAt).toISOString() !== value.placedAt
    || !Array.isArray(value.items) || value.items.length === 0
    || (value.couponCode !== null && (!text(value.couponCode) || normalizeCouponCode(value.couponCode) !== value.couponCode))) return invalid();
  let payment: OrderPayment | undefined;
  if (value.payment !== undefined) {
    const source = value.payment;
    if (!isRecord(source) || source.version !== 1 || !text(source.attemptId) || source.simulated !== true
      || !((source.method === 'upi' && source.status === 'succeeded') || (source.method === 'cod' && source.status === 'cod-confirmed'))) return invalid();
    payment = Object.freeze({ version: 1, attemptId: source.attemptId, method: source.method, status: source.status, simulated: true });
  }
  if (value.deliveryPreference !== undefined && value.deliveryPreference !== 'asap' && value.deliveryPreference !== 'scheduled') return invalid();
  const productIds = new Set<string>();
  let itemTotal = 0;
  let itemCount = 0;
  const items = Array.from(value.items, (item: unknown): OrderItemSnapshot => {
    if (!isRecord(item) || !text(item.productId) || !text(item.name) || !positiveInteger(item.quantity)
      || typeof item.rx !== 'boolean' || productIds.has(item.productId)) return invalid();
    productIds.add(item.productId);
    itemCount = safeSum(itemCount, item.quantity);
    const unitPrice = minorUnits(item.unitPrice);
    const lineTotal = unitPrice * item.quantity;
    if (!Number.isSafeInteger(lineTotal)) return invalid();
    itemTotal = safeSum(itemTotal, lineTotal);
    return Object.freeze({ productId: item.productId, name: item.name, quantity: item.quantity, unitPrice: unitPrice / 100, rx: item.rx });
  });
  const declaredTotal = minorUnits(value.itemTotal);
  const discount = minorUnits(value.discount);
  const deliveryFee = minorUnits(value.deliveryFee);
  const grandTotal = minorUnits(value.grandTotal);
  if (itemTotal !== declaredTotal || discount > itemTotal || (!value.couponCode && discount > 0)
    || safeSum(itemTotal - discount, deliveryFee) !== grandTotal) return invalid();
  return Object.freeze({ version: 1, id: value.id, checkoutId: value.checkoutId, placedAt: value.placedAt,
    items: Object.freeze(items), couponCode: value.couponCode, itemTotal: itemTotal / 100, discount: discount / 100,
    deliveryFee: deliveryFee / 100, grandTotal: grandTotal / 100, deliveryAddress: copyAddressSnapshot(value.deliveryAddress), status: 'placed',
    ...(payment ? { payment } : {}), ...(value.deliveryPreference ? { deliveryPreference: value.deliveryPreference } : {}) });
}

/** Creates a receipt only; never mutates a cart or redeems a coupon. IDs/time belong to the caller. */
export function createOrderDraft(input: OrderDraftInput): Order {
  if (input.cart.length === 0) throw new Error('Add an item before creating an order.');
  if (!input.deliveryAddress) throw new Error('Choose a delivery address before creating an order.');
  const ids = new Set<string>();
  const items = input.cart.map((entry): OrderItemSnapshot => {
    const matches = input.products.filter((product) => product.id === entry.medicineId);
    const product = matches[0];
    if (ids.has(entry.medicineId) || matches.length !== 1 || !product || !positiveInteger(entry.quantity)
      || !positiveInteger(product.maxQty) || entry.quantity > product.maxQty
      || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) return invalid();
    ids.add(entry.medicineId);
    // Match getItemTotal: round each unit price to paise before multiplying quantity.
    const price = Math.round(product.price * 100);
    if (!Number.isSafeInteger(price)) return invalid();
    return { productId: product.id, name: product.name, quantity: entry.quantity, unitPrice: price / 100, rx: product.rx };
  });
  const couponCode = input.couponCode === null ? null : normalizeCouponCode(input.couponCode);
  // Validate receipt arithmetic before passing bounded values into current pricing rules.
  const draft = parseOrder({ version: 1, id: input.id, checkoutId: input.checkoutId, placedAt: input.placedAt,
    items, itemTotal: input.bill.itemTotal, discount: input.bill.discount, deliveryFee: input.bill.deliveryFee,
    grandTotal: input.bill.grandTotal, couponCode, deliveryAddress: input.deliveryAddress, status: 'placed',
    ...(input.deliveryPreference ? { deliveryPreference: input.deliveryPreference } : {}) });
  const itemCount = items.reduce((count, item) => safeSum(count, item.quantity), 0);
  if (couponCode && !evaluateCoupon(couponCode, { itemTotal: draft.itemTotal, itemCount, usedCouponCodes: input.usedCouponCodes }).valid) {
    throw new Error('The selected coupon is not valid for this checkout.');
  }
  const expected = calculateBill(input.cart, input.products, couponCode, input.usedCouponCodes);
  if (draft.itemTotal !== expected.itemTotal || draft.discount !== expected.discount
    || draft.deliveryFee !== expected.deliveryFee || draft.grandTotal !== expected.grandTotal) {
    throw new Error('The checkout bill does not match its items and coupon.');
  }
  return draft;
}
