import { Stack } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { backTo } from '../../navigation/commerceNavigation';
import { headerContentEdges, headerOptions } from '../../navigation/headerOptions';
import { ui } from '../../theme/tokens';
import { DeviceLocation, PermissionPanel } from './PermissionPanel';

export default function AppPermissionsScreen() {
  return <SafeAreaView edges={headerContentEdges} style={ui.screen}>
    <Stack.Screen options={headerOptions('App permissions', 'Back from app permissions', () => backTo('/'))} />
    <ScrollView contentContainerStyle={ui.content}>
      <Text style={ui.label}>PERMISSIONS & DIAGNOSTICS</Text>
      <Text style={ui.body}>Optional device tools, separate from your delivery destination. Only use Enable access or Settings when you want to change access.</Text>
      <PermissionPanel />
      <DeviceLocation />
    </ScrollView>
  </SafeAreaView>;
}
