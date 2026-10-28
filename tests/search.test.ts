import { addRecentSearch, searchMedicines } from '../src/domain/search';
import { catalog } from './fixtures';

test('matches partial medicine names', () => expect(searchMedicines(catalog, 'rel')[0].id).toBe('a'));
test('matches partial salts', () => expect(searchMedicines(catalog, 'ceti')[0].id).toBe('b'));
test('ignores case', () => expect(searchMedicines(catalog, 'PARACETAMOL')[0].id).toBe('a'));
test('trims surrounding whitespace', () => expect(searchMedicines(catalog, '  Relief  ')[0].id).toBe('a'));
test('returns no results for an unknown query', () => expect(searchMedicines(catalog, 'unmatched')).toEqual([]));
test('empty input has no results', () => expect(searchMedicines(catalog, '  ')).toEqual([]));
test('recent searches are newest first and capped at five', () => {
  expect(addRecentSearch(['one', 'two', 'three', 'four', 'five'], 'six')).toEqual(['six', 'one', 'two', 'three', 'four']);
});
test('recent searches deduplicate case-insensitively and move to the front', () => {
  expect(addRecentSearch(['Care', 'Relief'], ' relief ')).toEqual(['relief', 'Care']);
});
test('blank recent queries are ignored', () => expect(addRecentSearch(['Care'], '   ')).toEqual(['Care']));
