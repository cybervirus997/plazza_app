import { act, type ReactNode } from 'react';
import { Alert, Keyboard, Platform, type PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance, type TestNode } from 'test-renderer';
import { router } from 'expo-router';
import { addressDraft, emptyAddressBook, type AddressBook, type AddressDraft } from '../src/domain/addresses';
import { AddressBookProvider, useAddressBook } from '../src/features/addresses/AddressBookProvider';
import AddressBookScreen from '../src/features/addresses/AddressBookScreen';
import AddressFormScreen from '../src/features/addresses/AddressFormScreen';
import { DeliveryAddressEntry } from '../src/features/addresses/DeliveryAddressEntry';
import { fetchDeliveryLocation, type PermissionSnapshot } from '../src/features/permissions/permissions';
import type { AddressRepository } from '../src/repositories/AddressRepository';
import { ADDRESS_STORAGE_KEY, createLocalAddressRepository } from '../src/repositories/local/LocalAddressRepository';
import type { StoragePort } from '../src/storage/persistence';

const mockParams: { id?: string } = {};
const mockDisablePrevention = jest.fn();
let mockPreventRemove: { prevented: boolean; callback?: (options: { repeat(): void }) => void };
const mockPermissions = { location: 'denied' as PermissionSnapshot['location'], notifications: 'unavailable' as PermissionSnapshot['notifications'],
  coordinates: null, locationMessage: 'Location access is off.', busy: false, checking: false, locating: false, error: null,
  request: jest.fn(), refresh: jest.fn(), openSettings: jest.fn(), updateLocation: jest.fn() };

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo-router', () => ({
  Stack: { Screen: jest.requireActual('./native-header').MockStackScreen },
  useFocusEffect: (effect: () => (() => void) | void) => { const React = jest.requireActual<typeof import('react')>('react'); React.useEffect(effect, [effect]); },
  router: { navigate: jest.fn(), push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
  usePreventRemove: (prevented: boolean, callback: (options: { repeat(): void }) => void) => {
    mockPreventRemove = { prevented, callback }; return mockDisablePrevention;
  },
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 72 }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: (props: { children: ReactNode }) => React.createElement('KeyboardAvoidingView', props, props.children) };
});
jest.mock('../src/features/permissions/PermissionProvider', () => ({ usePermissions: () => mockPermissions }));
jest.mock('../src/features/permissions/permissions', () => ({ fetchDeliveryLocation: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: (props: { children: ReactNode }) => {
  const React = jest.requireActual<typeof import('react')>('react');
  return React.createElement('SafeAreaView', props, props.children);
} }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const state = { pressed: false, hovered: false };
  return { __esModule: true, default: (props: PressableProps) => React.createElement('Pressable', props,
    typeof props.children === 'function' ? props.children(state) : props.children) };
});

function textContent(node: TestNode): string { return typeof node === 'string' ? node : node.children.map(textContent).join(''); }
function labelled(root: Root, label: string): TestInstance {
  const nodes = root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true });
  if (nodes.length !== 1) throw new Error(`Expected one ${label}, found ${nodes.length}`);
  return nodes[0];
}
function invoke(node: TestInstance, property: 'onPress' | 'onChangeText', value?: string) {
  const fn: unknown = node.props[property];
  if (typeof fn !== 'function') throw new Error(`Missing ${property}`);
  fn(value);
}
function storage() {
  const data = new Map<string, string>();
  const port: StoragePort = { getItem: jest.fn(async (key) => data.get(key) ?? null), setItem: jest.fn(async (key, value) => { data.set(key, value); }) };
  return { port, data };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const draft = (patch: Partial<AddressDraft> = {}): AddressDraft => ({ ...addressDraft(), addressLine: '42 Garden Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001', ...patch });
async function mount(repository: AddressRepository, screen: ReactNode = <AddressFormScreen />) {
  const root = createRoot();
  let context: ReturnType<typeof useAddressBook> | undefined;
  function Probe() { context = useAddressBook(); return null; }
  const render = () => root.render(<AddressBookProvider repository={repository}><Probe />{screen}</AddressBookProvider>);
  await act(async () => { render(); });
  const read = () => { if (!context) throw new Error('No address context'); return context; };
  return { root, read, render, unmount: () => act(async () => { root.unmount(); }) };
}
async function enterRequired(root: Root) {
  for (const [label, value] of [['Address line / building *', '42 Garden Road'], ['City *', 'Bengaluru'], ['State *', 'Karnataka'], ['PIN code *', '560001']]) {
    await act(async () => { invoke(labelled(root, label), 'onChangeText', value); });
  }
}

beforeEach(() => {
  delete mockParams.id;
  jest.clearAllMocks();
  jest.mocked(router.dismissTo).mockReset();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  mockPermissions.location = 'denied'; mockPermissions.checking = false; mockPermissions.busy = false;
  jest.mocked(fetchDeliveryLocation).mockReset().mockResolvedValue({ location: 'granted', coordinates: { latitude: 12, longitude: 77 }, locationMessage: 'Found' });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test.each(['denied', 'blocked'] as const)('manual add with %s GPS saves a selected/default address without a location call', async (permission) => {
  mockPermissions.location = permission;
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    expect(labelled(app.root, 'Use Current Location').props.accessibilityState).toMatchObject({ disabled: true });
    // Even a stale/programmatic press must not invoke GPS.
    await act(async () => { invoke(labelled(app.root, 'Use Current Location'), 'onPress'); });
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    await enterRequired(app.root);
    await act(async () => { invoke(labelled(app.root, "Dad's Home"), 'onPress'); });
    await act(async () => { invoke(labelled(app.root, 'Recipient relationship (optional)'), 'onChangeText', 'Parent'); });
    await act(async () => { invoke(labelled(app.root, 'MyGate'), 'onPress'); invoke(labelled(app.root, 'Call Before Arrival'), 'onPress'); });
    await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
    const saved = app.read().book.addresses[0];
    expect(saved).toMatchObject({ label: "Dad's Home", relationship: 'Parent', gateAccess: 'mygate', callBeforeArrival: true, coordinates: null });
    expect(app.read().book).toMatchObject({ defaultAddressId: saved.id, selectedAddressId: saved.id });
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(mockDisablePrevention).toHaveBeenCalled();
    expect((await createLocalAddressRepository(port).load()).book).toEqual(app.read().book);
  } finally { await app.unmount(); }
});

test('validation stays in the form, keeps input instances stable and does not write invalid data', async () => {
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    const input = labelled(app.root, 'Address line / building *');
    await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
    expect(textContent(app.root.container)).toContain('This field is required.');
    expect(textContent(app.root.container)).toContain('Review the highlighted fields');
    await act(async () => { invoke(input, 'onChangeText', 'Changed once'); });
    expect(labelled(app.root, 'Address line / building *')).toBe(input);
    expect(labelled(app.root, 'Address line / building *').props.value).toBe('Changed once');
    expect(port.setItem).not.toHaveBeenCalled();
  } finally { await app.unmount(); }
});

test.each(['android', 'ios'] as const)('address form accounts for the native header without double keyboard adjustment on %s', async (platform) => {
  jest.replaceProperty(Platform, 'OS', platform);
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    const safeArea = app.root.container.queryAll((node) => node.type === 'SafeAreaView')[0];
    expect(safeArea.props.edges).toEqual(['left', 'right', 'bottom']);
    const keyboard = app.root.container.queryAll((node) => node.type === 'KeyboardAvoidingView')[0];
    expect(keyboard.props).toMatchObject({ enabled: platform === 'ios', keyboardVerticalOffset: 72 });
    expect(keyboard.props.behavior).toBe(platform === 'ios' ? 'padding' : undefined);
    expect(app.root.container.queryAll((node) => node.props.testID === 'native-stack-header')).toHaveLength(1);
    expect(textContent(app.root.container)).toContain('Add address');
  } finally { await app.unmount(); }
});

test('editing preserves the ID and default while saving revised recipient, society and gate details', async () => {
  const { port } = storage();
  const repository = createLocalAddressRepository(port);
  const before = await repository.save(draft());
  mockParams.id = before.addresses[0].id;
  const app = await mount(repository);
  try {
    await act(async () => { invoke(labelled(app.root, 'Address label *'), 'onChangeText', "Mom's Place"); });
    await act(async () => { invoke(labelled(app.root, 'Society name'), 'onChangeText', 'Garden Heights'); });
    await act(async () => { invoke(labelled(app.root, 'Other society app'), 'onPress'); });
    await act(async () => { invoke(labelled(app.root, 'Society app name *'), 'onChangeText', 'Our Society'); });
    await act(async () => { invoke(labelled(app.root, 'Leave at Gate'), 'onPress'); });
    await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
    expect(app.read().book.addresses).toHaveLength(1);
    expect(app.read().book.addresses[0]).toMatchObject({ id: mockParams.id, label: "Mom's Place", society: 'Garden Heights', societyApp: 'Our Society', deliveryOption: 'gate' });
    expect(app.read().book.defaultAddressId).toBe(mockParams.id);
  } finally { await app.unmount(); }
});

test('saved-address cards select independently from default and delete through a confirmation', async () => {
  const { port } = storage();
  const repository = createLocalAddressRepository(port);
  await repository.save(draft());
  const book = await repository.save(draft({ label: 'Work' }));
  const app = await mount(repository, <AddressBookScreen />);
  try {
    await act(async () => { invoke(labelled(app.root, 'Deliver to Work, 42 Garden Road'), 'onPress'); });
    expect(app.read().book).toMatchObject({ defaultAddressId: book.addresses[0].id, selectedAddressId: book.addresses[1].id });
    await act(async () => { invoke(labelled(app.root, 'Make Work, 42 Garden Road default'), 'onPress'); });
    expect(app.read().book.defaultAddressId).toBe(book.addresses[1].id);
    await act(async () => { invoke(labelled(app.root, 'Delete Work, 42 Garden Road'), 'onPress'); });
    expect(app.read().book.addresses).toHaveLength(2);
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => { options?.find((option) => option.style === 'destructive')?.onPress?.(); });
    expect(app.read().book).toMatchObject({ defaultAddressId: book.addresses[0].id, selectedAddressId: book.addresses[0].id });
    expect(app.read().book.addresses).toHaveLength(1);
  } finally { await app.unmount(); }
});

test('current-location suggestions are editable, never auto-save, and ignore results after manual typing', async () => {
  mockPermissions.location = 'granted';
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    await act(async () => { invoke(labelled(app.root, 'Use Current Location'), 'onPress'); });
    expect(labelled(app.root, 'Latitude (optional)').props.value).toBe('12');
    expect(app.read().book.addresses).toHaveLength(0);
    expect(port.setItem).not.toHaveBeenCalled();
    const pending = deferred<Awaited<ReturnType<typeof fetchDeliveryLocation>>>();
    jest.mocked(fetchDeliveryLocation).mockReturnValue(pending.promise);
    await act(async () => { invoke(labelled(app.root, 'Use Current Location'), 'onPress'); });
    await act(async () => { invoke(labelled(app.root, 'Latitude (optional)'), 'onChangeText', '13'); });
    await act(async () => { pending.resolve({ location: 'granted', coordinates: { latitude: 80, longitude: 90 }, locationMessage: 'Late' }); });
    expect(labelled(app.root, 'Latitude (optional)').props.value).toBe('13');
    expect(port.setItem).not.toHaveBeenCalled();
    await enterRequired(app.root);
    await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
    expect(app.read().book.addresses[0].coordinates).toEqual({ latitude: 13, longitude: 77 });
  } finally { await app.unmount(); }
});

test('permission revocation cancels a pending suggestion without touching existing saved addresses', async () => {
  mockPermissions.location = 'granted';
  const { port } = storage();
  const repository = createLocalAddressRepository(port);
  const before = await repository.save(draft({ latitude: '11', longitude: '76' }));
  const pending = deferred<Awaited<ReturnType<typeof fetchDeliveryLocation>>>();
  jest.mocked(fetchDeliveryLocation).mockReturnValue(pending.promise);
  const app = await mount(repository);
  try {
    await act(async () => { invoke(labelled(app.root, 'Use Current Location'), 'onPress'); });
    await act(async () => { mockPermissions.location = 'blocked'; app.render(); });
    await act(async () => { pending.resolve({ location: 'granted', coordinates: { latitude: 80, longitude: 90 }, locationMessage: 'Late' }); });
    expect(labelled(app.root, 'Latitude (optional)').props.value).toBe('');
    expect(app.read().book).toEqual(before);
    expect((await repository.load()).book).toEqual(before);
  } finally { await app.unmount(); }
});

test('location errors leave manual entry available and pending suggestions are invalidated on unmount', async () => {
  mockPermissions.location = 'granted';
  const { port } = storage();
  jest.mocked(fetchDeliveryLocation).mockRejectedValueOnce(new Error('GPS timeout'));
  const app = await mount(createLocalAddressRepository(port));
  await act(async () => { invoke(labelled(app.root, 'Use Current Location'), 'onPress'); });
  expect(textContent(app.root.container)).toContain('could not be found');
  const pending = deferred<Awaited<ReturnType<typeof fetchDeliveryLocation>>>();
  jest.mocked(fetchDeliveryLocation).mockReturnValue(pending.promise);
  await act(async () => { invoke(labelled(app.root, 'Use Current Location'), 'onPress'); });
  const current = jest.mocked(fetchDeliveryLocation).mock.calls.at(-1)?.[0];
  await app.unmount();
  expect(current?.()).toBe(false);
  await act(async () => { pending.resolve({ location: 'granted', coordinates: { latitude: 1, longitude: 2 }, locationMessage: 'Late' }); });
  expect(port.setItem).not.toHaveBeenCalled();
});

test('Android Back uses the Router removal guard to preserve or explicitly discard an unsaved draft', async () => {
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    expect(mockPreventRemove.prevented).toBe(false);
    await act(async () => { invoke(labelled(app.root, 'City *'), 'onChangeText', 'Mysuru'); });
    expect(mockPreventRemove.prevented).toBe(true);
    const repeat = jest.fn();
    await act(async () => { mockPreventRemove.callback?.({ repeat }); });
    expect(repeat).not.toHaveBeenCalled();
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => { options?.find((option) => option.text === 'Discard')?.onPress?.(); });
    expect(repeat).toHaveBeenCalledTimes(1);
    expect(mockPreventRemove.prevented).toBe(false);
    expect(port.setItem).not.toHaveBeenCalled();
  } finally { await app.unmount(); }
});

test.each([false, true])('direct-link form Back uses a bounded address-book fallback (missing address: %s)', async (missing) => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  if (missing) mockParams.id = 'missing';
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    await act(async () => { invoke(labelled(app.root, missing ? 'Back to address book' : 'Back from address form'), 'onPress'); });
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/addresses');
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(port.setItem).not.toHaveBeenCalled();
  } finally { await app.unmount(); }
});

test('direct-link toolbar Back retains the removal guard until unsaved changes are explicitly discarded', async () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    await act(async () => { invoke(labelled(app.root, 'City *'), 'onChangeText', 'Mysuru'); });
    const repeat = jest.fn();
    jest.mocked(router.dismissTo).mockImplementationOnce(() => {
      expect(mockPreventRemove.prevented).toBe(true);
      mockPreventRemove.callback?.({ repeat });
    });
    await act(async () => { invoke(labelled(app.root, 'Back from address form'), 'onPress'); });
    expect(Alert.alert).toHaveBeenLastCalledWith('Discard address changes?', expect.any(String), expect.any(Array));
    expect(repeat).not.toHaveBeenCalled();
    expect(mockDisablePrevention).not.toHaveBeenCalled();
    expect(labelled(app.root, 'City *').props.value).toBe('Mysuru');
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => { options?.find((option) => option.text === 'Discard')?.onPress?.(); });
    expect(repeat).toHaveBeenCalledTimes(1);
    expect(mockPreventRemove.prevented).toBe(false);
    expect(port.setItem).not.toHaveBeenCalled();
  } finally { await app.unmount(); }
});

test('a direct-link save blocks Back while pending and returns only after the address is durable', async () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  const { port, data } = storage();
  const pending = deferred<void>();
  jest.mocked(port.setItem).mockImplementationOnce(async (key, value) => { await pending.promise; data.set(key, value); });
  const repository = createLocalAddressRepository(port);
  const app = await mount(repository);
  try {
    await enterRequired(app.root);
    await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
    expect(labelled(app.root, 'Back from address form').props.accessibilityState).toMatchObject({ disabled: true });
    const repeat = jest.fn();
    await act(async () => { mockPreventRemove.callback?.({ repeat }); });
    expect(Alert.alert).toHaveBeenLastCalledWith('Saving address', expect.any(String));
    expect(repeat).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(); });
    expect(app.read().book.addresses).toHaveLength(1);
    expect((await repository.load()).book).toEqual(app.read().book);
    expect(mockDisablePrevention).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/addresses');
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  } finally { await app.unmount(); }
});

test('loading and corrupt/failed storage show explicit states; retry is safe and manual entry is recoverable', async () => {
  const { port, data } = storage();
  const pending = deferred<string | null>();
  jest.mocked(port.getItem).mockReturnValueOnce(pending.promise);
  const app = await mount(createLocalAddressRepository(port), <AddressBookScreen />);
  try {
    expect(labelled(app.root, 'Loading address book')).toBeDefined();
    await act(async () => { pending.resolve('{broken'); });
    expect(textContent(app.root.container)).toContain('Some saved addresses could not be read');
    expect(textContent(app.root.container)).toContain('A place for every delivery');
    expect(port.setItem).not.toHaveBeenCalled();
    jest.mocked(port.getItem).mockRejectedValueOnce(new Error('disk failure'));
    await act(async () => { app.read().reload(); });
    expect(textContent(app.root.container)).toContain('Saved addresses could not be loaded');
    await act(async () => { invoke(labelled(app.root, 'Retry address book'), 'onPress'); });
    expect(app.read().ready).toBe(true);
    expect(data.size).toBe(0);
  } finally { await app.unmount(); }
});

test('write failures preserve form values and saved data; the user can retry without losing their draft', async () => {
  const { port } = storage();
  const app = await mount(createLocalAddressRepository(port));
  try {
    await enterRequired(app.root);
    jest.mocked(port.setItem).mockRejectedValueOnce(new Error('disk full'));
    await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
    expect(textContent(app.root.container)).toContain('could not be saved');
    expect(labelled(app.root, 'City *').props.value).toBe('Bengaluru');
    expect(app.read().book.addresses).toHaveLength(0);
    await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
    expect(app.read().book.addresses).toHaveLength(1);
  } finally { await app.unmount(); }
});

test('delivery entry opens the selector and snapshots stay detached from later edits', async () => {
  const { port, data } = storage();
  const repository = createLocalAddressRepository(port);
  const before = await repository.save(draft());
  const app = await mount(repository, <DeliveryAddressEntry />);
  try {
    await act(async () => { invoke(labelled(app.root, 'Choose delivery address'), 'onPress'); });
    expect(router.navigate).toHaveBeenCalledWith('/addresses');
    const snapshot = await app.read().snapshotForOrder();
    await act(async () => { await app.read().save(draft({ city: 'Mysuru' }), { id: before.addresses[0].id }); });
    expect(snapshot?.address.city).toBe('Bengaluru');
    expect((await app.read().snapshotForOrder())?.address.city).toBe('Mysuru');
    expect([...data.keys()]).toEqual([ADDRESS_STORAGE_KEY]);
  } finally { await app.unmount(); }
});

test('provider prevents duplicate saves and refuses an order snapshot during a pending mutation', async () => {
  const { port } = storage();
  const repository = createLocalAddressRepository(port);
  const pending = deferred<AddressBook>();
  const adapter: AddressRepository = { ...repository, save: jest.fn(() => pending.promise) };
  const app = await mount(adapter, null);
  try {
    let first: Promise<boolean> | undefined;
    await act(async () => {
      first = app.read().save(draft());
      await expect(app.read().snapshotForOrder()).rejects.toThrow('finish loading or saving');
      expect(await app.read().save(draft())).toBe(false);
    });
    expect(adapter.save).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(emptyAddressBook()); await first; });
    expect(app.read().busy).toBe(false);
  } finally { await app.unmount(); }
});

test('a snapshot immediately after an awaited save uses persisted fields even before React commits a render', async () => {
  const { port } = storage();
  const repository = createLocalAddressRepository(port);
  const before = await repository.save(draft());
  const app = await mount(repository, null);
  try {
    const actions = app.read();
    await act(async () => {
      expect(await actions.save(draft({ city: 'Mysuru' }), { id: before.addresses[0].id })).toBe(true);
      expect((await actions.snapshotForOrder())?.address.city).toBe('Mysuru');
    });
  } finally { await app.unmount(); }
});

test('leaving a form during an authorized save never navigates back or renders a late UI result', async () => {
  const { port } = storage();
  const repository = createLocalAddressRepository(port);
  const pending = deferred<AddressBook>();
  const adapter: AddressRepository = { ...repository, save: jest.fn(() => pending.promise) };
  const app = await mount(adapter);
  await enterRequired(app.root);
  await act(async () => { invoke(labelled(app.root, 'Save address'), 'onPress'); });
  const actions = app.read();
  await app.unmount();
  await act(async () => { pending.resolve(emptyAddressBook()); });
  expect(router.back).not.toHaveBeenCalled();
  expect(await actions.save(draft())).toBe(false);
  expect(adapter.save).toHaveBeenCalledTimes(1);
});

test('recovered selections require review before order snapshots and can be explicitly confirmed', async () => {
  const { port, data } = storage();
  const repository = createLocalAddressRepository(port);
  const original = await repository.save(draft());
  data.set(ADDRESS_STORAGE_KEY, JSON.stringify({ ...original, selectedAddressId: 'missing' }));
  const app = await mount(repository, <><DeliveryAddressEntry /><AddressBookScreen /></>);
  try {
    expect(textContent(app.root.container)).toContain('Review your saved delivery addresses');
    await expect(app.read().snapshotForOrder()).rejects.toThrow('Review your saved addresses');
    const confirm = labelled(app.root, 'Deliver to Home, 42 Garden Road');
    expect(confirm.props.accessibilityState).toMatchObject({ disabled: false });
    await act(async () => { invoke(confirm, 'onPress'); });
    expect(app.read().warning).toBeNull();
    expect((await app.read().snapshotForOrder())?.address.id).toBe(original.addresses[0].id);
  } finally { await app.unmount(); }
});
