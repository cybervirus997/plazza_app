import { act, type ReactNode } from 'react';
import { Alert, type PressableProps } from 'react-native';
import { createRoot, type TestNode } from 'test-renderer';
import MockAutoPayScreen from '../src/features/care/MockAutoPayScreen';
import { MOCK_MANDATE_STORAGE_KEY } from '../src/repositories/local/LocalMockMandateRepository';
import { planFixture as mockPlanFixture, mandateFixture } from './care-fixtures';
const mockData = new Map<string, string>();
const mockSet = jest.fn(async (key: string, value: string) => { mockData.set(key, value); });
let mockPlanPresent = true;
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async (key: string) => mockData.get(key) ?? null, setItem: (key: string, value: string) => mockSet(key, value) } }));
jest.mock('../src/features/care/CareProvider', () => ({ useCarePlans: () => ({ ready: true, records: mockPlanPresent ? [mockPlanFixture()] : [] }) }));
jest.mock('../src/state/AppStateProvider', () => ({ useShopping: () => ({ catalogStatus: 'ready', catalog: [{ id: 'a', name: 'Current', salt: '', price: 100, maxQty: 5, rx: true }] }) }));
jest.mock('expo-router', () => ({ Stack: { Screen: jest.requireActual('./native-header').MockStackScreen }, router: {}, useLocalSearchParams: () => ({ id: 'plan-1' }),
  useFocusEffect: (effect: () => void) => { const React = jest.requireActual<typeof import('react')>('react'); React.useEffect(effect, [effect]); },
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 64 }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: (props: PressableProps) => React.createElement('Pressable', props,
    typeof props.children === 'function' ? props.children({ pressed: false, hovered: false }) : props.children) };
});
function content(node: TestNode): string { return typeof node === 'string' ? node : node.children.map(content).join(''); }
beforeEach(() => { jest.clearAllMocks(); mockData.clear(); mockPlanPresent = true; jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
async function setup() {
  const root = createRoot(); await act(async () => root.render(<MockAutoPayScreen />));
  const node = (label: string) => root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true })[0];
  const tap = (label: string) => act(async () => { (node(label).props.onPress as () => void)(); });
  const confirm = () => act(async () => { jest.mocked(Alert.alert).mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Confirm mock action')?.onPress?.(); });
  const saved = () => JSON.parse(mockData.get(MOCK_MANDATE_STORAGE_KEY) ?? '{"records":[]}').records;
  return { root, node, tap, confirm, saved, unmount: () => act(async () => root.unmount()) };
}
test('inactive creation, activation, pause and cancellation require explicit confirmation and no commerce writes', async () => {
  const app = await setup();
  try {
    expect(content(app.root.container)).toContain('No mandate is registered and no money will be charged');
    await app.tap('Save inactive mock preview'); expect(mockData.size).toBe(0);
    await app.confirm(); expect(app.saved()[0].status).toBe('inactive');
    expect(app.node('Activate mock preview').props.accessibilityState).toMatchObject({ disabled: true });
    await app.tap('I understand and opt in to this demo only'); await app.tap('Activate mock preview');
    expect(app.saved()[0].status).toBe('inactive'); await app.confirm(); expect(app.saved()[0].status).toBe('active');
    await app.tap('Pause mock preview'); expect(app.saved()[0].status).toBe('active'); await app.confirm(); expect(app.saved()[0].status).toBe('paused');
    await app.tap('Cancel mock preview'); await app.confirm(); expect(app.saved()[0]).toMatchObject({ status: 'cancelled', optIn: false });
    expect([...mockData.keys()]).toEqual([MOCK_MANDATE_STORAGE_KEY]);
  } finally { await app.unmount(); }
});
test('charge preview is current-price information only, never a persisted charge/order or prescription approval', async () => {
  mockData.set(MOCK_MANDATE_STORAGE_KEY, JSON.stringify({ version: 1, records: [mandateFixture()] }));
  const app = await setup();
  try {
    const before = mockData.get(MOCK_MANDATE_STORAGE_KEY);
    await app.tap('Preview next mock charge'); expect(content(app.root.container)).not.toContain('Illustrative item subtotal:');
    await app.confirm(); expect(content(app.root.container)).toContain('Illustrative item subtotal: ₹200');
    expect(content(app.root.container)).toContain('No automatic prescription renewal');
    expect(content(app.root.container)).toContain('No revenue or order is recorded');
    expect(mockData.get(MOCK_MANDATE_STORAGE_KEY)).toBe(before); expect(mockSet).not.toHaveBeenCalled();
  } finally { await app.unmount(); }
});
test('deleted plans disable activation/preview but saved orphan previews can still be cancelled', async () => {
  mockPlanPresent = false;
  mockData.set(MOCK_MANDATE_STORAGE_KEY, JSON.stringify({ version: 1, records: [mandateFixture()] }));
  const app = await setup();
  try {
    expect(content(app.root.container)).toContain('Linked care plan is missing');
    expect(app.node('Activate mock preview').props.accessibilityState).toMatchObject({ disabled: true });
    expect(app.node('Preview next mock charge').props.accessibilityState).toMatchObject({ disabled: true });
    await app.tap('Cancel mock preview'); await app.confirm(); expect(app.saved()[0].status).toBe('cancelled');
  } finally { await app.unmount(); }
});
