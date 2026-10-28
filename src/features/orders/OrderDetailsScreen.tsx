import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { OrderItem } from './OrderItems';
import { OrderIdentity, OrderReceiptFooter } from './OrderReceipt';
import { useOrderById } from './useOrders';
import { backTo, openPayment } from '../../navigation/commerceNavigation';

export default function OrderDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { orders, payment } = useShopping();
  const resource = useOrderById(orders, id);
  const order = resource.data;
  return <SafeAreaView style={ui.screen}>
    <FlatList data={order?.items ?? []} keyExtractor={(item) => item.productId} contentContainerStyle={ui.content}
      ListHeaderComponent={<View style={{ gap: 14 }}>
        <Button label="← Back" accessibilityLabel="Back from receipt" variant="quiet" onPress={() => backTo('/orders')} />
        <Text style={ui.label}>PURCHASE-TIME SNAPSHOT</Text><Text accessibilityRole="header" style={ui.title}>Order receipt</Text>
        {order && <OrderIdentity order={order} reconciling={payment.attempt?.order.id === order.id && !payment.attempt.finalized} />}
        {order && payment.attempt?.order.id === order.id && !payment.attempt.finalized && <>
          <Text accessibilityRole="alert" style={ui.body}>This receipt is saved, but checkout reconciliation must finish before order confirmation.</Text>
          <Button label="Resolve saved checkout" onPress={openPayment} />
        </>}
      </View>}
      renderItem={({ item }) => <OrderItem item={item} />}
      ListEmptyComponent={<View style={ui.card}>
        {resource.status === 'loading' ? <ActivityIndicator accessibilityLabel="Loading receipt" color={colors.primary} />
          : resource.error ? <><Text accessibilityRole="alert" style={ui.body}>{resource.error}</Text><Button label="Retry receipt" onPress={resource.retry} /></>
            : <><Text style={ui.heading}>Order not found</Text><Text style={ui.body}>This order ID is not available on this device.</Text></>}
      </View>}
      ListFooterComponent={order ? <OrderReceiptFooter order={order} /> : undefined} />
  </SafeAreaView>;
}
