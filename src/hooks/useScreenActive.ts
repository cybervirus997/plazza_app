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
