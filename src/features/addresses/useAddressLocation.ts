import { useEffect, useRef, useState } from 'react';
import type { AddressDetails } from '../../domain/addresses';
import { usePermissions } from '../permissions/PermissionProvider';
import { fetchDeliveryLocation } from '../permissions/permissions';

type Coordinates = NonNullable<AddressDetails['coordinates']>;
export function useAddressLocation(apply: (coordinates: Coordinates) => void) {
  const permissions = usePermissions();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current += 1; };
  }, []);
  useEffect(() => {
    if (permissions.location !== 'granted' || permissions.checking) {
      revision.current += 1;
      running.current = false;
    }
  }, [permissions.location, permissions.checking]);

  function cancel() {
    revision.current += 1;
    running.current = false;
    setLoading(false);
    setMessage(null);
  }
  async function suggest() {
    if (!mounted.current || running.current) return;
    if (permissions.location !== 'granted' || permissions.checking || permissions.busy) {
      setMessage('Foreground location access must be granted and ready. You can enter every field manually.');
      return;
    }
    const id = ++revision.current;
    const isCurrent = () => mounted.current && id === revision.current;
    running.current = true;
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchDeliveryLocation(isCurrent);
      if (!isCurrent()) return;
      if (result.coordinates) {
        apply(result.coordinates);
        setMessage('Coordinates added. Complete and review the address, then Save. Nothing has been saved automatically.');
      } else {
        setMessage(result.locationMessage);
        if (result.location !== 'granted') permissions.refresh();
      }
    } catch {
      if (isCurrent()) setMessage('Your location could not be found. Try again or enter the address manually.');
    } finally {
      if (isCurrent()) { running.current = false; setLoading(false); }
      else if (mounted.current && !running.current) setLoading(false);
    }
  }
  return { loading: loading && permissions.location === 'granted' && !permissions.checking, message, cancel, suggest, permissions };
}
