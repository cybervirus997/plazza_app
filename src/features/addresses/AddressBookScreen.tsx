import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { deliveryOptions, formatAddress, gateOptions, type DeliveryAddress } from '../../domain/addresses';
import { colors, ui } from '../../theme/tokens';
import { useAddressBook } from './AddressBookProvider';
import { backTo } from '../../navigation/commerceNavigation';
import { useScreenCompletion } from '../../hooks/useScreenActive';

export default function AddressBookScreen() {
  const addresses = useAddressBook();
  const captureCompletion = useScreenCompletion();
  function goBack() { backTo('/'); }
  function confirmDelete(address: DeliveryAddress) {
    Alert.alert(`Delete ${address.label}?`, 'This removes the saved address from this device.', [
      { text: 'Keep address', style: 'cancel' },
      { text: 'Delete address', style: 'destructive', onPress: () => { void addresses.remove(address.id); } },
    ]);
  }
  return <SafeAreaView style={ui.screen}>
    <FlatList data={addresses.loading || !addresses.ready ? [] : addresses.book.addresses} keyExtractor={(address) => address.id}
      contentContainerStyle={ui.content} extraData={[addresses.book.selectedAddressId, addresses.book.defaultAddressId, addresses.busy]}
      ListHeaderComponent={<View style={styles.section}>
        <View style={[ui.between, styles.actions]}><Button label="← Back" accessibilityLabel="Back from address book" variant="quiet" onPress={goBack} />
          <Button label="+ Add address" disabled={!addresses.ready || addresses.busy} onPress={() => router.navigate('/address-form')} /></View>
        <Text style={ui.label}>CARE, WHEREVER YOU CALL HOME</Text>
        <Text accessibilityRole="header" style={ui.title}>Your address book</Text>
        <Text style={ui.body}>Save a place for yourself or someone you care about. Selecting a delivery address keeps your default unchanged.</Text>
        {addresses.warning && <Text accessibilityRole="alert" style={ui.body}>{addresses.warning}</Text>}
        {addresses.error && <View style={ui.card}><Text accessibilityRole="alert" style={ui.body}>{addresses.error}</Text>
          <Button label="Retry address book" variant="secondary" disabled={addresses.busy} onPress={addresses.reload} /></View>}
      </View>}
      renderItem={({ item }) => {
        const selected = item.id === addresses.book.selectedAddressId;
        const isDefault = item.id === addresses.book.defaultAddressId;
        const name = `${item.label}, ${[item.flatNumber, item.tower, item.addressLine].filter(Boolean).join(', ')}`;
        return <View style={[ui.card, selected && styles.selected]}>
          <View style={ui.between}>
            <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">{item.label === 'Work' ? '▣' : '⌂'}</Text>
            <View style={ui.flex}><Text accessibilityRole="header" style={ui.heading}>{item.label}</Text>
              <Text style={ui.small}>{[selected ? '✓ Selected for delivery' : '', isDefault ? 'Default address' : ''].filter(Boolean).join(' · ')}</Text></View>
          </View>
          {!!(item.recipientName || item.relationship) && <Text style={ui.body}>For {item.recipientName || 'recipient'}{item.relationship ? ` · ${item.relationship}` : ''}</Text>}
          {!!item.recipientPhone && <Text style={ui.small}>{item.recipientPhone}</Text>}
          <Text style={styles.address}>{formatAddress(item)}</Text>
          <Text style={ui.small}>{deliveryOptions.find((option) => option.id === item.deliveryOption)?.title}
            {item.callBeforeArrival ? ' · Call Before Arrival' : ''}</Text>
          <Text style={ui.small}>{gateOptions.find((option) => option.id === item.gateAccess)?.title}{item.societyApp ? ` · ${item.societyApp}` : ''} · demo instructions only</Text>
          {!!item.instructions && <Text style={ui.body}>{item.instructions}</Text>}
          <View style={styles.actions}>
            <Button label={selected && addresses.warning ? 'Confirm this address' : selected ? 'Delivering here' : 'Deliver here'} accessibilityLabel={`Deliver to ${name}`}
              disabled={(selected && !addresses.warning) || addresses.busy} onPress={() => { const complete = captureCompletion(); void addresses.select(item.id).then((saved) => { if (saved) complete.navigate(goBack); }); }} />
            {!isDefault && <Button label="Make default" accessibilityLabel={`Make ${name} default`} disabled={addresses.busy}
              variant="secondary" onPress={() => { void addresses.setDefault(item.id); }} />}
            <Button label="Edit" accessibilityLabel={`Edit ${name}`} variant="quiet" disabled={addresses.busy}
              onPress={() => router.navigate({ pathname: '/address-form', params: { id: item.id } })} />
            <Button label="Delete" accessibilityLabel={`Delete ${name}`} variant="quiet" disabled={addresses.busy} onPress={() => confirmDelete(item)} />
          </View>
        </View>;
      }}
      ListEmptyComponent={<View style={[ui.card, styles.empty]}>
        {addresses.loading ? <><ActivityIndicator accessibilityLabel="Loading address book" color={colors.primary} /><Text style={ui.body}>Opening your saved places…</Text></>
          : addresses.ready ? <><Text style={styles.icon}>⌂</Text><Text style={ui.heading}>A place for every delivery</Text>
            <Text style={ui.body}>Add Home, Work or a place for someone you love. You can type the whole address without location access.</Text>
            <Button label="Add your first address" onPress={() => router.navigate('/address-form')} /></> : null}
      </View>} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  section: { gap: 12 }, selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: { color: colors.primary, fontSize: 30 }, address: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, empty: { alignItems: 'center', paddingVertical: 28 },
});
