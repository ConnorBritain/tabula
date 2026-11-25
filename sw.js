// Tabula Debate: the service worker. It lets the app open and judge a round with the network off.
// Its scope is the app's folder (the site root). The build (build-app.mjs) puts two lines above this
// comment in the shipped copy: self.TABULA_APP_RELEASE (the commit sha from version.json plus a hash of
// the listed files) and self.TABULA_APP_FILES (every file the app needs to open and judge a round).
// The unbuilt copy in the repo has neither, so it caches nothing and answers nothing.
//
// One release = one cache, named 'tabula-app-' + the release. A release is installed whole or not at all.
//   install:  fetch every listed file past the HTTP cache into the new cache. One failure fails the install,
//             and the old release stays in use. Only then does the new worker take over (skipWaiting).
//   activate: delete older tabula-app-* caches. Other caches on this host are not touched.
//   fetch:    a listed file comes from this release's cache. Everything else (the API, sign-in, the hosted AI,
//             other hosts, POST, files not listed) goes to the network as if no worker were here, so it fails
//             visibly offline. Nothing is ever added to the cache at fetch time.
//
// Strategy: stale-while-revalidate, applied to the whole release instead of file by file. Every page load is
// served at once from the release on this device (fast on weak tournament Wi-Fi, and it works with none), while
// the browser checks sw.js in the background. A new release installs completely beside the old one and is used
// from the next page load. Network-first would make every load wait on a slow network, and per-file
// revalidation could mix an old index.html with new scripts.
//
// The worker never reloads a page. A page that is open keeps running the code it loaded at boot. The app loads
// all its code at boot; the only files it loads later are vendor files with the version in their names, so
// they do not change between releases (app-sw.test.mjs checks this).

const PREFIX = 'tabula-app-';
const RELEASE = self.TABULA_APP_RELEASE;
const FILES = Array.isArray(self.TABULA_APP_FILES) ? self.TABULA_APP_FILES : null;
const CACHE = RELEASE && FILES ? PREFIX + RELEASE : null;
const SCOPE = new URL('./', self.location).href;
const PAGE = new URL('index.html', self.location).href;
const URLS = FILES ? FILES.map((p) => new URL(p, self.location).href) : [];
const LISTED = new Set(URLS);

// The cache key of a request, or null when the worker must leave the request alone.
function cachedUrl(request) {
  if (!CACHE || request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (url.pathname.startsWith('/api/')) return null;
  url.search = ''; url.hash = '';
  if (request.mode === 'navigate' && (url.href === SCOPE || url.href === PAGE)) return PAGE;
  // The host serves about.html at /about too, so a page load of /about gets the cached about.html.
  if (request.mode === 'navigate' && LISTED.has(url.href + '.html')) return url.href + '.html';
  return LISTED.has(url.href) ? url.href : null;
}

// A redirected response (a host that sends /index.html to /) cannot answer a page load, so keep only its body
// and headers.
async function plain(res) {
  if (!res.ok) throw new Error('could not fetch ' + res.url + ' (' + res.status + ')');
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (event) => {
  if (!CACHE) return;
  event.waitUntil((async () => {
    try {
      const got = await Promise.all(URLS.map((u) => fetch(new Request(u, { cache: 'reload' })).then(plain)));
      const cache = await caches.open(CACHE);
      await Promise.all(got.map((res, i) => cache.put(URLS[i], res)));
    } catch (err) {
      await caches.delete(CACHE); // never keep half a release (for example when storage is full)
      throw err;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  if (!CACHE) return;
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
    .map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (event) => {
  const key = cachedUrl(event.request);
  if (!key) return;
  // This release's cache only. If the file is missing (a cleared cache), use the network, but do not store it.
  event.respondWith(caches.open(CACHE)
    .then((cache) => cache.match(key))
    .then((hit) => hit || fetch(event.request)));
});
