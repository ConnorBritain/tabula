// Tabula Speech Events: turns on the service worker (events/sw.js, step E2) so the page opens with the network off.
// The worker sits in events/, so its scope is events/ only: it never controls the debate app.
// updateViaCache 'none': the browser checks sw.js and sw-files.js past the HTTP cache, so a new release is found on
// the next visit with a connection.

/** Register the events worker. Returns a promise of the registration, or null where the browser has no workers. */
export function registerOffline(nav = globalThis.navigator) {
  if (!nav || !nav.serviceWorker) return Promise.resolve(null);
  return nav.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname, updateViaCache: 'none' })
    .catch((err) => { console.warn('Speech Events: offline mode is not on.', err); return null; });
}
