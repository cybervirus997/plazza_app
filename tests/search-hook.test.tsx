import { act } from 'react';
import { createRoot } from 'test-renderer';
import { searchCatalog } from '../src/data/catalog';
import type { Medicine } from '../src/domain/types';
import { useMedicineSearch } from '../src/features/search/useMedicineSearch';
import { catalog } from './fixtures';

jest.mock('../src/data/catalog', () => ({ searchCatalog: jest.fn() }));

type SearchController = ReturnType<typeof useMedicineSearch>;

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Promise not initialized.'); };
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

async function withSearch(check: (read: () => SearchController) => Promise<void>) {
  const root = createRoot();
  let current: SearchController | undefined;
  function Probe() {
    current = useMedicineSearch();
    return null;
  }
  const read = () => {
    if (!current) throw new Error('Search hook has not rendered.');
    return current;
  };
  try {
    await act(async () => { root.render(<Probe />); });
    await check(read);
  } finally { await act(async () => { root.unmount(); }); }
}

const advanceDebounce = () => act(async () => { await jest.advanceTimersByTimeAsync(150); });

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(searchCatalog).mockReset().mockResolvedValue([]);
});
afterEach(() => { jest.useRealTimers(); });

test('search starts idle and one 150ms debounce searches only the latest typed query', async () => {
  jest.mocked(searchCatalog).mockResolvedValue([catalog[0]]);
  await withSearch(async (read) => {
    expect(read().search).toEqual({ status: 'idle', results: [] });
    await act(async () => { read().updateQuery('do'); });
    expect(read().search.status).toBe('loading');
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    await act(async () => { read().updateQuery('dol'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(149); });
    expect(searchCatalog).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(searchCatalog).toHaveBeenCalledTimes(1);
    expect(searchCatalog).toHaveBeenCalledWith('dol');
    expect(read().search).toEqual({ status: 'results', results: [catalog[0]] });
  });
});

test('an old result resolved in the same act as typing a new query cannot replace loading', async () => {
  const previous = deferred<readonly Medicine[]>();
  const latest = deferred<readonly Medicine[]>();
  jest.mocked(searchCatalog).mockReturnValueOnce(previous.promise).mockReturnValueOnce(latest.promise);
  await withSearch(async (read) => {
    await act(async () => { read().updateQuery('dol'); });
    await advanceDebounce();
    await act(async () => {
      read().updateQuery('para');
      previous.resolve([catalog[0]]);
      await Promise.resolve();
    });
    expect(read().query).toBe('para');
    expect(read().search).toEqual({ status: 'loading', results: [] });
    await advanceDebounce();
    await act(async () => { latest.resolve([catalog[1]]); });
    expect(read().search).toEqual({ status: 'results', results: [catalog[1]] });
  });
});

test('a late previous response cannot replace already loaded newer results', async () => {
  const previous = deferred<readonly Medicine[]>();
  const latest = deferred<readonly Medicine[]>();
  jest.mocked(searchCatalog).mockReturnValueOnce(previous.promise).mockReturnValueOnce(latest.promise);
  await withSearch(async (read) => {
    await act(async () => { read().updateQuery('dol'); });
    await advanceDebounce();
    await act(async () => { read().updateQuery('cet'); });
    await advanceDebounce();
    await act(async () => { latest.resolve([catalog[1]]); });
    await act(async () => { previous.resolve([catalog[0]]); });
    expect(read().query).toBe('cet');
    expect(read().search).toEqual({ status: 'results', results: [catalog[1]] });
  });
});

test('clearing a query immediately returns to idle and ignores a pending result', async () => {
  const pending = deferred<readonly Medicine[]>();
  jest.mocked(searchCatalog).mockReturnValueOnce(pending.promise);
  await withSearch(async (read) => {
    await act(async () => { read().updateQuery('dol'); });
    await advanceDebounce();
    await act(async () => {
      read().updateQuery('');
      pending.resolve([catalog[0]]);
      await Promise.resolve();
    });
    await advanceDebounce();
    expect(read().query).toBe('');
    expect(read().search).toEqual({ status: 'idle', results: [] });
    expect(searchCatalog).toHaveBeenCalledTimes(1);
  });
});

test('a repository failure produces an error and retrying the same query can recover', async () => {
  jest.mocked(searchCatalog).mockRejectedValueOnce(new Error('Catalog unavailable')).mockResolvedValueOnce([catalog[0]]);
  await withSearch(async (read) => {
    await act(async () => { read().updateQuery('dol'); });
    await advanceDebounce();
    expect(read().search).toMatchObject({ status: 'error', results: [], message: expect.stringContaining('Please try again') });
    await act(async () => { read().updateQuery('dol'); });
    expect(read().search.status).toBe('loading');
    await advanceDebounce();
    expect(searchCatalog).toHaveBeenCalledTimes(2);
    expect(read().search).toEqual({ status: 'results', results: [catalog[0]] });
  });
});

test('whitespace-only queries remain idle and do not invoke the repository', async () => {
  await withSearch(async (read) => {
    await act(async () => { read().updateQuery('   '); });
    await advanceDebounce();
    expect(read().search).toEqual({ status: 'idle', results: [] });
    expect(searchCatalog).not.toHaveBeenCalled();
  });
});

test('a completed search with no matches retains an explicit results state', async () => {
  await withSearch(async (read) => {
    await act(async () => { read().updateQuery('no-matching-medicine'); });
    await advanceDebounce();
    expect(read().search).toEqual({ status: 'results', results: [] });
  });
});
