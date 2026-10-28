import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import { useShopping } from '../../state/AppStateProvider';
import { colors, formatMoney, ui } from '../../theme/tokens';
import { BillSummary } from './BillSummary';
import { CouponSection } from './CouponSection';

export default function CartScreen() {
  const { items, itemCount, bill, dispatch } = useShopping();
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList data={items} keyExtractor={({ medicine }) => medicine.id}
        contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        ListHeaderComponent={<View style={styles.header}>
          <Text style={ui.label}>A LITTLE CLOSER TO FEELING BETTER</Text>
          <Text accessibilityRole="header" style={ui.title}>Your care bag<Text style={styles.count}> {itemCount ? `(${itemCount})` : ''}</Text></Text>
          <Text style={ui.body}>{items.length ? 'Everything you need, all in one place.' : 'Good care starts with the essentials.'}</Text>
          <NoticeBanner />
        </View>}
        renderItem={({ item }) => <MedicineCard medicine={item.medicine} quantity={item.quantity} inCart />}
        ListEmptyComponent={<View style={styles.empty}>
          <View style={styles.emptyIcon}><SymbolView name={{ ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' }} size={56} tintColor={colors.primary} /></View>
          <Text style={ui.heading}>A fresh start for your care</Text>
          <Text style={[ui.body, styles.center]}>Your bag is empty. Find your medicines and we’ll keep them here for you.</Text>
          <Button label="Find your medicines →" onPress={() => router.navigate('/')} />
        </View>}
        ListFooterComponent={items.length ? <View style={styles.footer}>
          <Button label="+ Add more medicines" variant="quiet" onPress={() => router.navigate('/')} />
          <CouponSection />
          <BillSummary bill={bill} />
          {items.some(({ medicine }) => medicine.rx) && <Text style={ui.small}>Rx items require a valid prescription. This demo does not collect prescriptions.</Text>}
          <Text style={[ui.small, styles.center]}>Made for your everyday care. This is a demo order.</Text>
        </View> : undefined} />
      <View style={styles.checkout}>
        <View style={styles.checkoutInner}>
          <View><Text style={ui.small}>GRAND TOTAL</Text><Text style={styles.total}>{formatMoney(bill.grandTotal)}</Text></View>
          <View style={styles.checkoutButton}><Button label="Place Order →" disabled={!items.length} onPress={() => {
            Keyboard.dismiss();
            dispatch({ type: 'place-order' });
          }} /></View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { gap: 10, paddingBottom: 6 }, count: { color: colors.primary, fontWeight: '400' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 20 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  center: { textAlign: 'center' }, footer: { gap: 18 },
  checkout: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  checkoutInner: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  total: { color: colors.ink, fontWeight: '700', fontSize: 24, marginTop: 2 }, checkoutButton: { flex: 1, minWidth: 140 },
});
