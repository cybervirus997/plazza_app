import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { FeaturePage } from '../../components/ui/FeaturePage';
import { Button } from '../../components/ui/Button';
import type { CarePlan } from '../../domain/carePlans';
import { mockChargePreview, parseMockMandate, type MockMandate, type MockMandateAction } from '../../domain/mockMandates';
import { useShopping } from '../../state/AppStateProvider';
import { useCarePlans } from './CareProvider';
import { useMockMandates } from './useMockMandates';
import { CareField, careId } from './CareFields';
import { formatMoney, ui } from '../../theme/tokens';
import { useScreenCompletion } from '../../hooks/useScreenActive';
import { backTo } from '../../navigation/commerceNavigation';

const disclaimer = 'Demo only. No mandate is registered and no money will be charged.';
function Preview({ plan, existing, mandates }: { plan?: CarePlan; existing?: MockMandate; mandates: ReturnType<typeof useMockMandates> }) {
  const { catalog, catalogStatus } = useShopping(); const capture = useScreenCompletion();
  const [cap, setCap] = useState(String(existing?.maximumSimulatedAmount ?? 1000));
  const [consent, setConsent] = useState(false); const [showPreview, setShowPreview] = useState(false); const [error, setError] = useState<string | null>(null);
  const [newId] = useState(() => careId('mock-mandate'));
  const scheduleChanged = !!existing && !!plan && (existing.nextReviewAt !== plan.nextReviewAt || existing.frequency.unit !== plan.cadence.unit || existing.frequency.every !== plan.cadence.every);
  const unsaved = !!existing && (cap !== String(existing.maximumSimulatedAmount) || scheduleChanged);
  function confirm(label: string, action: () => void) {
    const complete = capture();
    Alert.alert(`${label}?`, disclaimer, [{ text: 'Keep current preview', style: 'cancel' },
      { text: 'Confirm mock action', onPress: () => { if (complete.isCurrent()) action(); } }]);
  }
  function save() {
    if (!plan) return;
    try {
      const now = new Date().toISOString();
      const value = parseMockMandate({ id: existing?.status !== 'cancelled' && existing ? existing.id : newId, version: 1, planId: plan.id, simulationOnly: true,
        status: existing?.status !== 'cancelled' && existing ? existing.status : 'inactive', optIn: existing?.status !== 'cancelled' && existing ? existing.optIn : false,
        maximumSimulatedAmount: Number(cap), frequency: { unit: plan.cadence.unit, every: plan.cadence.every }, nextReviewAt: plan.nextReviewAt,
        createdAt: existing?.status !== 'cancelled' && existing ? existing.createdAt : now, updatedAt: now, revision: existing?.status !== 'cancelled' && existing ? existing.revision : 1 });
      confirm('Save inactive preview or update its saved cap/schedule', () => { setCap(String(value.maximumSimulatedAmount)); void mandates.save(value, existing?.status !== 'cancelled' && existing ? existing.revision : 0); });
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Review the cap.'); }
  }
  function action(action: MockMandateAction) {
    if (!existing) return;
    confirm(`${action} mock preview`, () => { void mandates.action(existing, action, consent || existing.optIn); });
  }
  const quote = showPreview && existing && plan ? mockChargePreview(plan, catalog, existing) : null;
  return <>
    <Text style={ui.heading}>{existing ? `Mock preview: ${existing.status}` : 'Reminder only · preview inactive'}</Text>
    {!plan && <Text accessibilityRole="alert">Linked care plan is missing or unavailable. Activation and charge preview are disabled. You can still cancel a saved mock preview.</Text>}
    {plan && <Text style={ui.body}>Reminder status: {plan.status}. Reminders and this mock preview can be paused independently.</Text>}
    {existing && <View style={ui.card}>
      <Text style={ui.body}>Saved simulated cap: {formatMoney(existing.maximumSimulatedAmount)}</Text>
      <Text style={ui.body}>Saved mock frequency: every {existing.frequency.every} {existing.frequency.unit}(s)</Text>
      <Text style={ui.small}>Saved next review: {new Date(existing.nextReviewAt).toLocaleString(undefined, plan ? { timeZone: plan.timeZone } : undefined)} · {plan?.timeZone ?? 'device timezone'}</Text>
      <Text selectable style={ui.small}>Mock ID: {existing.id}</Text>
    </View>}
    <CareField label="Maximum simulated amount (₹)" value={cap} keyboardType="decimal-pad" onChange={setCap} />
    {scheduleChanged && <Text style={ui.small}>The care schedule changed. Confirm an update below to use its current schedule; no automatic mandate update occurs.</Text>}
    <Button label={existing && existing.status !== 'cancelled' ? 'Save mock cap & current plan schedule' : 'Save inactive mock preview'} disabled={!plan || mandates.busy}
      variant="secondary" onPress={save} />
    {existing?.status !== 'cancelled' && <Button label="I understand and opt in to this demo only" selected={consent} variant="secondary" disabled={mandates.busy} onPress={() => setConsent(!consent)} />}
    {existing?.status === 'inactive' && <Button label="Activate mock preview" disabled={!plan || !consent || unsaved || mandates.busy} onPress={() => action('activate')} />}
    {existing?.status === 'active' && <Button label="Pause mock preview" disabled={mandates.busy} variant="secondary" onPress={() => action('pause')} />}
    {existing?.status === 'paused' && <Button label="Resume mock preview" disabled={!plan || unsaved || mandates.busy} variant="secondary" onPress={() => action('resume')} />}
    {existing && existing.status !== 'cancelled' && <Button label="Cancel mock preview" disabled={mandates.busy} variant="quiet" onPress={() => action('cancel')} />}
    <Button label={existing && existing.status !== 'cancelled' ? 'Use reminder only (cancel mock preview)' : 'Reminder only · return to Family Care'} variant="quiet" disabled={mandates.busy}
      onPress={() => existing && existing.status !== 'cancelled' ? action('cancel') : backTo('/care')} />
    {existing && existing.status !== 'cancelled' && <Button label="Preview next mock charge" variant="secondary" disabled={!plan || catalogStatus !== 'ready' || mandates.busy || unsaved}
      onPress={() => confirm('Show an illustrative item subtotal', () => setShowPreview(true))} />}
    {quote && <View accessibilityLiveRegion="polite" style={ui.card}>
      <Text style={ui.heading}>Illustrative item subtotal: {formatMoney(quote.itemSubtotal)}</Text>
      <Text style={ui.body}>{quote.problems.length ? 'Product review required — no eligible charge amount' : quote.withinCap ? 'Within saved simulated cap' : 'Above saved simulated cap — review required'}</Text>
      {quote.problems.map((problem, index) => <Text key={`${index}:${problem}`} accessibilityRole="alert">{problem}</Text>)}
      {quote.requiresRx && <Text style={ui.body}>Rx review is required. No automatic prescription renewal or medicine purchase.</Text>}
      <Text style={ui.small}>Current catalog item subtotal only, not a charge. Discounts, delivery, availability and quantities are revalidated in Cart/Checkout. No revenue or order is recorded.</Text>
    </View>}
    {plan && <Button label="Deliberately review medicines in Cart" variant="quiet" onPress={() => router.navigate({ pathname: '/care/review', params: { id: plan.id } })} />}
    {(error || mandates.error) && <Text accessibilityRole="alert">{error ?? mandates.error}</Text>}
  </>;
}
export default function MockAutoPayScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const care = useCarePlans(); const mandates = useMockMandates();
  const plan = care.ready ? care.records.find((record) => record.kind === 'plan' && record.id === id) : undefined;
  const existing = mandates.records.filter((record) => record.planId === id).at(-1);
  const latest = [...new Map(mandates.records.map((record) => [record.planId, record])).values()];
  return <FeaturePage title="Mock AutoPay preview" fallback="/care">
    <Text style={ui.heading}>Future Subscription Preview</Text><Text style={ui.body}>{disclaimer}</Text>
    <Text style={ui.small}>No bank details, UPI credentials or payment tokens. Actual demo orders still need deliberate medicine review and simulated Checkout.</Text>
    <Button label="Reload mock previews" variant="quiet" disabled={mandates.busy} onPress={mandates.refresh} />
    {!mandates.ready ? <Text accessibilityRole={mandates.error ? 'alert' : undefined}>{mandates.error ?? 'Loading local mock previews…'}</Text>
      : id ? <Preview key={existing?.id ?? `new:${id}`} plan={plan?.kind === 'plan' ? plan : undefined} existing={existing} mandates={mandates} />
        : <>{!latest.length && <Text>No mock previews saved. Explore one from a care plan; Reminder only remains available.</Text>}
          {latest.map((record) => <Button key={record.id} label={`Mock preview ${record.id} · ${record.status}`} variant="secondary" onPress={() => router.navigate({ pathname: '/care/autopay', params: { id: record.planId } })} />)}</>}
  </FeaturePage>;
}
