// The app's service worker (sw.js) and web app manifest: what the build caches, the cache name, and what the worker
// answers. The browser run is in offline-open.test.mjs. Run with: node --test
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { ALLOW, build, listFiles, releaseName, shellFiles } from './build-app.mjs';

const SHA_A = '1111111111111111111111111111111111111111', SHA_B = '2222222222222222222222222222222222222222';
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let out, files, swSrc, sha;
before(() => {
  out = build(join(mkdtempSync(join(tmpdir(), 'app-sw-')), 'app'));
  sha = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8')).sha; // 40 hex, "<sha>-dirty" or "unknown"
  files = new Set(shellFiles(out));
  swSrc = readFileSync(join(out, 'sw.js'), 'utf8');
});
const read = (f) => readFileSync(join(out, f), 'utf8');
const local = (r) => r && !/^[a-z][a-z0-9+.-]*:|^\/\/|^#|^\?/i.test(r);
const norm = (ref, from) => { const u = new URL(ref, 'http://x/' + from); return u.pathname.slice(1); };

// Every file the page loads at open, found the way the browser finds them: index.html src/href, CSS url() and
// @import, and each static import of a JS module.
function pageLoads() {
  const seen = new Set(); const todo = ['index.html'];
  while (todo.length) {
    const f = todo.pop(); if (seen.has(f)) continue; seen.add(f);
    if (!existsSync(join(out, f))) continue;
    const src = /\.(html|css|m?js)$/.test(f) ? read(f) : '';
    let refs = [];
    if (f.endsWith('.html')) refs = [...src.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);
    else if (f.endsWith('.css')) refs = [...src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/gi)].map((m) => m[2] || m[4]);
    else if (/\.m?js$/.test(f)) refs = [...src.matchAll(/^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)].map((m) => m[1] || m[2]);
    for (const r of refs) if (local(r)) todo.push(norm(r, f));
  }
  return [...seen];
}

// Why: a file the page loads but the worker did not cache makes the offline open break (a blank or half-styled page).
test('the cached file list covers every file index.html loads', () => {
  const loads = pageLoads();
  assert.ok(loads.length > 60, 'the crawl found the page files (' + loads.length + ')');
  assert.deepEqual(loads.filter((f) => !files.has(f)), []);
  assert.ok(files.has('manifest.webmanifest') && files.has('index.html'));
});

// Why: the worker swaps releases without reloading an open page, so a file the page loads later must not change between releases, or an open page would mix old and new code.
test('the page loads nothing later except version-named vendor files', () => {
  const late = [];
  for (const f of listFiles(out).filter((x) => /^(app\.js|js\/|logic\/|core\/|assets\/).*\.m?js$/.test(x) || /^[a-z]+\.js$/.test(x))) {
    for (const m of read(f).matchAll(/\bimport\(\s*['"`]([^'"`]+)|\.src\s*=\s*['"`]([^'"`]+)/g)) {
      const r = m[1] || m[2];
      // Paths are read from the page (index.html), as the app writes them; the check is about the file name.
      if (local(r)) late.push(norm(r, 'index.html'));
    }
  }
  assert.ok(late.length > 0, 'found the late loads');
  for (const r of late) assert.match(r, /^vendor\/[a-z-]+-\d+\.\d+\.\d+[.\w]*\.m?js$/, r + ' is loaded after boot but has no version in its name');
});

// Why: each deploy needs a new cache name, or browsers keep serving the old release forever.
test('the cache release name contains the build sha and changes with the files', () => {
  const ctx = {}; vm.runInNewContext(swSrc.split('\n').slice(0, 2).join('\n').replace(/self\./g, 'this.'), ctx);
  assert.match(ctx.TABULA_APP_RELEASE, new RegExp('^' + esc(sha) + '-[0-9a-f]{12}$'), 'named from version.json');
  assert.deepEqual([...ctx.TABULA_APP_FILES].sort(), [...files].sort());
  const list = [...files];
  assert.match(releaseName(out, list, SHA_A), new RegExp('^' + SHA_A + '-[0-9a-f]{12}$'));
  assert.notEqual(releaseName(out, list, SHA_A), releaseName(out, list, SHA_B), 'a new commit gives a new cache');
});

// Why: a build with no git says "unknown"; it must still get a cache, and a changed file must still get a new one, or judges keep an old app.
test('an "unknown" sha still gives a release name, and new files give a new one', () => {
  const list = [...files];
  const name = releaseName(out, list, 'unknown');
  assert.match(name, /^unknown-[0-9a-f]{12}$/);
  assert.notEqual(releaseName(out, list.slice(1), 'unknown'), name, 'a different file set gives a different name');
});

// Why: caching the AI SDK, the Library or host files would waste judges' storage; caching sw.js itself would freeze updates.
test('host files, the Library and AI-only libraries are not cached', () => {
  for (const f of files) assert.doesNotMatch(f, /^(learn\/|sw\.js$|_headers$|version\.json$|vendor\/(mermaid|anthropic))|\.test\./, f);
});

// A fake worker scope that runs the shipped sw.js, with an in-memory cache.
function worker(src, netFetch = null, origin = 'https://debate.example') {
  const listeners = {}; const store = new Map(); let skipped = false; const net = [];
  const ctx = {
    self: null, URL, Request: class { constructor(u, o) { this.url = u; Object.assign(this, o); } },
    Response: class { constructor(b, o) { this.body = b; Object.assign(this, o); } },
    caches: {
      open: async (name) => { if (!store.has(name)) store.set(name, new Map()); const m = store.get(name); return { put: async (k, v) => m.set(k, v), match: async (k) => m.get(k) }; },
      keys: async () => [...store.keys()], delete: async (k) => store.delete(k),
    },
    fetch: netFetch || (async (req) => { net.push(req.url); return { ok: true, redirected: false, url: req.url, body: 'net:' + req.url }; }),
  };
  ctx.self = { location: new URL(origin + '/sw.js'), addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: async () => { skipped = true; } };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const fire = async (type, request) => {
    let until, answer;
    listeners[type]({ request, waitUntil: (p) => { until = p; }, respondWith: (p) => { answer = p; } });
    await until; return answer === undefined ? undefined : await answer;
  };
  return { fire, store, net, skipped: () => skipped, origin };
}

// Why: the API, sign-in and hosted AI must reach the network (and fail visibly offline); a cached answer would show stale or another user's data.
test('the worker answers listed files from its cache and leaves the API and other hosts alone', async () => {
  const w = worker(swSrc);
  w.store.set('tabula-app-old', new Map());
  await w.fire('install');
  assert.ok(w.skipped(), 'takes over only after the whole release is stored');
  await w.fire('activate');
  const names = [...w.store.keys()];
  assert.equal(names.length, 1); assert.match(names[0], new RegExp('^tabula-app-' + esc(sha) + '-'));
  const get = (path, o = {}) => w.fire('fetch', { url: new URL(path, w.origin).href, method: 'GET', mode: 'cors', ...o }).then((r) => r && r.body);
  assert.equal(await get('/', { mode: 'navigate' }), 'net:' + w.origin + '/index.html', 'the page comes from the cache');
  assert.equal(await get('/?demo=policy', { mode: 'navigate' }), 'net:' + w.origin + '/index.html');
  assert.equal(await get('/about', { mode: 'navigate' }), 'net:' + w.origin + '/about.html', 'the host serves about.html at /about');
  assert.equal(await get('/about'), undefined, 'only a page load uses the /about form');
  assert.equal(await get('/js/flow.js'), 'net:' + w.origin + '/js/flow.js');
  const before = w.net.length;
  await get('/js/flow.js');
  assert.equal(w.net.length, before, 'a cached file does not touch the network');
  assert.equal(await get('/api/health'), undefined);
  assert.equal(await get('/api/v1/me'), undefined);
  assert.equal(await get('https://api.anthropic.com/v1/messages'), undefined);
  assert.equal(await get('/js/flow.js', { method: 'POST' }), undefined);
  assert.equal(await get('/learn/index.html', { mode: 'navigate' }), undefined);
  assert.equal(await get('/vendor/anthropic-sdk-0.137.0.bundle.mjs'), undefined);
});

// Why: hosts often redirect /index.html to /; a stored redirected response cannot answer a page load, so offline open would fail.
test('a redirected file is stored as a plain response', async () => {
  const w2 = worker(swSrc, async (r) => ({ ok: true, redirected: true, url: r.url, status: 200, statusText: 'OK', headers: {}, blob: async () => 'bytes' }));
  await w2.fire('install');
  const cache = [...w2.store.values()][0];
  const page = cache.get('https://debate.example/index.html');
  assert.equal(page.redirected, undefined, 'not marked as redirected');
  assert.equal(page.body, 'bytes');
});

// Why: the repo copy has no file list; if it cached or answered anything, a dev server would serve stale files.
test('the unbuilt sw.js caches nothing and answers nothing', async () => {
  const w = worker(readFileSync(new URL('./sw.js', import.meta.url), 'utf8'));
  await w.fire('install');
  assert.equal(w.store.size, 0);
  assert.equal(await w.fire('fetch', { url: w.origin + '/', method: 'GET', mode: 'navigate' }), undefined);
});

// Why: an error from a browser without service workers would break the page for that judge.
test('index.html links the manifest and registers the worker only where supported', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<script src="assets\/sw-register\.js"><\/script>/);
  const reg = read('assets/sw-register.js');
  for (const nav of [{}, { serviceWorker: { register: () => Promise.reject(new Error('no')) } }]) {
    const calls = [];
    const ctx = { navigator: nav, location: { protocol: 'https:' }, addEventListener: (t, f) => { calls.push(t); f(); } };
    assert.doesNotThrow(() => vm.runInNewContext(reg, ctx));
    assert.equal(calls.length, 'serviceWorker' in nav ? 1 : 0);
  }
});

// Why: a manifest icon that does not exist, or the wrong start page, makes the installed app open broken.
test('the manifest names icons that exist, opens the app standalone and uses the app ink colour', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone'); assert.equal(m.start_url, './'); assert.ok(m.name);
  assert.ok(m.icons.length > 0);
  for (const i of m.icons) assert.ok(existsSync(join(out, i.src)), i.src);
  assert.match(read('core/tokens.css'), new RegExp('--accent: ' + m.theme_color + ';'));
  assert.match(read('index.html'), new RegExp('<meta name="theme-color" content="' + m.theme_color + '">'));
});

// Why: if the host cached sw.js, browsers would not see a new release, and judges would keep an old app.
test('sw.js is served with no-cache', () => {
  assert.match(read('_headers'), /\/sw\.js\n\s+Cache-Control: no-cache/);
});
