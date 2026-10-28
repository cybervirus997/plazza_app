import { parseCatalog } from '../src/data/catalog';
import { catalog } from './fixtures';

test('parses valid medicine metadata without modifying the source', () => expect(parseCatalog(catalog)).toEqual(catalog));
test.each([null, {}, 'invalid'])('rejects an invalid catalog container %p', (value) => expect(() => parseCatalog(value)).toThrow());
test('rejects duplicate medicine IDs', () => expect(() => parseCatalog([catalog[0], catalog[0]])).toThrow());
test.each([{ price: -1 }, { price: Number.NaN }, { maxQty: 0 }, { maxQty: 1.5 }, { rx: 'true' }, { id: '' }, { salt: null }])('rejects invalid metadata %p', (override) => {
  expect(() => parseCatalog([{ ...catalog[0], ...override }])).toThrow();
});
