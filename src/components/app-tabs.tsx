import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useShopping } from '../state/AppStateProvider';
import { colors } from '../theme/tokens';

export default function AppTabs() {
  const { itemCount } = useShopping();

  return (
    <Tabs screenOptions={{
      headerShown: false,
      animation: 'none',
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarHideOnKeyboard: true,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      tabBarItemStyle: { paddingVertical: 6 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.white },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) =>
        <SymbolView name={{ ios: 'house', android: 'home', web: 'home' }} tintColor={color} size={24} /> }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarBadge: itemCount || undefined,
        tabBarAccessibilityLabel: `Cart, ${itemCount} items`, tabBarIcon: ({ color }) =>
          <SymbolView name={{ ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' }} tintColor={color} size={24} /> }} />
    </Tabs>
  );
}
