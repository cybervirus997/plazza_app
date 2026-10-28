import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAddress } from '../../domain/addresses';
import { colors, controls, radii, space, ui } from '../../theme/tokens';
import { useAddressBook } from './AddressBookProvider';

export function DeliveryAddressEntry({ disabled = false, compact = false }: { disabled?: boolean; compact?: boolean }) {
  const { selected, loading, ready, error, warning } = useAddressBook();
  return <Pressable accessibilityRole="button" accessibilityLabel="Choose delivery address"
    accessibilityHint={selected ? `Current delivery address: ${selected.label}, ${formatAddress(selected)}. Opens your address book.` : 'Open your address book to choose or manually add a delivery address.'}
    disabled={disabled} accessibilityState={{ disabled }}
    onPress={() => router.navigate('/addresses')} style={[styles.entry, compact && styles.compact]}>
    <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={styles.pin}>⌂</Text></View>
    <View style={[ui.flex, styles.details]}>
      <Text style={ui.label}>DELIVER TO {selected ? `· ${selected.label}` : ''}</Text>
      <Text style={styles.summary} numberOfLines={compact ? 2 : undefined}>{loading ? 'Loading saved addresses…' : warning ? 'Review your saved delivery addresses' : selected
        ? compact ? [selected.flatNumber, selected.addressLine, selected.city, selected.pinCode].filter(Boolean).join(', ') : formatAddress(selected)
        : !ready || error ? 'Manage saved addresses' : 'Choose Delivery Address'}</Text>
      {(!compact || !selected || warning) && <Text style={ui.small}>{warning ? 'Some saved data needs your attention' : selected ? 'Saved address · GPS updates do not change it' : 'For you or someone you care about · GPS optional'}</Text>}
    </View>
    <Text style={styles.action}>{selected ? 'Change' : 'Choose'}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 80 },
  compact: { padding: space.md, borderRadius: radii.lg, minHeight: controls.minTouch }, details: { minWidth: 0 },
  icon: { width: 38, height: 44, backgroundColor: colors.primarySoft, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pin: { fontSize: 26, color: colors.primary }, summary: { color: colors.ink, fontSize: 13, lineHeight: 20, marginVertical: 4 },
  action: { color: colors.primary, fontSize: 13, fontWeight: '700', flexShrink: 1, maxWidth: '30%' },
});
