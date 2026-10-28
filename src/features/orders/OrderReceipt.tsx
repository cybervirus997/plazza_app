import { Text, View } from 'react-native';
import type { Order } from '../../domain/orders';
import { formatMoney, ui } from '../../theme/tokens';
import { AddressSummary } from './AddressSummary';
import { BillSummary } from '../cart/BillSummary';

export function orderDate(value: string): string {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function OrderIdentity({ order, reconciling = false }: { order: Order; reconciling?: boolean }) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return <View style={ui.card}>
    <Text style={ui.heading}>{order.id}</Text><Text style={ui.body}>{orderDate(order.placedAt)}</Text>
    <Text style={ui.body}>{count} items · {formatMoney(order.grandTotal)}</Text>
    <Text style={ui.body}>Order status: {reconciling ? 'reconciliation pending' : 'placed · local demo only'}</Text>
    <Text style={ui.small}>No pharmacy verification, delivery fulfillment or live tracking.</Text>
  </View>;
}
export function OrderReceiptFooter({ order }: { order: Order }) {
  return <>
    <Text style={ui.body}>{order.couponCode ? `Coupon ${order.couponCode} · saved ${formatMoney(order.discount)}` : 'No coupon applied'}</Text>
    <BillSummary bill={order} showDeliveryPolicy={false} />
    <View style={ui.card}>
      <Text style={ui.heading}>Payment · simulation only</Text>
      <Text style={ui.body}>{!order.payment ? 'Legacy demo order · payment metadata was not recorded.'
        : order.payment.method === 'cod' ? 'Mock COD · confirmed, no cash collected' : 'Simulated UPI · succeeded, no money transferred'}</Text>
      {order.payment && <Text style={ui.small}>Payment attempt: {order.payment.attemptId}</Text>}
      <Text style={ui.body}>Delivery preference: {order.deliveryPreference ?? 'not recorded'}{order.deliveryPreference ? ' · simulated, no ETA promise' : ''}</Text>
    </View>
    <Text style={ui.heading}>Delivery details saved with this order</Text>
    <AddressSummary snapshot={order.deliveryAddress} />
    <Text style={ui.small}>This immutable receipt uses purchase-time prices and delivery details. It is a local demonstration, not a tax invoice or proof of payment.</Text>
  </>;
}
