import { act } from 'react';
import { createRoot } from 'test-renderer';
import { useScreenActive, useScreenCompletion } from '../src/hooks/useScreenActive';
import { deferred } from './order-fixtures';

let mockBlur: (() => void) | undefined;
let mockFocus: (() => void) | undefined;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => (() => void) | void) => {
  const React = jest.requireActual<typeof import('react')>('react');
  React.useEffect(() => {
    const focus = () => { mockBlur = effect() ?? undefined; };
    mockFocus = focus;
    focus();
    return () => { mockBlur?.(); };
  }, [effect]);
} }));
test('covered native-stack screens reject late navigation while mounted, then reactivate on focus', async () => {
  const root = createRoot(); const saved = deferred<void>(); const navigate = jest.fn();
  let isActive = () => false;
  function Probe() { isActive = useScreenActive(); return null; }
  await act(async () => { root.render(<Probe />); });
  expect(isActive()).toBe(true);
  const completion = saved.promise.then(() => { if (isActive()) navigate(); });
  mockBlur?.();
  expect(isActive()).toBe(false);
  await act(async () => { saved.resolve(); await completion; });
  expect(navigate).not.toHaveBeenCalled();
  mockFocus?.();
  expect(isActive()).toBe(true);
  await act(async () => { root.unmount(); });
  expect(isActive()).toBe(false);
});

test('completion is tied to its focus visit and can navigate only once, including duplicate callbacks', async () => {
  const root = createRoot(); const navigate = jest.fn();
  let capture: ReturnType<typeof useScreenCompletion> | undefined;
  function Probe() { capture = useScreenCompletion(); return null; }
  await act(async () => { root.render(<Probe />); });
  const stale = capture?.();
  mockBlur?.(); mockFocus?.();
  expect(stale?.isCurrent()).toBe(false);
  stale?.navigate(navigate);
  expect(navigate).not.toHaveBeenCalled();
  const current = capture?.(); current?.navigate(navigate); current?.navigate(navigate); capture?.().navigate(navigate);
  expect(navigate).toHaveBeenCalledTimes(1);
  await act(async () => { root.unmount(); });
  expect(current?.isCurrent()).toBe(false);
});
