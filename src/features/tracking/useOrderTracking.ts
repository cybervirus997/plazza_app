import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Order } from '../../domain/orders';
import type { OrderTracking, TrackingStage } from '../../domain/tracking';
import type { TrackingRepository } from '../../repositories/TrackingRepository';
import { localTrackingRepository } from '../../repositories/local/LocalTrackingRepository';
let eventSequence = 0;
export function useOrderTracking(order: Order | null, eligible: boolean, repository: TrackingRepository = localTrackingRepository) {
  const [data, setData] = useState<OrderTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false); const visit = useRef(0);
  const load = useCallback(() => {
    const version = ++visit.current; setData(null); setError(null); setBusy(false);
    if (!order || !eligible) return;
    void repository.ensure(order, eligible).then((value) => { if (version === visit.current) setData(value); })
      .catch((failure: unknown) => { if (version === visit.current) setError(failure instanceof Error ? failure.message : 'Tracking could not be loaded.'); });
  }, [order, eligible, repository]);
  useFocusEffect(useCallback(() => { load(); return () => { visit.current += 1; }; }, [load]));
  async function advance(stage: TrackingStage) {
    if (!order || !eligible || !data || running.current) return;
    running.current = true; setBusy(true); const version = visit.current;
    try {
      const next = await repository.advance(order.id, stage, `${Date.now()}-${++eventSequence}`);
      if (version === visit.current) { setData(next); setError(null); }
    } catch (failure: unknown) { if (version === visit.current) setError(failure instanceof Error ? failure.message : 'Tracking could not be saved. Retry the same stage.'); }
    finally { running.current = false; if (version === visit.current) setBusy(false); }
  }
  return { data: eligible && data?.id === order?.id ? data : null, error, busy, retry: load, advance };
}
