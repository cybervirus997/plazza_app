import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { MockMandate } from '../../domain/mockMandates';
import type { MockMandateRepository } from '../../repositories/MockMandateRepository';
import { localMockMandateRepository } from '../../repositories/local/LocalMockMandateRepository';
export function useMockMandates(repository: MockMandateRepository = localMockMandateRepository) {
  const [records, setRecords] = useState<readonly MockMandate[]>([]); const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const generation = useRef(0); const running = useRef(false);
  const active = useRef(false);
  const refresh = useCallback(() => {
    const visit = ++generation.current; setBusy(running.current);
    void repository.load().then((value) => { if (visit === generation.current) { setRecords(value); setReady(true); setError(null); } })
      .catch((failure: unknown) => { if (visit === generation.current) { setReady(false); setError(failure instanceof Error ? failure.message : 'Mock previews could not be read.'); } });
  }, [repository]);
  useFocusEffect(useCallback(() => { active.current = true; refresh(); return () => { active.current = false; generation.current += 1; }; }, [refresh]));
  async function mutate(work: () => Promise<readonly MockMandate[]>) {
    if (!ready || running.current) return;
    const visit = generation.current; running.current = true; setBusy(true);
    try { const next = await work(); if (visit === generation.current) { setRecords(next); setError(null); } }
    catch (failure: unknown) { if (visit === generation.current) setError(failure instanceof Error ? failure.message : 'Mock preview could not be saved.'); }
    finally { running.current = false; if (active.current) setBusy(false); }
  }
  return { records, ready, busy, error, refresh, save: (value: MockMandate, revision: number) => mutate(() => repository.save(value, revision)),
    action: (value: MockMandate, action: Parameters<MockMandateRepository['action']>[1], optIn: boolean) => mutate(() => repository.action(value.id, action, optIn, value.revision)) };
}
