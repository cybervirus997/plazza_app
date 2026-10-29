import { parseMockMandate, transitionMockMandate, mockChargePreview } from '../src/domain/mockMandates';
import { createLocalMockMandateRepository, MOCK_MANDATE_STORAGE_KEY } from '../src/repositories/local/LocalMockMandateRepository';
import { orderStorage } from './order-fixtures';
import { planFixture, mandateFixture } from './care-fixtures';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
const now = '2026-10-29T10:00:00.000Z';
test('explicit opt-in and permitted preview transitions are independent of reminders', () => {
  const inactive = mandateFixture(); expect(() => transitionMockMandate(inactive, 'activate', false, now)).toThrow('opt-in');
  const active = transitionMockMandate(inactive, 'activate', true, now);
  const paused = transitionMockMandate(active, 'pause', true, now);
  const resumed = transitionMockMandate(paused, 'resume', true, now); expect(resumed.status).toBe('active');
  const cancelled = transitionMockMandate(resumed, 'cancel', true, now); expect(cancelled.optIn).toBe(false);
  expect(() => transitionMockMandate(cancelled, 'resume', true, now)).toThrow('Cancelled');
  expect(() => transitionMockMandate(inactive, 'pause', true, now)).toThrow();
});
test.each([0, -1, Infinity, NaN, 0.001])('invalid simulated cap %s is rejected', (maximumSimulatedAmount) => {
  expect(() => parseMockMandate(mandateFixture({ maximumSimulatedAmount }))).toThrow();
});
test('repository restart, revision conflicts and active-per-plan protection never create commerce writes', async () => {
  const storage = orderStorage(); let repo = createLocalMockMandateRepository(storage.port, () => now);
  await repo.save(mandateFixture(), 0); await repo.action('mandate-1', 'activate', true, 1);
  repo = createLocalMockMandateRepository(storage.port, () => now); expect((await repo.load())[0]).toMatchObject({ status: 'active', optIn: true, revision: 2 });
  await expect(repo.action('mandate-1', 'cancel', true, 1)).rejects.toThrow('changed');
  await expect(repo.save(mandateFixture({ id: 'other' }), 0)).rejects.toThrow('already');
  await repo.action('mandate-1', 'cancel', true, 2);
  await repo.save(mandateFixture({ id: 'other' }), 0);
  expect(await repo.load()).toHaveLength(2);
  expect([...storage.data.keys()]).toEqual([MOCK_MANDATE_STORAGE_KEY]);
});
test('preview uses current catalog values, cap/availability/Rx checks, and does not mutate plans', () => {
  const plan = planFixture(); const before = JSON.stringify(plan);
  const quote = mockChargePreview(plan, [{ id: 'a', name: 'Current', salt: '', price: 750, maxQty: 1, rx: true, isAvailable: false }], mandateFixture());
  expect(quote).toMatchObject({ itemSubtotal: 1500, withinCap: false, requiresRx: true }); expect(quote.problems).toHaveLength(1);
  expect(JSON.stringify(plan)).toBe(before);
});
test('unavailable products below the cap still require review and cannot look eligible', () => {
  const quote = mockChargePreview(planFixture(), [{ id: 'a', name: 'Current', salt: '', price: 1, maxQty: 5, rx: false, isAvailable: false }], mandateFixture());
  expect(quote.itemSubtotal).toBe(2); expect(quote.withinCap).toBe(false); expect(quote.problems).toHaveLength(1);
});
test.each(['broken', JSON.stringify({ version: 88, records: [] }), JSON.stringify({ version: 1, records: [{ ...mandateFixture(), simulationOnly: false }] })])('corruption/unsupported/non-demo data fails closed', async (bytes) => {
  const storage = orderStorage(); storage.data.set(MOCK_MANDATE_STORAGE_KEY, bytes);
  await expect(createLocalMockMandateRepository(storage.port).save(mandateFixture(), 0)).rejects.toThrow();
  expect(storage.data.get(MOCK_MANDATE_STORAGE_KEY)).toBe(bytes); expect(storage.port.setItem).not.toHaveBeenCalled();
});
test('a lost save acknowledgement preserves one inactive identity and never implies activation', async () => {
  const storage = orderStorage(); const repo = createLocalMockMandateRepository(storage.port, () => now);
  jest.mocked(storage.port.setItem).mockImplementationOnce(async (key, value) => { storage.data.set(key, value); throw new Error('lost ack'); });
  await expect(repo.save(mandateFixture(), 0)).rejects.toThrow(); await repo.save(mandateFixture(), 0);
  expect((await repo.load())[0].status).toBe('inactive'); expect(storage.port.setItem).toHaveBeenCalledTimes(1);
});
