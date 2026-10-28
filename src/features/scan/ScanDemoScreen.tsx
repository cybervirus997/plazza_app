import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { backTo } from '../../navigation/commerceNavigation';
import { headerContentEdges } from '../../navigation/headerOptions';
import { ui } from '../../theme/tokens';

// This synthetic fixture has no link to catalog, manufacturer or verification data.
const samplePack = [
  ['Pack', 'Sample Care tablets — fictional medicine'],
  ['Manufacturer', 'Example Demo Labs — fictional company'],
  ['Batch', 'DEMO-BATCH-001 — synthetic identifier'],
  ['Printed expiry', 'MM/YYYY — placeholder only'],
] as const;

export default function ScanDemoScreen() {
  const [showSample, setShowSample] = useState(false);
  return <SafeAreaView edges={headerContentEdges} style={ui.screen}>
    <Stack.Screen options={{ title: 'Scan medicine', headerBackVisible: false,
      headerLeft: () => <IconButton icon="close" label="Close medicine scan" onPress={() => backTo('/')} /> }} />
    <ScrollView contentContainerStyle={ui.content}>
      <Text style={ui.label}>MEDICINE PACK · DEMO</Text>
      <Text style={ui.body}>A medicine pack may show a name, manufacturer, batch and expiry. This demo shows how that information could be presented.</Text>
      <Text accessibilityRole="header" style={ui.heading}>Demo only — no authenticity verification</Text>
      <Text style={ui.body}>No camera is used. Nothing is scanned, checked against a manufacturer or certified as authentic. This sample cannot establish whether a medicine is safe or genuine.</Text>
      {showSample ? <View style={ui.card} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={ui.heading}>Synthetic sample result</Text>
        <Text style={ui.small}>Invented example data · no pack validation performed.</Text>
        {samplePack.map(([label, value]) => <View key={label}>
          <Text style={ui.small}>{label}</Text><Text selectable style={ui.body}>{value}</Text>
        </View>)}
        <Button label="Start again" variant="secondary" onPress={() => setShowSample(false)} />
      </View> : <Button label="Try sample scan" onPress={() => setShowSample(true)} />}
    </ScrollView>
  </SafeAreaView>;
}
