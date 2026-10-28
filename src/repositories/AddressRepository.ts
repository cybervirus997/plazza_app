import type { AddressBook, AddressDraft } from '../domain/addresses';

export interface AddressLoadResult { readonly book: AddressBook; readonly warning: string | null }
export interface SaveAddressOptions { readonly id?: string; readonly makeDefault?: boolean; readonly select?: boolean }
export interface AddressRepository {
  readonly version: 1;
  load(): Promise<AddressLoadResult>;
  save(draft: AddressDraft, options?: SaveAddressOptions): Promise<AddressBook>;
  remove(id: string): Promise<AddressBook>;
  setDefault(id: string): Promise<AddressBook>;
  select(id: string): Promise<AddressBook>;
}
