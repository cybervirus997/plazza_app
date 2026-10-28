import { catalogData } from '../src/data/catalog';
import { categories } from '../src/data/categories';
import demoProducts from '../src/data/demo-products.json';
import { filterProducts, parseDemoProducts } from '../src/features/catalog/products';
import { homeSections, resolveHomeSections, type HomeSection } from '../src/features/home/sections';
import { localCatalogRepository } from '../src/repositories/local/LocalCatalogRepository';
import { addMedicine } from '../src/domain/cart';
import { createSnapshotStore } from '../src/storage/persistence';
import { emptyShoppingState } from '../src/domain/types';

test('the separate fixture adds 42 demo products and preserves every medicine field and ID', async () => {
  const products = await localCatalogRepository.load();
  expect(parseDemoProducts(demoProducts)).toHaveLength(42);
  expect(products).toHaveLength(57);
  expect(new Set(products.map((product) => product.id)).size).toBe(57);
  for (const medicine of catalogData.medicines) {
    expect(products.find((product) => product.id === medicine.id)).toMatchObject(medicine);
    expect(await localCatalogRepository.search({ query: medicine.name })).toEqual(expect.arrayContaining([expect.objectContaining(medicine)]));
  }
  expect(products.filter((product) => product.isDemo).every((product) => product.id.startsWith('demo-'))).toBe(true);
});

test('categories include cross-category medicines exactly once and combine with name/salt search', async () => {
  const products = await localCatalogRepository.load();
  const before = JSON.stringify(products);
  for (const category of categories) {
    const matches = filterProducts(products, { categoryId: category.id });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((product) => product.categoryIds.includes(category.id))).toBe(true);
    expect(new Set(matches.map((product) => product.id)).size).toBe(matches.length);
  }
  expect(filterProducts(products, { categoryId: 'pain-relief', query: '  PARACETAMOL ' }).map((product) => product.id)).toEqual(['m1', 'm2', 'm7']);
  expect(filterProducts(products, { categoryId: 'baby-care', query: 'paracetamol' })).toEqual([]);
  expect(filterProducts(products, { categoryId: 'unknown' })).toEqual([]);
  expect(filterProducts(products, { query: ' ' })).toEqual(products);
  expect(JSON.stringify(products)).toBe(before);
});

test('sections follow configuration order, selection order, category boundaries and limits', async () => {
  const products = await localCatalogRepository.load();
  const config: readonly HomeSection[] = [
    { kind: 'products', id: 'picked', title: 'Picked', productIds: ['m3', 'm1', 'm2'], limit: 2 },
    { kind: 'offer', id: 'promo', title: 'Demo', subtitle: 'Demo only', cta: 'Explore' },
    { kind: 'products', id: 'baby', title: 'Baby', categoryId: 'baby-care', limit: 3 },
    { kind: 'products', id: 'empty', title: 'Empty', categoryId: 'baby-care', productIds: ['m1'], limit: 2 },
  ];
  const sections = resolveHomeSections(products, config);
  expect(sections.map((section) => section.id)).toEqual(['picked', 'promo', 'baby', 'empty']);
  expect(sections[0]).toMatchObject({ products: [{ id: 'm3' }, { id: 'm1' }] });
  expect(sections[1]).toEqual(config[1]);
  expect(sections[2].kind === 'products' && sections[2].products).toHaveLength(3);
  expect(sections[3]).toMatchObject({ products: [] });
  expect(resolveHomeSections(products).map((section) => section.id)).toEqual(homeSections.map((section) => section.id));
});

test.each([0, -1, 1.5, Infinity])('invalid section limit %s is rejected', (limit) => {
  expect(() => resolveHomeSections([], [{ kind: 'products', id: 'bad', title: 'Bad', limit }])).toThrow('configuration');
});

test('duplicate section IDs, missing curated products and invalid demo metadata fail explicitly', async () => {
  const products = await localCatalogRepository.load();
  expect(() => resolveHomeSections(products, [homeSections[0], homeSections[0]])).toThrow('configuration');
  expect(() => resolveHomeSections(products, [{ kind: 'products', id: 'bad', title: 'Bad', productIds: ['missing'], limit: 2 }])).toThrow('configuration');
  expect(() => parseDemoProducts([{ ...demoProducts[0], categoryIds: ['missing'] }])).toThrow('metadata');
  expect(() => parseDemoProducts([{ ...demoProducts[0], id: 'm1' }])).toThrow('metadata');
});

test('expanded products use the unchanged cart and v1 snapshot, preserving original quantities', async () => {
  const products = await localCatalogRepository.load();
  let cart = addMedicine([], 'm1', products);
  for (let i = 0; i < 10; i++) cart = addMedicine(cart, demoProducts[0].id, products);
  expect(cart).toEqual([{ medicineId: 'm1', quantity: 1 }, { medicineId: demoProducts[0].id, quantity: 5 }]);
  const snapshot = { ...emptyShoppingState(), cart, recentSearches: ['Dolo'] };
  let raw: string | null = null;
  const store = createSnapshotStore({ getItem: async () => raw, setItem: async (_key, value) => { raw = value; } });
  expect(await store.save(snapshot)).toBe(true);
  expect(await store.restore(products)).toEqual({ snapshot });
});

test('the expanded repository rejects a missing required medicine source rather than serving demo-only data', async () => {
  jest.replaceProperty(catalogData, 'error', 'Required catalog missing');
  try {
    await expect(localCatalogRepository.load()).rejects.toThrow('Required catalog missing');
    await expect(localCatalogRepository.search({ query: 'wipes' })).rejects.toThrow('Required catalog missing');
  } finally { jest.restoreAllMocks(); }
});
