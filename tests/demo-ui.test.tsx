import { act, type ReactNode } from 'react';
import type { PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance, type TestNode } from 'test-renderer';

import CartScreen from '../src/features/cart/CartScreen';
import HomeScreen from '../src/features/search/HomeScreen';
import { AppStateProvider } from '../src/state/AppStateProvider';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
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

function invoke(node: TestInstance, property: 'onPress' | 'onChangeText', value?: string) {
  const handler: unknown = node.props[property];
  if (typeof handler !== 'function') throw new Error(`Missing ${property} handler.`);
  handler(value);
}

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
