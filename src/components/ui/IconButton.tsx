import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, controls, radii } from '../../theme/tokens';

const icons = {
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
} as const;

export function IconButton({ icon, label, onPress, disabled = false }: {
  icon: keyof typeof icons; label: string; onPress(): void; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SymbolView name={icons[icon]} size={controls.icon} tintColor={colors.primary} />
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minWidth: controls.minTouch, minHeight: controls.minTouch, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.primarySoft }, disabled: { opacity: 0.45 },
});
