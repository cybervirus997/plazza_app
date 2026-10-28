import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { FeaturePage } from '../../components/ui/FeaturePage';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { useOrderById } from '../orders/useOrders';
import { canTrackOrder, nextTrackingStages, trackingStage } from '../../domain/tracking';
import { openPayment } from '../../navigation/commerceNavigation';
import { ui } from '../../theme/tokens';
import { useOrderTracking } from './useOrderTracking';
import { demoETA, trackingLabels } from './presentation';
import { DemoRouteMap } from './DemoRouteMap';
import { TrackingTimeline } from './TrackingTimeline';
export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { orders, payment, state } = useShopping();
  const order = useOrderById(orders, typeof id === 'string' ? id : undefined);
  const eligible = !!order.data && canTrackOrder(order.data, payment.attempt, state.lastFinalizedCheckoutId);
  const tracking = useOrderTracking(order.data, eligible);
  return <FeaturePage title="Demo tracking" fallback="/orders">
    <Text style={ui.body}>Simulated delivery only. No pharmacy fulfillment, live rider or real delivery promise.</Text>
    {order.error ? <><Text accessibilityRole="alert">{order.error}</Text><Button label="Retry order" onPress={order.retry} /></>
      : order.status === 'loading' ? <Text>Loading saved order…</Text>
        : !order.data ? <Text>Order not found on this device.</Text> : !eligible ? <>
          <Text>Finish payment/checkout reconciliation before tracking this order.</Text><Button label="Open payment recovery" onPress={openPayment} />
        </> : null}
    {tracking.error && <><Text accessibilityRole="alert">{tracking.error}</Text><Button label="Reload tracking" onPress={tracking.retry} /></>}
    {tracking.data && <>
      <View accessibilityLiveRegion="polite" style={ui.card}><Text style={ui.heading}>{trackingLabels[trackingStage(tracking.data)]}</Text>
        {demoETA(tracking.data) && <Text style={ui.title}>{demoETA(tracking.data)}</Text>}
        <Text style={ui.body}>This is a simulated delivery estimate, not a live delivery promise.</Text>
        {tracking.data.requiresRx && <Text style={ui.body}>Rx review is required in real care. These demo controls never verify or approve a prescription.</Text>}
      </View>
      <DemoRouteMap /><TrackingTimeline tracking={tracking.data} />
      <Text style={ui.heading}>Explicit demo controls</Text>
      {nextTrackingStages(tracking.data).map((stage) => <Button key={stage} label={`Simulate: ${trackingLabels[stage]}`} variant="secondary"
        disabled={tracking.busy} onPress={() => { void tracking.advance(stage); }} />)}
    </>}
  </FeaturePage>;
}
