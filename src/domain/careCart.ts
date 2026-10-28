import type { Cart, Medicine } from './types';
export function reviewedCareCart(current: Cart, proposed: Cart, catalog: readonly (Medicine & { isAvailable?: boolean })[], mode: 'merge' | 'replace'): Cart {
  if (!proposed.length || !['merge', 'replace'].includes(mode) || new Set(proposed.map((item) => item.medicineId)).size !== proposed.length) throw new Error('Review the proposed products before continuing.');
  const combined = new Map((mode === 'merge' ? current : []).map((item) => [item.medicineId, item.quantity]));
  for (const item of proposed) combined.set(item.medicineId, (combined.get(item.medicineId) ?? 0) + item.quantity);
  const result = [...combined].map(([medicineId, quantity]) => ({ medicineId, quantity }));
  for (const item of result) {
    const product = catalog.find((product) => product.id === item.medicineId);
    if (!product || product.isAvailable === false || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > product.maxQty) throw new Error('A product or quantity changed. Review availability and quantity limits before importing.');
  }
  return result;
}
