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

// ---------- "Ready for offline" (step S2, EXPERIENCE.md §9: Settings shows the check) ----------
// The worker keeps one release in one cache named 'tabula-events-' + its hash (events/sw.js).
export const CACHE_PREFIX = 'tabula-events-';

// The check, from what the browser says. Pure. s: { supported (the browser has workers and caches), controlled (a
// worker runs this page), cached (a tabula-events-* cache holds the page) }. Returns { ready, text }.
export function offlineState(s) {
  const o = s || {};
  if (!o.supported) return { ready: false, text: 'This browser cannot keep the app for offline use. Keep this tab open at the tournament.' };
  if (o.controlled && o.cached) return { ready: true, text: 'Ready for offline. The app opens with no internet on this device.' };
  if (o.cached) return { ready: false, text: 'Almost ready. Reload the page once while you have internet.' };
  return { ready: false, text: 'Not ready yet. Keep this page open for a minute while you have internet, then check again.' };
}

/** Ask the browser what the offline check needs. Resolves to offlineState's result. Page only (it reads the caches). */
export async function checkOffline(nav = globalThis.navigator, cacheStore = globalThis.caches) {
  if (!nav || !nav.serviceWorker || !cacheStore) return offlineState({ supported: false });
  let cached = false;
  try {
    const page = new URL('../index.html', import.meta.url).href;
    for (const name of await cacheStore.keys()) {
      if (!name.startsWith(CACHE_PREFIX)) continue;
      if (await (await cacheStore.open(name)).match(page)) { cached = true; break; }
    }
  } catch (err) { console.warn('Speech Events: the offline check could not read the cache.', err); }
  return offlineState({ supported: true, controlled: Boolean(nav.serviceWorker.controller), cached });
}
