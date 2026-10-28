import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { FeaturePage } from '../../components/ui/FeaturePage';
import { Button } from '../../components/ui/Button';
import { careProposal, type CarePlan } from '../../domain/carePlans';
import { reviewedCareCart } from '../../domain/careCart';
import { useShopping } from '../../state/AppStateProvider';
import { useAddressBook } from '../addresses/AddressBookProvider';
import { useCarePlans } from './CareProvider';
import { returnToShop } from '../../navigation/commerceNavigation';
import { formatMoney, ui } from '../../theme/tokens';
import { useScreenCompletion } from '../../hooks/useScreenActive';

function Review({ plan }: { plan: CarePlan }) {
  const care = useCarePlans(); const shopping = useShopping(); const addresses = useAddressBook(); const capture = useScreenCompletion();
  const recipient = care.records.find((record) => record.kind === 'recipient' && record.id === plan.recipientId);
  const [items, setItems] = useState(plan.items); const [mode, setMode] = useState<'merge' | 'replace' | null>(null);
  const [cartChoiceKey, setCartChoiceKey] = useState('');
  const [confirmedAddress, setConfirmedAddress] = useState<string | null>(null);
  const proposed = careProposal(items, shopping.catalog);
  const linked = recipient?.kind === 'recipient' ? addresses.book.addresses.find((address) => address.id === recipient.addressId) : null;
  const addressReady = !!confirmedAddress && addresses.ready && !addresses.busy && addresses.selected?.id === confirmedAddress;
  const ready = care.ready && !care.busy && !!recipient && items.length > 0 && proposed.every((item) => !item.problem) && addressReady && !shopping.checkoutLocked && shopping.catalogStatus === 'ready';
  const cartKey = JSON.stringify(shopping.state.cart);
  const choiceCurrent = !!mode && cartChoiceKey === cartKey;
  let mergeProblem: string | null = null;
  try { reviewedCareCart(shopping.state.cart, items, shopping.catalog, 'merge'); } catch (failure: unknown) { mergeProblem = failure instanceof Error ? failure.message : 'Review quantities.'; }
  async function choose(id: string) {
    const complete = capture(); if (await addresses.select(id) && complete.isCurrent()) setConfirmedAddress(id);
  }
  return <FeaturePage title="Review care medicines" fallback="/care">
    <Text style={ui.heading}>{recipient?.kind === 'recipient' ? recipient.name : 'Missing recipient'}</Text>
    <Text style={ui.body}>Proposed refill only. Prices and availability below come from the current catalog, not an old receipt. Review Rx requirements; no prescription is approved.</Text>
    {proposed.map(({ item, product, problem }) => <View key={item.medicineId} style={ui.card}>
      <Text style={ui.heading}>{product?.name ?? item.medicineId}</Text>
      {product && <Text style={ui.body}>Current unit price: {formatMoney(product.price)} · proposed quantity {item.quantity}</Text>}
      {problem && <Text accessibilityRole="alert">{problem}</Text>}
      {product?.rx && <Text style={ui.body}>Rx · Prescription review required. This proposal is not approval or renewal.</Text>}
      <Button label={`Decrease proposed ${item.medicineId}`} variant="secondary" disabled={item.quantity <= 1} onPress={() => setItems(items.map((entry) => entry.medicineId === item.medicineId ? { ...entry, quantity: entry.quantity - 1 } : entry))} />
      <Button label={`Increase proposed ${item.medicineId}`} variant="secondary" disabled={!product || item.quantity >= product.maxQty} onPress={() => setItems(items.map((entry) => entry.medicineId === item.medicineId ? { ...entry, quantity: entry.quantity + 1 } : entry))} />
      <Button label={`Remove proposed ${item.medicineId}`} variant="quiet" onPress={() => setItems(items.filter((entry) => entry.medicineId !== item.medicineId))} />
    </View>)}
    <Text style={ui.heading}>Confirm delivery destination</Text>
    {recipient?.kind === 'recipient' && recipient.addressId && !linked && <Text accessibilityRole="alert">Linked address missing. Choose another saved address; an old destination will not be used.</Text>}
    {linked && <Button label={`Use linked address: ${linked.label}`} variant="secondary" disabled={addresses.busy} onPress={() => { void choose(linked.id); }} />}
    {addresses.selected && <Button label={`Confirm selected address: ${addresses.selected.label}`} variant="secondary" disabled={addresses.busy} onPress={() => { void choose(addresses.selected!.id); }} />}
    <Button label="Choose delivery address" variant="quiet" onPress={() => router.navigate('/addresses')} />
    {addressReady && <Text style={ui.body}>Confirmed delivery address: {addresses.selected?.label}</Text>}
    {addresses.error && <Text accessibilityRole="alert">{addresses.error}</Text>}
    <Text style={ui.heading}>{shopping.state.cart.length ? 'Your cart already has items' : 'Review your new cart'}</Text>
    <Text style={ui.body}>Choose explicitly. Nothing is imported or ordered until you confirm below. Coupons are revalidated by the existing cart rules.</Text>
    {shopping.state.cart.length > 0 && <Button label="Merge with current cart" selected={choiceCurrent && mode === 'merge'} variant="secondary" disabled={!ready || !!mergeProblem} onPress={() => { setMode('merge'); setCartChoiceKey(cartKey); }} />}
    {mergeProblem && shopping.state.cart.length > 0 && <Text style={ui.small}>{mergeProblem} Edit quantities or choose replacement.</Text>}
    <Button label={shopping.state.cart.length ? 'Replace current cart' : 'Use proposed items'} selected={choiceCurrent && mode === 'replace'} variant="secondary" disabled={!ready} onPress={() => { setMode('replace'); setCartChoiceKey(cartKey); }} />
    {mode && !choiceCurrent && <Text accessibilityRole="alert">Your cart changed. Choose merge or replacement again.</Text>}
    <Button label="Confirm proposal & review Cart" disabled={!ready || !choiceCurrent || (mode === 'merge' && !!mergeProblem)} onPress={() => {
      if (!ready || !mode || !choiceCurrent) return;
      shopping.dispatch({ type: 'review-care-cart', cart: items, expectedCart: shopping.state.cart, mode }); returnToShop('cart');
    }} />
  </FeaturePage>;
}
export default function CareReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const care = useCarePlans();
  const plan = care.records.find((record) => record.kind === 'plan' && record.id === id);
  if (!care.ready || !plan || plan.kind !== 'plan') return <FeaturePage title="Review care medicines" fallback="/care"><Text>{care.error ?? 'Care plan is loading or no longer exists.'}</Text><Button label="Retry care data" onPress={care.refresh} /></FeaturePage>;
  return <Review key={`${plan.id}:${plan.revision}`} plan={plan} />;
}
