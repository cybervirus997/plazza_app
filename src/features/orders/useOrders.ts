import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { Order } from '../../domain/orders';
import type { OrderRepository } from '../../repositories/OrderRepository';

function useOrderResource<T>(load: () => Promise<T>) {
  const [resource, setResource] = useState<{ loader: typeof load; status: 'loading' | 'ready' | 'error'; data: T | null; error: string | null }>(
    () => ({ loader: load, status: 'loading', data: null, error: null }));
  const generation = useRef(0);
  const refresh = useCallback(() => {
    const version = ++generation.current;
    void load().then((data) => { if (version === generation.current) setResource({ loader: load, status: 'ready', data, error: null }); })
      .catch((error: unknown) => { if (version === generation.current) setResource({ loader: load, status: 'error', data: null,
        error: error instanceof Error ? error.message : 'Saved orders could not be read. Please retry.' }); });
  }, [load]);
  useFocusEffect(useCallback(() => {
    refresh();
    return () => { generation.current += 1; };
  }, [refresh]));
  const current = resource.loader === load ? resource : { status: 'loading' as const, data: null, error: null };
  return { ...current, retry: () => {
    setResource({ loader: load, status: 'loading', data: null, error: null });
    refresh();
  } };
}
export function useOrderHistory(repository: OrderRepository) {
  const load = useCallback(async () => {
    const result = await repository.load();
    return { ...result, orders: [...result.orders].sort((left, right) => right.placedAt.localeCompare(left.placedAt) || right.id.localeCompare(left.id)) };
  }, [repository]);
  return useOrderResource(load);
}
export function useOrderById(repository: OrderRepository, id: string | undefined) {
  const load = useCallback(async (): Promise<Order | null> => id ? repository.getById(id) : null, [repository, id]);
  return useOrderResource(load);
}
