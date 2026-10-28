import { act, type ReactNode, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Platform, type PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance, type TestNode } from 'test-renderer';
import { AppStateProvider, useShopping } from '../src/state/AppStateProvider';
import { AddressBookProvider, useAddressBook } from '../src/features/addresses/AddressBookProvider';
import { createLocalAddressRepository, ADDRESS_STORAGE_KEY } from '../src/repositories/local/LocalAddressRepository';
import { addressDraft } from '../src/domain/addresses';
import { ORDER_STORAGE_KEY } from '../src/repositories/local/LocalOrderRepository';
import { PAYMENT_STORAGE_KEY } from '../src/repositories/local/LocalPaymentRepository';
import { STORAGE_KEY } from '../src/storage/persistence';
import CartScreen from '../src/features/cart/CartScreen';
import CheckoutScreen from '../src/features/orders/CheckoutScreen';
import { CheckoutPreferencesProvider } from '../src/features/orders/CheckoutPreferences';
import PaymentScreen from '../src/features/orders/PaymentScreen';
import OrderConfirmationScreen from '../src/features/orders/OrderConfirmationScreen';
import OrderHistoryScreen from '../src/features/orders/OrderHistoryScreen';
import OrderDetailsScreen from '../src/features/orders/OrderDetailsScreen';
import HomeScreen from '../src/features/home/HomeScreen';
import AddressBookScreen from '../src/features/addresses/AddressBookScreen';
import { paymentSetup } from './payment-fixtures';
import { deferred, testOrder } from './order-fixtures';
import * as orderPresentation from '../src/features/orders/orderPresentation';

type Href = string | { pathname: string; params?: { id?: string } };
let mockParams: { id?: string } = {};
let mockNavigate: (href: Href) => void = () => {};
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn((href: Href) => mockNavigate(href)), push: jest.fn((href: Href) => mockNavigate(href)), replace: jest.fn((href: Href) => mockNavigate(href)), navigate: jest.fn((href: Href) => mockNavigate(href)),
    canGoBack: () => true, back: jest.fn(() => mockNavigate('/cart')) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => (() => void) | void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: (props: { children: ReactNode }) => React.createElement('KeyboardAvoidingView', props, props.children) };
});
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('../src/features/permissions/PermissionPanel', () => ({ DeliveryLocation: () => null, PermissionPanel: () => null }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: (props: PressableProps) => React.createElement('Pressable', props,
    typeof props.children === 'function' ? props.children({ pressed: false, hovered: false }) : props.children) };
});
function content(node: TestNode): string { return typeof node === 'string' ? node : node.children.map(content).join(''); }
function labelled(root: Root, label: string): TestInstance {
  const nodes = root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true });
  if (nodes.length !== 1) throw new Error(`Expected one ${label}, found ${nodes.length}`);
  return nodes[0];
}
function press(root: Root, label: string) {
  const handler: unknown = labelled(root, label).props.onPress;
  if (typeof handler !== 'function') throw new Error('Missing press handler');
  handler();
}
async function mount(app = paymentSetup(), initial = '/checkout', params: { id?: string } = {}) {
  const root = createRoot(); mockParams = params;
  let shopping: ReturnType<typeof useShopping> | undefined;
  let addresses: ReturnType<typeof useAddressBook> | undefined;
  let route = initial;
  function Probe() { shopping = useShopping(); addresses = useAddressBook(); return null; }
  function Navigator() {
    const [screen, setScreen] = useState(initial);
    useEffect(() => {
      mockNavigate = (href) => { route = typeof href === 'string' ? href : href.pathname; mockParams = typeof href === 'string' ? {} : href.params ?? {}; setScreen(route); };
      return () => { mockNavigate = () => {}; };
    }, []);
    return screen === '/cart' ? <CartScreen /> : screen === '/checkout' ? <CheckoutScreen /> : screen === '/payment' ? <PaymentScreen />
      : screen === '/order-confirmation' ? <OrderConfirmationScreen /> : screen === '/orders' ? <OrderHistoryScreen />
        : screen === '/orders/[id]' ? <OrderDetailsScreen /> : screen === '/addresses' ? <AddressBookScreen /> : <HomeScreen />;
  }
  const repository = { load: async () => app.start.products, search: async () => app.start.products };
  await act(async () => { root.render(<AppStateProvider storage={app.port} ordering={app.service} repository={repository}>
    <AddressBookProvider repository={createLocalAddressRepository(app.port)}><CheckoutPreferencesProvider><Probe /><Navigator /></CheckoutPreferencesProvider></AddressBookProvider>
  </AppStateProvider>); });
  const read = () => { if (!shopping || !addresses) throw new Error('Missing contexts'); return { shopping, addresses }; };
  return { app, root, read, route: () => route, text: () => content(root.container),
    tap: (label: string) => act(async () => { press(root, label); }),
    go: (href: Parameters<typeof router.push>[0]) => act(async () => { router.push(href); }),
    unmount: () => act(async () => { root.unmount(); }) };
}
async function startSuccess(screen: Awaited<ReturnType<typeof mount>>) {
  await screen.tap('success');
  await screen.tap('Continue to simulated payment →');
  expect(screen.route()).toBe('/payment');
}
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

test('Cart opens Checkout without clearing or placing anything; Back retains the editable cart', async () => {
  const screen = await mount(paymentSetup(), '/cart');
  try {
    const before = screen.read().shopping.state.cart;
    await screen.tap('Proceed to Checkout →');
    expect(screen.route()).toBe('/checkout');
    expect(screen.read().shopping.state.cart).toEqual(before);
    expect((await screen.app.service.orders.load()).orders).toHaveLength(0);
    await screen.tap('Back from Checkout');
    expect(screen.route()).toBe('/cart');
    expect(screen.read().shopping.state.cart).toEqual(before);
  } finally { await screen.unmount(); }
});
test('complete UPI flow confirms only durable state, then renders an immutable receipt', async () => {
  const screen = await mount();
  const shoppingWrites = () => jest.mocked(screen.app.port.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY).length;
  const writesBefore = shoppingWrites();
  try {
    expect(screen.text()).toContain('Prescription review required');
    expect(screen.text()).toContain('no gate-app integration');
    expect(screen.text()).toContain('Actual stock, coverage and delivery times are not checked');
    await startSuccess(screen);
    expect((await screen.app.service.orders.load()).orders).toHaveLength(0);
    expect(screen.read().shopping.state.usedCouponCodes).toEqual([]);
    await screen.tap('Pay ₹400 · simulated UPI');
    expect(screen.route()).toBe('/order-confirmation');
    expect(screen.text()).toContain('Your mock order is saved');
    expect(screen.text()).toContain('order-1');
    expect(screen.read().shopping.state).toMatchObject({ cart: [], usedCouponCodes: ['FIRST100'] });
    expect(shoppingWrites()).toBe(writesBefore + 1);
    await screen.tap('View Order');
    expect(screen.route()).toBe('/orders/[id]');
    expect(screen.text()).toContain('Test Relief');
    expect(screen.text()).toContain('2 × ₹200 = ₹400');
    expect(screen.text()).toContain('Grand Total₹400');
    expect(screen.text()).toContain('Test Recipient');
    expect(screen.text()).toContain('Simulated UPI · succeeded, no money transferred');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  } finally { await screen.unmount(); }
});
test.each(['address', 'cart', 'unavailable'] as const)('Checkout blocks missing/invalid %s with helpful feedback', async (problem) => {
  const app = paymentSetup();
  if (problem === 'address') app.data.delete(ADDRESS_STORAGE_KEY);
  if (problem === 'cart') app.data.set(STORAGE_KEY, JSON.stringify({ version: 1, cart: [], activeCouponCode: null, usedCouponCodes: [], recentSearches: [] }));
  if (problem === 'unavailable') app.start.products = app.start.products.map((item) => ({ ...item, isAvailable: item.id !== 'a' }));
  const screen = await mount(app);
  try {
    expect(labelled(screen.root, 'Continue to simulated payment →').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.text()).toContain(problem === 'address' ? 'Choose a delivery address' : problem === 'cart' ? 'Add an item' : 'unavailable');
    expect((await app.service.orders.load()).orders).toHaveLength(0);
    expect(app.data.has(PAYMENT_STORAGE_KEY)).toBe(false);
    if (problem === 'unavailable') expect(screen.read().shopping.state.cart).toHaveLength(2);
  } finally { await screen.unmount(); }
});
test('a selected address change revalidates review, and pending payment keeps the captured address', async () => {
  const screen = await mount();
  try {
    const selected = screen.read().addresses.selected;
    if (!selected) throw new Error('No selected address');
    await act(async () => { expect(await screen.read().addresses.save({ ...addressDraft(selected), label: "Dad's Home", recipientName: 'Dad' }, { select: true })).toBe(true); });
    expect(screen.text()).toContain('Recipient: Dad');
    await screen.tap('Continue to simulated payment →');
    await screen.tap('Pay ₹400 · simulated UPI');
    expect(screen.text()).toContain('Verification is pending / unknown');
    const dad = screen.read().addresses.selected;
    if (!dad) throw new Error('No recipient');
    await act(async () => { await screen.read().addresses.save({ ...addressDraft(dad), recipientName: 'Changed Later' }, { id: dad.id }); });
    await screen.go('/checkout');
    expect(screen.text()).toContain('Recipient: Dad');
    expect(screen.text()).not.toContain('Changed Later');
    await screen.tap('Resume saved payment'); await screen.tap('Check Status');
    expect(screen.text()).toContain('Recipient: Dad');
  } finally { await screen.unmount(); }
});
test('pending payment restarts as pending and explicit Check Status completes the original checkout', async () => {
  const app = paymentSetup(); const first = await mount(app);
  await first.tap('Continue to simulated payment →'); await first.tap('Pay ₹400 · simulated UPI');
  expect(first.read().shopping.state.usedCouponCodes).toEqual([]);
  await first.unmount();
  const restart = await mount(app, '/cart');
  try {
    expect(restart.text()).toContain('Resume saved payment');
    await restart.tap('Resume saved payment');
    expect(restart.text()).toContain('Verification is pending / unknown');
    await restart.tap('Check Status');
    expect(restart.route()).toBe('/order-confirmation');
    expect((await app.service.orders.load()).orders).toHaveLength(1);
    expect(app.options.identity).toHaveBeenCalledTimes(1);
  } finally { await restart.unmount(); }
});
test.each(['failure', 'cancel'] as const)('UI outcome %s keeps cart intact and deliberate retry creates a new attempt', async (outcome) => {
  const screen = await mount();
  try {
    await screen.tap(outcome); await screen.tap('Continue to simulated payment →'); await screen.tap('Pay ₹400 · simulated UPI');
    expect(screen.read().shopping.state.cart).toHaveLength(2);
    expect(screen.read().shopping.state.usedCouponCodes).toEqual([]);
    expect(screen.route()).toBe('/payment');
    expect(screen.text()).toContain('No order was placed');
    await screen.tap(outcome === 'failure' ? 'Retry Payment' : 'Back to Checkout'); await startSuccess(screen); await screen.tap('Pay ₹400 · simulated UPI');
    expect(screen.read().shopping.payment.attempt?.id).toBe('payment-2');
    expect((await screen.app.service.orders.load()).orders).toHaveLength(1);
  } finally { await screen.unmount(); }
});
test('explicit cancellation and mock COD confirmation are separate deliberate actions', async () => {
  const screen = await mount();
  try {
    await screen.tap('Continue to simulated payment →'); await screen.tap('Cancel simulated payment');
    expect(screen.read().shopping.payment.attempt?.status).toBe('cancelled');
    expect(screen.read().shopping.state.usedCouponCodes).toEqual([]);
    await screen.tap('Back to Checkout'); await screen.tap('Mock Cash on Delivery');
    await screen.tap('Continue to simulated payment →');
    expect((await screen.app.service.orders.load()).orders).toHaveLength(0);
    await screen.tap('Confirm mock COD order');
    expect(screen.route()).toBe('/order-confirmation');
    expect(screen.text()).toContain('Mock COD · confirmed, no cash collected');
  } finally { await screen.unmount(); }
});
test('successful payment with an order-write failure shows reconciliation rather than order confirmation', async () => {
  const screen = await mount(); let failed = false;
  jest.mocked(screen.app.port.setItem).mockImplementation(async (key, value) => {
    if (key === ORDER_STORAGE_KEY && !failed) { failed = true; throw new Error('order disk full'); }
    screen.app.data.set(key, value);
  });
  try {
    await startSuccess(screen); await screen.tap('Pay ₹400 · simulated UPI');
    expect(screen.route()).toBe('/payment');
    expect(screen.text()).toContain('The payment simulation succeeded');
    expect(screen.text()).toContain('Order: not confirmed');
    expect(screen.text()).not.toContain('Your mock order is saved');
    expect(screen.read().shopping.state.usedCouponCodes).toEqual([]);
    await screen.tap('Retry order reconciliation');
    expect(screen.route()).toBe('/order-confirmation');
    expect((await screen.app.service.orders.load()).orders).toHaveLength(1);
  } finally { await screen.unmount(); }
});
test('confirmation waits for shopping durability and duplicate payment taps cannot race the writer', async () => {
  const screen = await mount(); const entered = deferred<void>(); const release = deferred<void>();
  jest.mocked(screen.app.port.setItem).mockImplementation(async (key, value) => {
    if (key === STORAGE_KEY && value.includes('lastFinalizedCheckoutId')) { entered.resolve(); await release.promise; }
    screen.app.data.set(key, value);
  });
  try {
    await startSuccess(screen);
    await act(async () => { press(screen.root, 'Pay ₹400 · simulated UPI'); press(screen.root, 'Pay ₹400 · simulated UPI'); });
    await entered.promise;
    const captured = screen.read().shopping.state.cart;
    await act(async () => {
      screen.read().shopping.retryRecovery();
      screen.read().shopping.dispatch({ type: 'clear' });
      screen.read().shopping.dispatch({ type: 'remove-coupon' });
      await screen.read().shopping.checkout(async () => null);
    });
    expect(screen.read().shopping.state.cart).toEqual(captured);
    expect(screen.read().shopping.state.activeCouponCode).toBe('FIRST100');
    expect(screen.route()).toBe('/payment');
    expect(labelled(screen.root, 'Verifying & saving…').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.read().shopping.state.usedCouponCodes).toEqual([]);
    expect(screen.text()).not.toContain('Your mock order is saved');
    await act(async () => { release.resolve(); });
    expect(screen.route()).toBe('/order-confirmation');
    expect((await screen.app.service.orders.load()).orders).toHaveLength(1);
    expect(screen.app.options.identity).toHaveBeenCalledTimes(1);
  } finally { release.resolve(); await screen.unmount(); }
});
test('unmounting the payment screen prevents late navigation while the provider finishes recovery-safe writes', async () => {
  const screen = await mount(); const entered = deferred<void>(); const release = deferred<void>();
  jest.mocked(screen.app.port.setItem).mockImplementation(async (key, value) => {
    if (key === ORDER_STORAGE_KEY) { entered.resolve(); await release.promise; }
    screen.app.data.set(key, value);
  });
  try {
    await startSuccess(screen);
    await act(async () => { press(screen.root, 'Pay ₹400 · simulated UPI'); });
    await entered.promise;
    await screen.go('/cart');
    await act(async () => { release.resolve(); });
    expect(screen.route()).toBe('/cart');
    expect((await screen.app.service.orders.load()).orders).toHaveLength(1);
  } finally { release.resolve(); await screen.unmount(); }
});
test('Home exposes Orders; empty history and legacy receipt metadata are explicit', async () => {
  const screen = await mount(paymentSetup(), '/');
  try {
    await screen.tap('Orders');
    expect(screen.route()).toBe('/orders');
    expect(screen.text()).toContain('No saved orders yet');
    const legacy = testOrder(); await screen.app.service.orders.create(legacy);
    await screen.go('/'); await screen.tap('Orders');
    await screen.tap('View order order-1');
    expect(screen.text()).toContain('Legacy demo order · payment metadata was not recorded');
  } finally { await screen.unmount(); }
});
test('history sorts newest first and receipts survive catalog/address changes and restart', async () => {
  const app = paymentSetup(); const screen = await mount(app);
  await startSuccess(screen); await screen.tap('Pay ₹400 · simulated UPI');
  await app.service.orders.create(testOrder({ id: 'later-order', checkoutId: 'later-checkout', placedAt: '2026-10-29T10:00:00.000Z' }));
  await screen.unmount();
  app.start.products = app.start.products.map((item) => ({ ...item, price: 1, maxQty: 1 }));
  app.data.delete(ADDRESS_STORAGE_KEY);
  const restart = await mount(app, '/orders');
  try {
    const body = restart.text();
    expect(body.indexOf('later-order')).toBeLessThan(body.indexOf('order-1'));
    await restart.tap('View order order-1');
    expect(restart.text()).toContain('2 × ₹200 = ₹400');
    expect(restart.text()).toContain('Grand Total₹400');
    expect(restart.text()).toContain('Test Recipient');
    expect(restart.text()).toContain('Call at the gate');
    expect(restart.text()).not.toContain('2 × ₹1');
  } finally { await restart.unmount(); }
});
test('missing receipt and damaged history display retry/error states without storage reset', async () => {
  const screen = await mount(paymentSetup(), '/orders/[id]', { id: 'missing' });
  try {
    expect(screen.text()).toContain('Order not found');
    screen.app.data.set(ORDER_STORAGE_KEY, '{broken');
    await screen.go('/orders');
    expect(screen.text()).toContain('Order history needs recovery');
    expect(screen.app.data.get(ORDER_STORAGE_KEY)).toBe('{broken');
    await screen.go({ pathname: '/orders/[id]', params: { id: 'missing' } });
    expect(screen.text()).toContain('Order history needs recovery');
    screen.app.data.set(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, orders: [testOrder()] }));
    await screen.tap('Retry receipt');
    expect(screen.text()).toContain('Order not found');
  } finally { await screen.unmount(); }
});
test('a saved receipt without successful shopping finalization cannot show confirmation', async () => {
  const app = paymentSetup();
  await app.service.orders.create(testOrder());
  const screen = await mount(app, '/order-confirmation', { id: 'order-1' });
  try {
    expect(screen.text()).not.toContain('Your mock order is saved');
    expect(screen.text()).toContain('cannot be confirmed');
    expect(screen.read().shopping.state.cart).toHaveLength(2);
  } finally { await screen.unmount(); }
});

test('Edit Cart returns to the existing tab and keeps Checkout method and delivery choices', async () => {
  const screen = await mount();
  try {
    await screen.tap('Scheduled · evening demo window');
    await screen.tap('Mock Cash on Delivery');
    await screen.tap('Edit Cart');
    expect(router.dismissTo).toHaveBeenCalledWith('/cart');
    expect(screen.route()).toBe('/cart');
    await screen.tap('Proceed to Checkout →');
    expect(screen.text()).toContain('✓ Scheduled · evening demo window');
    expect(screen.text()).toContain('✓ Mock Cash on Delivery');
    await screen.tap('Continue to simulated payment →');
    expect(screen.read().shopping.payment.attempt).toMatchObject({ method: 'cod', order: { deliveryPreference: 'scheduled' } });
  } finally { await screen.unmount(); }
});
test('Android Cart relies on native resize without a second keyboard height adjustment', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const screen = await mount(paymentSetup(), '/cart');
  try {
    const avoidance = screen.root.container.queryAll((node) => node.type === 'KeyboardAvoidingView');
    expect(avoidance).toHaveLength(1);
    expect(avoidance[0].props.enabled).toBe(false);
    expect(avoidance[0].props.behavior).toBeUndefined();
  } finally { await screen.unmount(); }
});

test('a failed payment offers an explicit Change Method review before a new COD confirmation', async () => {
  const screen = await mount();
  try {
    await screen.tap('failure'); await screen.tap('Continue to simulated payment →'); await screen.tap('Pay ₹400 · simulated UPI');
    expect(labelled(screen.root, 'Payment failed status').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.text()).toContain('The payment simulation failed');
    await screen.tap('Change Method');
    expect(screen.route()).toBe('/checkout');
    await screen.tap('Mock Cash on Delivery'); await screen.tap('Continue to simulated payment →');
    expect((await screen.app.service.orders.load()).orders).toHaveLength(0);
    await screen.tap('Confirm mock COD order');
    expect(screen.read().shopping.payment.attempt?.id).toBe('payment-2');
    expect(screen.route()).toBe('/order-confirmation');
    expect((await screen.app.service.orders.load()).orders).toHaveLength(1);
  } finally { await screen.unmount(); }
});
test('history and receipt distinguish persisted fulfillment from unfinished checkout reconciliation', async () => {
  const screen = await mount(); let failed = false;
  jest.mocked(screen.app.port.setItem).mockImplementation(async (key, value) => {
    if (key === STORAGE_KEY && value.includes('lastFinalizedCheckoutId') && !failed) { failed = true; throw new Error('finalization failed'); }
    screen.app.data.set(key, value);
  });
  try {
    await startSuccess(screen); await screen.tap('Pay ₹400 · simulated UPI');
    expect(labelled(screen.root, 'Order reconciliation required status').props.accessibilityLiveRegion).toBe('polite');
    await screen.go('/orders');
    expect(screen.text()).toContain('Placed');
    expect(screen.text()).toContain('2 products · 3 items');
    expect(screen.text()).toContain('Test Relief · Test Care');
    expect(screen.text()).toContain('Checkout reconciliation pending');
    expect(screen.text()).not.toContain('Order status: reconciliation pending');
    await screen.tap('View order order-1');
    expect(screen.text()).toContain('Receipt saved · checkout is not yet finalized');
    expect(screen.text()).toContain('Grand Total₹400');
    expect(screen.text()).toContain('Simulated UPI · succeeded, no money transferred');
    expect(screen.text()).not.toContain('Your mock order is saved');
  } finally { await screen.unmount(); }
});

test('Checkout choices expose selected state and stable accessible names', async () => {
  const screen = await mount();
  try {
    expect(labelled(screen.root, 'Simulated UPI').props.accessibilityState.selected).toBe(true);
    expect(labelled(screen.root, 'Mock Cash on Delivery').props.accessibilityState.selected).toBe(false);
    await screen.tap('Mock Cash on Delivery');
    expect(labelled(screen.root, 'Mock Cash on Delivery').props.accessibilityState.selected).toBe(true);
    expect(labelled(screen.root, 'Simulated UPI').props.accessibilityState.selected).toBe(false);
    await screen.tap('Scheduled · evening demo window');
    expect(labelled(screen.root, 'Scheduled · evening demo window').props.accessibilityState.selected).toBe(true);
    expect(labelled(screen.root, 'ASAP · demo preference').props.accessibilityState.selected).toBe(false);
  } finally { await screen.unmount(); }
});

test('unchanged history cards avoid repeated formatting when unrelated shopping state changes', async () => {
  const app = paymentSetup(); await app.service.orders.create(testOrder());
  const formatting = jest.spyOn(orderPresentation, 'orderSummary');
  const screen = await mount(app, '/orders');
  try {
    expect(formatting).toHaveBeenCalled();
    formatting.mockClear();
    await act(async () => { screen.read().shopping.dispatch({ type: 'search', query: 'care' }); });
    expect(screen.text()).toContain('Test Relief · Test Care');
    expect(formatting).not.toHaveBeenCalled();
  } finally { await screen.unmount(); }
});
