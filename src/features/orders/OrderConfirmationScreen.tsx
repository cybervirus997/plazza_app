import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { AddressSummary } from './AddressSummary';
import { OrderIdentity } from './OrderReceipt';
import { OrderPage } from './OrderPage';
import { useOrderById } from './useOrders';

export default function OrderConfirmationScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { orders, state, payment } = useShopping();
  const resource = useOrderById(orders, id);
  const order = resource.data;
  const matchingAttempt = payment.attempt?.order.id === order?.id ? payment.attempt : null;
  const finalized = order && (matchingAttempt ? matchingAttempt.finalized : state.lastFinalizedCheckoutId === order.checkoutId);
  return <OrderPage title="Order confirmation" onBack={() => router.replace('/orders')}>
    {resource.status === 'loading' ? <ActivityIndicator accessibilityLabel="Checking saved confirmation" color={colors.primary} />
      : resource.error ? <><Text accessibilityRole="alert" style={ui.body}>{resource.error}</Text><Button label="Retry confirmation" onPress={resource.retry} /></>
        : !order ? <><Text style={ui.heading}>Order not found</Text><Button label="View orders" onPress={() => router.replace('/orders')} /></>
          : !finalized ? <>
            <Text accessibilityRole="alert" style={ui.body}>This order cannot be confirmed from the current finalization evidence. Open its receipt or finish payment reconciliation.</Text>
            <Button label="Open payment recovery" onPress={() => router.replace('/payment')} />
            <Button label="View saved receipt" variant="secondary" onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: order.id } })} />
          </> : <>
            <View style={ui.card}><Text style={ui.heading}>✓ Your mock order is saved</Text><Text style={ui.body}>Checkout is durably finalized on this device. No real payment or delivery occurred.</Text></View>
            <OrderIdentity order={order} />
            <Text style={ui.body}>{order.payment ? order.payment.method === 'cod' ? 'Mock COD · confirmed, no cash collected' : 'Simulated UPI · succeeded, no money transferred' : 'Legacy demo · payment metadata not recorded'}</Text>
            {order.items.some((item) => item.rx) && <Text style={ui.body}>Prescription review required. No prescription was verified or approved.</Text>}
            <AddressSummary snapshot={order.deliveryAddress} />
            <Button label="View Order" onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: order.id } })} />
            <Button label="Continue Shopping" variant="secondary" onPress={() => router.replace('/')} />
          </>}
  </OrderPage>;
}
