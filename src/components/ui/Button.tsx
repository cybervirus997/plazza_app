import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/tokens';

interface Props {
  label: string;
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet';
  accessibilityLabel?: string;
}

export function Button({ label, onPress, disabled = false, variant = 'primary', accessibilityLabel }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.text, variant === 'primary' ? styles.lightText : styles.darkText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
  quiet: { backgroundColor: 'transparent' },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  lightText: { color: colors.white }, darkText: { color: colors.primary },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
});
