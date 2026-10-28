import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { FeaturePage } from '../../components/ui/FeaturePage';
import { Button } from '../../components/ui/Button';
import type { CareRecipient } from '../../domain/carePlans';
import { parseCareRecord } from '../../domain/carePlans';
import { useAddressBook } from '../addresses/AddressBookProvider';
import { useCarePlans } from './CareProvider';
import { CareField, careId, useCareFormGuard } from './CareFields';
import { useScreenCompletion } from '../../hooks/useScreenActive';
import { backTo } from '../../navigation/commerceNavigation';
function RecipientForm({ existing }: { existing?: CareRecipient }) {
  const care = useCarePlans(); const addresses = useAddressBook(); const capture = useScreenCompletion();
  const [initial] = useState<CareRecipient>(() => existing ?? { kind: 'recipient', id: careId('recipient'), name: '', relationship: '', addressId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1 });
  const [draft, setDraft] = useState(initial); const [error, setError] = useState<string | null>(null);
  const disable = useCareFormGuard(JSON.stringify(draft) !== JSON.stringify(initial), care.busy);
  async function save() {
    const complete = capture();
    try { const value = parseCareRecord(draft); if (await care.save(value, existing?.revision ?? 0)) complete.navigate(() => { disable(); backTo('/care'); }); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Review the recipient.'); }
  }
  return <FeaturePage title={existing ? 'Edit care recipient' : 'Add care recipient'} fallback="/care">
    <CareField label="Friendly name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
    <CareField label="Relationship" value={draft.relationship} onChange={(relationship) => setDraft({ ...draft, relationship })} />
    <Text>Optional saved-address link. This does not change the default or checkout selection.</Text>
    <Button label="No linked address" selected={!draft.addressId} variant="secondary" onPress={() => setDraft({ ...draft, addressId: null })} />
    {addresses.book.addresses.map((address) => <Button key={address.id} label={`Link ${address.label}`} selected={draft.addressId === address.id} variant="secondary" onPress={() => setDraft({ ...draft, addressId: address.id })} />)}
    {draft.addressId && !addresses.book.addresses.some((address) => address.id === draft.addressId) && <Text>Linked address is missing. Choose another or remove the link.</Text>}
    {(error || care.error) && <Text accessibilityRole="alert">{error ?? care.error}</Text>}
    <Button label="Save care recipient" disabled={care.busy} onPress={() => { void save(); }} />
  </FeaturePage>;
}
export default function RecipientFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const care = useCarePlans();
  const existing = care.records.find((record) => record.kind === 'recipient' && record.id === id);
  if (!care.ready || (id && !existing)) return <FeaturePage title="Care recipient" fallback="/care"><Text>{care.error ?? (care.ready ? 'Recipient not found.' : 'Loading care data…')}</Text><Button label="Retry care data" onPress={care.refresh} /></FeaturePage>;
  return <RecipientForm key={id ?? 'new'} existing={existing?.kind === 'recipient' ? existing : undefined} />;
}
