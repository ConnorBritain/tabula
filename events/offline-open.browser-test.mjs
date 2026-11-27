// Real compiled-host coverage: a redirected index page must still open and run its clock with no connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
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
