/* global document, location, sessionStorage, localStorage */
(() => {
  const { pathname } = location;
  const home = pathname === '/';
  if (!home && pathname !== '/login') return;
  const { guestKey, modules } = document.currentScript.dataset;
  try {
    if (home && (sessionStorage.getItem(guestKey) === '1'
      || Object.keys(localStorage).some(key => /^sb-.+-auth-token$/.test(key)))) return;
  } catch { /* Storage is optional. */ }
  for (const href of modules.split(' ')) {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.crossOrigin = 'anonymous';
    link.href = href;
    document.head.append(link);
  }
})();
