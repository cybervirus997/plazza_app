import { act, useEffect, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { AppState, Keyboard, type PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance, type TestNode } from 'test-renderer';
import HomeScreen from '../src/features/home/HomeScreen';
import AppPermissionsScreen from '../src/features/permissions/AppPermissionsScreen';
import ScanDemoScreen from '../src/features/scan/ScanDemoScreen';
import { PermissionProvider, usePermissions } from '../src/features/permissions/PermissionProvider';
import { fetchDeliveryLocation, initialPermissions, openPermissionSettings, readPermissions, requestPermissions,
  type PermissionSnapshot } from '../src/features/permissions/permissions';
import { AppStateProvider, useShopping } from '../src/state/AppStateProvider';
import { AddressBookProvider, useAddressBook } from '../src/features/addresses/AddressBookProvider';
import { createLocalAddressRepository, ADDRESS_STORAGE_KEY } from '../src/repositories/local/LocalAddressRepository';
import { addressDraft } from '../src/domain/addresses';
import { orderStorage } from './order-fixtures';

let mockNavigate: (path: string) => void = () => {};
jest.mock('expo-router', () => ({
  Stack: { Screen: jest.requireActual('./native-header').MockStackScreen },
  router: { navigate: jest.fn((path: string) => mockNavigate(path)), canGoBack: jest.fn(() => true),
    back: jest.fn(() => mockNavigate('/')), dismissTo: jest.fn((path: string) => mockNavigate(path)) },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('../src/features/permissions/permissions', () => ({
  ...jest.requireActual<typeof import('../src/features/permissions/permissions')>('../src/features/permissions/permissions'),
  readPermissions: jest.fn(), requestPermissions: jest.fn(), fetchDeliveryLocation: jest.fn(), openPermissionSettings: jest.fn(),
}));
jest.mock('expo-camera', () => { throw new Error('The scan demo must never load a camera module.'); }, { virtual: true });
jest.mock('react-native/Libraries/AppState/AppState', () => ({ __esModule: true,
  default: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: (props: PressableProps) => React.createElement('Pressable', props,
    typeof props.children === 'function' ? props.children({ pressed: false, hovered: false }) : props.children) };
});

const denied: PermissionSnapshot = { ...initialPermissions, location: 'denied', notifications: 'unavailable', locationMessage: 'Location access is off.' };
const granted: PermissionSnapshot = { ...denied, location: 'granted' };
const fix = { location: 'granted' as const, coordinates: { latitude: 12.3456, longitude: 77.1234 }, locationMessage: 'Device GPS: 12.3456, 77.1234' };
function content(node: TestNode): string { return typeof node === 'string' ? node : node.children.map(content).join(''); }
function labelled(root: Root, label: string): TestInstance {
  const nodes = root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true });
  if (nodes.length !== 1) throw new Error(`Expected one ${label}, found ${nodes.length}`);
  return nodes[0];
}
function invoke(node: TestInstance, property: 'onPress' | 'onChangeText' | 'onSubmitEditing', value?: string) {
  const handler: unknown = node.props[property];
  if (typeof handler !== 'function') throw new Error(`Missing ${property}`);
  handler(value);
}
async function setup(saved = false) {
  const memory = orderStorage();
  const repository = createLocalAddressRepository(memory.port);
  if (saved) {
    const selected = await repository.save({ ...addressDraft(), label: 'Home', addressLine: '42 Garden Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001' }, { select: true });
    await repository.save({ ...addressDraft(), label: 'Work', addressLine: '99 Office Street', city: 'Bengaluru', state: 'Karnataka', pinCode: '560002' }, { makeDefault: true });
    await repository.select(selected.addresses[0].id);
  }
  const originalAddressBytes = memory.data.get(ADDRESS_STORAGE_KEY);
  const root = createRoot();
  let current: { permissions: ReturnType<typeof usePermissions>; shopping: ReturnType<typeof useShopping>; addresses: ReturnType<typeof useAddressBook> } | undefined;
  let path = '/';
  function Probe() { current = { permissions: usePermissions(), shopping: useShopping(), addresses: useAddressBook() }; return null; }
  // Like a covered native tabs screen, Home stays mounted while a detail/modal is open.
  function Screens() {
    const [route, setRoute] = useState('/');
    useEffect(() => { mockNavigate = (next) => { path = next; setRoute(next); }; return () => { mockNavigate = () => {}; }; }, []);
    return <><HomeScreen />{route === '/app-permissions' ? <AppPermissionsScreen /> : route === '/scan-medicine' ? <ScanDemoScreen /> : null}</>;
  }
  const render = () => root.render(<AppStateProvider storage={memory.port}><AddressBookProvider repository={repository}>
    <PermissionProvider><Probe /><Screens /></PermissionProvider>
  </AddressBookProvider></AppStateProvider>);
  await act(async () => { render(); });
  const read = () => { if (!current) throw new Error('Missing providers'); return current; };
  return { root, read, memory, originalAddressBytes, render, path: () => path, text: () => content(root.container),
    tap: (label: string) => act(async () => { invoke(labelled(root, label), 'onPress'); }),
    unmount: () => act(async () => { root.unmount(); }) };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(readPermissions).mockReset().mockResolvedValue(denied);
  jest.mocked(requestPermissions).mockReset().mockResolvedValue(granted);
  jest.mocked(fetchDeliveryLocation).mockReset().mockResolvedValue(fix);
  jest.mocked(openPermissionSettings).mockReset().mockResolvedValue(undefined);
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test.each(['denied', 'granted'] as const)('Home uses the selected saved address, not default or GPS, with %s access', async (location) => {
  jest.mocked(readPermissions).mockResolvedValue({ ...denied, location });
  const app = await setup(true);
  try {
    expect(app.text()).toContain('DELIVER TO · Home');
    expect(app.text()).toContain('42 Garden Road, Bengaluru, 560001');
    expect(app.text()).not.toContain('99 Office Street');
    expect(app.text()).toContain('Change');
    expect(app.text()).not.toContain('Device GPS');
    expect(app.text()).not.toContain('Enable access');
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    if (location === 'granted') {
      await act(async () => { app.read().permissions.updateLocation(); });
      expect(app.read().permissions.coordinates).toEqual(fix.coordinates);
      expect(app.text()).not.toContain('12.3456');
    }
    expect(app.memory.data.get(ADDRESS_STORAGE_KEY)).toBe(app.originalAddressBytes);
    expect(app.read().addresses.selected?.label).toBe('Home');
    expect(app.read().addresses.book.defaultAddressId).not.toBe(app.read().addresses.selected?.id);
    const add = app.root.container.queryAll((node) => node.props.accessibilityLabel === 'Add Dolo 650 to cart', { matchDeepestOnly: true });
    expect(add.length).toBeGreaterThan(0);
    await act(async () => { invoke(add[0], 'onPress'); });
    expect(app.read().shopping.itemCount).toBe(1);
  } finally { await app.unmount(); }
});

test('Home without a saved address offers manual selection while search and categories remain available', async () => {
  const app = await setup();
  try {
    expect(app.text()).toContain('Choose Delivery Address');
    labelled(app.root, 'Search medicines by name or salt');
    labelled(app.root, 'Browse Baby care');
    await app.tap('Choose delivery address');
    expect(router.navigate).toHaveBeenCalledWith('/addresses');
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    expect(app.memory.data.has(ADDRESS_STORAGE_KEY)).toBe(false);
  } finally { await app.unmount(); }
});

test('medicine search and categories precede the existing promotion and product shelves', async () => {
  const app = await setup();
  try {
    const text = app.text();
    expect(text.indexOf('Find your medicines')).toBeLessThan(text.indexOf('Shop by category'));
    expect(text.indexOf('Shop by category')).toBeLessThan(text.indexOf('A little care, every day'));
    expect(text).toContain('Explore medicines');
    expect(text).not.toContain('YOUR DELIVERY LOCATION');
    expect(text).not.toContain('Location: denied');
  } finally { await app.unmount(); }
});

test('the discoverable diagnostics route refreshes status and exposes Settings without prompting or acquiring GPS', async () => {
  const app = await setup(true);
  try {
    await app.tap('App permissions and diagnostics');
    expect(app.path()).toBe('/app-permissions');
    expect(app.text()).toContain('App permissions');
    expect(app.text()).toContain('Android Expo Go skips the notifications module');
    jest.mocked(readPermissions).mockResolvedValue({ ...denied, location: 'blocked' });
    await app.tap('Refresh');
    expect(app.read().permissions.location).toBe('blocked');
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    await app.tap('Open Settings');
    expect(openPermissionSettings).toHaveBeenCalledTimes(1);
    expect(app.memory.data.get(ADDRESS_STORAGE_KEY)).toBe(app.originalAddressBytes);
    await app.tap('Back from app permissions');
    expect(app.path()).toBe('/');
  } finally { await app.unmount(); }
});

test('diagnostics explicitly enables access and shows separate authorized GPS fields without changing delivery selection', async () => {
  const app = await setup(true);
  try {
    await app.tap('App permissions and diagnostics');
    await app.tap('Enable access');
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
    expect(app.text()).toContain('Device GPS · optional');
    expect(app.text()).toContain('Latitude: 12.3456');
    expect(app.text()).toContain('Longitude: 77.1234');
    expect(app.text()).not.toContain('Delivering to:');
    expect(app.memory.data.get(ADDRESS_STORAGE_KEY)).toBe(app.originalAddressBytes);
    jest.mocked(readPermissions).mockResolvedValue(granted);
    await app.tap('Refresh');
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
    await app.tap('Update Location');
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(2);
  } finally { await app.unmount(); }
});

test('query and input identity survive results, permission updates, scan launch/sample/dismissal and keyboard dismissal', async () => {
  jest.useFakeTimers();
  const app = await setup(true);
  try {
    const input = labelled(app.root, 'Search medicines by name or salt');
    await act(async () => { invoke(input, 'onChangeText', 'dolo'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    const before = app.read().shopping.state;
    await app.tap('Scan medicine');
    expect(app.path()).toBe('/scan-medicine');
    expect(app.text()).toContain('Demo only — no authenticity verification');
    await app.tap('Try sample scan');
    expect(app.text()).toContain('Synthetic sample result');
    expect(app.text()).toContain('Example Demo Labs — fictional company');
    expect(app.text()).toContain('DEMO-BATCH-001 — synthetic identifier');
    expect(app.text()).not.toMatch(/authenticity verified|batch validated|manufacturer verified/iu);
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    await app.tap('Start again');
    expect(app.text()).not.toContain('Synthetic sample result');
    await app.tap('Close medicine scan');
    expect(app.path()).toBe('/');
    jest.mocked(readPermissions).mockResolvedValue({ ...denied, notifications: 'denied' });
    await act(async () => { app.read().permissions.refresh(); Keyboard.dismiss(); app.render(); });
    expect(labelled(app.root, 'Search medicines by name or salt')).toBe(input);
    expect(input.props.value).toBe('dolo');
    expect(app.read().shopping.state.cart).toEqual(before.cart);
    expect(app.read().shopping.state.usedCouponCodes).toEqual(before.usedCouponCodes);
    expect(app.read().shopping.state.recentSearches).toEqual(before.recentSearches);
  } finally { await app.unmount(); }
});

test('scan Close has a bounded Home fallback when opened without history', async () => {
  const app = await setup();
  try {
    await app.tap('Scan medicine');
    jest.mocked(router.canGoBack).mockReturnValueOnce(false);
    await app.tap('Close medicine scan');
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(app.path()).toBe('/');
    expect(requestPermissions).not.toHaveBeenCalled();
  } finally { await app.unmount(); }
});
