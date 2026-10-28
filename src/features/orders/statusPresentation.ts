import type { StatusPresentation } from '../../components/ui/StatusPanel';
import type { Order } from '../../domain/orders';
import type { PaymentAttempt, PaymentStatus } from '../../domain/payments';
import { formatMoney } from '../../theme/tokens';

export type PaymentViewKind = 'not-started' | 'initiated' | 'pending' | 'reconciling' | 'success' | 'failed' | 'cancelled';
export type PaymentAction = 'review' | 'advance' | 'cancel' | 'retry' | 'change-method' | 'receipt' | 'shop';
interface Action { id: PaymentAction; label: string; needsUnlocked?: boolean }
interface PaymentView { kind: PaymentViewKind; presentation: StatusPresentation; primary: Action; secondary?: Action }
const paymentStatuses: Record<PaymentStatus, StatusPresentation> = {
  initiated: { tone: 'neutral', icon: 'info', label: 'Ready to verify', heading: 'Confirm your simulated payment',
    explanation: 'Your reviewed checkout is saved. Choose Pay or confirm mock COD when you are ready. No money is transferred.' },
  pending: { tone: 'pending', icon: 'clock', label: 'Verification pending', heading: 'Waiting for a simulated outcome',
    explanation: 'Verification is pending / unknown. Your attempt is saved across restarts. Use Check Status; do not create another payment.' },
  succeeded: { tone: 'pending', icon: 'clock', label: 'Order reconciliation required', heading: 'Payment simulated · order not confirmed',
    explanation: 'The payment simulation succeeded. Order reconciliation is still required; the order is not yet confirmed. Retry the same checkout; no new payment is needed.' },
  failed: { tone: 'negative', icon: 'error', label: 'Payment failed', heading: 'The payment simulation failed',
    explanation: 'The local simulator returned a failed outcome. Your cart is intact. No order was placed and no first-order coupon was consumed. Review checkout to retry or choose another method.' },
  cancelled: { tone: 'neutral', icon: 'cancel', label: 'Payment cancelled', heading: 'You cancelled this attempt',
    explanation: 'Your cart is intact. No order was placed and no first-order coupon was consumed. No real payment was processed; return to Checkout when you are ready.' },
};
export const confirmedPresentation: StatusPresentation = { tone: 'positive', icon: 'check', label: 'Mock order confirmed', heading: 'Your mock order is saved',
  explanation: 'Checkout is durably finalized on this device. No real payment or delivery occurred.' };
export const fulfillmentStatuses: Record<Order['status'], StatusPresentation> = {
  placed: { tone: 'neutral', icon: 'bag', label: 'Placed', heading: 'Order placed locally',
    explanation: 'No pharmacy verification, delivery fulfillment or live tracking. This demo order has not been dispatched.' },
};
export function paymentView(attempt: PaymentAttempt | null): PaymentView {
  if (!attempt) return { kind: 'not-started', presentation: { tone: 'neutral', icon: 'info', label: 'Not started', heading: 'Review checkout first',
    explanation: 'No saved payment attempt. Return to review your cart, delivery address and total.' }, primary: { id: 'review', label: 'Review checkout', needsUnlocked: true } };
  if (attempt.finalized) return { kind: 'success', presentation: confirmedPresentation,
    primary: { id: 'receipt', label: 'View Order' }, secondary: { id: 'shop', label: 'Continue Shopping' } };
  const presentation = paymentStatuses[attempt.status];
  if (attempt.status === 'failed' || attempt.status === 'cancelled') return { kind: attempt.status, presentation,
    primary: { id: 'retry', label: attempt.status === 'failed' ? 'Retry Payment' : 'Back to Checkout', needsUnlocked: true },
    secondary: { id: 'change-method', label: 'Change Method', needsUnlocked: true } };
  return { kind: attempt.status === 'succeeded' ? 'reconciling' : attempt.status, presentation,
    primary: { id: 'advance', label: attempt.status === 'succeeded' ? 'Retry order reconciliation' : attempt.status === 'pending' ? 'Check Status'
      : attempt.method === 'cod' ? 'Confirm mock COD order' : `Pay ${formatMoney(attempt.order.grandTotal)} · simulated UPI` },
    ...(attempt.status !== 'succeeded' ? { secondary: { id: 'cancel' as const, label: 'Cancel simulated payment' } } : {}) };
}
export function receiptPaymentLabel(order: Order): string {
  return !order.payment ? 'Legacy demo order · payment metadata was not recorded.' : order.payment.method === 'cod'
    ? 'Mock COD · confirmed, no cash collected' : 'Simulated UPI · succeeded, no money transferred';
}
