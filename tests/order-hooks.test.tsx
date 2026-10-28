import { act } from 'react';
import { createRoot } from 'test-renderer';
import { useOrderById, useOrderHistory } from '../src/features/orders/useOrders';
import type { Order } from '../src/domain/orders';
import type { OrderRepository } from '../src/repositories/OrderRepository';
import { deferred, testOrder } from './order-fixtures';

jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => (() => void) | void) => {
  const React = jest.requireActual<typeof import('react')>('react');
  React.useEffect(effect, [effect]);
} }));
function repository(): OrderRepository {
  return { version: 1, load: jest.fn(async () => ({ orders: [], warning: null, canWrite: true })),
    getById: jest.fn(async () => null), create: jest.fn() };
}
test('history hook reports loading and sorts a copied receipt array newest first', async () => {
  const repo = repository(); const pending = deferred<Awaited<ReturnType<OrderRepository['load']>>>();
  jest.mocked(repo.load).mockReturnValue(pending.promise);
  const original = Object.freeze([testOrder(), testOrder({ id: 'newer', checkoutId: 'newer-checkout', placedAt: '2026-10-29T10:00:00.000Z' })]);
  const root = createRoot(); let view: ReturnType<typeof useOrderHistory> | undefined;
  function Probe() { view = useOrderHistory(repo); return null; }
  try {
    await act(async () => { root.render(<Probe />); });
    expect(view?.status).toBe('loading');
    await act(async () => { pending.resolve({ orders: original, warning: null, canWrite: true }); });
    expect(view?.data?.orders.map((order) => order.id)).toEqual(['newer', 'order-1']);
    expect(original.map((order) => order.id)).toEqual(['order-1', 'newer']);
  } finally { await act(async () => { root.unmount(); }); }
});
test('receipt errors expose a retry that returns the frozen repository snapshot', async () => {
  const repo = repository(); const order = testOrder();
  jest.mocked(repo.getById).mockRejectedValueOnce(new Error('disk read failed')).mockResolvedValue(order);
  const root = createRoot(); let view: ReturnType<typeof useOrderById> | undefined;
  function Probe() { view = useOrderById(repo, 'order-1'); return null; }
  try {
    await act(async () => { root.render(<Probe />); });
    expect(view?.error).toBe('disk read failed');
    await act(async () => { view?.retry(); });
    expect(view?.status).toBe('ready');
    expect(view?.data).toBe(order);
  } finally { await act(async () => { root.unmount(); }); }
});
test('changing receipt IDs invalidates stale async results and unmount stops later publications', async () => {
  const repo = repository(); const old = deferred<Order | null>(); const current = testOrder({ id: 'current', checkoutId: 'current-checkout' });
  jest.mocked(repo.getById).mockImplementation(async (id) => id === 'old' ? old.promise : current);
  const root = createRoot(); let view: ReturnType<typeof useOrderById> | undefined; const renders = jest.fn();
  function Probe({ id }: { id: string }) { view = useOrderById(repo, id); renders(view); return null; }
  await act(async () => { root.render(<Probe id="old" />); });
  await act(async () => { root.render(<Probe id="current" />); });
  expect(view?.data?.id).toBe('current');
  await act(async () => { old.resolve(testOrder({ id: 'old', checkoutId: 'old-checkout' })); });
  expect(view?.data?.id).toBe('current');
  const later = deferred<Order | null>(); jest.mocked(repo.getById).mockReturnValue(later.promise);
  await act(async () => { view?.retry(); });
  await act(async () => { root.unmount(); });
  const count = renders.mock.calls.length;
  await act(async () => { later.resolve(testOrder()); });
  expect(renders).toHaveBeenCalledTimes(count);
});
