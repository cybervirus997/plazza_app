import { StyleSheet, Text, View } from 'react-native';
import { colors, space, ui } from '../../theme/tokens';
import { IconButton } from './IconButton';

export function Snackbar({ message, warning, onDismiss }: { message: string; warning: boolean; onDismiss(): void }) {
  return <View accessibilityLiveRegion="polite" style={[styles.bar, warning && styles.warning]}>
    <Text style={[ui.body, styles.message]}>{warning ? 'Attention · ' : '✓ '}{message}</Text>
    <IconButton icon="close" label="Dismiss" onPress={onDismiss} />
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, backgroundColor: colors.primarySoft, paddingLeft: space.md },
  warning: { backgroundColor: colors.amberSoft }, message: { flex: 1, minWidth: 0 },
});
