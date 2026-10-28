import { StyleSheet, Text, View } from 'react-native';
import { colors, ui } from '../../theme/tokens';
export function DemoRouteMap() {
  return <View style={styles.map} accessible accessibilityLabel="Illustrative demo map. A symbolic pharmacy and destination connected by a route. No geographic coordinates or live rider data.">
    <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[20, 45, 75].map((position) => <View key={`h${position}`} style={[styles.street, { top: `${position}%`, left: 0, right: 0, height: 12 }]} />)}
      {[18, 50, 82].map((position) => <View key={`v${position}`} style={[styles.street, { left: `${position}%`, top: 0, bottom: 0, width: 12 }]} />)}
      <View style={styles.routeH} /><View style={styles.routeV} />
      <Text style={styles.store}>+ Demo pharmacy</Text><Text style={styles.destination}>⌂ Destination</Text>
    </View>
    <Text style={[ui.label, styles.watermark]}>ILLUSTRATIVE DEMO · NO LIVE GPS</Text>
  </View>;
}
const styles = StyleSheet.create({
  map: { minHeight: 210, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.primarySoft },
  art: { height: 180 }, street: { position: 'absolute', backgroundColor: colors.surface },
  routeH: { position: 'absolute', left: '18%', right: '18%', top: '45%', height: 5, backgroundColor: colors.primary },
  routeV: { position: 'absolute', left: '82%', top: '45%', height: '30%', width: 5, backgroundColor: colors.primary },
  store: { position: 'absolute', left: '4%', top: '15%', color: colors.primaryDark, backgroundColor: colors.surface, padding: 6, fontWeight: '700' },
  destination: { position: 'absolute', right: '2%', bottom: '5%', color: colors.primaryDark, backgroundColor: colors.surface, padding: 6, fontWeight: '700' },
  watermark: { padding: 12 },
});
