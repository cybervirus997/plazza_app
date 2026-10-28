import { Text, View } from 'react-native';
import type { OrderTracking } from '../../domain/tracking';
import { ui } from '../../theme/tokens';
import { trackingLabels } from './presentation';
export function TrackingTimeline({ tracking }: { tracking: OrderTracking }) {
  return <View style={ui.card}><Text style={ui.heading}>Simulated event history</Text>
    {tracking.events.map((event, index) => <View key={event.id}>
      <Text style={ui.body}>{index + 1}. {trackingLabels[event.stage]}{index === tracking.events.length - 1 ? ' · Current' : ''}</Text>
      <Text style={ui.small}>{new Date(event.at).toLocaleString()}</Text>
    </View>)}
  </View>;
}
