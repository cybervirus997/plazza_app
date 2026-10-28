import { router, StackRouter, type StackNavigationState, type StackActionType } from 'expo-router';
import { Keyboard } from 'react-native';
import { backTo, confirmOrder, openOrders, openPayment, openReceipt, returnToShop, reviewCheckout, stackOptions, quietStackOptions, returningScreenOptions } from '../src/navigation/commerceNavigation';

type Target = string | { pathname: string; params?: { id?: string } };
let mockApply: (type: string, target?: Target) => void;
let mockCanGoBack = () => false;
jest.mock('expo-router', () => ({
  StackRouter: jest.requireActual<typeof import('expo-router')>('expo-router').StackRouter,
  router: {
    navigate: jest.fn((target: Target) => mockApply('NAVIGATE', target)),
    replace: jest.fn((target: Target) => mockApply('REPLACE', target)),
    dismissTo: jest.fn((target: Target) => mockApply('POP_TO', target)),
    back: jest.fn(() => mockApply('GO_BACK')), canGoBack: () => mockCanGoBack(),
  },
}));
function navigation(initial = '(tabs)') {
  const routeNames = ['(tabs)', 'browse', 'checkout', 'payment', 'order-confirmation', 'orders/index', 'orders/[id]', 'addresses', 'address-form', 'app-permissions', 'scan-medicine'];
  const engine = StackRouter({});
  let state: StackNavigationState<Record<string, object | undefined>> = { stale: false, type: 'stack', key: 'root', routeKeySeq: 1,
    index: 0, routeNames, routes: [{ key: 'initial', name: initial }] };
  mockCanGoBack = () => state.index > 0;
  mockApply = (type, target) => {
    const path = typeof target === 'string' ? target : target?.pathname;
    const name = path === '/' || path === '/cart' ? '(tabs)' : path === '/orders' ? 'orders/index' : path?.slice(1);
    const action = { type, ...(name ? { payload: { name, params: typeof target === 'object' ? target.params : undefined } } : {}) };
    const result = engine.getStateForAction(state, action as StackActionType, { routeNames, routeGetIdList: {} });
    if (typeof result !== 'object' || !result) throw new Error(`Unhandled ${type}`);
    state = result.state;
  };
  return { names: () => state.routes.map((route) => route.name), state: () => state,
    checkout: () => mockApply('NAVIGATE', '/checkout') };
}
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

test('forward routes enter the stack and receipt Back pops to its actual origin', () => {
  const nav = navigation(); openOrders(); const historyKey = nav.state().routes.at(-1)?.key;
  openReceipt('order-1');
  expect(nav.names()).toEqual(['(tabs)', 'orders/index', 'orders/[id]']);
  backTo('/orders');
  expect(nav.names()).toEqual(['(tabs)', 'orders/index']);
  expect(nav.state().routes.at(-1)?.key).toBe(historyKey);
  expect(router.replace).not.toHaveBeenCalled();
});
test('Edit Cart and tab returns pop the existing tabs route instead of accumulating new stacks', () => {
  const nav = navigation(); const tabsKey = nav.state().routes[0].key;
  for (let index = 0; index < 3; index += 1) { nav.checkout(); openPayment(); returnToShop('cart'); }
  expect(nav.names()).toEqual(['(tabs)']);
  expect(nav.state().routes[0].key).toBe(tabsKey);
  expect(router.dismissTo).toHaveBeenLastCalledWith('/cart');
  returnToShop('home'); expect(nav.names()).toEqual(['(tabs)']);
});
test('rapid repeated Browse entries reuse one detail route and Back returns to the original tabs', () => {
  const previous = navigation(); mockApply('PUSH', '/browse'); mockApply('PUSH', '/browse');
  expect(previous.names()).toEqual(['(tabs)', 'browse', 'browse']);
  const nav = navigation(); const tabsKey = nav.state().routes[0].key;
  router.navigate('/browse'); router.navigate('/browse');
  expect(nav.names()).toEqual(['(tabs)', 'browse']);
  backTo('/');
  expect(nav.names()).toEqual(['(tabs)']);
  expect(nav.state().routes[0].key).toBe(tabsKey);
});
test('diagnostics and scan entries reuse their routes and Back retains the original Home stack', () => {
  const nav = navigation(); const tabsKey = nav.state().routes[0].key;
  for (const path of ['/app-permissions', '/scan-medicine'] as const) {
    router.navigate(path); router.navigate(path);
    expect(nav.names()).toEqual(['(tabs)', path.slice(1)]);
    backTo('/');
    expect(nav.names()).toEqual(['(tabs)']);
    expect(nav.state().routes[0].key).toBe(tabsKey);
  }
});
test('payment review uses an ancestor pop and repeated resume does not duplicate Payment', () => {
  const nav = navigation(); nav.checkout(); openPayment(); openPayment();
  expect(nav.names()).toEqual(['(tabs)', 'checkout', 'payment']);
  reviewCheckout(); expect(nav.names()).toEqual(['(tabs)', 'checkout']);
});
test('completed payment is replaced once; subsequent Back never reopens Pay', () => {
  const nav = navigation(); nav.checkout(); openPayment(); confirmOrder('order-1');
  expect(nav.names()).toEqual(['(tabs)', 'checkout', 'order-confirmation']);
  openReceipt('order-1'); backTo('/orders');
  expect(nav.names()).toEqual(['(tabs)', 'checkout', 'order-confirmation']);
  backTo('/'); backTo('/');
  expect(nav.names()).toEqual(['(tabs)']);
  expect(nav.names()).not.toContain('payment');
});
test('direct-link Back has a bounded fallback instead of creating another history entry', () => {
  const nav = navigation('orders/[id]'); backTo('/orders');
  expect(nav.names()).toEqual(['orders/index']);
  expect(router.dismissTo).toHaveBeenCalledWith('/orders');
});
test('address-form Back preserves the originating book key, and a direct-link fallback stays bounded', () => {
  const nav = navigation('addresses'); const bookKey = nav.state().routes[0].key;
  router.navigate('/address-form'); backTo('/addresses');
  expect(nav.names()).toEqual(['addresses']);
  expect(nav.state().routes[0].key).toBe(bookKey);
  const direct = navigation('address-form'); backTo('/addresses');
  expect(direct.names()).toEqual(['addresses']);
  backTo('/addresses'); expect(direct.names()).toEqual(['addresses']);
});
test('shared transition policy provides horizontal forward/reverse pops and reduced-motion fallback', () => {
  expect(stackOptions.animation).toBe('slide_from_right');
  expect(stackOptions.animationTypeForReplace).toBe('push');
  expect(returningScreenOptions.animationTypeForReplace).toBe('pop');
  expect(quietStackOptions.animation).toBe('none');
});
