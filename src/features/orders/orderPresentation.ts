import type { Order, OrderItemSnapshot } from '../../domain/orders';
import { formatMoney } from '../../theme/tokens';

/** Display aid only; the full immutable ID remains the reconciliation identity. */
export function orderReference(id: string): string {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return `PLZ-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function orderDate(value: string): string {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function orderSummary(order: Order) {
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const preview = order.items.slice(0, 2).map((item) => item.name).join(' · ');
  return { reference: orderReference(order.id), quantity, productCount: order.items.length, total: formatMoney(order.grandTotal), date: orderDate(order.placedAt),
    preview: `${preview}${order.items.length > 2 ? ` · +${order.items.length - 2} more` : ''}` };
}
export function receiptLine(item: OrderItemSnapshot) {
  return { unit: formatMoney(item.unitPrice), total: formatMoney(Math.round(item.unitPrice * 100) * item.quantity / 100) };
}
