import { act } from 'react';
import { createRoot } from 'test-renderer';
import { StatusPanel } from '../src/components/ui/StatusPanel';
import { paymentView, fulfillmentStatuses, receiptPaymentLabel } from '../src/features/orders/statusPresentation';
import { orderSummary, receiptLine } from '../src/features/orders/orderPresentation';
import { parsePaymentAttempt } from '../src/domain/payments';
import { paymentAttempt } from './payment-fixtures';
import { testOrder } from './order-fixtures';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
test.each([
  ['initiated', 'neutral', 'info', 'Pay ₹400 · simulated UPI'],
  ['pending', 'pending', 'clock', 'Check Status'],
  ['succeeded', 'pending', 'clock', 'Retry order reconciliation'],
  ['failed', 'negative', 'error', 'Retry Payment'],
  ['cancelled', 'neutral', 'cancel', 'Back to Checkout'],
] as const)('%s has a distinct truthful treatment and action', (status, tone, icon, action) => {
  const attempt = parsePaymentAttempt({ ...paymentAttempt(), status });
  const result = paymentView(attempt);
  expect(result.presentation).toMatchObject({ tone, icon });
  expect(result.primary.label).toBe(action);
  if (status === 'succeeded') expect(result.secondary).toBeUndefined();
  if (status === 'failed' || status === 'cancelled') expect(result.secondary?.label).toBe('Change Method');
  expect(result.kind).not.toBe('success');
});
test('only durable completion gets positive confirmation, saved identity and receipt/shopping actions', () => {
  const result = paymentView(parsePaymentAttempt({ ...paymentAttempt(), status: 'succeeded', finalized: true }));
  expect(result.kind).toBe('success');
  expect(result.presentation).toMatchObject({ tone: 'positive', icon: 'check', heading: 'Your mock order is saved' });
  expect(result.primary.id).toBe('receipt');
  expect(result.secondary?.id).toBe('shop');
  expect(paymentView(null)).toMatchObject({ kind: 'not-started', primary: { id: 'review' } });
});
test('COD remains a confirmation rather than a collected payment, and legacy metadata stays explicit', () => {
  expect(paymentView(parsePaymentAttempt({ ...paymentAttempt(), method: 'cod' })).primary.label).toBe('Confirm mock COD order');
  const order = testOrder();
  expect(receiptPaymentLabel(order)).toContain('payment metadata was not recorded');
  expect(receiptPaymentLabel({ ...order, payment: { version: 1, method: 'cod', status: 'cod-confirmed', attemptId: 'cod', simulated: true } })).toContain('no cash collected');
  expect(fulfillmentStatuses.placed.label).toBe('Placed');
  expect(fulfillmentStatuses.placed.explanation).not.toContain('Payment');
});
test('receipt summaries and line amounts use frozen snapshot values without live repricing', () => {
  const order = testOrder();
  expect(orderSummary(order)).toMatchObject({ quantity: 3, productCount: 2, total: '₹400', preview: 'Test Relief · Test Care' });
  expect(receiptLine({ ...order.items[0], quantity: 3, unitPrice: 0.1 })).toEqual({ unit: '₹0.1', total: '₹0.3' });
  expect(order.items[0].unitPrice).toBe(200);
});
test.each(['pending', 'failed', 'cancelled', 'succeeded'] as const)('%s status exposes a heading and polite state announcement without relying on color', async (status) => {
  const presentation = paymentView(parsePaymentAttempt({ ...paymentAttempt(), status })).presentation;
  const root = createRoot();
  try {
    await act(async () => { root.render(<StatusPanel presentation={presentation} />); });
    const panel = root.container.queryAll((node) => node.props.accessibilityLabel === `${presentation.label} status`, { matchDeepestOnly: true });
    expect(panel).toHaveLength(1);
    expect(panel[0].props.accessibilityLiveRegion).toBe('polite');
    expect(root.container.queryAll((node) => node.props.accessibilityRole === 'header')).not.toHaveLength(0);
  } finally { await act(async () => { root.unmount(); }); }
});
