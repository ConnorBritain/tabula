// Real compiled-host coverage: a redirected index page must still open and run its clock with no connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from '../build-events.mjs';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// The deployed host serves /index.html with a redirect to /. A direct-file server cannot expose this regression.
function serve(root) {
  return createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/index.html') { res.writeHead(307, { location: '/' }); res.end(); return; }
    if (path === '/') path = '/index.html';
    const file = join(root, path);
    if (!file.startsWith(root + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
}

// Why: a judge who loses the network must be able to reopen the saved room and use its clock, including the new timer cues.
test('Events opens its redirected cached page offline with saved timer settings and a working clock', { timeout: 120000 }, async () => {
  const temp = mkdtempSync(join(tmpdir(), 'events-offline-'));
  const out = build(join(temp, 'events'));
  const server = serve(out);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { chromium } = createRequire(import.meta.url)('playwright');
  let browser;
  let context;
  try {
    browser = await chromium.launch();
    context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('#main').waitFor();
    await page.evaluate(async () => {
      const { createRoom } = await import('/js/room.js');
      let id = 0;
      const room = createRoom({ now: Date.now(), makeId: (prefix) => prefix + (++id),
        event: { id: 'custom', version: 1, name: 'Offline test', short: 'Custom', category: 'custom', performers: 1,
          timing: { limit: 300, inRoomPrep: false, sharedClock: false }, checks: [], prompts: [], tags: [] },
        profile: { id: 'offline-test', version: 1, overtime: { grace: 30 } }, entries: [{ code: 'A12' }] });
      localStorage.setItem('tabulaEvents.rooms.v1', JSON.stringify([room]));
      localStorage.setItem('tabulaEvents.settings.v1', JSON.stringify({ timerBig: true }));
      location.hash = '#/room/' + room.id;
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.locator('#timer-card').waitFor();
    const cached = await page.evaluate(async () => {
      const name = (await caches.keys()).find((key) => key.startsWith('tabula-events-'));
      const cache = await caches.open(name);
      const page = await cache.match(new URL('/index.html', location.href));
      return { redirected: page.redirected, paths: (await cache.keys()).map((req) => new URL(req.url).pathname) };
    });
    assert.equal(cached.redirected, true, 'the host redirect really reached the release cache');
    for (const path of ['/js/timer-cue.js', '/js/timer-cue-view.js', '/js/timer-cue.css']) assert.ok(cached.paths.includes(path), path + ' is available offline');
    await context.setOffline(true);
    await page.reload();
    await page.locator('#timer-card').waitFor();
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    assert.equal(await page.locator('#timer-box').evaluate((el) => el.classList.contains('cue-big')), true);
    await page.locator('[data-tact="startstop"]').first().click();
    await page.waitForFunction(() => document.querySelector('#timer-digits')?.textContent !== '5:00');
    assert.equal(await page.locator('[data-tact="startstop"]').first().textContent(), 'Stop');
    await page.locator('[data-tact="startstop"]').first().click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1'))[0].entries[0].timing);
    assert.equal(saved.run, null);
    assert.ok(saved.usedMs > 0, 'the offline clock result is saved on this device');
    await assert.rejects(() => page.evaluate(() => fetch('/api/v1/health')));
    assert.deepEqual(errors, []);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    rmSync(temp, { recursive: true, force: true });
  }
});

// Why: destructive controls must work through real browser events, retain current settings, and remain safe with no network.
test('Events lifetime controls preview, cancel, restore, recover and Undo synthetic data online and offline', { timeout: 120000 }, async () => {
  const temp = mkdtempSync(join(tmpdir(), 'events-lifetime-'));
  const out = build(join(temp, 'events'));
  const server = serve(out);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { chromium } = createRequire(import.meta.url)('playwright');
  let browser, context;
  try {
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/#/settings`);
    await page.locator('#set-auto-h').waitFor();
    await page.evaluate(async () => {
      const { createRoom } = await import('/js/room.js');
      const old = Date.now() - 40 * 86400000;
      let id = 0;
      const make = (state) => createRoom({ now: old, makeId: (prefix) => prefix + (++id),
        event: { id: 'custom', version: 1, name: 'Synthetic lifetime', short: 'Custom', category: 'custom', performers: 1,
          timing: { limit: 300, inRoomPrep: false, sharedClock: false }, checks: [], prompts: [], tags: [] },
        profile: { id: 'synthetic', version: 1, overtime: { grace: 30 } }, entries: [{ code: 'A12' }] });
      const done = make(); done.id = 'old-done'; done.state = 'done';
      const open = make(); open.id = 'still-open'; open.state = 'judging';
      localStorage.setItem('tabulaEvents.rooms.v1', JSON.stringify([done, open]));
      localStorage.setItem('tabulaEvents.cards.v1', JSON.stringify([{ id: 'done-card', roundId: done.id, createdAt: old, submittedAt: old }, { id: 'open-card', roundId: open.id, createdAt: old, submittedAt: old }]));
      localStorage.setItem('tabulaEvents.settings.v1', JSON.stringify({ timerBig: true, aiPreferences: { defaults: { mode: 'custom', style: 'Original style' } } }));
      localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":7}');
      localStorage.setItem('policyJudge.synthetic-foreign', 'untouched');
    });
    await page.reload();
    await page.locator('#set-putback').waitFor();
    const roomIds = () => page.evaluate(() => JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).map((room) => room.id).sort());
    const saved = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tabulaEvents.'))));
    assert.deepEqual(await roomIds(), ['still-open']);
    while (await page.getByRole('button', { name: 'Dismiss message', exact: true }).count()) await page.getByRole('button', { name: 'Dismiss message', exact: true }).first().click();
    await page.locator('#set-putback').click();
    assert.deepEqual(await roomIds(), ['old-done', 'still-open']);
    assert.equal(await page.locator('#set-big').isChecked(), true);
    await page.locator('#event-ai-preferences summary').click();
    await page.locator('#event-ai-preferences [data-pref="mode"]').selectOption('custom');
    await page.locator('#event-ai-preferences [data-pref="style"]').fill('Browser preference');
    await page.locator('input[name="set-auto"][value="0"]').check();
    while (await page.getByRole('button', { name: 'Dismiss message', exact: true }).count()) await page.getByRole('button', { name: 'Dismiss message', exact: true }).first().click();
    const evidence = process.env.TABULA_LIFETIME_EVIDENCE;
    if (evidence) mkdirSync(evidence, { recursive: true });
    for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
      await page.emulateMedia({ colorScheme: theme });
      const bounds = await page.locator('[aria-labelledby="set-data-h"]').evaluate((el) => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        labels: [...el.querySelectorAll('.set-auto-options .radio')].map((label) => label.getBoundingClientRect().height),
      }));
      assert.equal(bounds.overflow, false, width + '/' + theme + ': no horizontal page overflow');
      if (width <= 820) assert.ok(bounds.labels.every((height) => height >= 44), 'delete-choice targets are at least44px on phones');
      if (evidence) await page.locator('[aria-labelledby="set-data-h"]').screenshot({ path: join(evidence, `${width}-${theme}-data.jpg`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    const before = await saved();
    const incoming = await page.evaluate(async () => {
      const { makeBackup } = await import('/js/settings.js');
      const room = JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1'))[0]; room.id = 'from-backup';
      return JSON.stringify(makeBackup({ 'tabulaEvents.rooms.v1': JSON.stringify([room]),
        'tabulaEvents.settings.v1': JSON.stringify({ timerBig: false }), 'tabulaEvents.lifetime.v1': '{"days":90}' }, { now: new Date().toISOString(), release: 'abc1234 synthetic' }));
    });
    const pick = async (text) => {
      await page.locator('#set-restore').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
      await page.getByRole('heading', { name: 'This backup holds', exact: true }).waitFor();
    };
    const confirm = async () => { await page.locator('#set-check-restore').click(); await page.locator('#ask').getByRole('button', { name: 'Replace my data', exact: true }).click(); };
    const installStorageFaults = () => page.evaluate(() => {
      const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
      window.syntheticBlock = true;
      window.syntheticBlockRemove = false;
      Storage.prototype.setItem = function (key, value) { if (window.syntheticBlock && key === 'tabulaEvents.settings.v1') throw new DOMException('Synthetic blocked setting', 'QuotaExceededError'); return set.call(this, key, value); };
      Storage.prototype.removeItem = function (key) { if (window.syntheticBlockRemove && key.startsWith('tabulaEvents.')) throw new DOMException('Synthetic blocked removal', 'QuotaExceededError'); return remove.call(this, key); };
    });
    await pick(incoming);
    assert.deepEqual(await saved(), before, 'checking does not write storage');
    await page.locator('#set-check-restore').click();
    await page.locator('#ask').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await saved(), before, 'cancel does not write storage');
    await confirm();
    assert.deepEqual(await roomIds(), ['from-backup']);
    assert.equal(await page.locator('input[name="set-auto"][value="0"]').isChecked(), true);
    assert.equal(await page.locator('#set-big').isChecked(), false);
    await page.getByRole('button', { name: 'Undo: restore backup', exact: true }).click();
    assert.deepEqual(await saved(), before);
    assert.equal(await page.locator('#event-ai-preferences [data-pref="style"]').inputValue(), 'Browser preference');
    // An older toast can fail while a new confirmation is waiting above the same page.
    await pick(incoming); await confirm();
    assert.equal(await page.getByRole('button', { name: 'Undo: restore backup', exact: true }).count(), 1, 'a repeated successful Restore still offers Undo');
    await pick(incoming);
    await page.locator('#set-check-restore').click();
    await installStorageFaults();
    await page.getByRole('button', { name: 'Undo: restore backup', exact: true }).click();
    await page.locator('#set-recovery').waitFor();
    const waitingPartial = await saved();
    await page.evaluate(() => { window.syntheticBlock = false; });
    await page.locator('#ask').getByRole('button', { name: 'Replace my data', exact: true }).click();
    assert.deepEqual(await saved(), waitingPartial, 'confirming a waiting Restore makes no write after recovery starts');
    assert.equal(await page.locator('#set-recovery').isVisible(), true);
    if (evidence) await page.locator('#set-recovery').screenshot({ path: join(evidence, '390-waiting-restore-recovery.jpg') });
    await page.locator('#set-recover').click();
    assert.deepEqual(await saved(), before, 'the original data survives the waiting confirmation');
    await page.locator('#set-wrap').click();
    await page.locator('#ask').getByRole('button', { name: 'Skip the backup', exact: true }).click();
    await page.locator('#ask').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await saved(), before);
    await pick(incoming);
    await page.evaluate(() => { window.syntheticBlock = true; window.syntheticBlockRemove = false; });
    await confirm();
    await page.locator('#set-recovery').waitFor();
    if (evidence) await page.locator('#set-recovery').screenshot({ path: join(evidence, '390-recovery.jpg') });
    const partial = await saved();
    assert.ok(Object.keys(partial).length < Object.keys(before).length, 'the failed rollback left a partial live store');
    await page.evaluate(() => { window.syntheticBlockRemove = true; });
    for (const action of ['#set-clear', '#set-wrap']) {
      assert.equal(await page.locator(action).count(), 0, action + ' is absent while data is quarantined');
      assert.equal(await page.locator('#ask').isVisible(), false, action + ' is blocked before a destructive dialog opens');
      assert.deepEqual(await saved(), partial, action + ' keeps the partial store unchanged');
    }
    while (await page.getByRole('button', { name: 'Dismiss message', exact: true }).count()) await page.getByRole('button', { name: 'Dismiss message', exact: true }).first().click();
    assert.equal(await page.locator('#set-recovery').isVisible(), true, 'dismissing all messages does not dismiss recovery');
    await page.locator('#set-recover').click();
    await page.locator('#set-recover').click();
    assert.equal(await page.locator('#set-recovery').isVisible(), true, 'repeated failed recovery keeps the original copy available');
    await page.evaluate(() => { window.syntheticBlock = false; window.syntheticBlockRemove = false; });
    await page.locator('#set-recover').click();
    assert.deepEqual(await saved(), before);
    assert.equal(await page.locator('#set-big').isChecked(), true);
    assert.equal(await page.locator('#event-ai-preferences [data-pref="style"]').inputValue(), 'Browser preference');
    assert.equal(await page.locator('#set-recovery').count(), 0);
    for (let clear = 0; clear < 2; clear++) {
      await page.locator('#set-clear').click();
      await page.locator('#ask').getByRole('button', { name: 'Clear this device', exact: true }).click();
      assert.deepEqual(await saved(), {}, 'Clear removes only this app data');
      assert.equal(await page.getByRole('button', { name: 'Undo: clear this device', exact: true }).count(), 1, 'every successful Clear offers a fresh Undo');
      await page.getByRole('button', { name: 'Undo: clear this device', exact: true }).click();
      assert.deepEqual(await saved(), before, 'repeated Clear and Undo preserve all original values');
    }
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    await page.reload();
    await page.locator('#set-auto-h').waitFor();
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    await page.locator('input[name="set-auto"][value="30"]').check();
    await page.reload();
    await page.locator('#set-putback').waitFor();
    assert.deepEqual(await roomIds(), ['still-open']);
    while (await page.getByRole('button', { name: 'Dismiss message', exact: true }).count()) await page.getByRole('button', { name: 'Dismiss message', exact: true }).first().click();
    await page.locator('#set-putback').click();
    assert.deepEqual(await roomIds(), ['old-done', 'still-open']);
    const offlineBefore = await saved();
    await pick(incoming); await confirm();
    assert.deepEqual(await roomIds(), ['from-backup']);
    assert.equal(await page.locator('input[name="set-auto"][value="30"]').isChecked(), true);
    await page.getByRole('button', { name: 'Undo: restore backup', exact: true }).click();
    assert.deepEqual(await saved(), offlineBefore);
    assert.equal(await page.evaluate(() => localStorage.getItem('policyJudge.synthetic-foreign')), 'untouched');
    await assert.rejects(() => page.evaluate(() => fetch('/api/v1/health')));
    assert.deepEqual(errors, []);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    rmSync(temp, { recursive: true, force: true });
  }
});
