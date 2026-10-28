import type { Order } from './orders';
import type { PaymentAttempt } from './payments';
import { record, text, timestamp, integer } from './recordFields';

export const trackingStages = ['placed', 'rx-review-required', 'confirmed', 'packing', 'out-for-delivery', 'delivered', 'delayed', 'cancelled', 'unable-to-fulfill'] as const;
export type TrackingStage = typeof trackingStages[number];
export interface TrackingEvent { readonly id: string; readonly stage: TrackingStage; readonly at: string; readonly etaMinutes: number | null }
export interface OrderTracking { readonly id: string; readonly version: 1; readonly requiresRx: boolean; readonly events: readonly TrackingEvent[] }
export const trackingStage = (tracking: OrderTracking) => tracking.events[tracking.events.length - 1].stage;
export function nextTrackingStages(tracking: OrderTracking): readonly TrackingStage[] {
  const stage = trackingStage(tracking);
  if (['delivered', 'cancelled', 'unable-to-fulfill'].includes(stage)) return [];
  if (stage === 'delayed') return [tracking.events.filter((event) => event.stage !== 'delayed').at(-1)!.stage, 'cancelled', 'unable-to-fulfill'];
  const next: Partial<Record<TrackingStage, TrackingStage>> = { placed: tracking.requiresRx ? 'rx-review-required' : 'confirmed', 'rx-review-required': 'confirmed', confirmed: 'packing', packing: 'out-for-delivery', 'out-for-delivery': 'delivered' };
  return [next[stage]!, 'delayed', 'cancelled', 'unable-to-fulfill'];
}
export function advanceTracking(tracking: OrderTracking, event: TrackingEvent): OrderTracking {
  const existing = tracking.events.find((item) => item.id === event.id);
  if (existing) { if (existing.stage !== event.stage) throw new Error('Tracking event identity conflicts.'); return tracking; }
  if (trackingStage(tracking) === event.stage) return tracking;
  if (!nextTrackingStages(tracking).includes(event.stage) || event.at < tracking.events.at(-1)!.at) throw new Error('Invalid tracking transition or event time.');
  return Object.freeze({ ...tracking, events: Object.freeze([...tracking.events, Object.freeze(event)]) });
}
export function parseTracking(value: unknown): OrderTracking {
  const input = record(value); const id = text(input.id);
  if (input.version !== 1 || typeof input.requiresRx !== 'boolean' || !Array.isArray(input.events) || !input.events.length) throw new Error('Invalid tracking history.');
  const events = input.events.map((raw): TrackingEvent => {
    const event = record(raw); const stage = text(event.stage) as TrackingStage;
    if (!trackingStages.includes(stage)) throw new Error('Unknown tracking stage.');
    return { id: text(event.id), at: timestamp(event.at), stage, etaMinutes: event.etaMinutes === null ? null : integer(event.etaMinutes, 1, 1440) };
  });
  if (events[0].stage !== 'placed' || new Set(events.map((event) => event.id)).size !== events.length) throw new Error('Invalid tracking origin/identity.');
  let result: OrderTracking = Object.freeze({ id, version: 1, requiresRx: input.requiresRx, events: Object.freeze([Object.freeze(events[0])]) });
  for (const event of events.slice(1)) {
    const next = advanceTracking(result, event);
    if (next === result) throw new Error('Repeated tracking stage.');
    result = next;
  }
  return result;
}
/** Receipt existence alone does not prove finalization. Called after healthy shopping recovery. */
export function canTrackOrder(order: Order, attempt: PaymentAttempt | null, checkpoint?: string | null): boolean {
  if (attempt?.order.id === order.id) return attempt.finalized;
  if (checkpoint === order.checkoutId) return true;
  return !!order.payment && !!attempt && attempt.order.checkoutId !== order.checkoutId;
}
