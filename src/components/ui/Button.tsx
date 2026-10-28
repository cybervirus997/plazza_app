import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, controls, radii, space, typography } from '../../theme/tokens';

interface Props {
  label: string;
  onPress(): void;
  disabled?: boolean;
  selected?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet';
  accessibilityLabel?: string;
}

export function Button({ label, onPress, disabled = false, selected, variant = 'primary', accessibilityLabel }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.text, variant === 'primary' ? styles.lightText : styles.darkText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: controls.minTouch, minHeight: controls.minTouch, borderRadius: radii.md, paddingHorizontal: space.lg, paddingVertical: space.md, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
  quiet: { backgroundColor: 'transparent' },
  text: { ...typography.action, textAlign: 'center' },
  lightText: { color: colors.white }, darkText: { color: colors.primary },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
});
