// Tests for the Speech Events service worker (docs/events/LANDING.md §4.1, step E2). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pageFiles, forWorker, releaseHash, swFilesSource, jsRefs, OUT } from './build-sw.mjs';
import { registerOffline } from './js/offline.js';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// Why: if sw-files.js is older than the files, the offline page misses a new file, or browsers keep the old release
// beside new code (the E1 failure: an old core/sheets.js beside a new events file stopped the page).
test('events/sw-files.js is up to date with the files the page loads (if not: run node events/build-sw.mjs; after a merge, run it again, never hand-merge sw-files.js)', async () => {
  assert.equal(read('events/sw-files.js'), await swFilesSource());
});

// The loaded modules that may call fetch(), and why the cache still covers them. A new fetch() must either read a file
// the build adds to the list (extend build-sw.mjs), or go to /api/ or another host (never cached); then add it here.
const FETCHERS = { 'events/js/app.js': 'readJson: reads only the files loadEventData asks for, which the build lists' };

// Why: the crawl can only follow static imports and the event loader; a dynamic import() or an unlisted fetch() would
// load a file the cache does not hold, and that screen would fail with the network off.
test('every file the page loads is found by the crawl: no import(), and fetch() only where the list covers it', async () => {
  const files = await pageFiles();
  for (const want of ['events/index.html', 'events/js/app.js', 'events/js/offline.js', 'core/sheets.js', 'core/ui.css', 'assets/theme-boot.js', 'events/published.json', 'events/defs/oo.v1.json', 'events/profiles/custom.v1.json']) {
    assert.ok(files.includes(want), want + ' is cached');
  }
  const pub = JSON.parse(read('events/published.json'));
  for (const f of pub.defs) assert.ok(files.includes('events/defs/' + f), f);
  for (const f of pub.profiles) assert.ok(files.includes('events/profiles/' + f), f);
  for (const f of files.filter((p) => p.endsWith('.js'))) {
    const src = read(f);
    assert.doesNotMatch(src, /\bimport\s*\(/, f + ' uses import(); the cache list cannot follow it');
    if (/\bfetch\s*\(/.test(src)) assert.ok(FETCHERS[f], f + ' calls fetch(); make sure the cache covers it, then add it to FETCHERS in events/sw.test.mjs');
  }
});

// Why: if the crawl skipped an import form it cannot read, that module would be missing offline with no warning.
test('the crawl reads each import form and stops on one it cannot read', () => {
  const src = "import a, { b } from './a.js';\nimport {\n  c,\n  d,\n} from '../core/c.js';\nimport './side.js';\nexport { e } from './e.js';\nconst x = import.meta.url;";
  assert.deepEqual(jsRefs(src, 't.js'), ['./a.js', '../core/c.js', './side.js', './e.js']);
  assert.throws(() => jsRefs("import a from `./a.js`;", 't.js'), /cannot read/);
});

// Why: the cache must hold only this app's own files; a debate file, a test or a prototype in it would ship to judges'
// devices, and an /api/ answer in it would serve one user's account data from the cache.
test('the cache list holds only core/, events/ and the needed assets/ files, and each one exists', async () => {
  const files = await pageFiles();
  for (const p of files) {
    assert.ok(/^(core|events)\//.test(p) || p === 'assets/theme-boot.js' || /^assets\/fonts\/[^/]+\.woff2$/.test(p), p + ' is outside core/, events/ and the needed assets/');
    assert.doesNotMatch(p, /\.test\.|^events\/(prototype|fixtures|sw\.js|sw-files\.js|build-sw)|(^|\/)api\//, p + ' must not be cached');
    assert.ok(existsSync(new URL(p, ROOT)), p + ' exists');
  }
  assert.equal(forWorker('events/js/app.js'), 'js/app.js');
  assert.equal(forWorker('core/ui.js'), '../core/ui.js');
});

// Why: the release name is how a browser learns that any file changed; if one changed byte kept the same name, judges
// would keep the old file forever.
test('the release name changes when any cached byte changes', () => {
  const paths = ['core/sheets.js', 'events/js/rooms.js'];
  const bytes = { 'core/sheets.js': 'a', 'events/js/rooms.js': 'b' };
  const base = releaseHash(paths, (p) => bytes[p]);
  assert.match(base, /^[0-9a-f]{16}$/);
  assert.equal(releaseHash(paths, (p) => bytes[p]), base, 'the same files give the same name');
  assert.notEqual(releaseHash(paths, (p) => (p === 'core/sheets.js' ? 'a ' : bytes[p])), base);
  assert.notEqual(releaseHash(['core/sheets.js', 'events/js/other.js'], (p) => bytes[p] || 'b'), base, 'a renamed file changes the name');
});

// A small browser for the worker: one origin, a cache store, and recorded network calls.
function runWorker() {
  const origin = 'https://events.example';
  const listeners = {};
  const stores = new Map([['tabula-events-old', new Map()], ['tabula-debate-v1', new Map()]]);
  const net = [];
  let skipped = false;
  class Request {
    constructor(url, init = {}) { this.url = String(url); this.method = init.method || 'GET'; this.mode = init.mode || 'cors'; this.cache = init.cache || 'default'; }
  }
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return {
        async addAll(reqs) { for (const r of reqs) { net.push(r); m.set(r.url, 'body of ' + r.url); } },
        async match(key) { return m.get(key) ?? undefined; },
        async put() { throw new Error('the worker must never add to the cache at fetch time'); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    location: new URL(origin + '/events/sw.js'),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => { skipped = true; },
  };
  const ctx = vm.createContext({ self, caches, Request, URL, Set, Promise, fetch: async (r) => { net.push(r); return 'network ' + r.url; } });
  ctx.importScripts = (f) => { assert.equal(f, 'sw-files.js'); vm.runInContext(readFileSync(OUT, 'utf8'), ctx); };
  vm.runInContext(read('events/sw.js'), ctx);
  const fire = async (type, request) => {
    let until, answer;
    listeners[type]({ request, waitUntil: (p) => { until = p; }, respondWith: (p) => { answer = p; } });
    await until;
    return answer === undefined ? undefined : await answer;
  };
  return { fire, stores, net, Request, origin, skipped: () => skipped, release: ctx.self.TABULA_EVENTS_RELEASE };
}

// Why: offline use needs every file in one release cache, fetched past the HTTP cache (the E1 failure came from a
// stale HTTP-cached core file), and only older Speech Events releases may be dropped, never another app's cache.
test('install caches the whole release past the HTTP cache; activate drops only older tabula-events caches', async () => {
  const w = runWorker();
  await w.fire('install');
  const cache = w.stores.get('tabula-events-' + w.release);
  assert.ok(cache, 'the cache is named for the release');
  const files = await pageFiles();
  assert.equal(cache.size, files.length);
  assert.ok(cache.has(w.origin + '/core/sheets.js') && cache.has(w.origin + '/events/index.html'));
  assert.ok(w.net.every((r) => r.cache === 'reload'), 'every install fetch skips the HTTP cache');
  assert.ok(w.skipped(), 'the new release takes over at once');
  await w.fire('activate');
  assert.deepEqual([...w.stores.keys()].sort(), ['tabula-debate-v1', 'tabula-events-' + w.release]);
});

// Why: a judge's room must open from the cache with the network off, but account calls (/api/), other hosts and other
// files must reach the network untouched; a cached /api/ answer would show stale or another user's data.
test('fetch serves listed files and the page from the release cache, and leaves everything else alone', async () => {
  const w = runWorker();
  await w.fire('install');
  const get = (path, init) => w.fire('fetch', new w.Request(path.startsWith('http') ? path : w.origin + path, init));
  assert.equal(await get('/core/sheets.js'), 'body of ' + w.origin + '/core/sheets.js');
  assert.equal(await get('/events/js/app.js?x=1'), 'body of ' + w.origin + '/events/js/app.js');
  assert.equal(await get('/events/', { mode: 'navigate' }), 'body of ' + w.origin + '/events/index.html');
  assert.equal(await get('/events/index.html', { mode: 'navigate' }), 'body of ' + w.origin + '/events/index.html');
  w.net.length = 0;
  assert.equal(await get('/api/v1/me/capabilities?v=2&product=events'), undefined, '/api/ is never answered by the worker');
  assert.equal(await get('/api/v1/ai/events.cleanup', { method: 'POST' }), undefined);
  assert.equal(await get('/core/sheets.js', { method: 'POST' }), undefined);
  assert.equal(await get('https://api.anthropic.com/v1/messages'), undefined, 'another host is not answered');
  assert.equal(await get('/index.html', { mode: 'navigate' }), undefined, 'the debate page is not answered');
  assert.equal(await get('/events/prototype/index.html'), undefined, 'an unlisted file is not answered');
  assert.deepEqual(w.net, [], 'the worker made no network call of its own for those');
});

// Why: if the worker were registered at the site root it would control the debate app too, and could serve it stale
// events files or block its updates.
test('the page registers events/sw.js with the events/ scope, past the HTTP cache, and survives a browser with no workers', async () => {
  const calls = [];
  await registerOffline({ serviceWorker: { register: async (url, opts) => { calls.push([String(url), opts]); return 'reg'; } } });
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /\/events\/sw\.js$/);
  assert.match(calls[0][1].scope, /\/events\/$/);
  assert.equal(calls[0][1].updateViaCache, 'none');
  assert.equal(await registerOffline({}), null);
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await registerOffline({ serviceWorker: { register: async () => { throw new Error('blocked'); } } }), null); } finally { console.warn = warn; }
});
