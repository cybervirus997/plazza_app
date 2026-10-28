import { act, StrictMode } from 'react';
import { AppState, Linking, Platform, type AppStateStatus, type PressableProps } from 'react-native';
import { createRoot, type Root } from 'test-renderer';

import { DeliveryLocation, PermissionPanel } from '../src/features/permissions/PermissionPanel';
import { PermissionProvider, usePermissions } from '../src/features/permissions/PermissionProvider';
import { fetchDeliveryLocation, initialPermissions, readPermissions, requestInitialPermissions, requestPermissions,
  type PermissionSnapshot } from '../src/features/permissions/permissions';

jest.mock('../src/features/permissions/permissions', () => ({
  ...jest.requireActual<typeof import('../src/features/permissions/permissions')>('../src/features/permissions/permissions'),
  fetchDeliveryLocation: jest.fn(), readPermissions: jest.fn(), requestInitialPermissions: jest.fn(), requestPermissions: jest.fn(),
}));
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true, default: { currentState: 'active', addEventListener: jest.fn() },
}));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const state = { pressed: false, hovered: false };
  return { __esModule: true, default: (props: PressableProps) => React.createElement('Pressable', props,
    typeof props.children === 'function' ? props.children(state) : props.children) };
});

const granted: PermissionSnapshot = { ...initialPermissions, location: 'granted', notifications: 'granted',
  locationMessage: 'Location access is enabled.' };
const denied: PermissionSnapshot = { ...granted, location: 'denied', coordinates: null, locationMessage: 'Location access is off.' };
const fix = { location: 'granted' as const, coordinates: { latitude: 12.3, longitude: 45.6 }, locationMessage: 'Delivering to: 12.3000, 45.6000' };
let change: (state: AppStateStatus) => void;
let focus: () => void;
let blur: () => void;
let remove: jest.Mock;

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Not initialized'); };
  let reject: (error: Error) => void = () => { throw new Error('Not initialized'); };
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function setup(strict = false) {
  const root = createRoot();
  let current: ReturnType<typeof usePermissions> | undefined;
  const renders = jest.fn();
  function Probe() {
    current = usePermissions();
    renders();
    return <><DeliveryLocation /><PermissionPanel /></>;
  }
  await act(async () => {
    const content = <PermissionProvider><Probe /></PermissionProvider>;
    root.render(strict ? <StrictMode>{content}</StrictMode> : content);
  });
  const read = () => {
    if (!current) throw new Error('Provider did not render.');
    return current;
  };
  return { root, read, renders, unmount: () => act(async () => { root.unmount(); }) };
}

const transition = (state: AppStateStatus) => act(async () => {
  jest.replaceProperty(AppState, 'currentState', state);
  change(state);
});
const labelled = (root: Root, label: string) => root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.mocked(readPermissions).mockReset().mockResolvedValue(granted);
  jest.mocked(requestInitialPermissions).mockReset().mockResolvedValue(granted);
  jest.mocked(requestPermissions).mockReset().mockResolvedValue(granted);
  jest.mocked(fetchDeliveryLocation).mockReset().mockResolvedValue(fix);
  jest.replaceProperty(AppState, 'currentState', 'active');
  jest.replaceProperty(Platform, 'OS', 'android');
  remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') change = listener;
    if (event === 'focus') focus = () => listener('active');
    if (event === 'blur') blur = () => listener('inactive');
    return { remove };
  });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});

test('initial authorized setup fetches once; repeated Refresh only reads status and preserves the fix', async () => {
  const screen = await setup();
  try {
    expect(screen.read().coordinates).toEqual(fix.coordinates);
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
    await act(async () => { screen.read().refresh(); screen.read().refresh(); screen.read().request(); });
    expect(readPermissions).toHaveBeenCalledTimes(1);
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
    expect(screen.read().coordinates).toEqual(fix.coordinates);
    expect(labelled(screen.root, 'Update Location')).toHaveLength(1);
    await act(async () => { screen.read().updateLocation(); });
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(2);
  } finally { await screen.unmount(); }
});

test.each(['denied', 'blocked', 'unavailable'] as const)('%s location never starts GPS or exposes Update Location', async (location) => {
  jest.mocked(requestInitialPermissions).mockResolvedValue({ ...denied, location });
  const screen = await setup();
  try {
    await act(async () => { screen.read().updateLocation(); });
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    expect(labelled(screen.root, 'Update Location')).toHaveLength(0);
    expect(screen.read().coordinates).toBeNull();
  } finally { await screen.unmount(); }
});

test('newly granted permission after Enable access fetches once; duplicate taps do not duplicate prompts', async () => {
  jest.mocked(requestInitialPermissions).mockResolvedValue(denied);
  const pending = deferred<PermissionSnapshot>();
  jest.mocked(requestPermissions).mockReturnValue(pending.promise);
  const screen = await setup();
  try {
    await act(async () => { screen.read().request(); screen.read().request(); screen.read().refresh(); });
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(granted); });
    expect(screen.read().location).toBe('granted');
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
  } finally { await screen.unmount(); }
});

test('returning from Settings newly granted fetches once, then ordinary background returns only recheck status', async () => {
  jest.mocked(requestInitialPermissions).mockResolvedValue({ ...denied, location: 'blocked' });
  const screen = await setup();
  try {
    await act(async () => { screen.read().openSettings(); screen.read().openSettings(); });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    await transition('background');
    await transition('active');
    expect(screen.read().coordinates).toEqual(fix.coordinates);
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
    await transition('background');
    expect(screen.read().coordinates).toBeNull();
    await transition('active');
    expect(screen.read().coordinates).toEqual(fix.coordinates);
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
    expect(requestPermissions).not.toHaveBeenCalled();
  } finally { await screen.unmount(); }
});

test('revocation hides coordinates immediately while status is pending and never restores a late GPS fix', async () => {
  const pendingFix = deferred<Awaited<ReturnType<typeof fetchDeliveryLocation>>>();
  const pendingStatus = deferred<PermissionSnapshot>();
  const screen = await setup();
  try {
    jest.mocked(fetchDeliveryLocation).mockReturnValue(pendingFix.promise);
    await act(async () => { screen.read().updateLocation(); screen.read().updateLocation(); });
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(2);
    jest.mocked(readPermissions).mockReturnValue(pendingStatus.promise);
    await transition('background');
    expect(screen.read().coordinates).toBeNull();
    await transition('active');
    expect(screen.read().coordinates).toBeNull();
    await act(async () => { pendingStatus.resolve({ ...denied, location: 'blocked' }); });
    expect(screen.read().location).toBe('blocked');
    await act(async () => { pendingFix.resolve(fix); });
    expect(screen.read().coordinates).toBeNull();
    expect(screen.read().locationMessage).not.toContain('Delivering to');
  } finally { await screen.unmount(); }
});

test('Refresh detects revocation during GPS acquisition without waiting for the GPS promise', async () => {
  const pendingFix = deferred<Awaited<ReturnType<typeof fetchDeliveryLocation>>>();
  jest.mocked(fetchDeliveryLocation).mockReturnValue(pendingFix.promise);
  const screen = await setup();
  try {
    expect(screen.read().locating).toBe(true);
    jest.mocked(readPermissions).mockResolvedValue(denied);
    await act(async () => { screen.read().refresh(); });
    expect(screen.read().location).toBe('denied');
    await act(async () => { pendingFix.resolve(fix); });
    expect(screen.read().location).toBe('denied');
    expect(screen.read().coordinates).toBeNull();
  } finally { await screen.unmount(); }
});

test('resume events during an initial native request coalesce into one fresh check and discard stale status', async () => {
  const pending = deferred<PermissionSnapshot>();
  jest.mocked(requestInitialPermissions).mockReturnValue(pending.promise);
  jest.mocked(readPermissions).mockResolvedValue(denied);
  const screen = await setup();
  try {
    await transition('inactive');
    await transition('background');
    await transition('active');
    await transition('active');
    expect(readPermissions).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(granted); });
    expect(readPermissions).toHaveBeenCalledTimes(1);
    expect(screen.read().location).toBe('denied');
    expect(fetchDeliveryLocation).not.toHaveBeenCalled();
    expect(screen.read().checking).toBe(false);
  } finally { await screen.unmount(); }
});

test('permission read failures release busy state and Refresh can recover', async () => {
  const screen = await setup();
  try {
    jest.mocked(readPermissions).mockRejectedValueOnce(new Error('native read failed'));
    await act(async () => { screen.read().refresh(); });
    expect(screen.read().busy).toBe(false);
    expect(screen.read().coordinates).toBeNull();
    expect(screen.read().error).toContain('could not be checked');
    await act(async () => { screen.read().refresh(); });
    expect(screen.read().error).toBeNull();
    expect(screen.read().coordinates).toEqual(fix.coordinates);
  } finally { await screen.unmount(); }
});

test('an unexpected location failure releases the location action and can be retried explicitly', async () => {
  jest.mocked(fetchDeliveryLocation).mockRejectedValueOnce(new Error('native location failed'));
  const screen = await setup();
  try {
    expect(screen.read().busy).toBe(false);
    expect(screen.read().locationMessage).toContain('Could not find');
    await act(async () => { screen.read().updateLocation(); });
    expect(screen.read().coordinates).toEqual(fix.coordinates);
  } finally { await screen.unmount(); }
});

test('Settings launch errors are visible and a later successful attempt clears the error', async () => {
  const screen = await setup();
  try {
    jest.mocked(Linking.openSettings).mockRejectedValueOnce(new Error('no activity'));
    await act(async () => { screen.read().openSettings(); });
    expect(screen.read().error).toContain('Settings could not be opened');
    expect(screen.read().checking).toBe(false);
    await act(async () => { screen.read().openSettings(); });
    expect(screen.read().error).toBeNull();
    await transition('background');
    await transition('active');
    expect(screen.read().checking).toBe(false);
  } finally { await screen.unmount(); }
});

test('unmount removes the listener, invalidates a pending fix and makes old actions inert', async () => {
  const pending = deferred<Awaited<ReturnType<typeof fetchDeliveryLocation>>>();
  jest.mocked(fetchDeliveryLocation).mockReturnValue(pending.promise);
  const screen = await setup();
  const beforeUnmount = screen.read();
  const isCurrent = jest.mocked(fetchDeliveryLocation).mock.calls[0][0];
  expect(isCurrent?.()).toBe(true);
  await screen.unmount();
  const renders = screen.renders.mock.calls.length;
  expect(isCurrent?.()).toBe(false);
  await act(async () => {
    pending.resolve(fix);
    beforeUnmount.refresh(); beforeUnmount.request(); beforeUnmount.openSettings(); beforeUnmount.updateLocation();
  });
  expect(remove).toHaveBeenCalledTimes(3);
  expect(screen.renders).toHaveBeenCalledTimes(renders);
  expect(readPermissions).not.toHaveBeenCalled();
  expect(Linking.openSettings).not.toHaveBeenCalled();
});

test('unmount during a status read or a failed Settings launch never renders late state', async () => {
  const pending = deferred<PermissionSnapshot>();
  const settings = deferred<void>();
  const screen = await setup();
  jest.mocked(readPermissions).mockReturnValue(pending.promise);
  jest.mocked(Linking.openSettings).mockReturnValue(settings.promise);
  await act(async () => { screen.read().refresh(); screen.read().openSettings(); });
  await screen.unmount();
  const renders = screen.renders.mock.calls.length;
  await act(async () => { pending.resolve(denied); settings.reject(new Error('late failure')); });
  expect(screen.renders).toHaveBeenCalledTimes(renders);
});

test('StrictMode cleanup cannot apply the first effect lifetime’s asynchronous result', async () => {
  const old = deferred<PermissionSnapshot>();
  jest.mocked(requestInitialPermissions).mockReturnValueOnce(old.promise).mockResolvedValue(granted);
  const screen = await setup(true);
  try {
    await act(async () => { old.resolve(denied); });
    expect(screen.read().location).toBe('granted');
    expect(screen.read().coordinates).toEqual(fix.coordinates);
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
  } finally { await screen.unmount(); }
});

test('Android blur/focus rechecks without new GPS or duplicate work when AppState stays active', async () => {
  const screen = await setup();
  try {
    await act(async () => { blur(); });
    expect(screen.read().coordinates).toBeNull();
    await act(async () => { focus(); focus(); });
    expect(readPermissions).toHaveBeenCalledTimes(1);
    expect(screen.read().coordinates).toEqual(fix.coordinates);
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
  } finally { await screen.unmount(); }
});

test('revocation detected by GPS invalidates an older pending permission read', async () => {
  const pendingFix = deferred<Awaited<ReturnType<typeof fetchDeliveryLocation>>>();
  const oldStatus = deferred<PermissionSnapshot>();
  jest.mocked(fetchDeliveryLocation).mockReturnValue(pendingFix.promise);
  const screen = await setup();
  try {
    jest.mocked(readPermissions).mockReturnValueOnce(oldStatus.promise).mockResolvedValue(denied);
    await act(async () => { screen.read().refresh(); });
    await act(async () => { pendingFix.resolve(denied); });
    await act(async () => { oldStatus.resolve(granted); });
    expect(screen.read().location).toBe('denied');
    expect(screen.read().coordinates).toBeNull();
    expect(screen.read().busy).toBe(false);
    expect(fetchDeliveryLocation).toHaveBeenCalledTimes(1);
    expect(readPermissions).toHaveBeenCalledTimes(2);
  } finally { await screen.unmount(); }
});

test('a delayed Settings error cannot overwrite a fresh state after returning to the app', async () => {
  const pending = deferred<void>();
  jest.mocked(Linking.openSettings).mockReturnValue(pending.promise);
  const screen = await setup();
  try {
    await act(async () => { screen.read().openSettings(); });
    await transition('background');
    await transition('active');
    await act(async () => { pending.reject(new Error('late Settings error')); });
    expect(screen.read().error).toBeNull();
    expect(screen.read().checking).toBe(false);
  } finally { await screen.unmount(); }
});

test('a Settings launch timeout releases the UI and cannot start a duplicate native launch', async () => {
  jest.useFakeTimers();
  const pending = deferred<void>();
  jest.mocked(Linking.openSettings).mockReturnValue(pending.promise);
  const screen = await setup();
  try {
    await act(async () => { screen.read().openSettings(); });
    await act(async () => { await jest.advanceTimersByTimeAsync(8000); });
    expect(screen.read().error).toContain('Settings could not be opened');
    expect(screen.read().checking).toBe(false);
    await act(async () => { screen.read().openSettings(); });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(); });
    await transition('background');
    await transition('active');
    expect(screen.read().checking).toBe(false);
  } finally {
    await screen.unmount();
    jest.useRealTimers();
  }
});
