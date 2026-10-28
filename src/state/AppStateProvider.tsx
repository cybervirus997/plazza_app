import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type PropsWithChildren } from 'react';

import { calculateBill, type Bill } from '../domain/bill';
import { cartCount, getCartItems } from '../domain/cart';
import { emptyShoppingState } from '../domain/types';
import type { Product } from '../features/catalog/products';
import type { CatalogRepository } from '../repositories/CatalogRepository';
import { localCatalogRepository } from '../repositories/local/LocalCatalogRepository';
import { createSnapshotStore } from '../storage/persistence';
import { createAppReducer, initialAppState, type AppAction, type AppState } from './appReducer';
import { announceNotice } from './notifications';

const store = createSnapshotStore(AsyncStorage);

interface ShoppingContext {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  catalog: readonly Product[];
  catalogStatus: 'loading' | 'ready' | 'error';
  catalogError: string | null;
  repository: CatalogRepository;
  items: ReturnType<typeof getCartItems>;
  itemCount: number;
  bill: Bill;
  persistenceError: string | null;
}

const Context = createContext<ShoppingContext | null>(null);

export function AppStateProvider({ children, repository = localCatalogRepository }: PropsWithChildren<{ repository?: CatalogRepository }>) {
  const [catalog, setCatalog] = useState<readonly Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<ShoppingContext['catalogStatus']>('loading');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const reducer = useMemo(() => createAppReducer(catalog), [catalog]);
  const [state, dispatch] = useReducer(reducer, undefined, initialAppState);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const announcedId = useRef(0);
  const writeSequence = useRef(0);
  const snapshot = useMemo(() => ({
    cart: state.cart, activeCouponCode: state.activeCouponCode,
    usedCouponCodes: state.usedCouponCodes, recentSearches: state.recentSearches,
  }), [state.cart, state.activeCouponCode, state.usedCouponCodes, state.recentSearches]);

  useEffect(() => {
    let active = true;
    void repository.load().then(async (products) => {
      if (!active) return;
      setCatalog(products);
      const restored = await store.restore(products);
      if (active) {
        setCatalogStatus('ready');
        dispatch({ type: 'hydrate', ...restored });
      }
    }).catch((error: unknown) => {
      if (!active) return;
      setCatalogError(error instanceof Error ? error.message : 'The product catalog could not be loaded.');
      setCatalogStatus('error');
      dispatch({ type: 'hydrate', snapshot: emptyShoppingState() });
    });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    // Missing production data must never wipe a previously saved cart.
    if (!state.hydrated || catalogStatus !== 'ready') return;
    let active = true;
    const sequence = ++writeSequence.current;
    void store.save(snapshot).then((saved) => {
      if (active && sequence === writeSequence.current) {
        setPersistenceError(saved ? null : 'Changes could not be saved on this device. Keep the app open and try again.');
      }
    });
    return () => { active = false; };
  }, [snapshot, state.hydrated, catalogStatus]);

  useEffect(() => {
    if (state.notice && state.notice.id > announcedId.current) {
      announcedId.current = state.notice.id;
      announceNotice(state.notice);
    }
  }, [state.notice]);

  const value = useMemo<ShoppingContext>(() => ({
    state, dispatch, catalog, catalogStatus, catalogError, repository,
    items: getCartItems(state.cart, catalog),
    itemCount: cartCount(state.cart),
    bill: calculateBill(state.cart, catalog, state.activeCouponCode, state.usedCouponCodes),
    persistenceError,
  }), [state, persistenceError, catalog, catalogStatus, catalogError, repository]);

  return <Context value={value}>{children}</Context>;
}

export function useShopping(): ShoppingContext {
  const value = useContext(Context);
  if (!value) throw new Error('useShopping must be inside AppStateProvider.');
  return value;
}
