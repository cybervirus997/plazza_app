import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Linking } from 'react-native';
import { initialPermissions, readPermissions, requestInitialPermissions, type PermissionSnapshot } from './permissions';

interface PermissionContext extends PermissionSnapshot {
  busy: boolean;
  error: string | null;
  refresh(): void;
  request(): void;
  openSettings(): void;
}

const Context = createContext<PermissionContext | null>(null);

export function PermissionProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(initialPermissions);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const refreshQueued = useRef(false);

  const run = useCallback(async (mode: 'refresh' | 'request') => {
    if (running.current) { refreshQueued.current = true; return; }
    running.current = true;
    setBusy(true);
    do {
      refreshQueued.current = false;
      const result = await readPermissions(mode);
      setSnapshot(result);
      mode = 'refresh';
    } while (refreshQueued.current);
    running.current = false;
    setBusy(false);
  }, []);

  useEffect(() => {
    let active = true;
    running.current = true;
    void requestInitialPermissions().then((result) => {
      if (!active) return;
      setSnapshot(result);
      running.current = false;
      setBusy(false);
      if (refreshQueued.current) void run('refresh');
    });
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && previousState !== 'active') void run('refresh');
      previousState = nextState;
    });
    return () => { active = false; subscription.remove(); };
  }, [run]);

  const openSettings = () => {
    void Linking.openSettings().catch(() => setError('Settings could not be opened. Open your phone’s Settings and find Plazza under Apps.'));
  };
  return <Context value={{ ...snapshot, busy, error, refresh: () => { void run('refresh'); }, request: () => { void run('request'); }, openSettings }}>{children}</Context>;
}

export function usePermissions(): PermissionContext {
  const context = useContext(Context);
  if (!context) throw new Error('usePermissions must be inside PermissionProvider.');
  return context;
}
