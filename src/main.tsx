import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from '@/App';
import { initWebVitals } from '@/utils/performance';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

initWebVitals();

// Auto-reload when old JS chunks 404 after Vercel deployment
window.addEventListener('unhandledrejection', (e) => {
  const msg = (e.reason as Error)?.message || '';
  const name = (e.reason as Error)?.name || '';
  if (msg.includes('Failed to fetch dynamically imported module')
      || msg.includes('Importing a module script failed')
      || msg.includes('Loading chunk')
      || name === 'ChunkLoadError') {
    const recoveryKey = 'f1-chunk-recovery-attempted';
    const lastAttempt = Number(sessionStorage.getItem(recoveryKey) || 0);
    if (!Number.isFinite(lastAttempt) || Date.now() - lastAttempt > 5 * 60 * 1000) {
      sessionStorage.setItem(recoveryKey, String(Date.now()));
      void navigator.serviceWorker?.getRegistration()
        .then((registration) => registration?.update())
        .catch(() => undefined)
        .finally(() => window.location.reload());
    }
  }
});
