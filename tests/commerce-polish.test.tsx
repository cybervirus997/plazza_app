import { act } from 'react';
import { createRoot } from 'test-renderer';
import { NoticeBanner } from '../src/components/ui/NoticeBanner';
import { orderReference } from '../src/features/orders/orderPresentation';
import { OrderIdentity } from '../src/features/orders/OrderReceipt';
import { testOrder } from './order-fixtures';
import type { Notice } from '../src/state/appReducer';

let mockNotice: Notice | null = null;
const mockDispatch = jest.fn();
jest.mock('../src/state/AppStateProvider', () => ({ useShopping: () => ({ state: { notice: mockNotice }, dispatch: mockDispatch, persistenceError: null }) }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockNotice = null; });
afterEach(() => { jest.useRealTimers(); });
test('short references are deterministic display aids and full immutable IDs remain selectable', async () => {
  const order = testOrder(); const root = createRoot();
  try {
    expect(orderReference(order.id)).toMatch(/^PLZ-[0-9A-F]{8}$/);
    expect(orderReference(order.id)).toBe(orderReference(order.id));
    expect(orderReference(order.id)).not.toBe(orderReference(`${order.id}-other`));
    await act(async () => { root.render(<OrderIdentity order={order} />); });
    const id = root.container.queryAll((node) => node.props.accessibilityLabel === `Order identifier ${order.id}`, { matchDeepestOnly: true });
    expect(id).toHaveLength(1); expect(id[0].props.selectable).toBe(true);
  } finally { await act(async () => root.unmount()); }
});
test('transient feedback expires but an older timer cannot dismiss a newer notice', async () => {
  const root = createRoot();
  try {
    mockNotice = { id: 1, kind: 'info', message: 'Coupon applied' };
    await act(async () => root.render(<NoticeBanner />));
    await act(async () => { jest.advanceTimersByTime(4000); });
    mockNotice = { id: 2, kind: 'info', message: 'New coupon applied' };
    await act(async () => root.render(<NoticeBanner />));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(mockDispatch).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'dismiss-notice', id: 2 });
  } finally { await act(async () => root.unmount()); }
});
test.each(['error', 'auto-removal'] as const)('%s stays available until explicitly dismissed', async (kind) => {
  const root = createRoot();
  try {
    mockNotice = { id: 1, kind, message: 'Review your coupon' };
    await act(async () => root.render(<NoticeBanner />));
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(mockDispatch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
test('durable order confirmation does not repeat as a shopping banner', async () => {
  const root = createRoot();
  try {
    mockNotice = { id: 1, kind: 'order', message: 'Order saved' };
    await act(async () => root.render(<NoticeBanner />));
    expect(root.container.queryAll((node) => node.props.accessibilityLiveRegion === 'polite')).toHaveLength(0);
  } finally { await act(async () => root.unmount()); }
});
