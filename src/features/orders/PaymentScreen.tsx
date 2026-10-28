import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { StatusPanel } from '../../components/ui/StatusPanel';
import { useShopping } from '../../state/AppStateProvider';
import { formatMoney, ui } from '../../theme/tokens';
import { AddressSummary } from './AddressSummary';
import { OrderItems } from './OrderItems';
import { OrderPage } from './OrderPage';
import { BillSummary } from '../cart/BillSummary';
import { useScreenCompletion } from '../../hooks/useScreenActive';
import { backTo, confirmOrder, openReceipt, returnToShop, reviewCheckout } from '../../navigation/commerceNavigation';
import { useCheckoutPreferences } from './CheckoutPreferences';
import { paymentView, type PaymentAction } from './statusPresentation';

export default function PaymentScreen() {
  const { payment, retryRecovery, checkoutLocked } = useShopping();
  const { update } = useCheckoutPreferences();
  const attempt = payment.attempt;
  const view = paymentView(attempt);
  const captureCompletion = useScreenCompletion();
  async function advance() {
    if (!attempt) return;
    const complete = captureCompletion();
    const result = await payment.advance(attempt.id, attempt.status === 'initiated' ? 'pay' : 'check');
    if (result?.attempt?.finalized && result.order) {
      const id = result.order.id;
      complete.navigate(() => confirmOrder(id));
    }
  }
  function handleAction(action: PaymentAction) {
    if (action === 'advance') { void advance(); return; }
    if (action === 'cancel' && attempt) { void payment.cancel(attempt.id); return; }
    if (action === 'receipt' && attempt) { openReceipt(attempt.order.id); return; }
    if (action === 'shop') { returnToShop(); return; }
    if (attempt) update({ method: attempt.method, preference: attempt.order.deliveryPreference ?? 'asap' });
    reviewCheckout();
  }
  const needsRecovery = checkoutLocked && !!view.primary.needsUnlocked;
  return <OrderPage title="Simulated payment" onBack={() => backTo('/checkout')} footer={<>
    {needsRecovery ? <>
      <Text style={ui.body}>Recover the saved checkout before starting another attempt.</Text>
      <Button label="Retry payment recovery" disabled={payment.busy} onPress={retryRecovery} />
    </> : <Button label={payment.busy ? 'Verifying & saving…' : view.primary.label} disabled={payment.busy} onPress={() => handleAction(view.primary.id)} />}
    {view.secondary && <Button label={view.secondary.label} variant="quiet"
      disabled={payment.busy || (!!view.secondary.needsUnlocked && checkoutLocked)} onPress={() => { if (view.secondary) handleAction(view.secondary.id); }} />}
  </>}>
    <Text style={ui.body}>No money is transferred. Payment verification and order fulfillment are separate states.</Text>
    <StatusPanel presentation={view.presentation} />
    {payment.busy && <Text accessibilityLiveRegion="polite" style={ui.body}>Checking your saved payment and order…</Text>}
    {payment.error && <View style={ui.card}>
      <Text accessibilityRole="alert" style={ui.body}>{payment.error}</Text>
      <Button label="Reload saved payment status" variant="secondary" disabled={payment.busy} onPress={retryRecovery} />
    </View>}
    {attempt && <>
      <View style={ui.card}>
        <Text style={ui.heading}>{attempt.method === 'upi' ? 'Simulated UPI' : 'Mock Cash on Delivery'}</Text>
        <Text style={ui.title}>{formatMoney(attempt.order.grandTotal)}</Text>
        <Text style={ui.small}>Reviewed total · saved with this attempt</Text>
        <Text style={ui.body}>Order: {attempt.finalized ? 'placed · local demo, no fulfillment' : 'not confirmed'}</Text>
        {attempt.finalized && <Text selectable style={ui.heading}>{attempt.order.id}</Text>}
        <Text selectable style={ui.small}>Attempt: {attempt.id}</Text>
      </View>
      <Text style={ui.heading}>Your saved delivery details</Text>
      <AddressSummary snapshot={attempt.order.deliveryAddress} />
      <Text style={ui.small}>Reviewed delivery preference: {attempt.order.deliveryPreference ?? 'not recorded'} · simulated</Text>
      <OrderItems items={attempt.order.items} />
      <BillSummary bill={attempt.order} showDeliveryPolicy={false} />
    </>}
  </OrderPage>;
}
