// Tabula Speech Events: the service worker (docs/events/LANDING.md §4.1, step E2). It lets the page open with the
// network off. Its scope is events/ only (the folder it sits in), so it never controls the debate app.
//
// One release = one cache, named 'tabula-events-' + a content hash of every file the page loads (events/sw-files.js,
// made by node events/build-sw.mjs). A release is installed whole or not at all, and the page is served from one
// release only. So a browser never runs an old core/ file beside a new events/ file.
//   install:  fetch every file past the HTTP cache into the new release's cache. One failure fails the install, and
//             the old release stays in use. A first install starts at once; an update then waits (see 'message').
//   message:  { type: 'start-update' } from the page: the waiting release takes over (events/js/update-gate.js).
//   activate: delete every older tabula-events-* cache. Other caches on this host are not touched.
//   fetch:    a listed file comes from the release cache. Everything else (other files, /api/, other hosts, POST)
//             goes to the network as if no worker were here, and nothing is ever added to the cache.
// Rule for the page: load every module at boot (static imports, no import()), so a page that is already open never
// needs a file from a release that has since replaced its own.
importScripts('sw-files.js');

const PREFIX = 'tabula-events-';
const CACHE = PREFIX + self.TABULA_EVENTS_RELEASE;
const SCOPE = new URL('./', self.location).href;
const URLS = self.TABULA_EVENTS_FILES.map((p) => new URL(p, self.location).href);
const LISTED = new Set(URLS);
const PAGE = new URL('index.html', self.location).href;

// The cache key of a request, or null when the worker must leave the request alone.
function cachedUrl(request) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (url.pathname.startsWith('/api/')) return null;
  url.search = ''; url.hash = '';
  // The page itself, at events/ or events/index.html.
  if (request.mode === 'navigate' && (url.href === SCOPE || url.href === PAGE)) return PAGE;
  return LISTED.has(url.href) ? url.href : null;
}

// A new release does not take over by itself. It waits until the page asks with { type: 'start-update' }, and the page
// asks only when the judge presses Reload while no round is open and no clock runs (events/js/update-gate.js). The
// first install has no release to replace, so it starts at once.
self.addEventListener('install', (event) => {
  const firstInstall = !(self.registration && self.registration.active);
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(URLS.map((u) => new Request(u, { cache: 'reload' }))))
    // An older release that started while this one installed deletes every other cache, this one too. Then fail the
    // install, so the browser tries again later, and never start with an empty cache.
    .then(() => caches.keys())
    .then((keys) => { if (!keys.includes(CACHE)) throw new Error('the release cache was deleted during install'); })
    .then(() => (firstInstall ? self.skipWaiting() : undefined)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'start-update') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
    .map((k) => caches.delete(k)))));
});

// Static hosts redirect index.html to /. A redirected cached response cannot answer a navigation request.
// Copy its body and headers into a plain response. This also repairs pages held by an older release cache.
async function navigationResponse(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('fetch', (event) => {
  const key = cachedUrl(event.request);
  if (!key) return;
  // Read this release's cache only. If the file is missing (a cleared cache), use the network, but do not store it.
  event.respondWith(caches.open(CACHE)
    .then((cache) => cache.match(key))
    .then((hit) => hit || fetch(event.request))
    .then((response) => event.request.mode === 'navigate' ? navigationResponse(response) : response));
});
