import { act, type ReactNode } from 'react';
import type { PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance, type TestNode } from 'test-renderer';

import CartScreen from '../src/features/cart/CartScreen';
import HomeScreen from '../src/features/search/HomeScreen';
import BrowseScreen from '../src/features/search/BrowseScreen';
import { catalogData } from '../src/data/catalog';
import { decodeSnapshot } from '../src/storage/persistence';
import { AppStateProvider } from '../src/state/AppStateProvider';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  router: { navigate: jest.fn(), push: jest.fn() },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../src/features/permissions/PermissionPanel', () => ({
  DeliveryLocation: () => null, PermissionPanel: () => null,
}));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: PressableProps) => React.createElement('Pressable', props,
      typeof props.children === 'function' ? props.children({ pressed: false, hovered: false }) : props.children),
  };
});

function textContent(node: TestNode): string {
  return typeof node === 'string' ? node : node.children.map(textContent).join('');
}

function labelled(root: Root, label: string): TestInstance[] {
  return root.container.queryAll((node) => node.props.accessibilityLabel === label,
    { matchDeepestOnly: true });
}

function invoke(node: TestInstance, property: 'onPress' | 'onChangeText' | 'onSubmitEditing', value?: string) {
  const handler: unknown = node.props[property];
  if (typeof handler !== 'function') throw new Error(`Missing ${property} handler.`);
  handler(value);
}

function recentSearches() {
  const raw = jest.mocked(AsyncStorage.setItem).mock.calls.at(-1)?.[1];
  expect(raw).toBeDefined();
  return decodeSnapshot(raw ?? null, catalogData.medicines).recentSearches;
}

beforeEach(() => jest.clearAllMocks());

test('Home searches the supplied names/salts and Add keeps Home and Cart quantities synchronized', async () => {
  jest.useFakeTimers();
  const root = createRoot();
  try {
    await act(async () => {
      root.render(<AppStateProvider><HomeScreen /><CartScreen /></AppStateProvider>);
    });
    const search = labelled(root, 'Search medicines by name or salt')[0];
    await act(async () => { invoke(search, 'onChangeText', '  dolo  '); });
    await act(async () => { await jest.advanceTimersByTimeAsync(250); });
    expect(textContent(root.container)).toContain('Dolo 650');
    const add = labelled(root, 'Add Dolo 650 to cart');
    expect(add).toHaveLength(1);
    expect(add[0].props.accessibilityState).toMatchObject({ disabled: false });
    await act(async () => { invoke(add[0], 'onPress'); });
    expect(labelled(root, 'Dolo 650, quantity 1')).toHaveLength(2);

    await act(async () => { invoke(search, 'onChangeText', '  PARACETAMOL  '); });
    await act(async () => { await jest.advanceTimersByTimeAsync(250); });
    expect(textContent(root.container)).toContain('Crocin Advance');
    expect(textContent(root.container)).toContain('Calpol 500');
    expect(labelled(root, 'Add Crocin Advance to cart')).toHaveLength(1);
    expect(labelled(root, 'Add Azithral 500 to cart')).toHaveLength(0);
    const increase = labelled(root, 'Increase Dolo 650 quantity');
    expect(increase).toHaveLength(2);
    await act(async () => { invoke(increase[0], 'onPress'); });
    expect(labelled(root, 'Dolo 650, quantity 2')).toHaveLength(2);
  } finally {
    await act(async () => { root.unmount(); });
    jest.useRealTimers();
  }
});
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

test('Home previews real medicines without typing and opens Browse without recording a search', async () => {
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><HomeScreen /></AppStateProvider>); });
    expect(textContent(root.container)).toContain('15 medicines in the catalog');
    expect(labelled(root, 'Add Dolo 650 to cart')).toHaveLength(1);
    expect(labelled(root, 'Add Azithral 500 to cart')).toHaveLength(1);
    expect(textContent(root.container)).toContain('Rx · Prescription required');
    await act(async () => { invoke(labelled(root, 'Browse all medicines')[0], 'onPress'); });
    expect(router.push).toHaveBeenCalledWith('/browse');
    expect(recentSearches()).toEqual([]);
  } finally { await act(async () => { root.unmount(); }); }
});

test('autocomplete caps suggestions at six and selecting a medicine commits only its name', async () => {
  jest.useFakeTimers();
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><HomeScreen /></AppStateProvider>); });
    const search = labelled(root, 'Search medicines by name or salt')[0];
    await act(async () => { invoke(search, 'onChangeText', 'a'); });
    expect(textContent(root.container)).toContain('Finding matching medicines');
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    const suggestions = root.container.queryAll((node) => typeof node.props.accessibilityLabel === 'string'
      && node.props.accessibilityLabel.startsWith('Show '), { matchDeepestOnly: true });
    expect(suggestions).toHaveLength(6);
    expect(recentSearches()).toEqual([]);

    await act(async () => { invoke(search, 'onChangeText', 'dol'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    const dolo = labelled(root, 'Show Dolo 650, Paracetamol, ₹30')[0];
    expect(dolo).toBeDefined();
    await act(async () => { invoke(dolo, 'onPress'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(textContent(root.container)).toContain('Selected medicine');
    expect(labelled(root, 'Add Dolo 650 to cart')).toHaveLength(1);
    expect(labelled(root, 'Add Crocin Advance to cart')).toHaveLength(0);
    expect(recentSearches()).toEqual(['Dolo 650']);

    await act(async () => { invoke(labelled(root, 'Clear search')[0], 'onPress'); });
    expect(textContent(root.container)).toContain('Find your everyday essentials');
    expect(labelled(root, 'Search again for Dolo 650')).toHaveLength(1);
    await act(async () => { invoke(labelled(root, 'Search again for Dolo 650')[0], 'onPress'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(textContent(root.container)).toContain('Search results');
    expect(recentSearches()).toEqual(['Dolo 650']);
  } finally {
    await act(async () => { root.unmount(); });
    jest.useRealTimers();
  }
});

test('View All routes the full canonical query and keyboard submission commits the same results', async () => {
  jest.useFakeTimers();
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><HomeScreen /></AppStateProvider>); });
    const search = labelled(root, 'Search medicines by name or salt')[0];
    await act(async () => { invoke(search, 'onChangeText', ' para '); });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(labelled(root, 'Add Crocin Advance to cart')).toHaveLength(1);
    await act(async () => { invoke(labelled(root, 'View all matching medicines')[0], 'onPress'); });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/browse', params: { query: 'para' } });
    expect(recentSearches()).toEqual(['para']);

    await act(async () => { invoke(search, 'onChangeText', 'cet'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    await act(async () => { invoke(search, 'onSubmitEditing'); });
    expect(textContent(root.container)).toContain('Search results');
    expect(labelled(root, 'Add Cetrizine to cart')).toHaveLength(1);
    expect(recentSearches()).toEqual(['cet', 'para']);
  } finally {
    await act(async () => { root.unmount(); });
    jest.useRealTimers();
  }
});

test('a no-match query has a helpful state and clearing restores the catalog preview', async () => {
  jest.useFakeTimers();
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><HomeScreen /></AppStateProvider>); });
    await act(async () => { invoke(labelled(root, 'Search medicines by name or salt')[0], 'onChangeText', 'no-such-medicine'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(150); });
    expect(textContent(root.container)).toContain('No medicines found');
    expect(labelled(root, 'View all matching medicines')).toHaveLength(0);
    await act(async () => { invoke(labelled(root, 'Clear search')[0], 'onPress'); });
    expect(labelled(root, 'Add Dolo 650 to cart')).toHaveLength(1);
  } finally {
    await act(async () => { root.unmount(); });
    jest.useRealTimers();
  }
});

test('Home, Browse, and Cart share preview additions and quantity updates', async () => {
  const root = createRoot();
  try {
    await act(async () => {
      root.render(<AppStateProvider><HomeScreen /><BrowseScreen /><CartScreen /></AppStateProvider>);
    });
    expect(labelled(root, 'Add Dolo 650 to cart')).toHaveLength(2);
    await act(async () => { invoke(labelled(root, 'Add Dolo 650 to cart')[0], 'onPress'); });
    expect(labelled(root, 'Dolo 650, quantity 1')).toHaveLength(3);
    await act(async () => { invoke(labelled(root, 'Increase Dolo 650 quantity')[1], 'onPress'); });
    expect(labelled(root, 'Dolo 650, quantity 2')).toHaveLength(3);
  } finally { await act(async () => { root.unmount(); }); }
});

test('Home reports catalog failure instead of silently showing an empty discovery list', async () => {
  jest.replaceProperty(catalogData, 'error', 'The medicine catalog could not be loaded.');
  jest.replaceProperty(catalogData, 'medicines', []);
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><HomeScreen /></AppStateProvider>); });
    expect(textContent(root.container)).toContain('Medicines are unavailable');
    expect(textContent(root.container)).toContain('The medicine catalog could not be loaded.');
    expect(labelled(root, 'Add Dolo 650 to cart')).toHaveLength(0);
    expect(labelled(root, 'Browse all medicines')[0].props.accessibilityState).toMatchObject({ disabled: true });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  } finally {
    await act(async () => { root.unmount(); });
    jest.restoreAllMocks();
  }
});
