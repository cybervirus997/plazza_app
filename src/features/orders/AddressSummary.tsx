import { Text, View } from 'react-native';
import { deliveryOptions, formatAddress, gateOptions, type DeliveryAddressSnapshot } from '../../domain/addresses';
import { ui } from '../../theme/tokens';

export function AddressSummary({ snapshot }: { snapshot: DeliveryAddressSnapshot }) {
  const address = snapshot.address;
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.heading}>{address.label}</Text>
    <Text style={ui.body}>{formatAddress(address)}</Text>
    {!!address.recipientName && <Text style={ui.body}>Recipient: {address.recipientName}{address.relationship ? ` · ${address.relationship}` : ''}</Text>}
    {!!address.recipientPhone && <Text style={ui.body}>{address.recipientPhone}</Text>}
    <Text style={ui.body}>{deliveryOptions.find((option) => option.id === address.deliveryOption)?.title}{address.callBeforeArrival ? ' · Call Before Arrival' : ''}</Text>
    <Text style={ui.small}>{gateOptions.find((option) => option.id === address.gateAccess)?.title}{address.societyApp ? ` · ${address.societyApp}` : ''} · instructions only, no gate-app integration</Text>
    {!!address.instructions && <Text style={ui.body}>{address.instructions}</Text>}
  </View>;
}
