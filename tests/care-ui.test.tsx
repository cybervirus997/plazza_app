import { act, type ReactNode } from 'react';
import { createRoot, type TestNode } from 'test-renderer';
import { router } from 'expo-router';
import type { PressableProps } from 'react-native';
import CareReviewScreen from '../src/features/care/CareReviewScreen';
import { planFixture as mockPlanFixture, recipientFixture as mockRecipientFixture } from './care-fixtures';
const mockDispatch = jest.fn();
let mockAvailable = true; let mockLinked = true; let mockLocked = false;
const mockSelected = { id: 'address-1', label: 'Demo home' };
jest.mock('../src/features/care/CareProvider', () => ({ useCarePlans: () => ({ ready: true, records: [mockRecipientFixture(), mockPlanFixture()], refresh: jest.fn() }) }));
jest.mock('../src/state/AppStateProvider', () => ({ useShopping: () => ({
  catalog: [{ id: 'a', name: 'Current medicine', salt: '', price: 250, maxQty: 5, rx: true, isAvailable: mockAvailable }], catalogStatus: 'ready',
  state: { cart: [{ medicineId: 'a', quantity: 1 }] }, checkoutLocked: mockLocked, dispatch: mockDispatch,
}) }));
jest.mock('../src/features/addresses/AddressBookProvider', () => ({ useAddressBook: () => ({
  ready: true, busy: false, selected: mockLinked ? mockSelected : null, book: { addresses: mockLinked ? [mockSelected] : [] }, select: async () => true,
}) }));
jest.mock('expo-router', () => ({ Stack: { Screen: jest.requireActual('./native-header').MockStackScreen }, useLocalSearchParams: () => ({ id: 'plan-1' }),
  router: { dismissTo: jest.fn() }, useFocusEffect: (effect: () => void) => { const React = jest.requireActual<typeof import('react')>('react'); React.useEffect(effect, [effect]); },
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 64 }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: (props: PressableProps) => React.createElement('Pressable', props,
    typeof props.children === 'function' ? props.children({ pressed: false, hovered: false }) : props.children) };
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
function content(node: TestNode): string { return typeof node === 'string' ? node : node.children.map(content).join(''); }
beforeEach(() => { jest.clearAllMocks(); mockAvailable = true; mockLinked = true; mockLocked = false; });
test('review shows current prices/Rx and requires address plus explicit cart collision choice before any import', async () => {
  const root = createRoot();
  const node = (label: string) => root.container.queryAll((node) => node.props.accessibilityLabel === label, { matchDeepestOnly: true })[0];
  const tap = (label: string) => act(async () => { (node(label).props.onPress as () => void)(); });
  try {
    await act(async () => root.render(<CareReviewScreen />));
    expect(content(root.container)).toContain('Current unit price: ₹250'); expect(content(root.container)).toContain('Prescription review required');
    expect(node('Confirm proposal & review Cart').props.accessibilityState).toMatchObject({ disabled: true });
    expect(mockDispatch).not.toHaveBeenCalled();
    await tap('Use linked address: Demo home');
    expect(node('Confirm proposal & review Cart').props.accessibilityState).toMatchObject({ disabled: true });
    await tap('Merge with current cart'); await tap('Confirm proposal & review Cart');
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'review-care-cart', cart: [{ medicineId: 'a', quantity: 2 }], expectedCart: [{ medicineId: 'a', quantity: 1 }], mode: 'merge' });
    expect(router.dismissTo).toHaveBeenCalledWith('/cart');
  } finally { await act(async () => root.unmount()); }
});
test.each(['address', 'unavailable', 'locked'])('%s blocks proposal import without silently replacing the cart', async (issue) => {
  mockLinked = issue !== 'address'; mockAvailable = issue !== 'unavailable'; mockLocked = issue === 'locked';
  const root = createRoot();
  try {
    await act(async () => root.render(<CareReviewScreen />));
    const button = root.container.queryAll((node) => node.props.accessibilityLabel === 'Confirm proposal & review Cart', { matchDeepestOnly: true })[0];
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    if (issue === 'address') expect(content(root.container)).toContain('Linked address missing');
    if (issue === 'unavailable') expect(content(root.container)).toContain('Currently unavailable');
    expect(mockDispatch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
