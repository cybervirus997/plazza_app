import { act } from 'react';
import { createRoot } from 'test-renderer';
import { useScreenActive } from '../src/hooks/useScreenActive';
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
