import { Text, View } from 'react-native';
import type { OrderItemSnapshot } from '../../domain/orders';
import { formatMoney, ui } from '../../theme/tokens';

export function OrderItem({ item }: { item: OrderItemSnapshot }) {
  return <View style={ui.card}>
    <Text style={ui.heading}>{item.name}</Text>
    <Text style={ui.body}>{item.quantity} × {formatMoney(item.unitPrice)} = {formatMoney(item.quantity * item.unitPrice)}</Text>
    {item.rx && <Text style={ui.small}>Rx · Prescription review required. No prescription has been verified.</Text>}
  </View>;
}
export function OrderItems({ items }: { items: readonly OrderItemSnapshot[] }) {
  return <>{items.map((item) => <OrderItem key={item.productId} item={item} />)}</>;
}
