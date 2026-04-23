import { useState, useEffect } from 'react';

interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

function resolveBrowserConnectionType(): string {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string };
  }).connection;

  return connection?.effectiveType || 'unknown';
}

function resolveConnectedState(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: resolveConnectedState(),
    connectionType: resolveBrowserConnectionType(),
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateStatus = () => {
      setStatus({
        connected: resolveConnectedState(),
        connectionType: resolveBrowserConnectionType(),
      });
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return status;
}
