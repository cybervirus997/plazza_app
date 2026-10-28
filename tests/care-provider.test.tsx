import { act } from 'react';
import { createRoot } from 'test-renderer';
import { CareProvider, useCarePlans } from '../src/features/care/CareProvider';
import { createLocalCarePlanRepository } from '../src/repositories/local/LocalCarePlanRepository';
import { orderStorage } from './order-fixtures';
import { recipientFixture } from './care-fixtures';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('../src/features/permissions/PermissionProvider', () => ({ usePermissions: () => ({ checking: false, notifications: 'denied' }) }));
test('native reminder failure/denial never prevents independent care persistence or a foreground refresh', async () => {
  const storage = orderStorage(); const repository = createLocalCarePlanRepository(storage.port, () => '2026-10-29T10:00:00.000Z');
  const reminders = { synchronize: jest.fn(async () => { throw new Error('OS unavailable'); }) };
  let current: ReturnType<typeof useCarePlans> | null = null;
  function Probe() { current = useCarePlans(); return null; }
  const root = createRoot();
  try {
    await act(async () => root.render(<CareProvider repository={repository} reminders={reminders}><Probe /></CareProvider>));
    const read = () => { if (!current) throw new Error(); return current; };
    expect(read().ready).toBe(true); expect(read().reminderError).toContain('in-app');
    await act(async () => { expect(await read().save(recipientFixture(), 0)).toBe(true); });
    expect(read().records).toHaveLength(1); expect(read().error).toBeNull();
    await act(async () => { read().refresh(); expect(read().ready).toBe(true); });
    expect(await repository.load()).toHaveLength(1);
  } finally { await act(async () => root.unmount()); }
});
