import { StyleSheet, Text, View } from 'react-native';
import type { Medicine } from '../domain/types';
import { useShopping } from '../state/AppStateProvider';
import { colors, formatMoney, ui } from '../theme/tokens';
import { Button } from './ui/Button';
import { QuantityControl } from './ui/QuantityControl';

export function MedicineCard({ medicine, quantity, inCart = false }: { medicine: Medicine; quantity: number; inCart?: boolean }) {
  const { dispatch } = useShopping();
  return <View style={ui.card}>
    <View style={ui.row}>
      <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={styles.cross}>+</Text></View>
      <View style={ui.flex}>
        <Text style={styles.name}>{medicine.name}</Text>
        <Text style={ui.small}>{medicine.salt}</Text>
        {medicine.rx && <View style={styles.rx}><Text style={styles.rxText}>Rx · Prescription required</Text></View>}
      </View>
    </View>
    <View style={styles.bottom}>
      <View><Text style={styles.price}>{formatMoney(medicine.price)}</Text><Text style={ui.small}>per unit</Text></View>
      <QuantityControl medicine={medicine} quantity={quantity} />
    </View>
    {inCart && <Button label="Remove item" variant="quiet" accessibilityLabel={`Remove ${medicine.name} from cart`}
      onPress={() => dispatch({ type: 'remove', id: medicine.id })} />}
  </View>;
}

const styles = StyleSheet.create({
  icon: { width: 48, height: 52, borderRadius: 14, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' },
  cross: { color: colors.primary, fontSize: 32, fontWeight: '400' },
  name: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  rx: { alignSelf: 'flex-start', backgroundColor: colors.amberSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  rxText: { fontSize: 10, lineHeight: 16, fontWeight: '600', color: colors.amber },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  price: { color: colors.ink, fontSize: 19, fontWeight: '700' },
});
