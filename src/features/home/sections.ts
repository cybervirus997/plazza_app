import { categories, type CategoryId } from '../../data/categories';
import { filterProducts, type Product } from '../catalog/products';

export interface ProductSection {
  readonly kind: 'products';
  readonly id: string;
  readonly title: string;
  readonly categoryId?: CategoryId;
  readonly productIds?: readonly string[];
  readonly limit: number;
}

export interface OfferBanner {
  readonly kind: 'offer';
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly cta: string;
  readonly categoryId?: CategoryId;
}

export type HomeSection = ProductSection | OfferBanner;

export const homeSections: readonly HomeSection[] = [
  { kind: 'offer', id: 'offer', title: 'A little care, every day',
    subtitle: 'Explore our demo wellness collection. Illustrative products and prices; no real stock or delivery promise.',
    cta: 'Explore daily wellness', categoryId: 'daily-wellness' },
  { kind: 'products', id: 'medicines', title: 'Explore medicines', categoryId: 'medicines', limit: 4 },
  ...categories.filter((category) => category.id !== 'medicines').map((category): ProductSection => ({
    kind: 'products', id: category.id, title: category.title, categoryId: category.id, limit: 6,
  })),
];

export function resolveHomeSections(products: readonly Product[], config: readonly HomeSection[] = homeSections) {
  const ids = new Set<string>();
  return config.map((section) => {
    if (!section.id.trim() || ids.has(section.id) || !section.title.trim()
      || (section.categoryId && !categories.some((category) => category.id === section.categoryId))) {
      throw new Error('Invalid Home section configuration.');
    }
    ids.add(section.id);
    if (section.kind === 'offer') return section;
    if (!Number.isSafeInteger(section.limit) || section.limit < 1
      || (section.productIds && (new Set(section.productIds).size !== section.productIds.length
        || section.productIds.some((id) => !products.some((product) => product.id === id))))) {
      throw new Error('Invalid Home product section configuration.');
    }
    const filtered = filterProducts(products, { categoryId: section.categoryId });
    const selected = section.productIds
      ? section.productIds.flatMap((id) => filtered.filter((product) => product.id === id)) : filtered;
    return { ...section, products: selected.slice(0, section.limit) };
  });
}
