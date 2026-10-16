import { clearFastF1AnalyticsCache } from '@/api/fastf1AnalyticsCache';

export function clearPrivateData(): void {
  clearFastF1AnalyticsCache();
  // Older releases persisted predictions alongside public data. Clear that
  // legacy store rather than retaining unenumerated private cache keys.
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('f1-data-cache') || key?.startsWith('CapacitorStorage.f1-data-cache')) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* Storage can be unavailable in privacy mode. */ }
  try {
    const request = indexedDB.open('f1-data-cache', 1);
    // Cleanup must not create a database without the adapter's snapshots store.
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('snapshots')) { db.close(); return; }
      const transaction = db.transaction('snapshots', 'readwrite');
      transaction.objectStore('snapshots').clear();
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => db.close();
    };
    request.onerror = () => undefined;
  } catch { /* IndexedDB is optional. */ }
  if (typeof caches !== 'undefined') {
    void caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('f1-data-')).map((name) => caches.delete(name)))).catch(() => undefined);
  }
  // The Preferences web adapter uses localStorage (already purged above).
  // Only native bridges need the plugin, avoiding its web-adapter waterfall.
  const runtime = globalThis as typeof globalThis & {
    Capacitor?: { isNativePlatform?: () => boolean };
    androidBridge?: unknown;
    webkit?: { messageHandlers?: { bridge?: unknown } };
  };
  if (!runtime.Capacitor?.isNativePlatform?.() && !runtime.androidBridge && !runtime.webkit?.messageHandlers?.bridge) return;
  void import('@capacitor/preferences').then(async ({ Preferences }) => {
    const { keys } = await Preferences.keys();
    await Promise.all(keys.filter((key) => key.startsWith('f1-data-cache')).map((key) => Preferences.remove({ key })));
  }).catch(() => undefined);
}
