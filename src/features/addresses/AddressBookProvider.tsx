import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { emptyAddressBook, selectedAddress, snapshotDeliveryAddress, type AddressBook, type AddressDraft } from '../../domain/addresses';
import type { AddressRepository, SaveAddressOptions } from '../../repositories/AddressRepository';
import { createLocalAddressRepository } from '../../repositories/local/LocalAddressRepository';

const localRepository = createLocalAddressRepository(AsyncStorage);
interface AddressContext {
  book: AddressBook;
  selected: ReturnType<typeof selectedAddress>;
  loading: boolean;
  ready: boolean;
  busy: boolean;
  error: string | null;
  warning: string | null;
  reload(): void;
  save(draft: AddressDraft, options?: SaveAddressOptions): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  setDefault(id: string): Promise<boolean>;
  select(id: string): Promise<boolean>;
  snapshotForOrder(): Promise<ReturnType<typeof snapshotDeliveryAddress>>;
}
interface AddressState {
  repository: AddressRepository;
  book: AddressBook;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  warning: string | null;
}
const Context = createContext<AddressContext | null>(null);

export function AddressBookProvider({ children, repository = localRepository }: PropsWithChildren<{ repository?: AddressRepository }>) {
  const [state, setState] = useState<AddressState>(() => ({ repository, book: emptyAddressBook(), status: 'loading', error: null, warning: null }));
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const lifetime = useRef(0);
  const mounted = useRef(false);
  const running = useRef(false);
  const loading = state.repository !== repository || state.status === 'loading';
  const ready = !loading && state.status === 'ready';

  useEffect(() => {
    const version = ++lifetime.current;
    mounted.current = true;
    running.current = true;
    void repository.load().then((result) => {
      if (version === lifetime.current) setState({ repository, ...result, status: 'ready', error: null });
    }).catch(() => {
      if (version === lifetime.current) setState((previous) => ({ ...previous, repository, status: 'error', warning: null,
        error: 'Saved addresses could not be loaded. Try again; your saved data has not been changed.' }));
    }).finally(() => {
      if (version === lifetime.current) { running.current = false; setBusy(false); }
    });
    return () => { mounted.current = false; lifetime.current += 1; };
  }, [repository, reload]);

  async function mutate(operation: () => Promise<AddressBook>): Promise<boolean> {
    if (!mounted.current || !ready || running.current) return false;
    running.current = true;
    setBusy(true);
    setState((previous) => ({ ...previous, error: null }));
    const version = lifetime.current;
    try {
      const book = await operation();
      if (version !== lifetime.current) return false;
      setState({ repository, book, status: 'ready', warning: null, error: null });
      return true;
    } catch (error: unknown) {
      if (version === lifetime.current) setState((previous) => ({ ...previous,
        error: error instanceof Error ? error.message : 'Address changes could not be saved. Please try again.' }));
      return false;
    } finally {
      if (version === lifetime.current) { running.current = false; setBusy(false); }
    }
  }

  return <Context value={{ book: state.book, selected: ready ? selectedAddress(state.book) : null, loading, ready, busy,
    error: state.repository === repository ? state.error : null, warning: ready ? state.warning : null,
    reload: () => {
      if (!mounted.current || running.current) return;
      setState((previous) => ({ ...previous, status: 'loading', error: null, warning: null }));
      setReload((value) => value + 1);
    },
    save: (draft, options) => mutate(() => repository.save(draft, options)),
    remove: (id) => mutate(() => repository.remove(id)), setDefault: (id) => mutate(() => repository.setDefault(id)),
    select: (id) => mutate(() => repository.select(id)), snapshotForOrder: async () => {
      if (!mounted.current || !ready || running.current) throw new Error('Wait for saved addresses to finish loading or saving.');
      const version = lifetime.current;
      const result = await repository.load();
      if (version !== lifetime.current) throw new Error('Address selection is no longer active.');
      if (result.warning) throw new Error('Review your saved addresses before creating an order.');
      return snapshotDeliveryAddress(result.book);
    },
  }}>{children}</Context>;
}

export function useAddressBook(): AddressContext {
  const context = useContext(Context);
  if (!context) throw new Error('useAddressBook must be inside AddressBookProvider.');
  return context;
}
