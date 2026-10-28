import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type Dispatch, type PropsWithChildren } from 'react';

import type { DeliveryAddressSnapshot } from '../domain/addresses';
import { calculateBill, type Bill } from '../domain/bill';
import { cartCount, getCartItems } from '../domain/cart';
import { emptyShoppingState, type ShoppingState } from '../domain/types';
import type { Product } from '../features/catalog/products';
import { createCheckoutCoordinator, type CheckoutCoordinator } from '../features/orders/checkout';
import type { CatalogRepository } from '../repositories/CatalogRepository';
import { localCatalogRepository } from '../repositories/local/LocalCatalogRepository';
import { createSnapshotStore, decodeSnapshot, snapshotKey, type StoragePort } from '../storage/persistence';
import { createAppReducer, initialAppState, type AppAction, type AppState } from './appReducer';
import { announceNotice } from './notifications';

const defaultCoordinator = createCheckoutCoordinator(AsyncStorage);
interface CheckoutState { status: 'idle' | 'working' | 'error' | 'success'; error: string | null; orderId: string | null }
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
  checkoutState: CheckoutState;
  checkoutLocked: boolean;
  checkout(address: () => Promise<DeliveryAddressSnapshot | null>): Promise<void>;
  retryRecovery(): void;
}
const Context = createContext<ShoppingContext | null>(null);
const persisted = (state: ShoppingState): ShoppingState => ({ cart: state.cart, activeCouponCode: state.activeCouponCode,
  usedCouponCodes: state.usedCouponCodes, recentSearches: state.recentSearches,
  ...(state.lastFinalizedCheckoutId ? { lastFinalizedCheckoutId: state.lastFinalizedCheckoutId } : {}) });

export function AppStateProvider({ children, repository = localCatalogRepository, storage = AsyncStorage, coordinator: injectedCoordinator }: PropsWithChildren<{
  repository?: CatalogRepository; storage?: StoragePort; coordinator?: CheckoutCoordinator;
}>) {
  const coordinator = useMemo(() => injectedCoordinator ?? (storage === AsyncStorage ? defaultCoordinator : createCheckoutCoordinator(storage)), [injectedCoordinator, storage]);
  const store = useMemo(() => createSnapshotStore(storage), [storage]);
  const [catalog, setCatalog] = useState<readonly Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<ShoppingContext['catalogStatus']>('loading');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const reducer = useMemo(() => createAppReducer(catalog), [catalog]);
  const [state, rawDispatch] = useReducer(reducer, undefined, initialAppState);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: 'idle', error: null, orderId: null });
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const announcedId = useRef(0);
  const writeSequence = useRef(0);
  const lifetime = useRef(0);
  const working = useRef(false);
  const mounted = useRef(false);
  const queuedAction = useRef(false);
  const current = useRef(state);
  const savedKey = useRef<string | null>(null);
  const snapshot = useMemo(() => ({ cart: state.cart, activeCouponCode: state.activeCouponCode,
    usedCouponCodes: state.usedCouponCodes, recentSearches: state.recentSearches,
    ...(state.lastFinalizedCheckoutId ? { lastFinalizedCheckoutId: state.lastFinalizedCheckoutId } : {}),
  }), [state.cart, state.activeCouponCode, state.usedCouponCodes, state.recentSearches, state.lastFinalizedCheckoutId]);
  const key = snapshotKey(snapshot);

  useLayoutEffect(() => { current.current = state; queuedAction.current = false; }, [state]);
  useLayoutEffect(() => {
    const version = ++lifetime.current;
    mounted.current = true;
    working.current = true;
    const isCurrent = () => version === lifetime.current;
    void coordinator.recover({ isCurrent }).then(async (recovered) => {
      if (!isCurrent()) return;
      if (recovered.order || recovered.snapshot.lastFinalizedCheckoutId) savedKey.current = snapshotKey(recovered.snapshot);
      let products: readonly Product[];
      try { products = await repository.load(); }
      catch (error: unknown) {
        if (!isCurrent()) return;
        setCatalogError(error instanceof Error ? error.message : 'The product catalog could not be loaded.');
        setCatalogStatus('error');
        rawDispatch({ type: 'hydrate', snapshot: emptyShoppingState() });
        return;
      }
      if (!isCurrent()) return;
      setCatalog(products);
      setCatalogError(null);
      setCatalogStatus('ready');
      const restored = decodeSnapshot(JSON.stringify({ version: 1, ...recovered.snapshot }), products);
      if (current.current.hydrated && restored.lastFinalizedCheckoutId) {
        rawDispatch({ type: 'checkout-finalized', checkoutId: restored.lastFinalizedCheckoutId, snapshot: restored });
      } else rawDispatch({ type: 'hydrate', snapshot: restored });
      rawDispatch({ type: 'checkout-lock', locked: false });
      setCheckoutState({ status: recovered.order ? 'success' : 'idle', error: null, orderId: recovered.order?.id ?? null });
    }).catch((error: unknown) => {
      if (isCurrent()) setCheckoutState({ status: 'error', error: error instanceof Error ? error.message : 'Checkout recovery failed. Please retry.', orderId: null });
    }).finally(() => { if (isCurrent()) working.current = false; });
    return () => { mounted.current = false; lifetime.current += 1; };
  }, [coordinator, repository, recoveryAttempt]);

  useEffect(() => {
    if (!state.hydrated || catalogStatus !== 'ready' || coordinator.isLocked() || key === savedKey.current) return;
    let active = true;
    const sequence = ++writeSequence.current;
    void store.save(snapshot).then((saved) => {
      if (active && sequence === writeSequence.current) {
        if (saved) savedKey.current = key;
        setPersistenceError(saved ? null : 'Changes could not be saved on this device. Keep the app open and try again.');
      }
    });
    return () => { active = false; };
  }, [snapshot, key, state.hydrated, catalogStatus, coordinator, store, checkoutState.status]);

  useEffect(() => {
    if (state.notice && state.notice.id > announcedId.current) { announcedId.current = state.notice.id; announceNotice(state.notice); }
  }, [state.notice]);

  const dispatch: Dispatch<AppAction> = (action) => {
    if (!mounted.current || action.type === 'hydrate' || action.type === 'checkout-lock' || action.type === 'checkout-finalized' || action.type === 'place-order') return;
    if (coordinator.isLocked() && action.type !== 'dismiss-notice') return;
    if (checkoutState.status === 'success' && action.type !== 'dismiss-notice') setCheckoutState({ status: 'idle', error: null, orderId: null });
    if (action.type !== 'dismiss-notice') queuedAction.current = true;
    rawDispatch(action);
  };
  async function checkout(address: () => Promise<DeliveryAddressSnapshot | null>) {
    if (!mounted.current || working.current || !current.current.hydrated || catalogStatus !== 'ready') return;
    if (queuedAction.current) {
      setCheckoutState({ status: 'error', error: 'Wait for your cart update to finish, then try again.', orderId: null });
      return;
    }
    working.current = true;
    const retrying = coordinator.isLocked();
    const version = lifetime.current;
    const isCurrent = () => mounted.current && version === lifetime.current;
    rawDispatch({ type: 'checkout-lock', locked: true });
    setCheckoutState((previous) => ({ status: 'working', error: null, orderId: retrying ? previous.orderId : null }));
    try {
      const result = await coordinator.begin({ snapshot: persisted(current.current), products: catalog, address }, {
        isCurrent,
        onFinalized(finalized, order) {
          if (!isCurrent()) return;
          savedKey.current = snapshotKey(finalized);
          setPersistenceError(null);
          rawDispatch({ type: 'checkout-finalized', checkoutId: order.checkoutId, snapshot: finalized });
          setCheckoutState({ status: 'working', error: null, orderId: order.id });
        },
      });
      if (isCurrent()) {
        rawDispatch({ type: 'checkout-lock', locked: false });
        setCheckoutState({ status: 'success', error: null, orderId: result.order?.id ?? null });
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        rawDispatch({ type: 'checkout-lock', locked: coordinator.isLocked() });
        setCheckoutState((previous) => ({ ...previous, status: 'error', error: error instanceof Error ? error.message : 'Checkout needs recovery. Retry without placing a new order.' }));
      }
    } finally { if (isCurrent()) working.current = false; }
  }

  return <Context value={{ state, dispatch, catalog, catalogStatus, catalogError, repository,
    items: getCartItems(state.cart, catalog), itemCount: cartCount(state.cart),
    bill: calculateBill(state.cart, catalog, state.activeCouponCode, state.usedCouponCodes), persistenceError,
    checkoutState, checkoutLocked: coordinator.isLocked() || state.checkoutLocked, checkout,
    retryRecovery: () => {
      if (mounted.current && !working.current) {
        setCheckoutState((previous) => ({ ...previous, status: 'working', error: null }));
        setRecoveryAttempt((value) => value + 1);
      }
    },
  }}>{children}</Context>;
}
export function useShopping(): ShoppingContext {
  const value = useContext(Context);
  if (!value) throw new Error('useShopping must be inside AppStateProvider.');
  return value;
}
