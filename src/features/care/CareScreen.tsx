import { router } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { FeaturePage } from '../../components/ui/FeaturePage';
import { Button } from '../../components/ui/Button';
import { useCarePlans } from './CareProvider';
import { useAddressBook } from '../addresses/AddressBookProvider';
import type { CareRecord } from '../../domain/carePlans';
import { ui } from '../../theme/tokens';
export default function CareScreen() {
  const care = useCarePlans(); const addresses = useAddressBook();
  const recipients = care.records.filter((record) => record.kind === 'recipient');
  const plans = care.records.filter((record) => record.kind === 'plan');
  function remove(record: CareRecord) {
    Alert.alert(record.kind === 'recipient' ? 'Remove care recipient and their plans?' : 'Delete care plan?',
      'This removes local reminder plans only. Existing orders and receipts remain unchanged.', [
        { text: 'Keep', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void care.remove(record); } },
      ]);
  }
  return <FeaturePage title="Family Care">
    <Text style={ui.body}>Reminder-first care for people you love. These are local organizers, not authenticated family accounts. No plan places or pays for an order.</Text>
    {care.error && <Text accessibilityRole="alert">{care.error}</Text>}
    {care.reminderError && <Text accessibilityRole="alert">{care.reminderError}</Text>}
    <Button label="Refresh due dates & device reminders" variant="secondary" disabled={care.busy} onPress={care.refresh} />
    <Button label="App permissions" variant="quiet" onPress={() => router.navigate('/app-permissions')} />
    <Button label="Manage Mock AutoPay previews" variant="quiet" onPress={() => router.navigate('/care/autopay')} />
    {!care.ready ? <Text>Care data is loading or needs retry. Saved data has not been reset.</Text> : <>
      <Text style={ui.heading}>Care recipients</Text>
      <Button label="Add care recipient" disabled={care.busy} onPress={() => router.navigate('/care/recipient')} />
      {!recipients.length && <Text style={ui.body}>Start with a friendly name and relationship. Contacts access is not needed.</Text>}
      {recipients.map((recipient) => <View key={recipient.id} style={ui.card}>
        <Text style={ui.heading}>{recipient.name}</Text><Text style={ui.body}>{recipient.relationship}</Text>
        {recipient.addressId && <Text style={ui.small}>{addresses.book.addresses.find((address) => address.id === recipient.addressId)?.label ?? 'Linked address missing — choose an address during review.'}</Text>}
        <Button label={`Edit ${recipient.name}`} variant="secondary" disabled={care.busy} onPress={() => router.navigate({ pathname: '/care/recipient', params: { id: recipient.id } })} />
        <Button label={`Remove ${recipient.name}`} variant="quiet" disabled={care.busy} onPress={() => remove(recipient)} />
      </View>)}
      <Text style={ui.heading}>Refill review plans</Text>
      <Button label="Create refill plan" disabled={care.busy || !recipients.length} onPress={() => router.navigate('/care/plan')} />
      {!plans.length && <Text style={ui.body}>No refill plans yet. Plans remind you to review medicines at current prices.</Text>}
      {plans.map((plan) => <View key={plan.id} style={ui.card}>
        <Text style={ui.heading}>{recipients.find((recipient) => recipient.id === plan.recipientId)?.name ?? 'Missing recipient'}</Text>
        <Text style={ui.body}>{plan.status === 'paused' ? 'Paused' : plan.nextReviewAt <= new Date().toISOString() ? 'Due for review' : 'Upcoming review'} · every {plan.cadence.every} {plan.cadence.unit}(s)</Text>
        <Text style={ui.body}>{new Date(plan.nextReviewAt).toLocaleString('en-IN', { timeZone: plan.timeZone })} · {plan.timeZone}</Text>
        <Text style={ui.small}>{plan.reminders ? 'Device reminders requested where supported. In-app due dates always work.' : 'In-app reminder only.'} Device delivery time is not guaranteed.</Text>
        <Button label="Review Medicines" accessibilityLabel={`Review care plan ${plan.id}`} disabled={care.busy} onPress={() => router.navigate({ pathname: '/care/review', params: { id: plan.id } })} />
        <Button label="Explore Mock AutoPay" variant="secondary" disabled={care.busy} onPress={() => router.navigate({ pathname: '/care/autopay', params: { id: plan.id } })} />
        <Button label="Edit plan" variant="secondary" disabled={care.busy} onPress={() => router.navigate({ pathname: '/care/plan', params: { id: plan.id } })} />
        <Button label={plan.status === 'active' ? 'Pause reminders' : 'Resume reminders'} variant="secondary" disabled={care.busy} onPress={() => { void care.action(plan, plan.status === 'active' ? 'pause' : 'resume'); }} />
        <Button label="Skip next reminder" variant="quiet" disabled={care.busy} onPress={() => { void care.action(plan, 'skip'); }} />
        <Button label="Delete plan" variant="quiet" disabled={care.busy} onPress={() => remove(plan)} />
      </View>)}
    </>}
  </FeaturePage>;
}
