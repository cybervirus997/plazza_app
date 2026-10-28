import { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { couponRules } from '../../domain/coupons';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';

export function CouponSection() {
  const [input, setInput] = useState('');
  const { state, dispatch } = useShopping();
  const feedback = state.notice?.kind === 'error' || state.notice?.kind === 'auto-removal'
    ? state.notice : null;
  function apply(code: string) {
    dispatch({ type: 'apply-coupon', code });
    Keyboard.dismiss();
  }
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.heading}>A little extra savings</Text>
    {state.activeCouponCode ? <View accessibilityLiveRegion="polite" style={styles.active}>
      <Text style={styles.code}>✓ {state.activeCouponCode} applied</Text>
      <Text style={ui.small}>{couponRules.find((rule) => rule.code === state.activeCouponCode)?.description}</Text>
      <Button label="Remove coupon" variant="quiet" onPress={() => dispatch({ type: 'remove-coupon' })} />
    </View> : <View style={styles.inputRow}>
        <TextInput value={input} onChangeText={setInput} accessibilityLabel="Coupon code" placeholder="Enter coupon code"
          placeholderTextColor={colors.muted} autoCapitalize="characters" autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => apply(input)} style={ui.input} />
        <Button label="Apply" variant="quiet" disabled={!input.trim()} onPress={() => apply(input)} />
    </View>}
    {feedback && <View accessibilityLabel="Coupon feedback" style={[styles.feedback, feedback.kind === 'error' && styles.error]}>
      <Text accessibilityRole={feedback.kind === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
        style={[ui.small, feedback.kind === 'error' && styles.errorText]}>{feedback.message}</Text>
    </View>}
    {!state.activeCouponCode && <View style={styles.offers}>{couponRules.map((rule) => {
      const used = !!rule.oneTime && state.usedCouponCodes.includes(rule.code);
      return <View key={rule.code} style={styles.offer}>
        <View style={ui.flex}><Text style={styles.code}>{rule.code}</Text><Text style={ui.small}>{rule.description}</Text></View>
        <Button label={used ? 'Used' : 'Use'} variant="quiet"
          accessibilityLabel={used ? `${rule.code} already used` : `Use coupon ${rule.code}`}
          disabled={used} onPress={() => apply(rule.code)} />
      </View>;
    })}</View>}
  </View>;
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 14, alignItems: 'center' },
  active: { padding: 14, backgroundColor: colors.primarySoft, borderRadius: 14, gap: 6 },
  code: { fontWeight: '700', fontSize: 13, color: colors.primary, letterSpacing: 0.4 },
  feedback: { borderRadius: 12, padding: 12, backgroundColor: colors.primarySoft },
  error: { backgroundColor: colors.dangerSoft }, errorText: { color: colors.danger },
  offers: { gap: 2 }, offer: { flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, paddingBottom: 4 },
});
