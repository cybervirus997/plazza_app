import { isRecord } from '../storage/persistence';
import type { Medicine } from '../domain/types';
import { searchMedicines } from '../domain/search';
import { catalogSource } from './catalog.generated';

export function parseCatalog(source: unknown): readonly Medicine[] {
  if (!Array.isArray(source)) throw new Error('The medicine catalog must be an array.');
  const ids = new Set<string>();
  return source.map((item: unknown) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim()
      || typeof item.name !== 'string' || !item.name.trim()
      || typeof item.salt !== 'string' || !item.salt.trim()
      || typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0
      || typeof item.maxQty !== 'number' || !Number.isSafeInteger(item.maxQty) || item.maxQty < 1
      || typeof item.rx !== 'boolean' || ids.has(item.id)) {
      throw new Error('The medicine catalog contains an invalid or duplicate entry.');
    }
    ids.add(item.id);
    return { id: item.id, name: item.name, salt: item.salt, price: item.price, maxQty: item.maxQty, rx: item.rx };
  });
}

function loadCatalog() {
  if (catalogSource === null) {
    return { medicines: [], error: 'Our medicine catalog is unavailable. Please try again once the catalog has been restored.' };
  }
  try { return { medicines: parseCatalog(catalogSource), error: null }; }
  catch { return { medicines: [], error: 'Our medicine catalog could not be loaded. Please try again later.' }; }
}

export const catalogData = loadCatalog();

export async function searchCatalog(query: string): Promise<readonly Medicine[]> {
  if (catalogData.error) throw new Error(catalogData.error);
  return searchMedicines(catalogData.medicines, query);
}
