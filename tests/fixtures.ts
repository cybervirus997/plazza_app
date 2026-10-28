import type { Medicine } from '../src/domain/types';

// Synthetic data for automated tests only. Never imported by the application.
export const catalog: readonly Medicine[] = [
  { id: 'a', name: 'Test Relief', salt: 'Paracetamol', price: 200, maxQty: 3, rx: false },
  { id: 'b', name: 'Test Care', salt: 'Cetirizine', price: 100, maxQty: 5, rx: true },
  { id: 'c', name: 'Test Plus', salt: 'Vitamin C', price: 299, maxQty: 4, rx: false },
  { id: 'd', name: 'Test Small', salt: 'Saline', price: 5, maxQty: 2, rx: false },
];
