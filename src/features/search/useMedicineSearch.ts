import { useEffect, useRef, useState } from 'react';
import { searchCatalog } from '../../data/catalog';
import type { Medicine } from '../../domain/types';

type SearchState =
  | { status: 'idle' | 'loading'; results: readonly Medicine[] }
  | { status: 'results'; results: readonly Medicine[] }
  | { status: 'error'; results: readonly Medicine[]; message: string };

export function useMedicineSearch(searchProducts: typeof searchCatalog = searchCatalog) {
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const [search, setSearch] = useState<SearchState>({ status: 'idle', results: [] });

  useEffect(() => {
    if (!query.trim()) return;
    let current = true;
    const id = requestId.current;
    // One short debounce for local search; commits reuse already loaded results.
    const timer = setTimeout(() => {
      void searchProducts(query).then((results) => {
        if (current && id === requestId.current) setSearch({ status: 'results', results });
      }).catch(() => {
        if (current && id === requestId.current) setSearch({ status: 'error', results: [], message: 'We could not search the product catalog. Please try again.' });
      });
    }, 150);
    return () => { current = false; clearTimeout(timer); };
  }, [query, revision, searchProducts]);

  function updateQuery(value: string) {
    requestId.current += 1;
    setQuery(value);
    setSearch({ status: value.trim() ? 'loading' : 'idle', results: [] });
    // Submitting the same recent query reruns it too.
    setRevision((value) => value + 1);
  }
  return { query, search, updateQuery };
}
