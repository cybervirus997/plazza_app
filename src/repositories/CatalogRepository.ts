import type { CatalogFilter, Product } from '../features/catalog/products';

export interface CatalogRepository {
  load(): Promise<readonly Product[]>;
  search(filter: CatalogFilter): Promise<readonly Product[]>;
}
