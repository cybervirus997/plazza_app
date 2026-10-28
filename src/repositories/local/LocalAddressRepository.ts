import { addressDraft, addressTextFields, chooseAddress, emptyAddressBook, removeAddress, saveAddress, validateAddress,
  type AddressBook, type DeliveryAddress } from '../../domain/addresses';
import { isRecord, type StoragePort } from '../../storage/persistence';
import type { AddressLoadResult, AddressRepository } from '../AddressRepository';

export const ADDRESS_STORAGE_KEY = 'plazza.addresses.v1';
const recoveryWarning = 'Some saved addresses could not be read. Valid addresses were kept; review your default and delivery selection.';

export function decodeAddressBook(raw: string | null): AddressLoadResult {
  if (!raw) return { book: emptyAddressBook(), warning: null };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { book: emptyAddressBook(), warning: recoveryWarning }; }
  if (!isRecord(parsed)) return { book: emptyAddressBook(), warning: recoveryWarning };
  if (parsed.version !== 1) throw new Error('This saved address-book version is not supported. It has not been overwritten.');
  if (!Array.isArray(parsed.addresses)) return { book: emptyAddressBook(), warning: recoveryWarning };
  const addresses: DeliveryAddress[] = [];
  let recovered = false;
  for (const item of parsed.addresses) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() || addresses.some((address) => address.id === item.id)
      || !addressTextFields.every((key) => typeof item[key] === 'string') || typeof item.callBeforeArrival !== 'boolean') {
      recovered = true; continue;
    }
    const coordinates = item.coordinates;
    if (coordinates !== null && (!isRecord(coordinates) || typeof coordinates.latitude !== 'number' || typeof coordinates.longitude !== 'number')) {
      recovered = true; continue;
    }
    const result = validateAddress({ ...addressDraft(), ...item,
      latitude: coordinates ? String(coordinates.latitude) : '', longitude: coordinates ? String(coordinates.longitude) : '',
    } as Parameters<typeof validateAddress>[0]);
    if (!result.valid) { recovered = true; continue; }
    addresses.push({ id: item.id, ...result.value });
  }
  const validId = (id: unknown) => typeof id === 'string' && addresses.some((address) => address.id === id);
  const defaultAddressId = validId(parsed.defaultAddressId) ? String(parsed.defaultAddressId) : addresses[0]?.id ?? null;
  const selectedAddressId = validId(parsed.selectedAddressId) ? String(parsed.selectedAddressId) : defaultAddressId;
  recovered ||= defaultAddressId !== parsed.defaultAddressId || selectedAddressId !== parsed.selectedAddressId;
  return { book: { version: 1, addresses, defaultAddressId, selectedAddressId }, warning: recovered ? recoveryWarning : null };
}

export function createLocalAddressRepository(storage: StoragePort): AddressRepository {
  let pending: Promise<unknown> = Promise.resolve();
  let counter = 0;
  async function read() {
    let raw: string | null;
    try { raw = await storage.getItem(ADDRESS_STORAGE_KEY); }
    catch { throw new Error('Saved addresses could not be loaded. Try again; your saved data has not been changed.'); }
    return decodeAddressBook(raw);
  }
  function commit(change: (book: AddressBook) => AddressBook): Promise<AddressBook> {
    const transaction = pending.then(async () => {
      const { book } = await read();
      const next = change(book);
      try { await storage.setItem(ADDRESS_STORAGE_KEY, JSON.stringify(next)); }
      catch { throw new Error('Address changes could not be saved on this device. Please try again.'); }
      return next;
    });
    pending = transaction.then(() => undefined, () => undefined);
    return transaction;
  }
  return {
    version: 1,
    async load() { await pending; return read(); },
    save(draft, options = {}) {
      const result = validateAddress(draft);
      if (!result.valid) return Promise.reject(new Error('Complete the required address fields before saving.'));
      return commit((book) => {
        if (options.id && !book.addresses.some((address) => address.id === options.id)) throw new Error('This address no longer exists.');
        let id = options.id;
        if (!id) {
          do { id = `address-${Date.now().toString(36)}-${(++counter).toString(36)}`; }
          while (book.addresses.some((address) => address.id === id));
        }
        return saveAddress(book, { id, ...result.value }, options);
      });
    },
    remove: (id) => commit((book) => removeAddress(book, id)),
    setDefault: (id) => commit((book) => chooseAddress(book, id, 'default')),
    select: (id) => commit((book) => chooseAddress(book, id, 'selected')),
  };
}
