import type { NativeStackNavigationOptions } from 'expo-router';
import { Text, View } from 'react-native';

// Render the native header's configured slots for screen-action tests only.
// This does not simulate native layout, animations, gestures or safe-area metrics.
export function MockStackScreen({ options }: { options: NativeStackNavigationOptions }) {
  return <View testID="native-stack-header">
    {options.headerLeft?.({ canGoBack: true })}
    <Text accessibilityRole="header">{options.title}</Text>
    {options.headerRight?.({ canGoBack: true })}
  </View>;
}
