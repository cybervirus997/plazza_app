import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { colors, radii, space, ui } from '../../theme/tokens';
import { usePermissions } from './PermissionProvider';

export function DeviceLocation() {
  const permissions = usePermissions();
  const coordinates = permissions.location === 'granted' && !permissions.checking ? permissions.coordinates : null;
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={ui.heading}>Device GPS · optional</Text>
    <Text style={styles.text}>GPS can help fill an address. It never chooses or changes your saved delivery address.</Text>
    {coordinates ? <View style={styles.coordinates} accessibilityLiveRegion="polite">
      <Text selectable style={styles.text}>Latitude: {coordinates.latitude.toFixed(4)}</Text>
      <Text selectable style={styles.text}>Longitude: {coordinates.longitude.toFixed(4)}</Text>
    </View> : <Text accessibilityLiveRegion="polite" style={styles.text}>{permissions.locationMessage}</Text>}
  </View>;
}
// Compatibility export; its presentation now explicitly means device GPS.
export { DeviceLocation as DeliveryLocation };

export function PermissionPanel() {
  const permissions = usePermissions();
  const blocked = permissions.location === 'blocked' || permissions.notifications === 'blocked';
  const canRequest = [permissions.location, permissions.notifications].some((status) => status === 'denied' || status === 'undetermined');
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={ui.heading}>App access</Text>
    <View style={styles.status} accessible accessibilityLabel={`Location permission: ${permissions.location}`}>
      <Text style={styles.text}>Location</Text><Text style={styles.value}>{permissions.location}</Text>
    </View>
    <View style={styles.status} accessible accessibilityLabel={`Notification permission: ${permissions.notifications}`}>
      <Text style={styles.text}>Notifications</Text><Text style={styles.value}>{permissions.notifications}</Text>
    </View>
    <Text style={styles.text}>Search, manual addresses and shopping work without location access. Refresh checks access without opening a permission prompt.</Text>
    {permissions.notifications === 'unavailable' && <Text style={styles.text}>Notification checks are unavailable in this runtime. Android Expo Go skips the notifications module; a compatible development build is needed for native notification checks. Missing modules also appear as unavailable.</Text>}
    {blocked && <Text style={styles.text}>A permission is blocked by your phone. You can change it in app Settings.</Text>}
    {permissions.error && <Text accessibilityRole="alert" style={styles.text}>{permissions.error}</Text>}
    <View style={styles.actions}>
      {blocked && <Button label="Open Settings" variant="secondary" disabled={permissions.checking} onPress={permissions.openSettings} />}
      {canRequest && <Button label="Enable access" variant="secondary" disabled={permissions.busy} onPress={permissions.request} />}
      <Button label={permissions.checking ? 'Checking…' : 'Refresh'} variant="secondary" disabled={permissions.checking} onPress={permissions.refresh} />
      {permissions.location === 'granted' && <Button label={permissions.locating ? 'Updating…' : 'Update Location'}
        variant="secondary" disabled={permissions.busy} onPress={permissions.updateLocation} />}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { width: '100%', minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    padding: space.lg, backgroundColor: colors.surface, gap: space.md },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  text: { ...ui.body, flexShrink: 1, maxWidth: '100%' }, value: { ...ui.body, color: colors.ink, fontWeight: '700', flexShrink: 1 },
  coordinates: { gap: space.sm, maxWidth: '100%' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.sm, maxWidth: '100%' },
});
