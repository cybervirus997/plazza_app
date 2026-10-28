import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { StatusPanel } from '../../components/ui/StatusPanel';
import { confirmedPresentation, receiptPaymentLabel } from './statusPresentation';
import { colors, ui } from '../../theme/tokens';
import { AddressSummary } from './AddressSummary';
import { OrderIdentity } from './OrderReceipt';
import { OrderPage } from './OrderPage';
import { useOrderById } from './useOrders';
import { backTo, openOrders, openPayment, openReceipt, openTracking, returnToShop } from '../../navigation/commerceNavigation';

export default function OrderConfirmationScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { orders, state, payment } = useShopping();
  const resource = useOrderById(orders, id);
  const order = resource.data;
  const matchingAttempt = payment.attempt?.order.id === order?.id ? payment.attempt : null;
  const finalized = order && (matchingAttempt ? matchingAttempt.finalized : state.lastFinalizedCheckoutId === order.checkoutId);
  return <OrderPage title="Order confirmation" onBack={() => backTo('/')}>
    {resource.status === 'loading' ? <ActivityIndicator accessibilityLabel="Checking saved confirmation" color={colors.primary} />
      : resource.error ? <><Text accessibilityRole="alert" style={ui.body}>{resource.error}</Text><Button label="Retry confirmation" onPress={resource.retry} /></>
        : !order ? <><Text style={ui.heading}>Order not found</Text><Button label="View orders" onPress={openOrders} /></>
          : !finalized ? <>
            <Text accessibilityRole="alert" style={ui.body}>This order cannot be confirmed from the current finalization evidence. Open its receipt or finish payment reconciliation.</Text>
            <Button label="Open payment recovery" onPress={openPayment} />
            <Button label="View saved receipt" variant="secondary" onPress={() => openReceipt(order.id)} />
          </> : <>
            <StatusPanel presentation={confirmedPresentation} />
            <OrderIdentity order={order} />
            <Text style={ui.body}>{receiptPaymentLabel(order)}</Text>
            {order.items.some((item) => item.rx) && <Text style={ui.body}>Prescription review required. No prescription was verified or approved.</Text>}
            <AddressSummary snapshot={order.deliveryAddress} />
            <Button label="View Order" onPress={() => openReceipt(order.id)} />
            <Button label="Track Demo Order" onPress={() => openTracking(order.id)} />
            <Button label="Continue Shopping" variant="secondary" onPress={() => returnToShop()} />
          </>}
  </OrderPage>;
}
