import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import type { DeliveryPreference } from '../../domain/orders';
import type { PaymentMethod, PaymentScenario } from '../../domain/payments';

interface Preferences { preference: DeliveryPreference; method: PaymentMethod; scenario: PaymentScenario }
const defaults: Preferences = { preference: 'asap', method: 'upi', scenario: 'pending-success' };
const Context = createContext<{ preferences: Preferences; update(patch: Partial<Preferences>): void } | null>(null);

// Ephemeral review choices survive popping Checkout to edit the existing Cart tab.
export function CheckoutPreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState(defaults);
  return <Context value={{ preferences, update: (patch) => setPreferences((current) => ({ ...current, ...patch })) }}>{children}</Context>;
}
export function useCheckoutPreferences() {
  const context = useContext(Context);
  if (!context) throw new Error('Checkout preferences must be used within CheckoutPreferencesProvider.');
  return context;
}
