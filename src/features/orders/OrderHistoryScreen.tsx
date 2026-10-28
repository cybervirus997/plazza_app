import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { OrderHistoryCard } from './OrderHistoryCard';
import { unresolvedPayment } from '../../domain/payments';
import { useOrderHistory } from './useOrders';
import { openPayment, openReceipt, returnToShop } from '../../navigation/commerceNavigation';

export default function OrderHistoryScreen() {
  const { orders, payment } = useShopping();
  const history = useOrderHistory(orders);
  return <SafeAreaView style={ui.screen}>
    <FlatList data={history.data?.orders ?? []} keyExtractor={(order) => order.id} contentContainerStyle={ui.content}
      ListHeaderComponent={<View style={{ gap: 12 }}>
        <Button label="← Home" variant="quiet" onPress={() => returnToShop()} />
        <Text style={ui.label}>PLAZZA · SAVED ON THIS DEVICE</Text><Text accessibilityRole="header" style={ui.title}>Your orders</Text>
        <Text style={ui.body}>Local demo orders, newest first. Payment and fulfillment are separate; no real delivery occurs.</Text>
        {history.data?.warning && <Text accessibilityRole="alert" style={ui.body}>{history.data.warning}</Text>}
        {unresolvedPayment(payment.attempt) && <Button label="Open saved payment attempt" variant="secondary" onPress={openPayment} />}
      </View>}
      renderItem={({ item }) => <OrderHistoryCard order={item} reconciling={payment.attempt?.order.id === item.id && !payment.attempt.finalized} onOpen={openReceipt} />}
      ListEmptyComponent={<View style={ui.card}>
        {history.status === 'loading' ? <><ActivityIndicator accessibilityLabel="Loading saved orders" color={colors.primary} /><Text style={ui.body}>Loading your saved orders…</Text></>
          : history.error ? <><Text accessibilityRole="alert" style={ui.body}>{history.error}</Text><Button label="Retry orders" onPress={history.retry} /></>
            : <><Text style={ui.heading}>No saved orders yet</Text><Text style={ui.body}>Your completed demo checkout receipts will appear here.</Text><Button label="Browse products" onPress={() => returnToShop()} /></>}
      </View>}
      ListFooterComponent={history.data?.warning ? <Button label="Retry orders" variant="secondary" onPress={history.retry} /> : undefined} />
  </SafeAreaView>;
}
