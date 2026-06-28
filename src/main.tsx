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
  if (msg.includes('Failed to fetch dynamically imported module')
      || msg.includes('Importing a module script failed')) {
    window.location.reload();
  }
});
