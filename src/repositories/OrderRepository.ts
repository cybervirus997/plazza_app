import type { Order } from '../domain/orders';

export class OrderHistoryRecoveryError extends Error {
  constructor() { super('Order history needs recovery. Existing data has not been changed and new orders cannot be saved.'); this.name = 'OrderHistoryRecoveryError'; }
}
export class UnsupportedOrderVersionError extends Error {
  constructor() { super('This order-history version is not supported. Existing data has not been changed.'); this.name = 'UnsupportedOrderVersionError'; }
}
export class OrderConflictError extends Error {
  constructor() { super('An order or checkout ID already belongs to a different receipt.'); this.name = 'OrderConflictError'; }
}

export interface OrderHistoryResult {
  readonly orders: readonly Order[];
  readonly warning: string | null;
  readonly canWrite: boolean;
}
export interface OrderCreateResult {
  readonly order: Order;
  readonly created: boolean;
}
export interface OrderRepository {
  readonly version: 1;
  load(): Promise<OrderHistoryResult>;
  getById(id: string): Promise<Order | null>;
  create(order: Order): Promise<OrderCreateResult>;
}
