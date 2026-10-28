import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CartItemRow } from './CartItemRow';
import { Button } from '../../components/ui/Button';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import { useShopping } from '../../state/AppStateProvider';
import { colors, formatMoney, ui } from '../../theme/tokens';
import { BillSummary } from './BillSummary';
import { CouponSection } from './CouponSection';
import { DeliveryAddressEntry } from '../addresses/DeliveryAddressEntry';
import { useAddressBook } from '../addresses/AddressBookProvider';
import { unresolvedPayment } from '../../domain/payments';
import { returnToShop } from '../../navigation/commerceNavigation';

export default function CartScreen() {
  const { items, itemCount, bill, checkoutState, checkoutLocked, payment } = useShopping();
  const addresses = useAddressBook();
  const retry = checkoutState.status === 'error' && checkoutLocked;
  const placing = checkoutState.status === 'working';
  const pendingPayment = unresolvedPayment(payment.attempt);
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <KeyboardAvoidingView style={ui.flex} enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList data={items} keyExtractor={({ medicine }) => medicine.id}
        contentContainerStyle={[ui.content, { paddingHorizontal: 16 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        ListHeaderComponent={<View style={styles.header}>
          <Text accessibilityRole="header" style={ui.title}>Your care bag<Text style={styles.count}> {itemCount ? `(${itemCount})` : ''}</Text></Text>
          <NoticeBanner />
          <DeliveryAddressEntry compact />
        </View>}
        renderItem={({ item }) => <CartItemRow medicine={item.medicine} quantity={item.quantity} />}
        ListEmptyComponent={<View style={styles.empty}>
          <View style={styles.emptyIcon}><SymbolView name={{ ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' }} size={32} tintColor={colors.primary} /></View>
          <Text style={ui.heading}>A fresh start for your care</Text>
          <Text style={[ui.body, styles.center]}>Your bag is empty. Find your medicines and we’ll keep them here for you.</Text>
          <Button label="Find your medicines →" onPress={() => returnToShop()} />
        </View>}
        ListFooterComponent={items.length ? <View style={styles.footer}>
          <Button label="+ Add more medicines" variant="quiet" onPress={() => returnToShop()} />
          <CouponSection />
          <BillSummary bill={bill} />
          {items.some(({ medicine }) => medicine.rx) && <Text style={ui.small}>Rx items require a valid prescription. This demo does not collect prescriptions.</Text>}
          <Text style={[ui.small, styles.center]}>Made for your everyday care. This is a demo order.</Text>
        </View> : undefined} />
      <View style={styles.checkout}>
        <View style={styles.checkoutFeedback} accessibilityLiveRegion="polite">
          {checkoutState.error && <Text accessibilityRole="alert" style={styles.checkoutError}>{checkoutState.error}</Text>}
          {(retry || pendingPayment) && <Text style={ui.small}>Resume the saved checkout; your reviewed details stay unchanged until it is resolved or safely cancelled.</Text>}
          {!addresses.selected && !retry && <Text style={ui.body}>Choose a delivery address before placing your demo order.</Text>}
        </View>
        <View style={styles.checkoutInner}>
          <View><Text style={ui.small}>GRAND TOTAL · {itemCount} items</Text><Text style={styles.total}>{formatMoney(bill.grandTotal)}</Text></View>
          <View style={styles.checkoutButton}><Button label={pendingPayment ? 'Resume saved payment' : 'Proceed to Checkout →'}
            disabled={placing || payment.busy || (!pendingPayment && !retry && !items.length)}
            onPress={() => router.navigate(pendingPayment ? '/payment' : '/checkout')} /></View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { gap: 10, paddingBottom: 6 }, count: { color: colors.primary, fontWeight: '400' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' },
  center: { textAlign: 'center' }, footer: { gap: 18 },
  checkout: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  checkoutFeedback: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  checkoutError: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  checkoutInner: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  total: { color: colors.ink, fontWeight: '700', fontSize: 24, marginTop: 2 }, checkoutButton: { flex: 1, minWidth: 140 },
});
