import { usePreventRemove } from 'expo-router';
import { Alert, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, ui } from '../../theme/tokens';
let sequence = 0;
export const careId = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2, 8)}`;
export function CareField({ label, value, onChange, keyboardType }: { label: string; value: string; onChange(value: string): void; keyboardType?: TextInputProps['keyboardType'] }) {
  return <View><Text style={ui.small}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
    keyboardType={keyboardType} autoCorrect={false} maxLength={200} style={[ui.input, { flex: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }]} /></View>;
}
export function useCareFormGuard(dirty: boolean, busy: boolean) {
  return usePreventRemove(dirty || busy, ({ repeat }) => {
    if (busy) { Alert.alert('Saving changes', 'Please wait for the save to finish.'); return; }
    Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: repeat },
    ]);
  });
}
