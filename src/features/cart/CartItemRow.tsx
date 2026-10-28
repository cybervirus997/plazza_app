import { StyleSheet, Text, View } from 'react-native';
import type { Medicine } from '../../domain/types';
import { ProductImage } from '../../components/ProductImage';
import { Button } from '../../components/ui/Button';
import { QuantityControl } from '../../components/ui/QuantityControl';
import { useShopping } from '../../state/AppStateProvider';
import { colors, formatMoney, space, ui } from '../../theme/tokens';

export function CartItemRow({ medicine, quantity }: { medicine: Medicine; quantity: number }) {
  const { catalog, dispatch, checkoutLocked } = useShopping();
  const product = catalog.find((item) => item.id === medicine.id);
  return <View style={styles.row}>
    <View style={ui.row}><ProductImage imageKey={product?.imageKey} />
      <View style={ui.flex}><Text style={ui.heading}>{medicine.name}</Text>
        <Text style={ui.small}>{product?.subtitle ?? medicine.salt}</Text>
        {product?.isDemo && <Text style={ui.small}>Demo item</Text>}
        {medicine.rx && <Text style={styles.rx}>Rx · Prescription required</Text>}
        <Text style={styles.price}>{formatMoney(medicine.price)} <Text style={ui.small}>per unit</Text></Text>
      </View>
    </View>
    <View style={[ui.between, styles.actions]}>
      <QuantityControl medicine={medicine} quantity={quantity} />
      <Button label="Remove" accessibilityLabel={`Remove ${medicine.name} from cart`} variant="quiet" disabled={checkoutLocked}
        onPress={() => dispatch({ type: 'remove', id: medicine.id })} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderColor: colors.border },
  actions: { flexWrap: 'wrap' }, price: { color: colors.ink, fontWeight: '700', marginTop: space.xs },
  rx: { color: colors.amber, fontSize: 12, lineHeight: 18, fontWeight: '600' },
});
