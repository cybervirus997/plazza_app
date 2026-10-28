import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Order } from '../../domain/orders';
import type { PaymentAttempt } from '../../domain/payments';
import type { ShoppingState } from '../../domain/types';
import { CheckoutCancelledError, type CheckoutLifecycle } from './checkout';
import type { OrderingResult, OrderingService, StartPaymentInput } from './ordering';

interface Callbacks {
  onFinalized(snapshot: ShoppingState, order: Order): void;
  onResult(result: OrderingResult): void;
}
export function usePaymentFlow(service: OrderingService, callbacks: Callbacks, scope: object) {
  const [state, setState] = useState<{ attempt: PaymentAttempt | null; busy: boolean; error: string | null }>({ attempt: null, busy: false, error: null });
  const epoch = useRef(0);
  const mounted = useRef(false);
  const running = useRef(false);
  const inflight = useRef<Promise<OrderingResult | null> | null>(null);
  const handlers = useRef(callbacks);
  useLayoutEffect(() => { handlers.current = callbacks; });
  useLayoutEffect(() => {
    mounted.current = true;
    epoch.current += 1;
    return () => { mounted.current = false; epoch.current += 1; };
  }, [service, scope]);

  const execute = useCallback((operation: (lifecycle: CheckoutLifecycle) => Promise<OrderingResult>, external: CheckoutLifecycle = {}, propagate = false) => {
    if (!mounted.current || running.current) return Promise.resolve(null);
    const version = epoch.current;
    const isCurrent = () => mounted.current && version === epoch.current && (!external.isCurrent || external.isCurrent());
    if (!isCurrent()) return Promise.reject(new CheckoutCancelledError());
    running.current = true;
    setState((previous) => ({ ...previous, busy: true, error: null }));
    const result = (async () => {
      try {
        const next = await operation({ isCurrent, onFinalized(snapshot, order) {
          if (isCurrent()) handlers.current.onFinalized(snapshot, order);
        } });
        if (!isCurrent()) return null;
        setState({ attempt: next.attempt, busy: false, error: null });
        handlers.current.onResult(next);
        return next;
      } catch (error: unknown) {
        let saved: PaymentAttempt | null | undefined;
        if (isCurrent()) { try { saved = await service.inspectPayment(); } catch { /* Keep the previous view if storage cannot be read. */ } }
        if (isCurrent()) setState((previous) => ({ ...previous, attempt: saved === undefined ? previous.attempt : saved, busy: false,
          error: error instanceof Error ? error.message : 'The simulated payment needs recovery. Retry without starting a new payment.' }));
        if (propagate) throw error;
        return null;
      } finally { running.current = false; }
    })();
    inflight.current = result;
    return result;
  }, [service]);
  const recover = useCallback(async (lifecycle: CheckoutLifecycle = {}) => {
    await inflight.current?.catch(() => undefined);
    if (lifecycle.isCurrent && !lifecycle.isCurrent()) throw new CheckoutCancelledError();
    return execute((life) => service.recover(life), lifecycle, true);
  }, [execute, service]);
  return { ...state, recover,
    start: (input: StartPaymentInput) => execute((life) => service.start(input, life)),
    advance: (id: string, action: 'pay' | 'check') => execute((life) => service.advance(id, action, life)),
    cancel: (id: string) => execute((life) => service.cancel(id, life)),
  };
}
