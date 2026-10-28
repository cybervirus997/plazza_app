import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      eventReceived = true;
      if (active) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !eventReceived) setReduced(value);
    }).catch(() => { /* Keep transitions disabled if the preference cannot be read. */ });
    return () => { active = false; listener.remove(); };
  }, []);
  return reduced;
}
