import { useEffect, useLayoutEffect, useRef } from 'react';
import { Text } from 'react-native';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { Snackbar } from './Snackbar';

export function NoticeBanner() {
  const { state, dispatch, persistenceError } = useShopping();
  const currentDispatch = useRef(dispatch);
  useLayoutEffect(() => { currentDispatch.current = dispatch; }, [dispatch]);
  const notice = state.notice;
  useEffect(() => {
    if (!notice || notice.kind !== 'info') return;
    const timer = setTimeout(() => currentDispatch.current({ type: 'dismiss-notice', id: notice.id }), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  return <>
    {persistenceError && <Text accessibilityRole="alert" style={[ui.body, { color: colors.danger }]}>{persistenceError}</Text>}
    {notice && notice.kind !== 'order' && <Snackbar message={notice.message} warning={notice.kind !== 'info'}
      onDismiss={() => dispatch({ type: 'dismiss-notice', id: notice.id })} />}
  </>;
}
