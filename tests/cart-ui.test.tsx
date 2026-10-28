import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, type ReactNode } from 'react';
import type { PressableProps } from 'react-native';
import { createRoot, type Root, type TestInstance, type TestNode } from 'test-renderer';

import CartScreen from '../src/features/cart/CartScreen';
import { AppStateProvider } from '../src/state/AppStateProvider';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
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

function snapshot(activeCouponCode: string | null = null) {
  return JSON.stringify({
    version: 1, cart: [{ medicineId: 'm4', quantity: 2 }],
    activeCouponCode, usedCouponCodes: [], recentSearches: [],
  });
}

function textContent(node: TestNode): string {
  return typeof node === 'string' ? node : node.children.map(textContent).join('');
}

function labelled(root: Root, label: string): TestInstance {
  const nodes = root.container.queryAll((node) => node.props.accessibilityLabel === label,
    { matchDeepestOnly: true });
  if (nodes.length !== 1) throw new Error(`Expected one ${label}, received ${nodes.length}.`);
  return nodes[0];
}

function invoke(node: TestInstance, property: 'onPress' | 'onChangeText', value?: string) {
  const handler: unknown = node.props[property];
  if (typeof handler !== 'function') throw new Error(`Missing ${property} handler.`);
  handler(value);
}

test('coupon validation is visible at the form and a valid coupon updates the bill', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(snapshot());
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><CartScreen /></AppStateProvider>); });
    await act(async () => { invoke(labelled(root, 'Coupon code'), 'onChangeText', 'INVALID'); });
    await act(async () => { invoke(labelled(root, 'Apply'), 'onPress'); });
    const feedback = labelled(root, 'Coupon feedback');
    expect(textContent(feedback)).toContain('That coupon code is not valid.');
    expect(feedback.queryAll((node) => node.props.accessibilityRole === 'alert')).not.toHaveLength(0);

    await act(async () => { invoke(labelled(root, 'Use coupon FLAT50'), 'onPress'); });
    expect(textContent(root.container)).toContain('✓ FLAT50 applied');
    expect(textContent(root.container)).toContain('Grand Total₹290');
    expect(root.container.queryAll((node) => node.props.accessibilityLabel === 'Coupon feedback')).toHaveLength(0);
  } finally { await act(async () => { root.unmount(); }); }
});

test('reducing an eligible cart displays auto-removal beside the coupon form and recalculates the bill', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(snapshot('FLAT50'));
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppStateProvider><CartScreen /></AppStateProvider>); });
    expect(textContent(root.container)).toContain('✓ FLAT50 applied');
    await act(async () => { invoke(labelled(root, 'Decrease Pan 40 quantity'), 'onPress'); });
    expect(textContent(labelled(root, 'Coupon feedback'))).toContain('FLAT50 was removed.');
    expect(textContent(labelled(root, 'Coupon feedback'))).toContain('at least ₹300');
    expect(textContent(root.container)).toContain('Grand Total₹190');
    expect(labelled(root, 'Coupon code')).toBeDefined();
  } finally { await act(async () => { root.unmount(); }); }
});
