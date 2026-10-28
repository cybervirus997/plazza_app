import type { Medicine } from './types';

export function searchMedicines(catalog: readonly Medicine[], query: string): readonly Medicine[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return catalog.filter((item) => item.name.toLowerCase().includes(normalized)
    || item.salt.toLowerCase().includes(normalized));
}

export function addRecentSearch(recent: readonly string[], query: string): readonly string[] {
  const trimmed = query.trim();
  if (!trimmed) return recent;
  return [trimmed, ...recent.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
}
