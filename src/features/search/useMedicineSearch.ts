import { useEffect, useState } from 'react';
import { searchCatalog } from '../../data/catalog';
import type { Medicine } from '../../domain/types';

type SearchState =
  | { status: 'idle' | 'loading'; results: readonly Medicine[] }
  | { status: 'results'; results: readonly Medicine[] }
  | { status: 'error'; results: readonly Medicine[]; message: string };

export function useMedicineSearch() {
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState<SearchState>({ status: 'idle', results: [] });

  useEffect(() => {
    if (!query.trim()) return;
    let current = true;
    // Debounce local work; the 250ms demo delay also makes loading visible.
    const timer = setTimeout(() => {
      void searchCatalog(query).then((results) => {
        if (current) setSearch({ status: 'results', results });
      }).catch(() => {
        if (current) setSearch({ status: 'error', results: [], message: 'We could not search the medicine catalog. Please try again.' });
      });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query, revision]);

  function updateQuery(value: string) {
    setQuery(value);
    setSearch({ status: value.trim() ? 'loading' : 'idle', results: [] });
    // Submitting the same recent query reruns it too.
    setRevision((value) => value + 1);
  }
  return { query, search, updateQuery };
}
