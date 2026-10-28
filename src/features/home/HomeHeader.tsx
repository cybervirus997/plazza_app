import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { openOrders } from '../../navigation/commerceNavigation';
import { colors, radii, space, typography } from '../../theme/tokens';

export function HomeHeader() {
  return <View style={styles.header}>
    <View style={styles.brand}>
      <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text allowFontScaling={false} style={styles.plus}>+</Text></View>
      <Text accessibilityRole="header" style={styles.name}>Plazza</Text>
    </View>
    <View style={styles.actions}>
      <Button label="Family Care" variant="quiet" onPress={() => router.navigate('/care')} />
      <Button label="Orders" variant="quiet" onPress={openOrders} />
      <IconButton icon="settings" label="App permissions and diagnostics" onPress={() => router.navigate('/app-permissions')} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1, maxWidth: '100%' },
  mark: { width: 32, height: 32, backgroundColor: colors.primary, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  plus: { color: colors.white, fontSize: 28, lineHeight: 32 },
  name: { ...typography.title, color: colors.primaryDark, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%' },
});
