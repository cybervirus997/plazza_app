import { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { couponRules } from '../../domain/coupons';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';

export function CouponSection() {
  const [input, setInput] = useState('');
  const { state, dispatch } = useShopping();
  function apply(code: string) {
    dispatch({ type: 'apply-coupon', code });
    Keyboard.dismiss();
  }
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.heading}>A little extra savings</Text>
    {state.activeCouponCode ? <View style={styles.active}>
      <Text style={styles.code}>✓ {state.activeCouponCode} applied</Text>
      <Text style={ui.small}>{couponRules.find((rule) => rule.code === state.activeCouponCode)?.description}</Text>
      <Button label="Remove coupon" variant="quiet" onPress={() => dispatch({ type: 'remove-coupon' })} />
    </View> : <>
      <View style={styles.inputRow}>
        <TextInput value={input} onChangeText={setInput} accessibilityLabel="Coupon code" placeholder="Enter coupon code"
          placeholderTextColor={colors.muted} autoCapitalize="characters" autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => apply(input)} style={ui.input} />
        <Button label="Apply" variant="quiet" disabled={!input.trim()} onPress={() => apply(input)} />
      </View>
      <View style={styles.offers}>{couponRules.map((rule) => <View key={rule.code} style={styles.offer}>
        <View style={ui.flex}><Text style={styles.code}>{rule.code}</Text><Text style={ui.small}>{rule.description}</Text></View>
        <Button label={state.usedCouponCodes.includes(rule.code) && rule.oneTime ? 'Used' : 'Use'} variant="quiet"
          accessibilityLabel={`Use coupon ${rule.code}`} disabled={!!rule.oneTime && state.usedCouponCodes.includes(rule.code)} onPress={() => apply(rule.code)} />
      </View>)}</View>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 14, alignItems: 'center' },
  active: { padding: 14, backgroundColor: colors.primarySoft, borderRadius: 14, gap: 6 },
  code: { fontWeight: '700', fontSize: 13, color: colors.primary, letterSpacing: 0.4 },
  offers: { gap: 2 }, offer: { flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, paddingBottom: 4 },
});
