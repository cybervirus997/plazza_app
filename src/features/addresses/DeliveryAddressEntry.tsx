import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAddress } from '../../domain/addresses';
import { colors, ui } from '../../theme/tokens';
import { useAddressBook } from './AddressBookProvider';

export function DeliveryAddressEntry({ disabled = false }: { disabled?: boolean }) {
  const { selected, loading, ready, error, warning } = useAddressBook();
  return <Pressable accessibilityRole="button" accessibilityLabel="Choose delivery address"
    disabled={disabled} accessibilityState={{ disabled }}
    onPress={() => router.navigate('/addresses')} style={styles.entry}>
    <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={styles.pin}>⌂</Text></View>
    <View style={ui.flex}>
      <Text style={ui.label}>DELIVER TO {selected ? `· ${selected.label}` : ''}</Text>
      <Text style={styles.summary} numberOfLines={2}>{loading ? 'Loading saved addresses…' : warning ? 'Review your saved delivery addresses' : selected ? formatAddress(selected)
        : !ready || error ? 'Manage saved addresses' : 'Add a delivery address'}</Text>
      <Text style={ui.small}>{warning ? 'Some saved data needs your attention' : selected ? 'Saved address · GPS updates do not change it' : 'For you or someone you care about · GPS optional'}</Text>
    </View>
    <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">›</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 80 },
  icon: { width: 38, height: 44, backgroundColor: colors.primarySoft, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pin: { fontSize: 26, color: colors.primary }, summary: { color: colors.ink, fontSize: 13, lineHeight: 20, marginVertical: 4 },
  chevron: { color: colors.primary, fontSize: 24 },
});
