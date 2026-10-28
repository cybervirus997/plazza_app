import suppliedCatalog from '../src/data/catalog.json';
import { catalogData, parseCatalog, searchCatalog } from '../src/data/catalog';
import { cartCount, getCartItems } from '../src/domain/cart';
import { emptyShoppingState } from '../src/domain/types';
import { createAppReducer, initialAppState } from '../src/state/appReducer';

test('the generated application source loads all 15 supplied demo medicines through schema validation', () => {
  const validated = parseCatalog(suppliedCatalog);
  expect(validated).toHaveLength(15);
  expect(catalogData.error).toBeNull();
  expect(catalogData.medicines).toEqual(validated);
  expect(validated).toEqual(suppliedCatalog);
});

test('every supplied medicine is searchable by name and partial salt, ignoring case and surrounding whitespace', async () => {
  for (const medicine of suppliedCatalog) {
    const names = await searchCatalog(`  ${medicine.name.toUpperCase()}  `);
    const salts = await searchCatalog(`  ${medicine.salt.slice(0, 5).toUpperCase()}  `);
    expect(names.map((item) => item.id)).toContain(medicine.id);
    expect(salts.map((item) => item.id)).toContain(medicine.id);
  }
});

test('adding every supplied medicine resolves the product-card metadata and initial cart quantity', () => {
  const reduce = createAppReducer(catalogData.medicines);
  let state = reduce(initialAppState(), { type: 'hydrate', snapshot: emptyShoppingState() });
  for (const medicine of suppliedCatalog) state = reduce(state, { type: 'add', id: medicine.id });
  expect(cartCount(state.cart)).toBe(15);
  expect(getCartItems(state.cart, catalogData.medicines)).toEqual(
    suppliedCatalog.map((medicine) => ({ medicine, quantity: 1 })),
  );
});

test('repeated Add/Increase actions respect each of the 15 supplied quantity limits', () => {
  const reduce = createAppReducer(catalogData.medicines);
  let state = reduce(initialAppState(), { type: 'hydrate', snapshot: emptyShoppingState() });
  for (const medicine of suppliedCatalog) {
    state = reduce(state, { type: 'add', id: medicine.id });
    for (let tap = 0; tap < medicine.maxQty + 3; tap++) {
      state = reduce(state, { type: 'increase', id: medicine.id });
    }
    expect(state.cart.find((entry) => entry.medicineId === medicine.id)?.quantity).toBe(medicine.maxQty);
  }
  expect(state.cart).toHaveLength(15);
});

test('an empty supplied catalog is an explicit validation error rather than successful empty shopping data', () => {
  expect(() => parseCatalog([])).toThrow('nonempty array');
});
