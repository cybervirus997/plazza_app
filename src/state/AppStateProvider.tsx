import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type PropsWithChildren } from 'react';

import { catalogData } from '../data/catalog';
import { calculateBill, type Bill } from '../domain/bill';
import { cartCount, getCartItems } from '../domain/cart';
import type { Medicine } from '../domain/types';
import { createSnapshotStore } from '../storage/persistence';
import { createAppReducer, initialAppState, type AppAction, type AppState } from './appReducer';
import { announceNotice } from './notifications';

const store = createSnapshotStore(AsyncStorage);
const reducer = createAppReducer(catalogData.medicines);

interface ShoppingContext {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  catalog: readonly Medicine[];
  items: ReturnType<typeof getCartItems>;
  itemCount: number;
  bill: Bill;
  persistenceError: string | null;
}

const Context = createContext<ShoppingContext | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
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
    void store.restore(catalogData.medicines).then((restored) => {
      if (active) dispatch({ type: 'hydrate', ...restored });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Missing production data must never wipe a previously saved cart.
    if (!state.hydrated || catalogData.error) return;
    let active = true;
    const sequence = ++writeSequence.current;
    void store.save(snapshot).then((saved) => {
      if (active && sequence === writeSequence.current) {
        setPersistenceError(saved ? null : 'Changes could not be saved on this device. Keep the app open and try again.');
      }
    });
    return () => { active = false; };
  }, [snapshot, state.hydrated]);

  useEffect(() => {
    if (state.notice && state.notice.id > announcedId.current) {
      announcedId.current = state.notice.id;
      announceNotice(state.notice);
    }
  }, [state.notice]);

  const value = useMemo<ShoppingContext>(() => ({
    state, dispatch, catalog: catalogData.medicines,
    items: getCartItems(state.cart, catalogData.medicines),
    itemCount: cartCount(state.cart),
    bill: calculateBill(state.cart, catalogData.medicines, state.activeCouponCode, state.usedCouponCodes),
    persistenceError,
  }), [state, persistenceError]);

  return <Context value={value}>{children}</Context>;
}

export function useShopping(): ShoppingContext {
  const value = useContext(Context);
  if (!value) throw new Error('useShopping must be inside AppStateProvider.');
  return value;
}
