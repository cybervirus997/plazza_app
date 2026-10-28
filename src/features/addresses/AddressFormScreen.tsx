import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { addressDraft, addressLabels, deliveryOptions, gateOptions, validateAddress,
  type AddressDraft, type AddressErrors, type DeliveryAddress } from '../../domain/addresses';
import { colors, ui } from '../../theme/tokens';
import { useAddressBook } from './AddressBookProvider';
import { useAddressLocation } from './useAddressLocation';

interface Field { key: keyof Pick<AddressDraft, 'label' | 'recipientName' | 'recipientPhone' | 'relationship' | 'addressLine' | 'flatNumber' | 'tower'
  | 'society' | 'landmark' | 'city' | 'state' | 'pinCode' | 'instructions' | 'latitude' | 'longitude' | 'societyApp'>;
  title: string; keyboardType?: TextInputProps['keyboardType']; multiline?: boolean; }
const addressFields: readonly Field[] = [
  { key: 'addressLine', title: 'Address line / building *' }, { key: 'flatNumber', title: 'Flat or house number' },
  { key: 'tower', title: 'Tower / block' }, { key: 'society', title: 'Society name' }, { key: 'landmark', title: 'Landmark' },
  { key: 'city', title: 'City *' }, { key: 'state', title: 'State *' }, { key: 'pinCode', title: 'PIN code *', keyboardType: 'number-pad' },
];
const recipientFields: readonly Field[] = [{ key: 'recipientName', title: 'Recipient name (optional)' },
  { key: 'recipientPhone', title: 'Recipient phone (optional)', keyboardType: 'phone-pad' }, { key: 'relationship', title: 'Recipient relationship (optional)' }];

function AddressField({ field, value, error, onChange }: { field: Field; value: string; error?: string; onChange(value: string): void }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{field.title}</Text>
    <TextInput accessibilityLabel={field.title} accessibilityHint={error} value={value} onChangeText={onChange}
      keyboardType={field.keyboardType} multiline={field.multiline} textAlignVertical={field.multiline ? 'top' : 'center'}
      maxLength={field.key === 'instructions' ? 500 : field.key === 'label' ? 50 : field.key === 'pinCode' ? 6 : 150}
      style={[styles.input, field.multiline && styles.multiline, !!error && styles.invalid]} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
function Choice({ title, selected, onPress, disabled = false }: { title: string; selected: boolean; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected, disabled }} disabled={disabled}
    onPress={onPress} style={[styles.choice, selected && styles.activeChoice]}>
    <Text style={[styles.choiceText, selected && styles.activeText]}>{selected ? '✓ ' : ''}{title}</Text>
  </Pressable>;
}
function returnToBook() { if (router.canGoBack()) router.back(); else router.replace('/addresses'); }

function AddressForm({ address }: { address?: DeliveryAddress }) {
  const addresses = useAddressBook();
  const [initial] = useState(() => addressDraft(address));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [initialDefault] = useState(!addresses.book.addresses.length || address?.id === addresses.book.defaultAddressId);
  const [makeDefault, setMakeDefault] = useState(initialDefault);
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [savingForm, setSavingForm] = useState(false);
  const dirty = makeDefault !== initialDefault || (Object.keys(initial) as (keyof AddressDraft)[]).some((key) => initial[key] !== draft[key]);
  const disablePrevention = usePreventRemove((dirty || savingForm) && !saved, ({ repeat }) => {
    if (savingForm) { Alert.alert('Saving address', 'Please wait for the save to finish.'); return; }
    Alert.alert('Discard address changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { setSaved(true); repeat(); } },
    ]);
  });
  const location = useAddressLocation((coordinates) => {
    setDraft((current) => ({ ...current, latitude: String(coordinates.latitude), longitude: String(coordinates.longitude) }));
    setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
  });
  function change<K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) {
    location.cancel();
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  function renderField(field: Field) {
    return <AddressField key={field.key} field={field} value={draft[field.key]} error={errors[field.key]}
      onChange={(value) => change(field.key, value)} />;
  }
  async function save() {
    if (saving.current) return;
    const result = validateAddress(draft);
    if (!result.valid) { setErrors(result.errors); return; }
    saving.current = true;
    setSavingForm(true);
    location.cancel();
    const success = await addresses.save(draft, { id: address?.id, makeDefault, select: !address });
    saving.current = false;
    if (!mounted.current) return;
    setSavingForm(false);
    if (success) {
      setSaved(true);
      Keyboard.dismiss();
      disablePrevention();
      returnToBook();
    }
  }
  return <SafeAreaView style={ui.screen}>
    <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={ui.between}><Button label="← Back" accessibilityLabel="Back from address form" variant="quiet" disabled={savingForm} onPress={returnToBook} />
          <Text style={ui.label}>SAVED PLACES</Text></View>
        <Text accessibilityRole="header" style={ui.title}>{address ? 'Edit your place' : 'Add a new place'}</Text>
        <Text style={ui.body}>A little detail makes the doorstep easier to find. Fields marked * are required.</Text>
        <View style={ui.card}>
          <Text style={ui.heading}>A name that feels familiar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.strip}>
            {addressLabels.map((label) => <Choice key={label} title={label} selected={draft.label === label} onPress={() => change('label', label)} />)}
          </ScrollView>
          {renderField({ key: 'label', title: 'Address label *' })}
          <Text style={ui.small}>Home, Work or your own label. This label does not set the recipient’s relationship.</Text>
        </View>
        <View style={ui.card}>
          <Text style={ui.heading}>Find your starting point</Text>
          <Text style={ui.body}>Type your address below, or add editable coordinates. GPS is optional and never saves an address for you.</Text>
          <Button label={location.loading ? 'Finding location…' : 'Use Current Location'} variant="secondary"
            disabled={location.loading || savingForm || location.permissions.busy || location.permissions.location !== 'granted'} onPress={() => { void location.suggest(); }} />
          {location.permissions.location !== 'granted' && <Text style={ui.small}>Location access is {location.permissions.location}. Manual entry works without it.</Text>}
          {['denied', 'blocked', 'undetermined'].includes(location.permissions.location) &&
            <Button label="Open app Settings" variant="quiet" disabled={location.permissions.checking} onPress={location.permissions.openSettings} />}
          {location.message && <Text accessibilityLiveRegion="polite" style={ui.body}>{location.message}</Text>}
        </View>
        <View style={ui.card}><Text style={ui.heading}>Address details</Text>{addressFields.map(renderField)}
          <Text style={ui.small}>PIN format is checked locally. This does not verify delivery coverage.</Text>
          {renderField({ key: 'latitude', title: 'Latitude (optional)', keyboardType: 'numbers-and-punctuation' })}
          {renderField({ key: 'longitude', title: 'Longitude (optional)', keyboardType: 'numbers-and-punctuation' })}
        </View>
        <View style={ui.card}><Text style={ui.heading}>Who’s receiving it?</Text>
          <Text style={ui.small}>Optional and entered by you. No access to phone contacts is requested.</Text>{recipientFields.map(renderField)}</View>
        <View style={ui.card}>
          <Text style={ui.heading}>Gate access & society instructions</Text>
          <Text style={ui.body}>Local demo preferences only. No connection to society apps, gate approvals or calls.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.strip}>
            {gateOptions.map((option) => <Choice key={option.id} title={option.title} selected={draft.gateAccess === option.id} onPress={() => change('gateAccess', option.id)} />)}
          </ScrollView>
          {draft.gateAccess === 'other' && renderField({ key: 'societyApp', title: 'Society app name *' })}
          <View style={styles.choices}>{deliveryOptions.map((option) => <Choice key={option.id} title={option.title}
            selected={draft.deliveryOption === option.id} onPress={() => change('deliveryOption', option.id)} />)}</View>
          <Choice title="Call Before Arrival" selected={draft.callBeforeArrival} onPress={() => change('callBeforeArrival', !draft.callBeforeArrival)} />
          {renderField({ key: 'instructions', title: 'Delivery instructions', multiline: true })}
        </View>
        <View style={ui.card}>
          <Choice title="Make this my default address" selected={makeDefault} disabled={initialDefault} onPress={() => setMakeDefault(!makeDefault)} />
          <Text style={ui.small}>{initialDefault ? 'Every nonempty address book has one default. Choose another saved address to change it.'
            : 'Your current delivery choice is separate from your default.'}</Text>
          {!address && <Text style={ui.body}>Saving selects this place for your current delivery.</Text>}
        </View>
        {addresses.error && <Text accessibilityRole="alert" style={styles.error}>{addresses.error}</Text>}
        {Object.values(errors).some(Boolean) && <Text accessibilityRole="alert" style={styles.error}>Review the highlighted fields above before saving.</Text>}
        <Button label={savingForm ? 'Saving address…' : 'Save address'} disabled={savingForm || addresses.busy || !addresses.ready}
          onPress={() => { void save(); }} />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export default function AddressFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const addresses = useAddressBook();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const address = addresses.book.addresses.find((item) => item.id === id);
  if (addresses.loading) return <SafeAreaView style={ui.screen}><ActivityIndicator accessibilityLabel="Loading address form" color={colors.primary} /></SafeAreaView>;
  if (!addresses.ready || (id && !address)) return <SafeAreaView style={[ui.screen, ui.content]}>
    <Text style={ui.heading}>{addresses.error ?? 'This address no longer exists.'}</Text>
    <Button label="Back to address book" onPress={returnToBook} />
    {!addresses.ready && <Button label="Retry saved addresses" variant="secondary" onPress={addresses.reload} />}
  </SafeAreaView>;
  return <AddressForm key={id ?? 'new'} address={address} />;
}
const styles = StyleSheet.create({
  field: { gap: 6 }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 52, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, color: colors.ink },
  multiline: { minHeight: 100 }, invalid: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  strip: { flexDirection: 'row', gap: 8 },
  choice: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  activeChoice: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, choiceText: { color: colors.muted, fontSize: 13 },
  activeText: { color: colors.primaryDark, fontWeight: '600' },
});
