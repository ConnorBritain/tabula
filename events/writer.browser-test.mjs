// Real pages in one browser profile must share the native Events writer lock before using saved data, keys or clocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from '../build-events.mjs';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const saved = (page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tabulaEvents.'))));
function serve(root) {
  return createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname), file = join(root, path === '/' ? '/index.html' : path);
    if (!file.startsWith(root + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); createReadStream(file).pipe(res);
  });
}
async function observe(context, mode = 'native') {
  await context.addInitScript((mode) => {
    if (mode !== 'native') Object.defineProperty(navigator, 'locks', { configurable: true, value: mode === 'missing' ? undefined : { request: () => Promise.reject(new Error('Synthetic lock refusal')) } });
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    window.syntheticOwnershipReads = []; window.syntheticOwnershipWrites = [];
    window.syntheticWriterPageToken = String(Date.now()) + ':' + Math.random();
    window.syntheticWriterTransitions = [];
    addEventListener('pageshow', (event) => window.syntheticWriterTransitions.push({ type: 'pageshow', persisted: event.persisted }));
    addEventListener('pagehide', (event) => window.syntheticWriterTransitions.push({ type: 'pagehide', persisted: event.persisted }));
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('tabulaEvents.') || key.startsWith('tabulaEventsRecovery.')) {
        // The unchanged first-paint theme helper reads appearance only. It never saves or initializes the app.
        const appearance = key === 'tabulaEvents.settings.v1' && /assets\/theme-boot\.js/.test(new Error().stack || '');
        window.syntheticOwnershipReads.push({ key, appearance });
      }
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, raw) {
      if (key.startsWith('tabulaEvents.') || key.startsWith('tabulaEventsRecovery.')) window.syntheticOwnershipWrites.push({ key, op: 'set' });
      if (this === localStorage && window.syntheticOwnershipFault && key === 'tabulaEvents.settings.v1') throw new DOMException('Synthetic blocked ordinary Settings save', 'QuotaExceededError');
      return set.call(this, key, raw);
    };
    Storage.prototype.removeItem = function (key) {
      if (key.startsWith('tabulaEvents.') || key.startsWith('tabulaEventsRecovery.')) window.syntheticOwnershipWrites.push({ key, op: 'remove' });
      return remove.call(this, key);
    };
  }, mode);
}
async function seed(page) {
  await page.evaluate(async () => {
    const { createRoom } = await import('/js/room.js'); let id = 0; const old = Date.now() - 40 * 86400000;
    const room = createRoom({ now: old, makeId: (prefix) => prefix + (++id), event: { id: 'custom', version: 1, name: 'Synthetic owner room', short: 'Custom', category: 'custom', performers: 1,
      timing: { limit: 300, inRoomPrep: false, sharedClock: false }, checks: [], prompts: [], tags: [] }, profile: { id: 'synthetic-owner', version: 1, overtime: { grace: 30 } }, entries: [{ code: 'A12' }] });
    room.id = 'owner-old-room'; room.state = 'done';
    const open = structuredClone(room); open.id = 'owner-open-room'; open.state = 'judging';
    localStorage.setItem('tabulaEvents.rooms.v1', JSON.stringify([room, open]));
    localStorage.setItem('tabulaEvents.cards.v1', JSON.stringify([{ id: 'owner-card', roundId: room.id, createdAt: old, submittedAt: old }]));
    localStorage.setItem('tabulaEvents.settings.v1', '{"theme":"system","timerBig":true,"aiPreferences":{"defaults":{"mode":"custom","style":"Original ownership style"}}}');
    localStorage.setItem('tabulaEvents.aiKeys.v1', '{"anthropic":"synthetic-owner-remembered"}');
    sessionStorage.setItem('tabulaEvents.aiKeys.v1', '{"openai":"synthetic-owner-tab-only"}');
    localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":0}');
    localStorage.setItem('policyJudge.owner-foreign', 'untouched');
  });
  await page.reload(); await page.locator('#set-auto-h').waitFor();
}
async function denied(page) {
  return page.evaluate(async () => {
    const { createEventsStore, ROOMS_KEY, PREFIX } = await import('/js/store.js');
    const { createPageAI } = await import('/js/page-ai.js');
    const store = createEventsStore({ toast() {}, dismissToast() {} });
    let read = false, clear = false, ai = false;
    try { store.get(ROOMS_KEY, []); } catch (e) { read = e.code === 'writer_required'; }
    try { store.replaceAll(PREFIX, {}); } catch (e) { clear = e.code === 'writer_required'; }
    try { createPageAI(store); } catch (e) { ai = e.code === 'writer_required'; }
    return { read, clear, ai, save: store.set(ROOMS_KEY, [{ id: 'must-not-save' }]), recovery: store.journal.recover().ok, writer: store.writer.isHeld() };
  });
}
async function assertWaiting(page) {
  await page.locator('#events-waiting').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-ready'), 'false');
  assert.equal(await page.locator('header').evaluate((el) => el.inert), true);
  for (const control of ['#set-clear', '#set-auto-h', '#set-recover', '#set-ai-connect', '#timer-card']) assert.equal(await page.locator(control).count(), 0);
  assert.deepEqual(await denied(page), { read: true, clear: true, ai: true, save: false, recovery: false, writer: false });
  assert.deepEqual(await page.evaluate(() => window.syntheticOwnershipWrites), []);
  assert.deepEqual(await page.evaluate(() => window.syntheticOwnershipReads.filter((read) => !read.appearance)), []);
}

// Why: an ordinary second page must never recover an active writer's journal, save inside its Clear, or start AI or clocks.
test('same-context pages enforce one writable Events page through Clear, failure recovery, owner closure/crash, reload and offline saves', { timeout: 180000 }, async () => {
  const temp = mkdtempSync(join(tmpdir(), 'events-one-writer-')), out = build(join(temp, 'events')), server = serve(out);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { chromium } = createRequire(import.meta.url)('playwright');
  let browser;
  const contexts = [], evidence = process.env.TABULA_WRITER_EVIDENCE, observations = [], errors = [], providers = [];
  try {
    browser = await chromium.launch();
    const url = `http://127.0.0.1:${server.address().port}/#/settings`;
    const fresh = async (mode = 'native') => {
      const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(c); await observe(c, mode);
      c.on('page', (p) => { p.on('pageerror', (error) => errors.push(error.message)); p.on('request', (req) => { if (/api\.(openai|anthropic|x\.ai)|generativelanguage|openrouter/.test(req.url())) providers.push(req.url()); }); });
      return c;
    };
    {
      const c = await fresh(), a = await c.newPage(); await a.goto(url); await a.locator('#set-auto-h').waitFor(); await seed(a);
      const original = await saved(a), b = await c.newPage(); await b.goto(url); await assertWaiting(b);
      for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
        await b.setViewportSize({ width, height: 844 }); await b.emulateMedia({ colorScheme: theme });
        const geometry = await b.locator('#events-writer-retry').evaluate((el) => ({ height: el.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth }));
        assert.equal(geometry.overflow, false); if (width <= 820) assert.ok(geometry.height >= 44);
      }
      await b.locator('#events-waiting-h').focus(); await b.keyboard.press('Tab'); assert.equal(await b.locator('#events-writer-retry').evaluate((el) => el === document.activeElement), true);
      await b.keyboard.press('Enter'); await assertWaiting(b);
      await a.locator('#set-clear').click(); await a.locator('#ask').getByRole('button', { name: 'Clear this device', exact: true }).click();
      assert.deepEqual(await saved(a), {}); await b.locator('#events-writer-retry').click(); await assertWaiting(b);
      await a.getByRole('button', { name: 'Undo: clear this device', exact: true }).click(); await a.locator('#set-auto-h').waitFor();
      assert.deepEqual(await saved(a), original);
      await b.locator('#events-writer-retry').click(); await assertWaiting(b);
      if (evidence) { mkdirSync(evidence, { recursive: true }); await b.screenshot({ path: join(evidence, 'second-page-waiting.jpg'), fullPage: true }); }
      await a.close();
      await b.locator('#events-writer-retry').click(); await b.locator('#set-auto-h').waitFor();
      assert.deepEqual(await saved(b), original);
      await b.locator('#set-big').uncheck(); assert.equal(JSON.parse((await saved(b))['tabulaEvents.settings.v1']).timerBig, false, 'ordinary checkbox save is enabled only after native ownership');
      await b.evaluate(() => navigator.serviceWorker.ready); await b.reload(); await b.locator('#set-auto-h').waitFor();
      await b.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await c.setOffline(true); await b.reload(); await b.locator('#set-auto-h').waitFor();
      assert.equal(await b.evaluate(() => navigator.onLine), false);
      await b.locator('#set-big').check(); assert.equal(JSON.parse((await saved(b))['tabulaEvents.settings.v1']).timerBig, true);
      observations.push({ scenario: 'second page waits through primary Clear/Undo; explicit retry after close; ordinary, reload and offline saves', pass: true });
      await c.close();
    }
    for (const ending of ['close', 'crash']) {
      const c = await fresh(), a = await c.newPage(); await a.goto(url); await a.locator('#set-auto-h').waitFor(); await seed(a);
      await a.evaluate(() => localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":7}'));
      const original = await saved(a), b = await c.newPage(); await b.goto(url); await assertWaiting(b);
      const file = await a.evaluate(async () => {
        const { makeBackup } = await import('/js/settings.js');
        const room = JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1'))[0]; room.id = 'must-not-replace-original';
        return JSON.stringify(makeBackup({ 'tabulaEvents.rooms.v1': JSON.stringify([room]), 'tabulaEvents.settings.v1': '{"timerBig":false}' }));
      });
      await a.locator('#set-restore').setInputFiles({ name: 'synthetic-owner.json', mimeType: 'application/json', buffer: Buffer.from(file) });
      await a.getByRole('heading', { name: 'This backup holds', exact: true }).waitFor();
      await a.evaluate(() => { window.syntheticOwnershipFault = true; });
      await a.locator('#set-check-restore').click(); await a.locator('#ask').getByRole('button', { name: 'Replace my data', exact: true }).click();
      await a.locator('#set-recovery').waitFor();
      const partial = await saved(a); assert.notDeepEqual(partial, original);
      const journal = await a.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('tabulaEventsRecovery.journal.')).map(([, raw]) => JSON.parse(raw)));
      assert.equal(journal.length, 1); assert.deepEqual(journal[0].before, original);
      await b.locator('#events-writer-retry').click(); await assertWaiting(b);
      assert.deepEqual(await saved(a), partial, 'waiting page cannot recover or change the active writer recovery');
      if (ending === 'close') await a.close();
      else {
        const crashed = a.waitForEvent('crash');
        const navigation = a.goto('chrome://crash').catch((error) => error);
        await crashed; await navigation;
      }
      await b.locator('#events-writer-retry').click(); await b.locator('#set-auto-h').waitFor();
      assert.deepEqual(await saved(b), original, 'new owner recovers exact originals before eligible old rounds can auto-delete');
      assert.equal(await b.locator('#set-big').isChecked(), true);
      assert.equal(await b.locator('#event-ai-preferences [data-pref="style"]').inputValue(), 'Original ownership style');
      assert.equal(await b.evaluate(() => sessionStorage.getItem('tabulaEvents.aiKeys.v1')), null);
      assert.equal(await b.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))).includes('synthetic-owner-tab-only')), false);
      assert.equal(await b.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('tabulaEventsRecovery.journal.'))), false);
      observations.push({ scenario: 'partial Restore and failed rollback cannot be stolen; owner ' + ending + ' releases; explicit retry recovers before boot', pass: true });
      await c.close();
    }
    {
      const c = await fresh(), a = await c.newPage(); await a.goto(url); await a.locator('#set-auto-h').waitFor(); await seed(a);
      const token = await a.evaluate(async () => {
        const { createEventsStore } = await import('/js/store.js');
        window.syntheticStaleStore = createEventsStore({ toast() {}, dismissToast() {} });
        return window.syntheticWriterPageToken;
      });
      // An actual old confirmation is cancelled before the waiting view can accept Retry.
      await a.locator('#set-clear').click();
      await a.locator('#ask').getByRole('heading', { name: 'Clear this device?', exact: true }).waitFor();
      // Exercise the preserved-JavaScript pagehide/pageshow path even on Chromium builds that do not retain this document in BFCache.
      await a.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      await a.locator('#events-waiting').waitFor();
      assert.equal(await a.locator('#ask').isVisible(), false, 'the old Clear confirmation cannot survive loss of ownership');
      assert.equal(await a.locator('#main').evaluate((el) => el.inert), false, 'Retry remains usable after cancelling the old dialog');
      const b = await c.newPage(); await b.goto(url); await b.locator('#set-auto-h').waitFor();
      const before = await saved(b);
      assert.equal(await a.evaluate(() => window.syntheticStaleStore.set('tabulaEvents.rooms.v1', [{ id: 'stale-page-write' }])), false);
      await a.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await a.locator('#events-writer-retry').click(); await a.locator('#events-waiting').waitFor();
      assert.deepEqual(await saved(b), before);
      await b.locator('#set-big').uncheck();
      const latest = await saved(b); await b.close();
      await a.locator('#events-writer-retry').click();
      await a.waitForFunction((old) => window.syntheticWriterPageToken !== old && document.documentElement.dataset.ready === 'true', token);
      await a.locator('#set-auto-h').waitFor();
      assert.deepEqual(await saved(a), latest, 'stale page reacquisition reloads and revalidates the new owner saved state');
      assert.equal(await a.locator('#set-big').isChecked(), false);
      observations.push({ scenario: 'preserved-JavaScript pagehide/pageshow revokes stale callbacks; Retry reacquires then forces a fresh document', pass: true, lifecycle: 'explicit persisted PageTransitionEvents' });

      // Also exercise real navigation away and browser Back. Record rather than assume BFCache retention.
      const navigationToken = await a.evaluate(() => window.syntheticWriterPageToken);
      await a.goto(url.split('/#/')[0] + '/writer-away');
      const next = await c.newPage(); await next.goto(url); await next.locator('#set-auto-h').waitFor();
      await next.locator('#set-big').check(); const newer = await saved(next);
      await a.goBack(); await a.locator('#events-waiting').waitFor();
      assert.deepEqual(await denied(a), { read: true, clear: true, ai: true, save: false, recovery: false, writer: false });
      const retained = await a.evaluate((old) => window.syntheticWriterPageToken === old, navigationToken);
      await next.close(); await a.locator('#events-writer-retry').click(); await a.locator('#set-auto-h').waitFor();
      assert.deepEqual(await saved(a), newer);
      observations.push({ scenario: 'real navigation and browser Back respect the current owner and reload/revalidate before use', pass: true, retainedDocument: retained });
      await c.close();
    }
    for (const mode of ['missing', 'rejected']) {
      const c = await fresh(mode), p = await c.newPage(); await p.goto(url); await assertWaiting(p);
      await p.getByRole('heading', { name: 'Events cannot open safely right now', exact: true }).waitFor();
      await p.locator('#events-writer-retry').click(); await assertWaiting(p);
      observations.push({ scenario: mode + ' native locks fail closed with Retry and no data/key/provider/clock work', pass: true });
      await c.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(providers, []);
    if (evidence) writeFileSync(join(evidence, 'RESULT.json'), JSON.stringify({ pass: true, observations, pageErrors: errors.length, providerRequests: providers.length, beforeLeaseException: 'existing appearance-only theme helper', ownerDataUsed: false }, null, 2) + '\n');
  } finally {
    for (const context of contexts) await context.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve)); rmSync(temp, { recursive: true, force: true });
  }
});
