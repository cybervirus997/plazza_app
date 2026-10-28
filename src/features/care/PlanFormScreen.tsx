import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { FeaturePage } from '../../components/ui/FeaturePage';
import { Button } from '../../components/ui/Button';
import { parseCareRecord, type CarePlan } from '../../domain/carePlans';
import { reviewInputs, reviewInstant } from '../../domain/careRecurrence';
import { useShopping } from '../../state/AppStateProvider';
import { useCarePlans } from './CareProvider';
import { CareField, careId, useCareFormGuard } from './CareFields';
import { useScreenCompletion } from '../../hooks/useScreenActive';
import { backTo } from '../../navigation/commerceNavigation';
import { ui } from '../../theme/tokens';
function PlanForm({ existing }: { existing?: CarePlan }) {
  const care = useCarePlans(); const { catalog } = useShopping(); const capture = useScreenCompletion();
  const [initial] = useState<CarePlan>(() => existing ?? { kind: 'plan', id: careId('plan'), recipientId: '', items: [], cadence: { unit: 'week', every: 1, anchorDay: 1 },
    nextReviewAt: new Date(Date.now() + 7 * 86400000).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminders: false, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1 });
  const [draft, setDraft] = useState(initial); const [inputs, setInputs] = useState(() => reviewInputs(initial.nextReviewAt, initial.timeZone));
  const [every, setEvery] = useState(String(initial.cadence.every)); const [query, setQuery] = useState(''); const [error, setError] = useState<string | null>(null);
  const disable = useCareFormGuard(JSON.stringify(draft) !== JSON.stringify(initial) || JSON.stringify(inputs) !== JSON.stringify(reviewInputs(initial.nextReviewAt, initial.timeZone)) || every !== String(initial.cadence.every), care.busy);
  function quantity(id: string, value: number) { setDraft({ ...draft, items: [...draft.items.filter((item) => item.medicineId !== id), ...(value > 0 ? [{ medicineId: id, quantity: value }] : [])] }); }
  async function save() {
    const complete = capture();
    try {
      const at = reviewInstant(inputs.date, inputs.time, draft.timeZone);
      const original = reviewInputs(initial.nextReviewAt, initial.timeZone);
      const value = parseCareRecord({ ...draft, nextReviewAt: at, cadence: { ...draft.cadence, every: Number(every),
        anchorDay: existing && inputs.date === original.date ? initial.cadence.anchorDay : Number(inputs.date.slice(-2)),
        hour: existing && inputs.time === original.time ? initial.cadence.hour ?? Number(inputs.time.slice(0, 2)) : Number(inputs.time.slice(0, 2)),
        minute: existing && inputs.time === original.time ? initial.cadence.minute ?? Number(inputs.time.slice(3)) : Number(inputs.time.slice(3)) } });
      if (await care.save(value, existing?.revision ?? 0)) complete.navigate(() => { disable(); backTo('/care'); });
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Review the plan.'); }
  }
  return <FeaturePage title={existing ? 'Edit refill plan' : 'Create refill plan'} fallback="/care">
    <Text style={ui.body}>A future review reminder, not an order or delivery reservation. No prescription approval is stored.</Text>
    {care.records.filter((record) => record.kind === 'recipient').map((recipient) => <Button key={recipient.id} label={recipient.name} selected={draft.recipientId === recipient.id} variant="secondary" onPress={() => setDraft({ ...draft, recipientId: recipient.id })} />)}
    <Text style={ui.heading}>Proposed products</Text>
    {draft.items.map((item) => <View key={item.medicineId} style={ui.card}>
      <Text>{catalog.find((product) => product.id === item.medicineId)?.name ?? `Unavailable product ${item.medicineId}`}</Text>
      <CareField label={`Proposed quantity ${item.medicineId}`} value={String(item.quantity)} keyboardType="number-pad" onChange={(value) => { if (/^[1-9]\d{0,2}$/.test(value)) quantity(item.medicineId, Number(value)); }} />
      <Button label={`Remove proposed ${item.medicineId}`} variant="quiet" onPress={() => quantity(item.medicineId, 0)} />
    </View>)}
    <CareField label="Find a product for this plan" value={query} onChange={setQuery} />
    {query.trim() && catalog.filter((product) => `${product.name} ${product.salt}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8).map((product) => <Button key={product.id} label={`Add to plan: ${product.name}`} disabled={draft.items.some((item) => item.medicineId === product.id)} variant="secondary" onPress={() => { quantity(product.id, 1); setQuery(''); }} />)}
    <Text style={ui.heading}>Review schedule</Text>
    {(['week', 'month', 'day'] as const).map((unit) => <Button key={unit} label={unit === 'week' ? 'Weekly' : unit === 'month' ? 'Monthly' : 'Custom days'} selected={draft.cadence.unit === unit} variant="secondary" onPress={() => setDraft({ ...draft, cadence: { ...draft.cadence, unit } })} />)}
    <CareField label="Repeat every (whole number)" value={every} keyboardType="number-pad" onChange={setEvery} />
    <CareField label="Next review date (YYYY-MM-DD)" value={inputs.date} onChange={(date) => setInputs({ ...inputs, date })} />
    <CareField label="Review time (HH:mm)" value={inputs.time} onChange={(time) => setInputs({ ...inputs, time })} />
    <CareField label="Timezone (IANA name)" value={draft.timeZone} onChange={(timeZone) => setDraft({ ...draft, timeZone })} />
    <Text style={ui.small}>Monthly dates clamp to month end and retain the chosen day. DST gaps shift forward; repeated wall times use the earlier instant.</Text>
    <Button label={draft.reminders ? 'Device reminder requested' : 'In-app reminder only'} selected={draft.reminders} variant="secondary" onPress={() => setDraft({ ...draft, reminders: !draft.reminders })} />
    <Text style={ui.small}>Native reminders depend on permission and runtime support; exact-minute delivery is not guaranteed. Denial or scheduling failure never blocks a plan.</Text>
    {(error || care.error) && <Text accessibilityRole="alert">{error ?? care.error}</Text>}
    <Button label="Save refill plan" disabled={care.busy} onPress={() => { void save(); }} />
  </FeaturePage>;
}
export default function PlanFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const care = useCarePlans(); const existing = care.records.find((record) => record.kind === 'plan' && record.id === id);
  if (!care.ready || (id && !existing)) return <FeaturePage title="Refill plan" fallback="/care"><Text>{care.error ?? (care.ready ? 'Plan not found.' : 'Loading care data…')}</Text><Button label="Retry care data" onPress={care.refresh} /></FeaturePage>;
  return <PlanForm key={id ?? 'new'} existing={existing?.kind === 'plan' ? existing : undefined} />;
}
