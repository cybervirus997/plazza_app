import type { Order, OrderItemSnapshot } from '../../domain/orders';
import { formatMoney } from '../../theme/tokens';

export function orderDate(value: string): string {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function orderSummary(order: Order) {
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const preview = order.items.slice(0, 2).map((item) => item.name).join(' · ');
  return { quantity, productCount: order.items.length, total: formatMoney(order.grandTotal), date: orderDate(order.placedAt),
    preview: `${preview}${order.items.length > 2 ? ` · +${order.items.length - 2} more` : ''}` };
}
export function receiptLine(item: OrderItemSnapshot) {
  return { unit: formatMoney(item.unitPrice), total: formatMoney(Math.round(item.unitPrice * 100) * item.quantity / 100) };
}
