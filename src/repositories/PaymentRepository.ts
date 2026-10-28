import type { PaymentAttempt, PaymentStatus } from '../domain/payments';

export interface PaymentRepository {
  readonly version: 1;
  load(): Promise<PaymentAttempt | null>;
  create(attempt: PaymentAttempt): Promise<PaymentAttempt>;
  transition(id: string, status: PaymentStatus, updatedAt: string): Promise<PaymentAttempt>;
  finalize(id: string): Promise<PaymentAttempt>;
}
