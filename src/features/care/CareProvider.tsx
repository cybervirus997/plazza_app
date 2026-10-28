import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import type { CareRecord } from '../../domain/carePlans';
import type { CarePlanRepository } from '../../repositories/CarePlanRepository';
import { localCarePlanRepository } from '../../repositories/local/LocalCarePlanRepository';
import { usePermissions } from '../permissions/PermissionProvider';
import { careReminders } from './reminders';
interface CareContext {
  records: readonly CareRecord[]; ready: boolean; busy: boolean; error: string | null; reminderError: string | null;
  refresh(): void; save(record: CareRecord, expectedRevision: number): Promise<boolean>;
  remove(record: CareRecord): Promise<boolean>; action(record: CareRecord, action: 'pause' | 'resume' | 'skip'): Promise<boolean>;
}
const Context = createContext<CareContext | null>(null);
export function CareProvider({ children, repository = localCarePlanRepository, reminders = careReminders }: PropsWithChildren<{
  repository?: CarePlanRepository; reminders?: typeof careReminders;
}>) {
  const [records, setRecords] = useState<readonly CareRecord[]>([]); const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const generation = useRef(0); const running = useRef(false); const active = useRef(false);
  const permissions = usePermissions();
  const refresh = useCallback(() => {
    if (running.current) return;
    const version = ++generation.current;
    void repository.load().then((value) => { if (active.current && version === generation.current) { setRecords(value); setReady(true); setError(null); } })
      .catch((failure: unknown) => { if (active.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Care data could not be loaded.'); });
  }, [repository]);
  useEffect(() => {
    active.current = true; refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { active.current = false; generation.current += 1; listener.remove(); };
  }, [refresh]);
  useEffect(() => {
    if (!ready || permissions.checking) return;
    let current = true;
    void reminders.synchronize(records.filter((record) => record.kind === 'plan'), permissions.notifications === 'granted')
      .then(() => { if (current) setReminderError(null); })
      .catch(() => { if (current) setReminderError('Device reminder scheduling needs retry. Plans and in-app due dates are saved; no order or payment was created.'); });
    return () => { current = false; };
  }, [records, ready, reminders, permissions.notifications, permissions.checking]);
  async function mutate(work: () => Promise<readonly CareRecord[]>) {
    if (!ready || running.current || !active.current) return false;
    running.current = true; setBusy(true); const version = ++generation.current;
    try { const value = await work(); if (active.current && version === generation.current) { setRecords(value); setError(null); } return true; }
    catch (failure: unknown) { if (active.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Care data could not be saved.'); return false; }
    finally { running.current = false; if (active.current) setBusy(false); }
  }
  return <Context value={{ records, ready, busy, error, reminderError, refresh,
    save: (record, expectedRevision) => mutate(() => repository.save(record, expectedRevision)),
    remove: (record) => mutate(() => repository.remove(record.id, record.revision)),
    action: (record, action) => mutate(() => repository.action(record.id, action, record.revision)),
  }}>{children}</Context>;
}
export function useCarePlans() { const context = useContext(Context); if (!context) throw new Error('CareProvider is required.'); return context; }
