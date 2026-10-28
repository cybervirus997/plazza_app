import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusPanel';
import type { Order } from '../../domain/orders';
import { colors, ui } from '../../theme/tokens';
import { orderSummary } from './orderPresentation';
import { fulfillmentStatuses } from './statusPresentation';

export const OrderHistoryCard = memo(function OrderHistoryCard({ order, reconciling, onOpen }: { order: Order; reconciling: boolean; onOpen(id: string): void }) {
  const summary = orderSummary(order);
  return <View style={[styles.card, reconciling && styles.reconciling]}>
    <View style={styles.header}><StatusBadge {...fulfillmentStatuses[order.status]} /><Text style={styles.total}>{summary.total}</Text></View>
    <Text style={styles.date}>{summary.date}</Text>
    <Text style={styles.id} accessibilityLabel={`Order identifier ${order.id}`} numberOfLines={1} ellipsizeMode="middle">{order.id}</Text>
    <Text style={styles.preview} numberOfLines={2}>{summary.preview}</Text>
    <Text style={ui.small}>{summary.productCount} {summary.productCount === 1 ? 'product' : 'products'} · {summary.quantity} {summary.quantity === 1 ? 'item' : 'items'}</Text>
    {reconciling && <StatusBadge label="Checkout reconciliation pending" tone="pending" icon="clock" />}
    <View style={styles.footer}><Text style={styles.note}>Local demo · no fulfillment</Text>
      <Button label="View Details" accessibilityLabel={`View order ${order.id}`} variant="secondary" onPress={() => onOpen(order.id)} /></View>
  </View>;
});
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary,
    borderRadius: 18, padding: 18, gap: 10 },
  reconciling: { borderColor: colors.amber, borderLeftColor: colors.amber },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  total: { color: colors.ink, fontSize: 24, lineHeight: 31, fontWeight: '700' },
  date: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  id: { color: colors.muted, fontSize: 12, lineHeight: 18 }, preview: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  footer: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  note: { color: colors.muted, fontSize: 11, lineHeight: 18, flexShrink: 1 },
});
