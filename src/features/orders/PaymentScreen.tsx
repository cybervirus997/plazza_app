import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { formatMoney, ui } from '../../theme/tokens';
import { AddressSummary } from './AddressSummary';
import { OrderItems } from './OrderItems';
import { OrderPage } from './OrderPage';
import { BillSummary } from '../cart/BillSummary';
import type { OrderingResult } from './ordering';
import { useScreenActive } from '../../hooks/useScreenActive';

export default function PaymentScreen() {
  const { payment, retryRecovery, checkoutLocked } = useShopping();
  const attempt = payment.attempt;
  const isActive = useScreenActive();
  function confirmed(result: OrderingResult | null) {
    if (isActive() && result?.attempt?.finalized && result.order) router.replace({ pathname: '/order-confirmation', params: { id: result.order.id } });
  }
  const terminal = attempt?.status === 'failed' || attempt?.status === 'cancelled';
  const footer = !attempt ? <>
    <Text style={ui.body}>Payment status: not started</Text>
    <Text style={ui.body}>No saved payment attempt. Return to review your cart.</Text>
    <Button label="Review checkout" onPress={() => router.replace('/checkout')} />
  </> : attempt.finalized ? <>
    <Text style={ui.body}>This mock order was finalized. Payment cannot be repeated.</Text>
    <Button label="View confirmed order" onPress={() => router.replace({ pathname: '/order-confirmation', params: { id: attempt.order.id } })} />
    <Button label="Continue Shopping" variant="quiet" onPress={() => router.replace('/')} />
  </> : terminal ? <>
    <Text style={ui.body}>Your cart is intact. A deliberate retry creates a new payment and checkout identity.</Text>
    <Button label="Review & start a new attempt" disabled={payment.busy || checkoutLocked} onPress={() => router.replace('/checkout')} />
    {checkoutLocked && <Button label="Retry payment recovery" disabled={payment.busy} onPress={retryRecovery} />}
  </> : <>
    <Button label={payment.busy ? 'Verifying & saving…' : attempt.status === 'succeeded' ? 'Retry order reconciliation' : attempt.status === 'pending' ? 'Check Status'
      : attempt.method === 'cod' ? 'Confirm mock COD order' : `Pay ${formatMoney(attempt.order.grandTotal)} · simulated UPI`}
      disabled={payment.busy} onPress={() => { void payment.advance(attempt.id, attempt.status === 'initiated' ? 'pay' : 'check').then(confirmed); }} />
    {attempt.status !== 'succeeded' && <Button label="Cancel simulated payment" variant="quiet" disabled={payment.busy}
      onPress={() => { void payment.cancel(attempt.id); }} />}
  </>;
  return <OrderPage title="Simulated payment" footer={footer} onBack={() => router.replace('/cart')}>
    <Text style={ui.body}>No money is transferred. Payment verification and order fulfillment are separate states.</Text>
    {payment.error && <View style={ui.card}>
      <Text accessibilityRole="alert" style={ui.body}>{payment.error}</Text>
      <Button label="Reload saved payment status" variant="secondary" disabled={payment.busy} onPress={retryRecovery} />
    </View>}
    {attempt && <>
      <View style={ui.card}>
        <Text style={ui.heading}>{attempt.method === 'upi' ? 'Simulated UPI' : 'Mock Cash on Delivery'}</Text>
        <Text accessibilityLiveRegion="polite" style={ui.body}>Payment status: {attempt.method === 'cod' && attempt.status === 'succeeded' ? 'COD confirmed · no cash collected'
          : attempt.status === 'initiated' ? 'initiated · ready to verify' : attempt.status}</Text>
        <Text style={ui.small}>Attempt: {attempt.id}</Text>
        {attempt.status === 'pending' && <Text style={ui.body}>Verification is pending / unknown. Your attempt is saved across restarts. Use Check Status; do not create another payment.</Text>}
        {attempt.status === 'succeeded' && !attempt.finalized && <Text accessibilityRole="alert" style={ui.body}>The payment simulation succeeded. Order reconciliation is still required; the order is not yet confirmed.</Text>}
        {terminal && <Text style={ui.body}>The simulation {attempt.status}. No order was placed and no first-order coupon was consumed.</Text>}
        <Text style={ui.body}>Order: {attempt.finalized ? 'placed · local demo, no fulfillment' : 'not confirmed'}</Text>
      </View>
      <AddressSummary snapshot={attempt.order.deliveryAddress} />
      <Text style={ui.small}>Reviewed delivery preference: {attempt.order.deliveryPreference ?? 'not recorded'} · simulated</Text>
      <OrderItems items={attempt.order.items} />
      <BillSummary bill={attempt.order} showDeliveryPolicy={false} />
    </>}
  </OrderPage>;
}
