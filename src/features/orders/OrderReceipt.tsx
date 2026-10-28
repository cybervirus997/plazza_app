import { StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '../../components/ui/StatusPanel';
import type { Order } from '../../domain/orders';
import { colors, formatMoney, ui } from '../../theme/tokens';
import { AddressSummary } from './AddressSummary';
import { BillSummary } from '../cart/BillSummary';
import { orderSummary } from './orderPresentation';
import { fulfillmentStatuses, receiptPaymentLabel } from './statusPresentation';

export function OrderIdentity({ order, reconciling = false }: { order: Order; reconciling?: boolean }) {
  const summary = orderSummary(order);
  return <View style={ui.card}>
    <StatusBadge {...fulfillmentStatuses[order.status]} />
    <Text selectable style={ui.heading}>{order.id}</Text><Text style={ui.body}>{summary.date}</Text>
    <Text style={ui.label}>SAVED ORDER TOTAL</Text><Text style={styles.total}>{summary.total}</Text>
    <Text style={ui.body}>{summary.productCount} products · {summary.quantity} items</Text>
    <Text style={ui.small}>{fulfillmentStatuses[order.status].explanation}</Text>
    {reconciling && <><StatusBadge label="Checkout reconciliation pending" tone="pending" icon="clock" />
      <Text style={ui.body}>Receipt saved · checkout is not yet finalized.</Text></>}
  </View>;
}
export function OrderReceiptFooter({ order }: { order: Order }) {
  return <>
    <Text style={ui.body}>{order.couponCode ? `Coupon ${order.couponCode} · saved ${formatMoney(order.discount)}` : 'No coupon applied'}</Text>
    <BillSummary bill={order} showDeliveryPolicy={false} />
    <View style={ui.card}>
      <Text style={ui.heading}>Payment · simulation only</Text>
      <Text style={ui.body}>{receiptPaymentLabel(order)}</Text>
      {order.payment && <Text selectable style={ui.small}>Payment attempt: {order.payment.attemptId}</Text>}
      <Text style={ui.body}>Delivery preference: {order.deliveryPreference ?? 'not recorded'}{order.deliveryPreference ? ' · simulated, no ETA promise' : ''}</Text>
    </View>
    <Text style={ui.heading}>Delivery details saved with this order</Text>
    <AddressSummary snapshot={order.deliveryAddress} />
    <Text style={ui.small}>This immutable receipt uses purchase-time prices and delivery details. It is a local demonstration, not a tax invoice or proof of payment.</Text>
  </>;
}
const styles = StyleSheet.create({ total: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' } });
