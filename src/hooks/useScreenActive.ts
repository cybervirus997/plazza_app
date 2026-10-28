import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Native stacks keep covered screens mounted; navigation callbacks need focus too. */
export function useScreenActive() {
  const active = useRef(false);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []));
  return useCallback(() => active.current, []);
}

/** Capture the current focus visit; one completion may navigate during that visit. */
export function useScreenCompletion() {
  const visit = useRef({ active: false, version: 0, navigated: false });
  useFocusEffect(useCallback(() => {
    const current = visit.current;
    current.version += 1;
    current.active = true;
    current.navigated = false;
    return () => { current.active = false; current.version += 1; };
  }, []));
  return useCallback(() => {
    const version = visit.current.version;
    const isCurrent = () => visit.current.active && visit.current.version === version;
    return { isCurrent, navigate(action: () => void) {
      if (!isCurrent() || visit.current.navigated) return;
      visit.current.navigated = true;
      action();
    } };
  }, []);
}
