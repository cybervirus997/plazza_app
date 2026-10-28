import { act } from 'react';
import { AccessibilityInfo } from 'react-native';
import { createRoot } from 'test-renderer';
import { useReducedMotion } from '../src/hooks/useReducedMotion';
import { deferred } from './order-fixtures';

afterEach(() => { jest.restoreAllMocks(); });
test.each([false, true])('reduced motion reflects the OS preference %s and updates without polling', async (preference) => {
  let change: (value: boolean) => void = () => {};
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => { change = callback; return { remove }; });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(preference);
  const root = createRoot(); let value = true;
  function Probe() { value = useReducedMotion(); return null; }
  await act(async () => { root.render(<Probe />); });
  expect(value).toBe(preference);
  await act(async () => { change(!preference); });
  expect(value).toBe(!preference);
  await act(async () => { root.unmount(); });
  expect(remove).toHaveBeenCalledTimes(1);
});
test('a newer preference event wins over a stale initial response, and late results after unmount are ignored', async () => {
  const pending = deferred<boolean>(); let change: (value: boolean) => void = () => {}; const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => { change = callback; return { remove }; });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(pending.promise);
  const root = createRoot(); let value = true; const renders = jest.fn();
  function Probe() { value = useReducedMotion(); renders(); return null; }
  await act(async () => { root.render(<Probe />); });
  await act(async () => { change(true); pending.resolve(false); });
  expect(value).toBe(true);
  await act(async () => { root.unmount(); }); const count = renders.mock.calls.length;
  await act(async () => { change(false); });
  expect(renders).toHaveBeenCalledTimes(count);
  expect(remove).toHaveBeenCalledTimes(1);
});
test('preference read failure leaves animations safely disabled', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('unavailable'));
  const root = createRoot(); let value = false;
  function Probe() { value = useReducedMotion(); return null; }
  await act(async () => { root.render(<Probe />); });
  expect(value).toBe(true);
  await act(async () => { root.unmount(); });
});
