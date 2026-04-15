import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';

interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: true,
    connectionType: 'unknown',
  });

  useEffect(() => {
    const checkNetwork = async () => {
      const state = await Network.getStatus();
      setStatus({
        connected: state.connected,
        connectionType: state.connectionType,
      });
    };

    checkNetwork();

    const listener = Network.addListener('networkStatusChange', (state) => {
      setStatus({
        connected: state.connected,
        connectionType: state.connectionType,
      });
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return status;
}
