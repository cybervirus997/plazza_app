import { calculateBill } from '../src/domain/bill';
import { createOrderDraft, parseOrder } from '../src/domain/orders';
import { createAppReducer, initialAppState } from '../src/state/appReducer';
import { orderInput, testOrder } from './order-fixtures';

test('a valid draft captures identity, timestamp, Rx items, Bill and the complete delivery snapshot', () => {
  expect(testOrder()).toMatchObject({ version: 1, id: 'order-1', checkoutId: 'checkout-1', placedAt: '2026-10-29T09:00:00.000Z', status: 'placed',
    couponCode: 'FIRST100', itemTotal: 500, discount: 100, deliveryFee: 0, grandTotal: 400,
    items: [{ productId: 'a', name: 'Test Relief', quantity: 2, unitPrice: 200, rx: false },
      { productId: 'b', name: 'Test Care', quantity: 1, unitPrice: 100, rx: true }],
    deliveryAddress: { version: 1, address: { id: 'address-1', label: 'Home', recipientName: 'Test Recipient',
      gateAccess: 'mygate', instructions: 'Call at the gate', coordinates: { latitude: 12, longitude: 77 } } } });
});

test('creating a draft neither mutates shopping state nor redeems FIRST100', () => {
  const input = orderInput();
  const reducer = createAppReducer(input.products);
  const state = reducer(initialAppState(), { type: 'hydrate', snapshot: { cart: input.cart, activeCouponCode: 'FIRST100', usedCouponCodes: [], recentSearches: ['a'] } });
  const before = JSON.stringify(state);
  const order = createOrderDraft({ ...input, cart: state.cart, couponCode: state.activeCouponCode, usedCouponCodes: state.usedCouponCodes });
  expect(order.couponCode).toBe('FIRST100');
  expect(JSON.stringify(state)).toBe(before);
  expect(state.usedCouponCodes).toEqual([]);
  expect(state.cart).toHaveLength(2);
});

test('items, prices and nested addresses are detached and deeply frozen', () => {
  const source = orderInput();
  if (!source.deliveryAddress) throw new Error('Missing test snapshot');
  const cart = source.cart.map((entry) => ({ ...entry }));
  const products = source.products.map((product) => ({ ...product }));
  const deliveryAddress = { ...source.deliveryAddress, address: { ...source.deliveryAddress.address, coordinates: { latitude: 12, longitude: 77 } } };
  const order = createOrderDraft({ ...source, cart, products, deliveryAddress });
  cart[0].quantity = 1; products[0].price = 999; products[0].name = 'Changed';
  deliveryAddress.address.city = 'Mysuru'; deliveryAddress.address.instructions = 'Changed'; deliveryAddress.address.coordinates.latitude = 80;
  expect(order.items[0]).toMatchObject({ name: 'Test Relief', quantity: 2, unitPrice: 200 });
  expect(order.deliveryAddress.address).toMatchObject({ city: 'Bengaluru', instructions: 'Call at the gate', coordinates: { latitude: 12, longitude: 77 } });
  for (const value of [order, order.items, ...order.items, order.deliveryAddress, order.deliveryAddress.address, order.deliveryAddress.address.coordinates]) expect(Object.isFrozen(value)).toBe(true);
  expect(() => Object.assign(order.items[0], { unitPrice: 1 })).toThrow(TypeError);
});

test('empty carts and missing required delivery addresses are rejected', () => {
  expect(() => createOrderDraft(orderInput({ cart: [] }))).toThrow('Add an item');
  expect(() => createOrderDraft(orderInput({ deliveryAddress: null }))).toThrow('Choose a delivery address');
});

test('sparse item/cart arrays cannot masquerade as nonempty receipts', () => {
  const receipt = testOrder();
  expect(() => parseOrder({ ...receipt, items: new Array<unknown>(1), couponCode: null,
    itemTotal: 0, discount: 0, deliveryFee: 0, grandTotal: 0 })).toThrow('invalid receipt');
  expect(() => createOrderDraft(orderInput({ cart: new Array<{ medicineId: string; quantity: number }>(1), couponCode: null }))).toThrow('invalid receipt');
});

test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 4])('invalid or excessive quantity %s is rejected', (quantity) => {
  expect(() => createOrderDraft(orderInput({ cart: [{ medicineId: 'a', quantity }] }))).toThrow();
});

test('unknown products, duplicate cart entries and ambiguous resolved products are rejected', () => {
  const input = orderInput();
  expect(() => createOrderDraft(orderInput({ cart: [{ medicineId: 'missing', quantity: 1 }] }))).toThrow();
  expect(() => createOrderDraft(orderInput({ cart: [input.cart[0], input.cart[0]] }))).toThrow();
  expect(() => createOrderDraft(orderInput({ products: [...input.products, input.products[0]] }))).toThrow();
});

test.each([-1, NaN, Infinity, 1e15])('invalid or unsafe product price %s is rejected', (price) => {
  const input = orderInput();
  expect(() => createOrderDraft(orderInput({ products: input.products.map((product) => ({ ...product, price })) }))).toThrow();
});

test.each(['itemTotal', 'discount', 'deliveryFee', 'grandTotal'] as const)('a mismatching %s is rejected', (field) => {
  const input = orderInput();
  expect(() => createOrderDraft({ ...input, bill: { ...input.bill, [field]: input.bill[field] + 1 } })).toThrow();
});

test('invalid or already redeemed coupons are rejected without consuming anything', () => {
  expect(() => testOrder({ couponCode: 'UNKNOWN' })).toThrow('coupon');
  expect(() => testOrder({ usedCouponCodes: ['FIRST100'] })).toThrow('coupon');
  expect(testOrder({ couponCode: ' first100 ' }).couponCode).toBe('FIRST100');
});

test('fractional prices use per-unit paise while SAVE10 keeps existing whole-rupee rounding', () => {
  const product = orderInput().products[0];
  const fractional = testOrder({ cart: [{ medicineId: 'a', quantity: 3 }], products: [{ ...product, price: 0.1 }], couponCode: null });
  expect(fractional).toMatchObject({ itemTotal: 0.3, deliveryFee: 40, grandTotal: 40.3 });
  const rounded = testOrder({ cart: [{ medicineId: 'a', quantity: 3 }], products: [{ ...product, price: 1.005 }], couponCode: null });
  expect(rounded.items[0].unitPrice).toBe(1);
  expect(rounded.itemTotal).toBe(3);
  const percentage = testOrder({ cart: [{ medicineId: 'a', quantity: 1 }], products: [{ ...product, price: 255 }], couponCode: 'SAVE10' });
  expect(percentage).toMatchObject({ itemTotal: 255, discount: 26, deliveryFee: 40, grandTotal: 269 });
});

test('zero-price nonempty carts remain valid and FREEDEL only waives the delivery fee', () => {
  const product = orderInput().products[0];
  expect(testOrder({ cart: [{ medicineId: 'a', quantity: 1 }], products: [{ ...product, price: 0 }], couponCode: null }))
    .toMatchObject({ itemTotal: 0, discount: 0, deliveryFee: 0, grandTotal: 0 });
  expect(testOrder({ cart: [{ medicineId: 'a', quantity: 1 }], products: [product], couponCode: 'FREEDEL' }))
    .toMatchObject({ itemTotal: 200, discount: 0, deliveryFee: 0, grandTotal: 200 });
});

test('historical restoration uses snapshots, not today’s product limits, names, prices or coupon registry', () => {
  const source = orderInput();
  const receipt = createOrderDraft(source);
  const historical = { ...receipt, couponCode: 'RETIRED_PROMO' };
  const changedProducts = source.products.map((product) => ({ ...product, name: 'New name', price: 999, maxQty: 1 }));
  expect(calculateBill(source.cart, changedProducts).itemTotal).not.toBe(receipt.itemTotal);
  expect(parseOrder(historical)).toMatchObject({ itemTotal: 500, discount: 100, grandTotal: 400, items: [{ name: 'Test Relief', unitPrice: 200 }, { name: 'Test Care', unitPrice: 100 }] });
});

test('unrecognized bill fields cannot override receipt identity or items', () => {
  const input = orderInput();
  const bill = { ...input.bill, id: 'wrong', items: [] };
  expect(createOrderDraft({ ...input, bill })).toMatchObject({ id: 'order-1', items: input.cart.map((entry) => ({ productId: entry.medicineId })) });
});

test.each([
  { id: '' }, { checkoutId: '  ' }, { placedAt: 'not a date' }, { placedAt: '2026-10-29' }, { status: 'delivered' }, { version: 2 },
  { items: [] }, { deliveryAddress: null }, { itemTotal: -1 }, { discount: NaN }, { deliveryFee: 0.001 }, { grandTotal: Infinity },
])('malformed stored fields %j are rejected', (patch) => {
  expect(() => parseOrder({ ...testOrder(), ...patch })).toThrow('invalid receipt');
});

test('stored item, aggregate-quantity and address corruption is rejected instead of repaired', () => {
  const order = testOrder();
  expect(() => parseOrder({ ...order, items: [{ ...order.items[0], rx: 'yes' }] })).toThrow();
  expect(() => parseOrder({ ...order, items: [order.items[0], order.items[0]] })).toThrow();
  expect(() => parseOrder({ ...order, items: [{ ...order.items[0], quantity: Number.MAX_SAFE_INTEGER, unitPrice: 0 },
    { ...order.items[1], quantity: 1, unitPrice: 0 }], couponCode: null, itemTotal: 0, discount: 0, deliveryFee: 0, grandTotal: 0 })).toThrow();
  expect(() => parseOrder({ ...order, deliveryAddress: { version: 1, address: { ...order.deliveryAddress.address, city: ' Bengaluru ' } } })).toThrow();
  expect(() => parseOrder({ ...order, deliveryAddress: { version: 2, address: order.deliveryAddress.address } })).toThrow();
});
