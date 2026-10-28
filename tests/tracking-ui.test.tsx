import { act, type ReactNode } from 'react';
import { createRoot, type TestNode } from 'test-renderer';
import TrackingScreen from '../src/features/tracking/TrackingScreen';
import { testOrder } from './order-fixtures';
import type { Order } from '../src/domain/orders';
let mockOrder: Order | null = null;
let mockFinalized = true;
const mockOrders = { getById: async () => mockOrder };
const mockData = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockData.get(key) ?? null, setItem: async (key: string, value: string) => { mockData.set(key, value); },
} }));
jest.mock('../src/state/AppStateProvider', () => ({ useShopping: () => ({ orders: mockOrders, payment: { attempt: null }, state: { lastFinalizedCheckoutId: mockFinalized ? mockOrder?.checkoutId : null } }) }));
jest.mock('expo-router', () => ({ Stack: { Screen: jest.requireActual('./native-header').MockStackScreen },
  useLocalSearchParams: () => ({ id: 'order-1' }), useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react'); React.useEffect(effect, [effect]);
  }, router: {},
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 64 }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
function content(node: TestNode): string { return typeof node === 'string' ? node : node.children.map(content).join(''); }
beforeEach(() => { mockData.clear(); mockOrder = testOrder(); mockFinalized = true; });
test('eligible order exposes an honest map/timeline and Rx has no unconditional ETA', async () => {
  const root = createRoot();
  try {
    await act(async () => root.render(<TrackingScreen />));
    expect(content(root.container)).toContain('Rx review is required');
    expect(content(root.container)).not.toContain('approximately 10 min');
    expect(root.container.queryAll((node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Illustrative demo map.'))).toHaveLength(1);
    expect(mockData.size).toBe(1);
  } finally { await act(async () => root.unmount()); }
});
test.each([false, null])('unfinished/unknown orders never create tracking records (%s)', async (condition) => {
  if (condition === null) mockOrder = null; else mockFinalized = false;
  const root = createRoot();
  try {
    await act(async () => root.render(<TrackingScreen />));
    expect(content(root.container)).toContain(condition === null ? 'Order not found' : 'reconciliation');
    expect(mockData.size).toBe(0);
  } finally { await act(async () => root.unmount()); }
});
