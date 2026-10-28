import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { colors, ui } from '../../theme/tokens';
import { usePermissions } from './PermissionProvider';

export function DeliveryLocation() {
  const permissions = usePermissions();
  return <View style={styles.location}>
    <View style={styles.pin}><Text style={styles.pinText}>⌖</Text></View>
    <View style={ui.flex}><Text style={ui.label}>YOUR DELIVERY LOCATION</Text>
      <Text style={styles.locationText}>{permissions.locationMessage}</Text>
    </View>
  </View>;
}

export function PermissionPanel({ compact = false }: { compact?: boolean }) {
  const permissions = usePermissions();
  const blocked = permissions.location === 'blocked' || permissions.notifications === 'blocked';
  const canRequest = [permissions.location, permissions.notifications].some((status) => status === 'denied' || status === 'undetermined');
  return <View style={[styles.panel, compact && styles.compact]}>
    <View style={compact && styles.summary}>
    <Text style={ui.small}>Permissions · Location: {permissions.location} · Notifications: {permissions.notifications}</Text>
    {blocked && <Text style={ui.small}>A permission is blocked by your phone. Enable it in the app’s Settings. Shopping is still available.</Text>}
    {permissions.error && <Text accessibilityRole="alert" style={ui.small}>{permissions.error}</Text>}
    </View>
    <View style={styles.actions}>
      {blocked && <Button label="Open Settings" variant="quiet" onPress={permissions.openSettings} />}
      {canRequest && <Button label="Enable access" variant="quiet" disabled={permissions.busy} onPress={permissions.request} />}
      <Button label={permissions.busy ? 'Checking…' : 'Refresh'} variant="quiet" disabled={permissions.busy} onPress={permissions.refresh} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  location: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pin: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pinText: { fontSize: 25, color: colors.primary },
  locationText: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 4 },
  panel: { borderRadius: 14, padding: 12, backgroundColor: '#EDF2EF', gap: 6 },
  compact: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  summary: { flexBasis: 160, flexGrow: 1, flexShrink: 1 },
  actions: { maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
