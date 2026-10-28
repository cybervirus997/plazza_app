import { act, type ReactNode } from 'react';
import type { PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance, type TestNode } from 'test-renderer';

import BrowseScreen from '../src/features/search/BrowseScreen';
import { catalogData } from '../src/data/catalog';
import { AppStateProvider } from '../src/state/AppStateProvider';

const mockParams: { query?: string } = {};
const mockCanGoBack = jest.fn(() => true);
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { navigate: jest.fn(), canGoBack: () => mockCanGoBack(), back: () => mockBack(), replace: (path: string) => mockReplace(path) },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
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
  return root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true });
}

function invoke(node: TestInstance, property: 'onPress' | 'onChangeText', value?: string) {
  const handler: unknown = node.props[property];
  if (typeof handler !== 'function') throw new Error(`Missing ${property} handler.`);
  handler(value);
}

beforeEach(() => {
  delete mockParams.query;
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});

test('Browse renders the whole catalog without typing and supports Add with maxQty enforcement', async () => {
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><BrowseScreen /></AppStateProvider>); });
    expect(textContent(root.container)).toContain('15 medicines available');
    // FlatList virtualizes the initial window; filtering makes each entry visible.
    const filter = labelled(root, 'Filter medicines by name or salt')[0];
    for (const medicine of catalogData.medicines) {
      await act(async () => { invoke(filter, 'onChangeText', medicine.name); });
      expect(textContent(root.container)).toContain(medicine.name);
      expect(textContent(root.container)).toContain(medicine.salt);
      expect(labelled(root, `Add ${medicine.name} to cart`)).toHaveLength(1);
    }
    await act(async () => { invoke(filter, 'onChangeText', ''); });
    expect(textContent(root.container)).toContain('Rx · Prescription required');
    await act(async () => { invoke(labelled(root, 'Add Azithral 500 to cart')[0], 'onPress'); });
    expect(labelled(root, 'Azithral 500, quantity 1')).toHaveLength(1);
    await act(async () => { invoke(labelled(root, 'Increase Azithral 500 quantity')[0], 'onPress'); });
    expect(labelled(root, 'Azithral 500, quantity 2')).toHaveLength(1);
    expect(labelled(root, 'Increase Azithral 500 quantity')[0].props.accessibilityState).toMatchObject({ disabled: true });
  } finally { await act(async () => { root.unmount(); }); }
});

test('Browse filters a routed query by name or salt and clearing restores every medicine', async () => {
  mockParams.query = '  DOLO  ';
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><BrowseScreen /></AppStateProvider>); });
    expect(labelled(root, 'Add Dolo 650 to cart')).toHaveLength(1);
    expect(labelled(root, 'Add Crocin Advance to cart')).toHaveLength(0);
    const filter = labelled(root, 'Filter medicines by name or salt')[0];
    await act(async () => { invoke(filter, 'onChangeText', '  para  '); });
    expect(labelled(root, 'Add Crocin Advance to cart')).toHaveLength(1);
    expect(labelled(root, 'Add Calpol 500 to cart')).toHaveLength(1);
    expect(labelled(root, 'Add Azithral 500 to cart')).toHaveLength(0);
    await act(async () => { invoke(filter, 'onChangeText', 'no-such-medicine'); });
    expect(textContent(root.container)).toContain('No medicines found');
    await act(async () => { invoke(labelled(root, 'Clear medicine filter')[0], 'onPress'); });
    expect(textContent(root.container)).toContain('15 medicines available');
    await act(async () => { invoke(labelled(root, 'Back to Home')[0], 'onPress'); });
    expect(mockBack).toHaveBeenCalledTimes(1);
  } finally { await act(async () => { root.unmount(); }); }
});

test('Browse has a Home fallback when opened directly without navigation history', async () => {
  mockCanGoBack.mockReturnValue(false);
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><BrowseScreen /></AppStateProvider>); });
    await act(async () => { invoke(labelled(root, 'Back to Home')[0], 'onPress'); });
    expect(mockReplace).toHaveBeenCalledWith('/');
  } finally { await act(async () => { root.unmount(); }); }
});

test('Browse reports catalog failure and keeps the Home escape available', async () => {
  jest.replaceProperty(catalogData, 'error', 'The medicine catalog could not be loaded.');
  jest.replaceProperty(catalogData, 'medicines', []);
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><BrowseScreen /></AppStateProvider>); });
    expect(textContent(root.container)).toContain('Medicines are unavailable');
    expect(textContent(root.container)).toContain('The medicine catalog could not be loaded.');
    expect(labelled(root, 'Add Dolo 650 to cart')).toHaveLength(0);
    expect(labelled(root, 'Back to Home')).toHaveLength(1);
  } finally {
    await act(async () => { root.unmount(); });
    jest.restoreAllMocks();
  }
});
