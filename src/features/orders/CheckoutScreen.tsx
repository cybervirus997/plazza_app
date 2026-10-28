import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { allowsDemoCod, demoServiceability } from '../../domain/checkoutReview';
import type { DeliveryPreference } from '../../domain/orders';
import { paymentScenarios, unresolvedPayment, type PaymentMethod, type PaymentScenario } from '../../domain/payments';
import { useShopping } from '../../state/AppStateProvider';
import { formatMoney, ui } from '../../theme/tokens';
import { useAddressBook } from '../addresses/AddressBookProvider';
import { DeliveryAddressEntry } from '../addresses/DeliveryAddressEntry';
import { BillSummary } from '../cart/BillSummary';
import { AddressSummary } from './AddressSummary';
import { OrderItems } from './OrderItems';
import { OrderPage } from './OrderPage';
import { useCheckoutReview } from './useCheckoutReview';
import { useScreenActive } from '../../hooks/useScreenActive';

export default function CheckoutScreen() {
  const { payment, startPayment, checkoutLocked, retryRecovery } = useShopping();
  const addresses = useAddressBook();
  const [preference, setPreference] = useState<DeliveryPreference>('asap');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [scenario, setScenario] = useState<PaymentScenario>('pending-success');
  const { review, error } = useCheckoutReview(addresses.selected, preference);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const isActive = useScreenActive();
  // Navigation is performed by the caller only after the durable attempt exists.
  const pending = unresolvedPayment(payment.attempt);
  async function continueToPayment() {
    if (!review || payment.busy || pending || checkoutLocked) return;
    const result = await startPayment({ review, method, scenario, address: addresses.snapshotForOrder });
    if (!isActive()) return;
    if (result?.attempt) router.push('/payment');
    else setNavigationError('Review the current details and try again.');
  }
  if (pending && payment.attempt) return <OrderPage title="Checkout" footer={<>
    <Text style={ui.body}>Your reviewed payment attempt is saved. Resolve or cancel it before changing checkout.</Text>
    <Button label="Resume saved payment" onPress={() => router.replace('/payment')} disabled={payment.busy} />
  </>}>
    <Text style={ui.body}>These are the frozen details of your saved attempt. Address-book and catalog changes cannot replace them.</Text>
    {payment.error && <Text accessibilityRole="alert" style={ui.body}>{payment.error}</Text>}
    <AddressSummary snapshot={payment.attempt.order.deliveryAddress} />
    <OrderItems items={payment.attempt.order.items} />
    <BillSummary bill={payment.attempt.order} showDeliveryPolicy={false} />
  </OrderPage>;
  if (payment.attempt?.finalized && !review) return <OrderPage title="Checkout">
    <Text style={ui.heading}>Your previous mock order is saved.</Text>
    <Button label="View confirmed order" onPress={() => router.replace({ pathname: '/order-confirmation', params: { id: payment.attempt?.order.id } })} />
    <Button label="Continue Shopping" variant="secondary" onPress={() => router.replace('/')} />
  </OrderPage>;
  return <OrderPage title="Checkout" footer={checkoutLocked ? <>
    <Text style={ui.body}>Checkout recovery must finish before a new payment.</Text>
    <Button label="Retry checkout recovery" onPress={retryRecovery} disabled={payment.busy} />
  </> : <>
    <Text style={ui.body}>Final total · {formatMoney(review?.grandTotal ?? 0)}</Text>
    <Button label={payment.busy ? 'Saving reviewed checkout…' : 'Continue to simulated payment →'} onPress={() => { void continueToPayment(); }}
      disabled={!review || !addresses.ready || addresses.busy || payment.busy || (method === 'cod' && !allowsDemoCod(review))} />
  </>}>
    <Text style={ui.body}>Review your items, delivery details and total. Nothing is charged in this demo.</Text>
    <DeliveryAddressEntry disabled={payment.busy} />
    {review && <AddressSummary snapshot={review.deliveryAddress} />}
    <Button label={addresses.selected ? 'Change Address' : 'Add a delivery address'} variant="secondary" disabled={pending || payment.busy}
      onPress={() => router.push('/addresses')} />
    {(error || payment.error || navigationError) && <Text accessibilityRole="alert" style={ui.body}>{payment.error ?? error ?? navigationError}</Text>}
    {!review && <Button label="Edit Cart" variant="secondary" disabled={payment.busy} onPress={() => router.push('/cart')} />}
    <View style={ui.card}>
      <Text style={ui.heading}>Demo availability & serviceability</Text><Text style={ui.body}>{demoServiceability}</Text>
      {review && <Text style={ui.body}>All reviewed products are marked available in the local demo catalog.</Text>}
      {review?.items.some((item) => item.rx) && <Text accessibilityRole="alert" style={ui.body}>Prescription review required. This demo does not collect or approve prescriptions; an Rx badge is not approval.</Text>}
    </View>
    <View style={ui.card}>
      <Text style={ui.heading}>Delivery preference · simulated</Text>
      <Text style={ui.small}>ASAP or a scheduled window is a saved preference, not a confirmed ETA or reservation.</Text>
      <Button label={`${preference === 'asap' ? '✓ ' : ''}ASAP · demo preference`} variant="secondary" disabled={pending || payment.busy} onPress={() => setPreference('asap')} />
      <Button label={`${preference === 'scheduled' ? '✓ ' : ''}Scheduled · evening demo window`} variant="secondary" disabled={pending || payment.busy} onPress={() => setPreference('scheduled')} />
    </View>
    {review && <>
      <View style={ui.between}><Text style={ui.heading}>Items in your order</Text><Button label="Edit Cart" variant="quiet" disabled={payment.busy} onPress={() => router.push('/cart')} /></View>
      <OrderItems items={review.items} />
      <Text style={ui.body}>{review.couponCode ? `${review.couponCode} · saving ${formatMoney(review.discount)}` : 'No coupon applied'}</Text>
      <BillSummary bill={review} />
    </>}
    <View style={ui.card}>
      <Text style={ui.heading}>Choose a simulated payment method</Text>
      <Button label={`${method === 'upi' ? '✓ ' : ''}Simulated UPI`} variant="secondary" disabled={pending || payment.busy} onPress={() => setMethod('upi')} />
      <Button label={`${method === 'cod' ? '✓ ' : ''}Mock Cash on Delivery`} variant="secondary" disabled={pending || payment.busy || !review || !allowsDemoCod(review)} onPress={() => setMethod('cod')} />
      <Text style={ui.small}>Demo COD is available for totals up to ₹2,000. No cash collection or fulfillment occurs.</Text>
    </View>
    {__DEV__ && method === 'upi' && <View style={ui.card}>
      <Text style={ui.heading}>Developer simulation outcome</Text>
      <Text style={ui.small}>This control exercises the local simulator. No bank or UPI app is contacted.</Text>
      {paymentScenarios.map((outcome) => <Button key={outcome} label={`${scenario === outcome ? '✓ ' : ''}${outcome}`} variant="quiet"
        disabled={pending || payment.busy} onPress={() => setScenario(outcome)} />)}
    </View>}
  </OrderPage>;
}
