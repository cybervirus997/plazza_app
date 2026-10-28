import { act, type ReactNode } from 'react';
import { Alert, type PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance } from 'test-renderer';
import { AppStateProvider, useShopping } from '../src/state/AppStateProvider';
import { AddressBookProvider } from '../src/features/addresses/AddressBookProvider';
import CartScreen from '../src/features/cart/CartScreen';
import { createCheckoutCoordinator, CHECKOUT_STORAGE_KEY } from '../src/features/orders/checkout';
import { ORDER_STORAGE_KEY, createLocalOrderRepository } from '../src/repositories/local/LocalOrderRepository';
import { createLocalAddressRepository, ADDRESS_STORAGE_KEY } from '../src/repositories/local/LocalAddressRepository';
import { STORAGE_KEY, decodeCheckoutShopping } from '../src/storage/persistence';
import { adaptMedicine } from '../src/features/catalog/products';
import { createAppReducer, initialAppState } from '../src/state/appReducer';
import { orderInput, orderStorage, deferred, testOrder } from './order-fixtures';

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const state = { pressed: false, hovered: false };
  return { __esModule: true, default: (props: PressableProps) => React.createElement('Pressable', props,
    typeof props.children === 'function' ? props.children(state) : props.children) };
});
function setup() {
  const input = orderInput();
  const memory = orderStorage();
  memory.data.set(STORAGE_KEY, JSON.stringify({ version: 1, cart: input.cart, activeCouponCode: 'FIRST100', usedCouponCodes: [], recentSearches: ['care'] }));
  if (!input.deliveryAddress) throw new Error('Missing fixture address');
  const address = input.deliveryAddress.address;
  memory.data.set(ADDRESS_STORAGE_KEY, JSON.stringify({ version: 1, addresses: [address], defaultAddressId: address.id, selectedAddressId: address.id }));
  const identity = jest.fn(() => ({ id: 'order-1', checkoutId: 'checkout-1', placedAt: input.placedAt }));
  return { ...memory, input, identity };
}
type App = ReturnType<typeof setup>;
async function mount(app: App, changedCatalog = false) {
  const root = createRoot();
  let context: ReturnType<typeof useShopping> | undefined;
  function Probe() { context = useShopping(); return null; }
  const products = app.input.products.map((product) => adaptMedicine(changedCatalog ? { ...product, maxQty: 1, price: 1 } : product));
  const repository = { load: async () => products, search: async () => products };
  const coordinator = createCheckoutCoordinator(app.port, { identity: app.identity });
  const addresses = createLocalAddressRepository(app.port);
  await act(async () => {
    root.render(<AppStateProvider repository={repository} storage={app.port} coordinator={coordinator}>
      <AddressBookProvider repository={addresses}><Probe /><CartScreen /></AddressBookProvider>
    </AppStateProvider>);
  });
  const read = () => { if (!context) throw new Error('No shopping context'); return context; };
  return { root, read, unmount: () => act(async () => { root.unmount(); }) };
}
function labelled(root: Root, label: string): TestInstance {
  const nodes = root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true });
  if (nodes.length !== 1) throw new Error(`Expected one ${label}, found ${nodes.length}`);
  return nodes[0];
}
function press(root: Root, label: string) {
  const fn: unknown = labelled(root, label).props.onPress;
  if (typeof fn !== 'function') throw new Error('Missing press');
  fn();
}
const shopWrites = (app: App) => jest.mocked(app.port.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY);
beforeEach(() => { jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

test('Cart success publishes persisted state once, without a duplicate autosave; checkpoint restoration is compatible', async () => {
  const app = setup();
  const screen = await mount(app);
  const before = shopWrites(app).length;
  try {
    await act(async () => { press(screen.root, 'Place Order →'); });
    expect(screen.read().state).toMatchObject({ cart: [], activeCouponCode: null, usedCouponCodes: ['FIRST100'], lastFinalizedCheckoutId: 'checkout-1' });
    expect(screen.read().checkoutState.status).toBe('success');
    expect(shopWrites(app)).toHaveLength(before + 1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  } finally { await screen.unmount(); }
  const restart = await mount(app);
  try {
    expect(restart.read().state).toMatchObject({ hydrated: true, cart: [], usedCouponCodes: ['FIRST100'], lastFinalizedCheckoutId: 'checkout-1' });
    expect(shopWrites(app)).toHaveLength(before + 1);
  } finally { await restart.unmount(); }
});

test('double taps are blocked synchronously and cart/coupon changes stay locked until finalization', async () => {
  const app = setup();
  const screen = await mount(app);
  const pending = deferred<void>(); const entered = deferred<void>();
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (key === STORAGE_KEY && value.includes('lastFinalizedCheckoutId')) { entered.resolve(); await pending.promise; }
    app.data.set(key, value);
  });
  try {
    await act(async () => { press(screen.root, 'Place Order →'); press(screen.root, 'Place Order →'); });
    await entered.promise;
    expect(screen.read().checkoutState.status).toBe('working');
    expect(labelled(screen.root, 'Placing order…').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.read().state.usedCouponCodes).toEqual([]);
    const oldCart = screen.read().state.cart;
    await act(async () => {
      screen.read().dispatch({ type: 'clear' }); screen.read().dispatch({ type: 'remove-coupon' });
      screen.read().dispatch({ type: 'apply-coupon', code: 'FREEDEL' }); screen.read().dispatch({ type: 'increase', id: 'a' });
    });
    expect(screen.read().state.cart).toEqual(oldCart);
    expect(screen.read().state.activeCouponCode).toBe('FIRST100');
    expect(app.identity).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(); });
    expect(screen.read().state.usedCouponCodes).toEqual(['FIRST100']);
  } finally { pending.resolve(); await screen.unmount(); }
});

test('missing address disables Place Order and a stale/programmatic press cannot create an order', async () => {
  const app = setup();
  app.data.delete(ADDRESS_STORAGE_KEY);
  const screen = await mount(app);
  try {
    expect(labelled(screen.root, 'Place Order →').props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => { press(screen.root, 'Place Order →'); });
    expect(screen.read().checkoutState.error).toContain('delivery address');
    expect(screen.read().state.cart).toHaveLength(2);
    expect(screen.read().state.usedCouponCodes).toEqual([]);
    expect(app.data.has(ORDER_STORAGE_KEY)).toBe(false);
    expect(screen.read().checkoutLocked).toBe(false);
  } finally { await screen.unmount(); }
});

test('shopping finalization failure retains the cart and allows same-intent retry even without a new address', async () => {
  const app = setup();
  const screen = await mount(app);
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (key === STORAGE_KEY && value.includes('lastFinalizedCheckoutId') && !failed) { failed = true; throw new Error('disk full'); }
    app.data.set(key, value);
  });
  try {
    await act(async () => { press(screen.root, 'Place Order →'); });
    expect(screen.read().checkoutState.error).toContain('disk full');
    expect(screen.read().state.cart).toHaveLength(2);
    expect(screen.read().state.usedCouponCodes).toEqual([]);
    expect(screen.read().checkoutLocked).toBe(true);
    app.data.delete(ADDRESS_STORAGE_KEY);
    await act(async () => { press(screen.root, 'Retry checkout recovery'); });
    expect(screen.read().state.cart).toEqual([]);
    expect(screen.read().state.usedCouponCodes).toEqual(['FIRST100']);
    expect((await createLocalOrderRepository(app.port).load()).orders).toHaveLength(1);
    expect(app.identity).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  } finally { await screen.unmount(); }
});

test('cleanup retry does not re-publish success, redeem again, or write a second finalization snapshot', async () => {
  const app = setup();
  const screen = await mount(app);
  const before = shopWrites(app).length;
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (key === CHECKOUT_STORAGE_KEY && value.includes('"pending":null') && !failed) { failed = true; throw new Error('cleanup failed'); }
    app.data.set(key, value);
  });
  try {
    await act(async () => { press(screen.root, 'Place Order →'); });
    expect(screen.read().state.cart).toEqual([]);
    expect(screen.read().checkoutState).toMatchObject({ status: 'error', orderId: 'order-1' });
    expect(labelled(screen.root, 'Retry checkout recovery').props.accessibilityState).toMatchObject({ disabled: false });
    await act(async () => { press(screen.root, 'Retry checkout recovery'); });
    expect(screen.read().checkoutState.status).toBe('success');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(shopWrites(app)).toHaveLength(before + 1);
    expect(screen.read().state.usedCouponCodes).toEqual(['FIRST100']);
  } finally { await screen.unmount(); }
});

test('startup blocks hydration/autosave on a damaged journal and retries without discarding it', async () => {
  const app = setup();
  app.data.set(CHECKOUT_STORAGE_KEY, '{broken');
  const screen = await mount(app);
  try {
    expect(screen.read().state.hydrated).toBe(false);
    expect(screen.read().checkoutState.error).toContain('journal');
    expect(app.port.setItem).not.toHaveBeenCalled();
    expect(app.data.get(CHECKOUT_STORAGE_KEY)).toBe('{broken');
    app.data.set(CHECKOUT_STORAGE_KEY, JSON.stringify({ version: 1, pending: { order: testOrder(), oneTimeCouponCode: 'FIRST100' } }));
    await act(async () => { screen.read().retryRecovery(); });
    expect(screen.read().state).toMatchObject({ hydrated: true, cart: [], usedCouponCodes: ['FIRST100'] });
    expect(shopWrites(app)).toHaveLength(1);
  } finally { await screen.unmount(); }
});

test('unmount after a receipt write stops stale publication; restart recovers before catalog clamping/repricing', async () => {
  const app = setup();
  const screen = await mount(app);
  const entered = deferred<void>(); const release = deferred<void>();
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    if (key === ORDER_STORAGE_KEY) { entered.resolve(); await release.promise; }
  });
  let pending: Promise<void> | undefined;
  await act(async () => { pending = screen.read().checkout(async () => app.input.deliveryAddress); });
  await entered.promise;
  const stale = screen.read();
  await screen.unmount();
  await act(async () => { release.resolve(); await pending; });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(decodeCheckoutShopping(app.data.get(STORAGE_KEY) ?? null).cart).toHaveLength(2);
  await stale.checkout(async () => app.input.deliveryAddress);
  const restart = await mount(app, true);
  try {
    expect(restart.read().state).toMatchObject({ hydrated: true, cart: [], usedCouponCodes: ['FIRST100'] });
    const order = (await createLocalOrderRepository(app.port).load()).orders[0];
    expect(order.itemTotal).toBe(500);
    expect(order.items[0]).toMatchObject({ unitPrice: 200, quantity: 2 });
    expect(shopWrites(app).filter(([, value]) => value.includes('lastFinalizedCheckoutId'))).toHaveLength(1);
  } finally { await restart.unmount(); }
});

test('legacy immediate place-order dispatch is not exposed through the live provider', async () => {
  const app = setup();
  const screen = await mount(app);
  try {
    await act(async () => { screen.read().dispatch({ type: 'place-order' }); });
    expect(screen.read().state.cart).toHaveLength(2);
    expect(screen.read().state.usedCouponCodes).toEqual([]);
    expect(app.data.has(ORDER_STORAGE_KEY)).toBe(false);
  } finally { await screen.unmount(); }
});

test('the reducer publishes persisted finalization idempotently and blocks shopping changes under its lock', () => {
  const app = setup();
  const reduce = createAppReducer(app.input.products);
  let state = reduce(initialAppState(), { type: 'hydrate', snapshot: { cart: app.input.cart, activeCouponCode: 'FIRST100', usedCouponCodes: [], recentSearches: [] } });
  state = reduce(state, { type: 'checkout-lock', locked: true });
  expect(reduce(state, { type: 'clear' })).toBe(state);
  const snapshot = { cart: [], activeCouponCode: null, usedCouponCodes: ['FIRST100'], recentSearches: [], lastFinalizedCheckoutId: 'checkout-1' };
  state = reduce(state, { type: 'checkout-finalized', snapshot, checkoutId: 'checkout-1' });
  const published = state;
  expect(reduce(state, { type: 'checkout-finalized', snapshot, checkoutId: 'checkout-1' })).toBe(published);
  state = reduce(state, { type: 'checkout-lock', locked: false });
  state = reduce(state, { type: 'add', id: 'c' });
  expect(reduce(state, { type: 'checkout-finalized', snapshot, checkoutId: 'checkout-1' })).toBe(state);
});

test('checkout does not race an uncommitted cart action from the same event', async () => {
  const app = setup();
  const screen = await mount(app);
  try {
    await act(async () => {
      screen.read().dispatch({ type: 'decrease', id: 'a' });
      await screen.read().checkout(async () => app.input.deliveryAddress);
    });
    expect(screen.read().checkoutState.error).toContain('cart update');
    expect(app.data.has(ORDER_STORAGE_KEY)).toBe(false);
    await act(async () => { press(screen.root, 'Place Order →'); });
    const order = (await createLocalOrderRepository(app.port).load()).orders[0];
    expect(order.items[0].quantity).toBe(1);
    expect(order.itemTotal).toBe(300);
  } finally { await screen.unmount(); }
});

test('a recovery-state change on an already hydrated provider publishes the recovered checkpoint', async () => {
  const app = setup();
  const screen = await mount(app);
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    if (key === STORAGE_KEY && value.includes('lastFinalizedCheckoutId') && !failed) { failed = true; throw new Error('write failed'); }
    app.data.set(key, value);
  });
  try {
    await act(async () => { press(screen.root, 'Place Order →'); });
    expect(screen.read().state.hydrated).toBe(true);
    expect(screen.read().state.cart).toHaveLength(2);
    await act(async () => { screen.read().retryRecovery(); });
    expect(screen.read().state).toMatchObject({ cart: [], usedCouponCodes: ['FIRST100'], lastFinalizedCheckoutId: 'checkout-1' });
    expect(screen.read().checkoutLocked).toBe(false);
    expect((await createLocalOrderRepository(app.port).load()).orders).toHaveLength(1);
  } finally { await screen.unmount(); }
});

test('a lost cleanup acknowledgement retries the same finalized checkout without another write or address lookup', async () => {
  const app = setup();
  const screen = await mount(app);
  let failed = false;
  jest.mocked(app.port.setItem).mockImplementation(async (key, value) => {
    app.data.set(key, value);
    if (key === CHECKOUT_STORAGE_KEY && value.includes('"pending":null') && !failed) { failed = true; throw new Error('cleanup ack lost'); }
  });
  try {
    await act(async () => { press(screen.root, 'Place Order →'); });
    expect(screen.read().checkoutState).toMatchObject({ status: 'error', orderId: 'order-1' });
    expect(screen.read().state.cart).toEqual([]);
    const writes = jest.mocked(app.port.setItem).mock.calls.length;
    const address = jest.fn(async () => { throw new Error('Must not recapture'); });
    await act(async () => { await screen.read().checkout(address); });
    expect(screen.read().checkoutState).toMatchObject({ status: 'success', orderId: 'order-1' });
    expect(address).not.toHaveBeenCalled();
    expect(app.port.setItem).toHaveBeenCalledTimes(writes);
    expect(app.identity).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(screen.read().state.usedCouponCodes).toEqual(['FIRST100']);
  } finally { await screen.unmount(); }
});
