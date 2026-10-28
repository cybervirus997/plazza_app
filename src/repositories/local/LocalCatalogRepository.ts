import { catalogData } from '../../data/catalog';
import demoProducts from '../../data/demo-products.json';
import { adaptMedicine, filterProducts, parseDemoProducts } from '../../features/catalog/products';
import type { CatalogRepository } from '../CatalogRepository';

export const localCatalogRepository: CatalogRepository = {
  async load() {
    // The extra fixture must never hide a missing required medicine catalog.
    if (catalogData.error) throw new Error(catalogData.error);
    const products = [...catalogData.medicines.map(adaptMedicine), ...parseDemoProducts(demoProducts)];
    if (new Set(products.map((product) => product.id)).size !== products.length) {
      throw new Error('The product catalog contains duplicate IDs.');
    }
    return products;
  },
  async search(filter) {
    return filterProducts(await localCatalogRepository.load(), filter);
  },
};
