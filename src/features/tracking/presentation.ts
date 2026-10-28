import type { OrderTracking, TrackingStage } from '../../domain/tracking';
import { trackingStage } from '../../domain/tracking';
export const trackingLabels: Record<TrackingStage, string> = {
  placed: 'Order placed', 'rx-review-required': 'Rx review required', confirmed: 'Preparing your order', packing: 'Packing your medicines',
  'out-for-delivery': 'Out for delivery — demo', delivered: 'Delivered — simulated', delayed: 'Demo delayed', cancelled: 'Cancelled — simulated', 'unable-to-fulfill': 'Unable to fulfill — simulated',
};
export function demoETA(tracking: OrderTracking): string | null {
  const stage = trackingStage(tracking);
  if (['rx-review-required', 'delivered', 'cancelled', 'unable-to-fulfill'].includes(stage)
    || (tracking.requiresRx && !tracking.events.some((event) => event.stage === 'confirmed'))) return null;
  return stage === 'delayed' ? `Updated demo estimate: approximately ${tracking.events.at(-1)?.etaMinutes ?? 20} min` : 'Demo ETA: approximately 10 min';
}
