export const addressLabels = ['Home', 'Work', "Dad's Home", "Mom's Place", 'Friend', 'Other'] as const;
export const gateOptions = [
  { id: 'none', title: 'No gate restriction' }, { id: 'mygate', title: 'MyGate' },
  { id: 'nobrokerhood', title: 'NoBrokerHood' }, { id: 'other', title: 'Other society app' },
  { id: 'call-recipient', title: 'Call recipient at gate' },
] as const;
export const deliveryOptions = [{ id: 'door', title: 'Deliver to Door' }, { id: 'gate', title: 'Leave at Gate' }] as const;
export type GateAccess = typeof gateOptions[number]['id'];
export type DeliveryOption = typeof deliveryOptions[number]['id'];

export const addressTextFields = ['label', 'recipientName', 'recipientPhone', 'relationship', 'addressLine',
  'flatNumber', 'tower', 'society', 'landmark', 'city', 'state', 'pinCode', 'instructions', 'societyApp'] as const;
type AddressTextField = typeof addressTextFields[number];
export type AddressDraft = Record<AddressTextField | 'latitude' | 'longitude', string> & {
  gateAccess: GateAccess;
  deliveryOption: DeliveryOption;
  callBeforeArrival: boolean;
};
export type AddressErrors = Partial<Record<keyof AddressDraft, string>>;
export type AddressDetails = Readonly<Record<AddressTextField, string>> & {
  readonly gateAccess: GateAccess;
  readonly deliveryOption: DeliveryOption;
  readonly callBeforeArrival: boolean;
  readonly coordinates: Readonly<{ latitude: number; longitude: number }> | null;
};
export type DeliveryAddress = AddressDetails & { readonly id: string };
export interface AddressBook {
  readonly version: 1;
  readonly addresses: readonly DeliveryAddress[];
  readonly defaultAddressId: string | null;
  readonly selectedAddressId: string | null;
}
export interface DeliveryAddressSnapshot {
  readonly version: 1;
  readonly address: DeliveryAddress;
}

export const emptyAddressBook = (): AddressBook => ({ version: 1, addresses: [], defaultAddressId: null, selectedAddressId: null });
export function addressDraft(address?: DeliveryAddress): AddressDraft {
  return { label: address?.label ?? 'Home', recipientName: address?.recipientName ?? '', recipientPhone: address?.recipientPhone ?? '',
    relationship: address?.relationship ?? '', addressLine: address?.addressLine ?? '', flatNumber: address?.flatNumber ?? '',
    tower: address?.tower ?? '', society: address?.society ?? '', landmark: address?.landmark ?? '', city: address?.city ?? '',
    state: address?.state ?? '', pinCode: address?.pinCode ?? '', instructions: address?.instructions ?? '',
    societyApp: address?.societyApp ?? '', latitude: address?.coordinates ? String(address.coordinates.latitude) : '',
    longitude: address?.coordinates ? String(address.coordinates.longitude) : '', gateAccess: address?.gateAccess ?? 'none',
    deliveryOption: address?.deliveryOption ?? 'door', callBeforeArrival: address?.callBeforeArrival ?? false };
}

export function validateAddress(draft: AddressDraft): { valid: true; value: AddressDetails } | { valid: false; errors: AddressErrors } {
  const errors: AddressErrors = {};
  const text = Object.fromEntries(addressTextFields.map((key) => [key, draft[key].trim()])) as Record<AddressTextField, string>;
  for (const key of addressTextFields) {
    const limit = key === 'instructions' ? 500 : key === 'label' ? 50 : 150;
    if (text[key].length > limit) errors[key] = `Use ${limit} characters or fewer.`;
  }
  for (const key of ['label', 'addressLine', 'city', 'state'] as const) {
    if (!text[key]) errors[key] = 'This field is required.';
  }
  if (!/^[1-9]\d{5}$/.test(text.pinCode)) errors.pinCode = 'Enter a 6-digit Indian PIN code that does not start with 0.';
  const phone = text.recipientPhone.replace(/[\s()-]/g, '');
  if (text.recipientPhone && !/^\+?\d{7,15}$/.test(phone)) errors.recipientPhone = 'Enter a phone number with 7–15 digits, optionally starting with +.';
  if (!gateOptions.some((option) => option.id === draft.gateAccess)) errors.gateAccess = 'Choose a gate access option.';
  if (!deliveryOptions.some((option) => option.id === draft.deliveryOption)) errors.deliveryOption = 'Choose a delivery option.';
  if (draft.gateAccess === 'other' && !text.societyApp) errors.societyApp = 'Enter the society app name.';
  const latitude = draft.latitude.trim();
  const longitude = draft.longitude.trim();
  let coordinates: AddressDetails['coordinates'] = null;
  if (latitude || longitude) {
    if (!latitude || !longitude) errors.latitude = 'Enter both latitude and longitude, or leave both empty.';
    else if (!/^[+-]?\d+(\.\d+)?$/.test(latitude) || !Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90) errors.latitude = 'Latitude must be between -90 and 90.';
    else if (!/^[+-]?\d+(\.\d+)?$/.test(longitude) || !Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180) errors.longitude = 'Longitude must be between -180 and 180.';
    else coordinates = { latitude: Number(latitude), longitude: Number(longitude) };
  }
  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, value: { ...text, recipientPhone: phone, societyApp: draft.gateAccess === 'other' ? text.societyApp : '',
    gateAccess: draft.gateAccess, deliveryOption: draft.deliveryOption, callBeforeArrival: draft.callBeforeArrival, coordinates } };
}

export function saveAddress(book: AddressBook, address: DeliveryAddress, options: { makeDefault?: boolean; select?: boolean } = {}): AddressBook {
  const exists = book.addresses.some((item) => item.id === address.id);
  const addresses = exists ? book.addresses.map((item) => item.id === address.id ? address : item) : [...book.addresses, address];
  return { version: 1, addresses, defaultAddressId: options.makeDefault || !book.defaultAddressId ? address.id : book.defaultAddressId,
    selectedAddressId: options.select || !book.selectedAddressId ? address.id : book.selectedAddressId };
}
export function removeAddress(book: AddressBook, id: string): AddressBook {
  const addresses = book.addresses.filter((address) => address.id !== id);
  const defaultAddressId = book.defaultAddressId === id ? addresses[0]?.id ?? null : book.defaultAddressId;
  return { ...book, addresses, defaultAddressId, selectedAddressId: book.selectedAddressId === id ? defaultAddressId : book.selectedAddressId };
}
export function chooseAddress(book: AddressBook, id: string, kind: 'default' | 'selected'): AddressBook {
  if (!book.addresses.some((address) => address.id === id)) throw new Error('This address no longer exists.');
  return { ...book, [kind === 'default' ? 'defaultAddressId' : 'selectedAddressId']: id };
}
export function selectedAddress(book: AddressBook): DeliveryAddress | null {
  return book.addresses.find((address) => address.id === book.selectedAddressId) ?? null;
}
export function snapshotDeliveryAddress(book: AddressBook): DeliveryAddressSnapshot | null {
  const address = selectedAddress(book);
  if (!address) return null;
  return Object.freeze({ version: 1, address: Object.freeze({ ...address,
    coordinates: address.coordinates ? Object.freeze({ ...address.coordinates }) : null }) });
}
export function formatAddress(address: DeliveryAddress): string {
  return [address.flatNumber, address.tower, address.addressLine, address.society, address.landmark,
    `${address.city}, ${address.state} ${address.pinCode}`].filter(Boolean).join(', ');
}
