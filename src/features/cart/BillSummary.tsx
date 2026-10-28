import { StyleSheet, Text, View } from 'react-native';
import type { Bill } from '../../domain/bill';
import { colors, formatMoney, ui } from '../../theme/tokens';

export function BillSummary({ bill }: { bill: Bill }) {
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.heading}>Bill details</Text>
    <View style={[ui.between, styles.line]}><Text style={ui.body}>Item Total</Text><Text style={styles.amount}>{formatMoney(bill.itemTotal)}</Text></View>
    <View style={[ui.between, styles.line]}><Text style={ui.body}>Discount</Text><Text style={styles.saving}>−{formatMoney(bill.discount)}</Text></View>
    <View style={[ui.between, styles.line]}><Text style={ui.body}>Delivery Fee</Text><Text style={bill.deliveryFee ? styles.amount : styles.saving}>{bill.deliveryFee ? formatMoney(bill.deliveryFee) : 'FREE'}</Text></View>
    <View style={[ui.between, styles.line, styles.total]}><Text style={styles.totalText}>Grand Total</Text><Text style={styles.totalText}>{formatMoney(bill.grandTotal)}</Text></View>
    <Text style={ui.small}>Free delivery on item totals of ₹499 or more, before discounts.</Text>
  </View>;
}

const styles = StyleSheet.create({
  line: { flexWrap: 'wrap' },
  amount: { color: colors.ink, fontSize: 14, fontWeight: '500' }, saving: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  total: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, marginTop: 2 },
  totalText: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
