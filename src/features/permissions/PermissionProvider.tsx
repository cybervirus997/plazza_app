import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { fetchDeliveryLocation, initialPermissions, openPermissionSettings, readPermissions, requestInitialPermissions, requestPermissions,
  type PermissionSnapshot, type PermissionStatus } from './permissions';

interface PermissionActions {
  refresh(): void;
  request(): void;
  updateLocation(): void;
  openSettings(): void;
}
interface PermissionContext extends PermissionSnapshot, PermissionActions {
  busy: boolean;
  checking: boolean;
  locating: boolean;
  error: string | null;
}

const Context = createContext<PermissionContext | null>(null);

export function PermissionProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(initialPermissions);
  const [checking, setChecking] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = useRef<PermissionActions | null>(null);

  useEffect(() => {
    let active = true;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let running = false;
    let locating = false;
    let refreshQueued = false;
    let awaitingSettings = false;
    let statusRevision = 0;
    let locationRevision = 0;
    let lastLocation: PermissionStatus = 'undetermined';

    async function updateLocation() {
      if (!active || !foreground || awaitingSettings || running || locating || lastLocation !== 'granted') return;
      locating = true;
      setLocating(true);
      const revision = ++locationRevision;
      try {
        const result = await fetchDeliveryLocation(() => active && foreground && revision === locationRevision);
        if (!active || !foreground || revision !== locationRevision) return;
        lastLocation = result.location;
        if (result.location !== 'granted') {
          statusRevision += 1;
          refreshQueued ||= running;
        }
        setSnapshot((previous) => ({ ...previous, ...result }));
      } catch {
        if (active && foreground && revision === locationRevision) {
          setSnapshot((previous) => ({ ...previous, coordinates: null,
            locationMessage: 'Could not find your location. Tap Update Location to try again.' }));
        }
      } finally {
        locating = false;
        if (active) setLocating(false);
      }
    }

    async function run(mode: 'initial' | 'refresh' | 'request', queueRefresh = false) {
      if (!active || !foreground || awaitingSettings) return;
      if (running) { refreshQueued ||= queueRefresh; return; }
      running = true;
      setChecking(true);
      setError(null);
      const revision = statusRevision;
      try {
        const result = await (mode === 'initial' ? requestInitialPermissions()
          : mode === 'request' ? requestPermissions() : readPermissions());
        if (!active || !foreground || revision !== statusRevision) return;
        const newlyGranted = result.location === 'granted' && lastLocation !== 'granted';
        lastLocation = result.location;
        if (result.location !== 'granted') locationRevision += 1;
        setSnapshot((previous) => result.location === 'granted' && previous.coordinates
          ? { ...result, coordinates: previous.coordinates, locationMessage: previous.locationMessage } : result);
        // Status refreshes retain an existing fix; only a grant transition starts GPS.
        running = false;
        if (newlyGranted && !refreshQueued) void updateLocation();
      } catch {
        if (active && revision === statusRevision) {
          locationRevision += 1;
          lastLocation = 'unavailable';
          setSnapshot({ ...initialPermissions, location: 'unavailable', notifications: 'unavailable',
            locationMessage: 'Permissions could not be checked. Try Refresh again.' });
          setError('Permissions could not be checked. Try Refresh again.');
        }
      } finally {
        running = false;
        if (active && foreground && revision === statusRevision) setChecking(false);
        if (active && foreground && refreshQueued) {
          refreshQueued = false;
          void run('refresh');
        }
      }
    }

    async function openSettings() {
      if (!active || awaitingSettings) return;
      awaitingSettings = true;
      const revision = ++statusRevision;
      locationRevision += 1;
      setChecking(true);
      setError(null);
      try { await openPermissionSettings(); }
      catch {
        if (!active || revision !== statusRevision) return;
        awaitingSettings = false;
        setChecking(false);
        setError('Settings could not be opened. Open your phone’s Settings and find Plazza under Apps.');
      }
    }

    actions.current = { refresh: () => { void run('refresh'); }, request: () => { void run('request'); },
      updateLocation: () => { void updateLocation(); }, openSettings: () => { void openSettings(); } };
    void run('initial');
    function onAppStateChange(nextState: AppStateStatus) {
      if (!active) return;
      const wasForeground = foreground;
      foreground = nextState === 'active';
      if (!foreground) {
        statusRevision += 1;
        locationRevision += 1;
        // Hide cached coordinates until access has been verified on return.
        setChecking(true);
      } else if (!wasForeground) {
        awaitingSettings = false;
        void run('refresh', true);
      }
    }
    const subscription = AppState.addEventListener('change', onAppStateChange);
    // Android's notification drawer can change focus without changing AppState.
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => onAppStateChange('inactive')) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => {
      if (AppState.currentState === 'active') onAppStateChange('active');
    }) : null;
    return () => {
      active = false;
      locationRevision += 1;
      actions.current = null;
      subscription.remove();
      blur?.remove();
      focus?.remove();
    };
  }, []);

  return <Context value={{ ...snapshot, coordinates: checking ? null : snapshot.coordinates,
    locationMessage: checking ? 'Checking location access…' : snapshot.locationMessage,
    busy: checking || locating, checking, locating, error,
    refresh: () => actions.current?.refresh(), request: () => actions.current?.request(),
    updateLocation: () => actions.current?.updateLocation(), openSettings: () => actions.current?.openSettings(),
  }}>{children}</Context>;
}

export function usePermissions(): PermissionContext {
  const context = useContext(Context);
  if (!context) throw new Error('usePermissions must be inside PermissionProvider.');
  return context;
}
