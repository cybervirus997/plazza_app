import { parseCatalog } from '../../data/catalog';
import { categories, type CategoryId, type ProductImageKey } from '../../data/categories';
import { searchMedicines } from '../../domain/search';
import type { Medicine } from '../../domain/types';
import { isRecord } from '../../storage/persistence';

export interface Product extends Medicine {
  readonly subtitle?: string;
  readonly categoryIds: readonly CategoryId[];
  readonly imageKey?: ProductImageKey;
  readonly tags: readonly string[];
  readonly isAvailable: boolean;
  readonly isDemo: boolean;
}

export interface CatalogFilter {
  readonly categoryId?: string;
  readonly query?: string;
}

export function filterProducts(products: readonly Product[], filter: CatalogFilter = {}): readonly Product[] {
  const matches = filter.query?.trim()
    ? new Set(searchMedicines(products, filter.query).map((product) => product.id)) : null;
  return products.filter((product) => (!filter.categoryId || product.categoryIds.some((id) => id === filter.categoryId))
    && (!matches || matches.has(product.id)));
}

const medicineCategories: Readonly<Record<string, readonly CategoryId[]>> = {
  m1: ['pain-relief'], m2: ['pain-relief'], m5: ['cold-cough'], m6: ['cold-cough'],
  m7: ['pain-relief'], m10: ['pain-relief'], m11: ['cold-cough'], m12: ['cold-cough'],
  m13: ['cold-cough'], m14: ['pain-relief'], m15: ['daily-wellness'],
};

export function adaptMedicine(medicine: Medicine): Product {
  return { ...medicine, categoryIds: ['medicines', ...(medicineCategories[medicine.id] ?? [])],
    imageKey: 'medicine', tags: [], isAvailable: true, isDemo: false };
}

export function parseDemoProducts(source: unknown): readonly Product[] {
  const medicines = parseCatalog(source);
  if (!Array.isArray(source)) throw new Error('Demo products must be an array.');
  return medicines.map((medicine, index) => {
    const item: unknown = source[index];
    if (!isRecord(item) || !medicine.id.startsWith('demo-') || medicine.rx
      || typeof item.subtitle !== 'string' || !item.subtitle.trim()
      || !Array.isArray(item.categoryIds) || item.categoryIds.length === 0
      || new Set(item.categoryIds).size !== item.categoryIds.length
      || !item.categoryIds.every((id: unknown) => categories.some((category) => category.id === id))
      || (item.imageKey !== undefined && !categories.some((category) => category.imageKey === item.imageKey))
      || !Array.isArray(item.tags) || !item.tags.every((tag: unknown) => typeof tag === 'string')
      || item.isDemo !== true || typeof item.isAvailable !== 'boolean') {
      throw new Error('The demo product catalog contains invalid metadata.');
    }
    return { ...medicine, subtitle: item.subtitle, categoryIds: item.categoryIds as CategoryId[],
      imageKey: item.imageKey as ProductImageKey | undefined, tags: item.tags,
      isAvailable: item.isAvailable, isDemo: true };
  });
}
