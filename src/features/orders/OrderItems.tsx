import { StyleSheet, Text, View } from 'react-native';
import type { OrderItemSnapshot } from '../../domain/orders';
import { colors, ui } from '../../theme/tokens';
import { receiptLine } from './orderPresentation';

export function OrderItem({ item }: { item: OrderItemSnapshot }) {
  const line = receiptLine(item);
  return <View style={styles.line}>
    <Text style={styles.name}>{item.name}</Text>
    <View style={styles.amounts}><Text style={ui.body}>{item.quantity} × {line.unit} = </Text><Text style={styles.total}>{line.total}</Text></View>
    {item.rx && <Text style={ui.small}>Rx · Prescription review required. No prescription has been verified.</Text>}
  </View>;
}
export function OrderItems({ items }: { items: readonly OrderItemSnapshot[] }) {
  return <View style={ui.card}>{items.map((item) => <OrderItem key={item.productId} item={item} />)}</View>;
}
const styles = StyleSheet.create({
  line: { padding: 14, gap: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  total: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '700' },
});
