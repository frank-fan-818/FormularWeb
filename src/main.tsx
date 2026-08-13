import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/i18n';
import App from '@/App';
import { initWebVitals } from '@/utils/performance';
import './index.css';
import { logger } from '@/utils/logger';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

initWebVitals();

window.requestIdleCallback(() => {
  void import('@/hooks/useGlobalSearch')
    .then(({ preloadGlobalSearchIndex }) => preloadGlobalSearchIndex())
    .catch(() => { /* Search remains lazy and retryable from the input. */ });
}, { timeout: 2_000 });

let loadedShellBuildId: string | null = null;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'GET_CLIENT_BUILD_ID') {
      event.ports[0]?.postMessage({ buildId: loadedShellBuildId });
    }
  });

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .then(async (registration) => {
        const initialWorker = navigator.serviceWorker.controller || registration.active;
        if (!loadedShellBuildId && initialWorker) {
          loadedShellBuildId = await requestWorkerBuildId(initialWorker);
        }
        registration.active?.postMessage({ type: 'PRUNE_UNUSED_SHELL_CACHES' });
      })
      .catch(() => {
        // Offline startup and browsers with disabled storage still use the network shell.
      });
  });
}

const recoveryKey = 'f1-chunk-recovery-attempted';
let recoveryInFlight = false;

function waitForWorkerToBecomeInstalled(worker: ServiceWorker) {
  if (worker.state === 'installed') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 4_000);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' || worker.state === 'redundant') {
        window.clearTimeout(timeout);
        resolve();
      }
    });
  });
}

function waitForWorkerToActivate(worker: ServiceWorker) {
  if (worker.state === 'activated') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 4_000);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        window.clearTimeout(timeout);
        resolve();
      }
    });
  });
}

function requestWorkerBuildId(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), 1_000);

    channel.port1.onmessage = (event: MessageEvent<{ buildId?: unknown }>) => {
      window.clearTimeout(timeout);
      resolve(typeof event.data?.buildId === 'string' ? event.data.buildId : null);
    };
    worker.postMessage({ type: 'GET_BUILD_ID' }, [channel.port2]);
  });
}

function requestSafeShellCachePrune(worker: ServiceWorker): void {
  worker.postMessage({ type: 'PRUNE_UNUSED_SHELL_CACHES' });
}

async function hasActiveControllerMismatch(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  const activeWorker = registration.active;
  const controllingWorker = navigator.serviceWorker.controller;
  if (!activeWorker) return false;

  if (!loadedShellBuildId) {
    const initialWorker = controllingWorker || activeWorker;
    loadedShellBuildId = await requestWorkerBuildId(initialWorker);
  }

  const activeBuildId = await requestWorkerBuildId(activeWorker);
  if (loadedShellBuildId && activeBuildId && loadedShellBuildId !== activeBuildId) {
    return true;
  }
  if (!controllingWorker) return true;
  if (activeWorker === controllingWorker) {
    requestSafeShellCachePrune(activeWorker);
    return false;
  }

  const controllingBuildId = await requestWorkerBuildId(controllingWorker);
  if (activeBuildId && controllingBuildId) {
    if (activeBuildId === controllingBuildId) {
      requestSafeShellCachePrune(activeWorker);
      return false;
    }
    return true;
  }

  // A pre-v0.12.3 controller cannot answer the build-ID handshake. Distinct
  // worker objects are therefore treated conservatively as a version change.
  return true;
}

async function shouldReloadForServiceWorkerUpdate(allowNetworkUpdate = true): Promise<boolean> {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) return false;
  if (await hasActiveControllerMismatch(registration)) return true;
  if (!allowNetworkUpdate) return false;

  await registration.update();

  if (!registration.waiting && registration.installing) {
    await waitForWorkerToBecomeInstalled(registration.installing);
  }

  const waitingWorker = registration.waiting;
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    await waitForWorkerToActivate(waitingWorker);
    return true;
  }

  return hasActiveControllerMismatch(registration);
}

function recoverFromStaleChunk(): boolean {
  if (recoveryInFlight) return false;
  const lastAttempt = Number(sessionStorage.getItem(recoveryKey) || 0);
  if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt <= 5 * 60 * 1000) return false;

  recoveryInFlight = true;
  sessionStorage.setItem(recoveryKey, String(Date.now()));
  void shouldReloadForServiceWorkerUpdate()
    .catch(() => {
      // A hard reload still bypasses the stale in-memory module graph when SW update fails.
    })
    .finally(() => window.location.reload());
  return true;
}

window.addEventListener('vite:preloadError', ((event: Event) => {
  if (recoverFromStaleChunk()) {
    event.preventDefault();
  }
}) as EventListener);

window.addEventListener('unhandledrejection', (event) => {
  const message = (event.reason as Error)?.message || '';
  const name = (event.reason as Error)?.name || '';
  if (message.includes('Failed to fetch dynamically imported module')
      || message.includes('Importing a module script failed')
      || message.includes('Loading chunk')
      || name === 'ChunkLoadError') {
    recoverFromStaleChunk();
    return;
  }
  logger.errorWithDiagnosticContext({
    event: 'exit', module: 'global', function: 'unhandledrejection',
    status: 'failed', error: message || 'Unhandled promise rejection',
    operation: 'unhandled_promise', outcome: 'failed', reasonCode: 'unknown',
  });
});

window.addEventListener('error', (event) => {
  logger.errorWithDiagnosticContext({
    event: 'exit', module: 'global', function: 'window.error',
    status: 'failed', error: event.message || 'Unhandled window error',
    operation: 'window_error', outcome: 'failed', reasonCode: 'unknown',
  });
});

let lastProactiveUpdateCheck = 0;
let proactiveUpdateInFlight = false;
async function refreshWhenReturningToTheApp() {
  if (document.visibilityState !== 'visible' || recoveryInFlight || proactiveUpdateInFlight) return;

  const allowNetworkUpdate = Date.now() - lastProactiveUpdateCheck >= 60_000;
  if (allowNetworkUpdate) {
    lastProactiveUpdateCheck = Date.now();
  }
  proactiveUpdateInFlight = true;
  try {
    // Controller/build mismatches are checked on every return. Only the
    // network update request is throttled.
    if (await shouldReloadForServiceWorkerUpdate(allowNetworkUpdate)) {
      window.location.reload();
    }
  } catch {
    // Normal navigation continues; chunk recovery remains the final fallback.
  } finally {
    proactiveUpdateInFlight = false;
  }
}

window.addEventListener('focus', () => void refreshWhenReturningToTheApp());
document.addEventListener('visibilitychange', () => void refreshWhenReturningToTheApp());
