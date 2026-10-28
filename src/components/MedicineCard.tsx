import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Medicine } from '../domain/types';
import { useShopping } from '../state/AppStateProvider';
import { colors, formatMoney, ui } from '../theme/tokens';
import { Button } from './ui/Button';
import { QuantityControl } from './ui/QuantityControl';
import { ProductImage } from './ProductImage';

interface Props {
  medicine: Medicine;
  quantity: number;
  inCart?: boolean;
  onSelect?(): void;
}

export function MedicineCard({ medicine, quantity, inCart = false, onSelect }: Props) {
  const { dispatch, catalog, checkoutLocked } = useShopping();
  const product = catalog.find((item) => item.id === medicine.id);
  const details = <>
      <ProductImage imageKey={product?.imageKey} />
      <View style={ui.flex}>
        <Text style={styles.name}>{medicine.name}</Text>
        <Text style={ui.small}>{medicine.salt}</Text>
        {product?.isDemo && <Text style={styles.demo}>Demo item</Text>}
        {medicine.rx && <View style={styles.rx}><Text style={styles.rxText}>Rx · Prescription required</Text></View>}
      </View>
    </>;
  return <View style={ui.card}>
    {onSelect ? <Pressable accessibilityRole="button"
      accessibilityLabel={`Show ${medicine.name}, ${medicine.salt}, ${formatMoney(medicine.price)}${medicine.rx ? ', prescription required' : ''}`}
      onPress={onSelect} style={({ pressed }) => [ui.row, styles.selectable, pressed && styles.pressed]}>
      {details}<Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">›</Text>
    </Pressable> : <View style={ui.row}>{details}</View>}
    <View style={styles.bottom}>
      <View><Text style={styles.price}>{formatMoney(medicine.price)}</Text><Text style={ui.small}>per unit</Text></View>
      <QuantityControl medicine={medicine} quantity={quantity} />
    </View>
    {inCart && <Button label="Remove item" variant="quiet" disabled={checkoutLocked} accessibilityLabel={`Remove ${medicine.name} from cart`}
      onPress={() => dispatch({ type: 'remove', id: medicine.id })} />}
  </View>;
}

const styles = StyleSheet.create({
  demo: { color: colors.primary, fontSize: 11, fontWeight: '600', marginTop: 4 },
  name: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  rx: { alignSelf: 'flex-start', backgroundColor: colors.amberSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  rxText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.amber },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  price: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  selectable: { minHeight: 48 }, pressed: { opacity: 0.65 },
  chevron: { color: colors.primary, fontSize: 24 },
});
