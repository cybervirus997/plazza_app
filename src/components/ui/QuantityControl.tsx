import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Medicine } from '../../domain/types';
import { useShopping } from '../../state/AppStateProvider';
import { colors } from '../../theme/tokens';
import { Button } from './Button';

export function QuantityControl({ medicine, quantity }: { medicine: Medicine; quantity: number }) {
  const { state, dispatch } = useShopping();
  if (!quantity) return <Button label="+ Add" disabled={!state.hydrated} accessibilityLabel={`Add ${medicine.name} to cart`}
    variant="secondary" onPress={() => dispatch({ type: 'add', id: medicine.id })} />;
  const atMaximum = quantity >= medicine.maxQty;
  return <View>
    <View style={styles.control}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${medicine.name} quantity`}
        onPress={() => dispatch({ type: 'decrease', id: medicine.id })} style={styles.step}>
        <Text style={styles.symbol}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`${medicine.name}, quantity ${quantity}`} style={styles.quantity}>{quantity}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${medicine.name} quantity`}
        accessibilityState={{ disabled: atMaximum }} disabled={atMaximum}
        onPress={() => dispatch({ type: 'increase', id: medicine.id })} style={[styles.step, atMaximum && styles.disabled]}>
        <Text style={styles.symbol}>+</Text>
      </Pressable>
    </View>
    {atMaximum && <Text style={styles.maximum}>Limit {medicine.maxQty} reached</Text>}
  </View>;
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  step: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  symbol: { color: colors.primary, fontSize: 22, fontWeight: '500' },
  quantity: { color: colors.primaryDark, fontWeight: '700', fontSize: 15, minWidth: 24, textAlign: 'center' },
  disabled: { opacity: 0.3 },
  maximum: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 4 },
});
