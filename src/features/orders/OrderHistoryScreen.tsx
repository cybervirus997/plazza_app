import { Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { OrderHistoryCard } from './OrderHistoryCard';
import { unresolvedPayment } from '../../domain/payments';
import { useOrderHistory } from './useOrders';
import { backTo, openPayment, openReceipt, openTracking, returnToShop } from '../../navigation/commerceNavigation';
import { canTrackOrder } from '../../domain/tracking';
import { headerContentEdges, headerOptions } from '../../navigation/headerOptions';

export default function OrderHistoryScreen() {
  const { orders, payment, state } = useShopping();
  const history = useOrderHistory(orders);
  return <SafeAreaView edges={headerContentEdges} style={ui.screen}>
    <Stack.Screen options={headerOptions('Your orders', 'Back from orders', () => backTo('/'))} />
    <FlatList data={history.data?.orders ?? []} keyExtractor={(order) => order.id} contentContainerStyle={ui.content}
      ListHeaderComponent={<View style={{ gap: 12 }}>
        <Text style={ui.label}>PLAZZA · SAVED ON THIS DEVICE</Text>
        <Text style={ui.body}>Local demo orders, newest first. Payment and fulfillment are separate; no real delivery occurs.</Text>
        {history.data?.warning && <Text accessibilityRole="alert" style={ui.body}>{history.data.warning}</Text>}
        {unresolvedPayment(payment.attempt) && <Button label="Open saved payment attempt" variant="secondary" onPress={openPayment} />}
      </View>}
      renderItem={({ item }) => <OrderHistoryCard order={item} reconciling={payment.attempt?.order.id === item.id && !payment.attempt.finalized} onOpen={openReceipt}
        onTrack={canTrackOrder(item, payment.attempt, state.lastFinalizedCheckoutId) ? openTracking : undefined} />}
      ListEmptyComponent={<View style={ui.card}>
        {history.status === 'loading' ? <><ActivityIndicator accessibilityLabel="Loading saved orders" color={colors.primary} /><Text style={ui.body}>Loading your saved orders…</Text></>
          : history.error ? <><Text accessibilityRole="alert" style={ui.body}>{history.error}</Text><Button label="Retry orders" onPress={history.retry} /></>
            : <><Text style={ui.heading}>No saved orders yet</Text><Text style={ui.body}>Your completed demo checkout receipts will appear here.</Text><Button label="Browse products" onPress={() => returnToShop()} /></>}
      </View>}
      ListFooterComponent={history.data?.warning ? <Button label="Retry orders" variant="secondary" onPress={history.retry} /> : undefined} />
  </SafeAreaView>;
}
