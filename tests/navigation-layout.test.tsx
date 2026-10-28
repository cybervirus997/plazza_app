import { act, type ReactNode } from 'react';
import { createRoot } from 'test-renderer';
import type { NativeStackNavigationOptions } from 'expo-router';
import RootLayout, { unstable_settings } from '../src/app/_layout';
import AppTabs from '../src/components/app-tabs';
import { colors } from '../src/theme/tokens';

let mockHydrated = false;
let mockReducedMotion = false;
const mockStackMounted = jest.fn();
const mockStackUnmounted = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Screen = (props: object) => React.createElement('RouteOptions', props);
  const Stack = Object.assign((props: { children: ReactNode; screenOptions: NativeStackNavigationOptions }) => {
    React.useEffect(() => { mockStackMounted(); return () => { mockStackUnmounted(); }; }, []);
    return React.createElement('NativeStack', props, props.children);
  }, { Screen });
  const Tabs = Object.assign((props: { children: ReactNode }) => React.createElement('Tabs', props, props.children), { Screen });
  return { Stack, Tabs, router: {}, DefaultTheme: { colors: {} }, ThemeProvider: ({ children }: { children: ReactNode }) => children };
});
jest.mock('../src/state/AppStateProvider', () => ({
  AppStateProvider: ({ children }: { children: ReactNode }) => children,
  useShopping: () => ({ state: { hydrated: mockHydrated }, checkoutState: { error: null }, itemCount: 2 }),
}));
jest.mock('../src/features/addresses/AddressBookProvider', () => ({ AddressBookProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock('../src/features/permissions/PermissionProvider', () => ({ PermissionProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock('../src/features/care/CareProvider', () => ({ CareProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

beforeEach(() => { jest.clearAllMocks(); mockHydrated = false; mockReducedMotion = false; });

test('recovery gates the stack once; hydration and reduced-motion updates preserve navigator identity and header ownership', async () => {
  const root = createRoot();
  try {
    await act(async () => { root.render(<RootLayout />); });
    expect(mockStackMounted).not.toHaveBeenCalled();
    mockHydrated = true;
    await act(async () => { root.render(<RootLayout />); });
    const stack = root.container.queryAll((node) => node.type === 'NativeStack')[0];
    expect(stack.props.screenOptions).toMatchObject({ headerShown: true, headerTitleAlign: 'left', headerTransparent: false,
      headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' });
    const tabs = root.container.queryAll((node) => node.type === 'RouteOptions' && node.props.name === '(tabs)')[0];
    expect(tabs.props.options).toMatchObject({ headerShown: false, animationTypeForReplace: 'pop' });
    expect(unstable_settings.anchor).toBe('(tabs)');
    const scan = root.container.queryAll((node) => node.type === 'RouteOptions' && node.props.name === 'scan-medicine')[0];
    expect(scan.props.options).toMatchObject({ presentation: 'modal', animation: 'slide_from_bottom', title: 'Scan medicine' });
    mockReducedMotion = true;
    await act(async () => { root.render(<RootLayout />); });
    expect(root.container.queryAll((node) => node.type === 'NativeStack')[0]).toBe(stack);
    expect(stack.props.screenOptions.animation).toBe('none');
    expect(root.container.queryAll((node) => node.type === 'RouteOptions' && node.props.name === 'scan-medicine')[0].props.options.animation).toBe('none');
    expect(mockStackMounted).toHaveBeenCalledTimes(1);
    expect(mockStackUnmounted).not.toHaveBeenCalled();
  } finally { await act(async () => { root.unmount(); }); }
});

test('Home and Cart retain their own headers and tabs switch without stack animations', async () => {
  const root = createRoot();
  try {
    await act(async () => { root.render(<AppTabs />); });
    const tabs = root.container.queryAll((node) => node.type === 'Tabs')[0];
    expect(tabs.props.screenOptions).toMatchObject({ headerShown: false, animation: 'none' });
    expect(root.container.queryAll((node) => node.type === 'RouteOptions').map((node) => node.props.name)).toEqual(['index', 'cart']);
  } finally { await act(async () => { root.unmount(); }); }
});
