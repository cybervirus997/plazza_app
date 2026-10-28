import type { Order } from '../domain/orders';
import type { OrderTracking, TrackingStage } from '../domain/tracking';
export interface TrackingRepository {
  get(orderId: string): Promise<OrderTracking | null>;
  ensure(order: Order, finalized: boolean): Promise<OrderTracking>;
  advance(orderId: string, stage: TrackingStage, eventId: string): Promise<OrderTracking>;
}
