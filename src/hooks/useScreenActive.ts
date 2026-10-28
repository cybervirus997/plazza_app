import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

function useFocusVisit() {
  const visit = useRef({ active: false, version: 0, navigated: false });
  useFocusEffect(useCallback(() => {
    const current = visit.current;
    current.version += 1;
    current.active = true;
    current.navigated = false;
    return () => { current.active = false; current.version += 1; };
  }, []));
  return visit;
}

/** Current focus only; async navigation must capture a visit with useScreenCompletion. */
export function useScreenActive() {
  const visit = useFocusVisit();
  return () => visit.current.active;
}

/** Capture the current focus visit; one completion may navigate during that visit. */
export function useScreenCompletion() {
  const visit = useFocusVisit();
  return () => {
    const version = visit.current.version;
    const isCurrent = () => visit.current.active && visit.current.version === version;
    return { isCurrent, navigate(action: () => void) {
      if (!isCurrent() || visit.current.navigated) return;
      visit.current.navigated = true;
      action();
    } };
  };
}
