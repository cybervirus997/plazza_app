import { Text, View } from 'react-native';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { Button } from './Button';

export function NoticeBanner() {
  const { state, dispatch, persistenceError } = useShopping();
  return <>
    {persistenceError && <Text accessibilityRole="alert" style={[ui.body, { color: colors.danger }]}>{persistenceError}</Text>}
    {state.notice && <View accessibilityLiveRegion="polite" style={[ui.card, { backgroundColor: state.notice.kind === 'error' ? colors.dangerSoft : colors.primarySoft }]}>
      <Text style={ui.body}>{state.notice.message}</Text>
      <Button label="Dismiss" variant="quiet" onPress={() => {
        if (state.notice) dispatch({ type: 'dismiss-notice', id: state.notice.id });
      }} />
    </View>}
  </>;
}
