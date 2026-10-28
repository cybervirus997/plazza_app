import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { colors, statusColors, ui } from '../../theme/tokens';

export type StatusTone = 'positive' | 'pending' | 'negative' | 'neutral';
export type StatusIcon = 'check' | 'clock' | 'error' | 'cancel' | 'bag' | 'info';
export interface StatusPresentation {
  tone: StatusTone; icon: StatusIcon; label: string; heading: string; explanation: string;
}
const tones = {
  positive: statusColors.positive, pending: statusColors.warning,
  negative: statusColors.negative, neutral: statusColors.neutral,
};
const icons = {
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  clock: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  error: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
  cancel: { ios: 'minus.circle', android: 'cancel', web: 'cancel' },
  bag: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
} as const;
export function StatusBadge({ label, tone, icon }: Pick<StatusPresentation, 'label' | 'tone' | 'icon'>) {
  const palette = tones[tone];
  return <View style={[styles.badge, { backgroundColor: palette.background }]} accessibilityLabel={label}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><SymbolView name={icons[icon]} size={18} tintColor={palette.ink} /></View>
    <Text style={[styles.badgeText, { color: palette.ink }]}>{label}</Text>
  </View>;
}
export function StatusPanel({ presentation }: { presentation: StatusPresentation }) {
  const palette = tones[presentation.tone];
  return <View style={[ui.card, styles.panel, { backgroundColor: palette.background, borderColor: palette.border }]}
    accessibilityLabel={`${presentation.label} status`} accessibilityLiveRegion="polite">
    <View style={styles.panelHeading}>
      <View style={[styles.icon, { backgroundColor: colors.surface }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SymbolView name={icons[presentation.icon]} size={30} tintColor={palette.ink} />
      </View>
      <View style={ui.flex}><Text style={[styles.statusLabel, { color: palette.ink }]}>{presentation.label}</Text>
        <Text accessibilityRole="header" style={[styles.heading, { color: palette.ink }]}>{presentation.heading}</Text></View>
    </View>
    <Text style={ui.body}>{presentation.explanation}</Text>
  </View>;
}
const styles = StyleSheet.create({
  panel: { padding: 20, gap: 16 }, panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', marginBottom: 4 },
  heading: { fontSize: 22, lineHeight: 29, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
});
