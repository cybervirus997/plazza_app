import { addressDraft, chooseAddress, emptyAddressBook, removeAddress, saveAddress, snapshotDeliveryAddress, validateAddress,
  type AddressDraft, type DeliveryAddress } from '../src/domain/addresses';
import { ADDRESS_STORAGE_KEY, createLocalAddressRepository, decodeAddressBook } from '../src/repositories/local/LocalAddressRepository';
import type { StoragePort } from '../src/storage/persistence';

const draft = (patch: Partial<AddressDraft> = {}): AddressDraft => ({ ...addressDraft(), label: "Dad's Home", addressLine: '12 Garden Road',
  city: 'Bengaluru', state: 'Karnataka', pinCode: '560001', ...patch });
function address(id: string, patch: Partial<AddressDraft> = {}): DeliveryAddress {
  const result = validateAddress(draft(patch));
  if (!result.valid) throw new Error('Invalid test data');
  return { id, ...result.value };
}
function memoryStorage() {
  const data = new Map<string, string>();
  const storage: StoragePort = { getItem: jest.fn(async (key) => data.get(key) ?? null), setItem: jest.fn(async (key, value) => { data.set(key, value); }) };
  return { storage, data };
}

test('manual addresses require no coordinates, preserve separate labels/relationships and normalize phone input', () => {
  const result = validateAddress(draft({ label: "Mom's Place", relationship: 'Friend', recipientName: '  Alex  ', recipientPhone: '+91 (98765) 43210' }));
  expect(result).toMatchObject({ valid: true, value: { label: "Mom's Place", relationship: 'Friend', recipientName: 'Alex', recipientPhone: '+919876543210', coordinates: null } });
});

test.each(['label', 'addressLine', 'city', 'state'] as const)('%s is mandatory', (field) => {
  expect(validateAddress(draft({ [field]: '  ' }))).toMatchObject({ valid: false, errors: { [field]: expect.any(String) } });
});

test.each(['12345', '1234567', '012345', 'ABCDEF', '560 001', ''])('PIN %s is rejected', (pinCode) => {
  expect(validateAddress(draft({ pinCode }))).toMatchObject({ valid: false, errors: { pinCode: expect.any(String) } });
});

test.each([
  { latitude: '91', longitude: '10' }, { latitude: '10', longitude: '-181' },
  { latitude: '0', longitude: '' }, { latitude: 'NaN', longitude: '2' }, { latitude: 'Infinity', longitude: '2' },
])('invalid or incomplete coordinates are rejected: %j', (patch) => {
  expect(validateAddress(draft(patch)).valid).toBe(false);
});

test('zero and boundary coordinates are accepted, with optional phone and bounded instructions', () => {
  expect(validateAddress(draft({ latitude: '0', longitude: '0' }))).toMatchObject({ valid: true, value: { coordinates: { latitude: 0, longitude: 0 } } });
  expect(validateAddress(draft({ latitude: '-90', longitude: '180' })).valid).toBe(true);
  expect(validateAddress(draft({ recipientPhone: 'not a phone' })).valid).toBe(false);
  expect(validateAddress(draft({ instructions: 'a'.repeat(501) })).valid).toBe(false);
  expect(validateAddress(draft({ label: 'a'.repeat(51) })).valid).toBe(false);
});

test('gate instructions and delivery preferences are explicit demo data', () => {
  expect(validateAddress(draft({ gateAccess: 'other' }))).toMatchObject({ valid: false, errors: { societyApp: expect.any(String) } });
  expect(validateAddress(draft({ gateAccess: 'other', societyApp: 'Our Society', deliveryOption: 'gate', callBeforeArrival: true })))
    .toMatchObject({ valid: true, value: { societyApp: 'Our Society', gateAccess: 'other', deliveryOption: 'gate', callBeforeArrival: true } });
});

test('first address is default and selected; changing either ID leaves the other independent', () => {
  let book = saveAddress(emptyAddressBook(), address('a'));
  book = saveAddress(book, address('b'));
  expect(book).toMatchObject({ defaultAddressId: 'a', selectedAddressId: 'a' });
  book = chooseAddress(book, 'b', 'selected');
  expect(book).toMatchObject({ defaultAddressId: 'a', selectedAddressId: 'b' });
  book = chooseAddress(book, 'b', 'default');
  expect(book).toMatchObject({ defaultAddressId: 'b', selectedAddressId: 'b' });
  book = chooseAddress(book, 'a', 'selected');
  expect(book).toMatchObject({ defaultAddressId: 'b', selectedAddressId: 'a' });
  expect(() => chooseAddress(book, 'missing', 'selected')).toThrow('no longer exists');
});

test('editing preserves stable IDs and deletion chooses a valid default/selection or an empty book', () => {
  let book = saveAddress(saveAddress(emptyAddressBook(), address('a')), address('b'), { select: true });
  book = saveAddress(book, address('a', { city: 'Mysuru' }));
  expect(book.addresses).toHaveLength(2);
  expect(book.addresses[0].city).toBe('Mysuru');
  book = removeAddress(book, 'a');
  expect(book).toMatchObject({ defaultAddressId: 'b', selectedAddressId: 'b' });
  expect(removeAddress(book, 'b')).toEqual(emptyAddressBook());
});

test('a future order gets a detached, deeply frozen, versioned snapshot that survives edits/deletion', () => {
  const book = saveAddress(emptyAddressBook(), address('a', { latitude: '12', longitude: '77', gateAccess: 'mygate', instructions: 'Call at tower A' }));
  const snapshot = snapshotDeliveryAddress(book);
  const edited = saveAddress(book, address('a', { city: 'Mysuru', gateAccess: 'none' }));
  expect(snapshot).toMatchObject({ version: 1, address: { city: 'Bengaluru', gateAccess: 'mygate', instructions: 'Call at tower A', coordinates: { latitude: 12, longitude: 77 } } });
  expect(snapshot?.address).not.toBe(book.addresses[0]);
  expect(snapshot?.address.coordinates).not.toBe(book.addresses[0].coordinates);
  expect(Object.isFrozen(snapshot?.address.coordinates)).toBe(true);
  expect(Object.isFrozen(snapshot?.address)).toBe(true);
  expect(removeAddress(edited, 'a')).toEqual(emptyAddressBook());
  expect(snapshot?.address.city).toBe('Bengaluru');
  expect(snapshotDeliveryAddress(emptyAddressBook())).toBeNull();
});

test('repository serializes additions and persists edits, defaults, selection and deletion across restart', async () => {
  const { storage, data } = memoryStorage();
  data.set('plazza.shopping.v1', 'unchanged');
  const repository = createLocalAddressRepository(storage);
  await Promise.all([repository.save(draft()), repository.save(draft({ label: 'Work' }))]);
  const { book } = await repository.load();
  const [a, b] = book.addresses;
  expect(a.id).not.toBe(b.id);
  await repository.select(b.id);
  await repository.setDefault(a.id);
  await repository.save(draft({ label: 'Custom', society: 'Garden Society' }), { id: b.id });
  const restored = await createLocalAddressRepository(storage).load();
  expect(restored.book).toMatchObject({ defaultAddressId: a.id, selectedAddressId: b.id });
  expect(restored.book.addresses[1]).toMatchObject({ id: b.id, label: 'Custom', society: 'Garden Society' });
  await repository.remove(a.id);
  expect((await repository.load()).book.defaultAddressId).toBe(b.id);
  await repository.remove(b.id);
  expect((await repository.load()).book).toEqual(emptyAddressBook());
  expect(data.get('plazza.shopping.v1')).toBe('unchanged');
});

test('corrupt storage recovers valid addresses and repairs missing default/selection IDs', () => {
  expect(decodeAddressBook('{broken')).toMatchObject({ book: emptyAddressBook(), warning: expect.any(String) });
  const decoded = decodeAddressBook(JSON.stringify({ version: 1, addresses: [address('a'), address('a'), { id: 'bad' }, address('b')], defaultAddressId: 'missing', selectedAddressId: 'bad' }));
  expect(decoded.book.addresses.map((item) => item.id)).toEqual(['a', 'b']);
  expect(decoded.book).toMatchObject({ defaultAddressId: 'a', selectedAddressId: 'a' });
  expect(decoded.warning).not.toBeNull();
});

test('a new explicit save can recover invalid JSON, while future versions are never overwritten', async () => {
  const { storage, data } = memoryStorage();
  data.set(ADDRESS_STORAGE_KEY, '{bad');
  const repository = createLocalAddressRepository(storage);
  await repository.save(draft());
  expect((await repository.load()).book.addresses).toHaveLength(1);
  data.set(ADDRESS_STORAGE_KEY, JSON.stringify({ version: 2, addresses: [] }));
  await expect(repository.save(draft())).rejects.toThrow('not supported');
  expect(JSON.parse(data.get(ADDRESS_STORAGE_KEY) ?? '{}').version).toBe(2);
});

test('failed storage reads/writes leave existing data intact and later operations recover', async () => {
  const { storage } = memoryStorage();
  const repository = createLocalAddressRepository(storage);
  const book = await repository.save(draft());
  jest.mocked(storage.getItem).mockRejectedValueOnce(new Error('read failure'));
  await expect(repository.remove(book.addresses[0].id)).rejects.toThrow('could not be loaded');
  jest.mocked(storage.setItem).mockRejectedValueOnce(new Error('write failure'));
  await expect(repository.remove(book.addresses[0].id)).rejects.toThrow('could not be saved');
  expect((await repository.load()).book.addresses).toHaveLength(1);
  await repository.remove(book.addresses[0].id);
  expect((await repository.load()).book.addresses).toHaveLength(0);
});
