// Offline open, end to end: build the app, serve it, load it once, cut the network, reload, and judge a round to a
// saved decision through the normal flow. Needs Playwright and Chromium. Plain `node --test` runs it (CI, before each
// merge); the deploy build runs only the *.test.* files, which need no browser (see wrangler.app.jsonc).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from './build-app.mjs';

const require = createRequire(import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

// Serves the build the way the production host does (Workers static assets, html_handling "auto-trailing-slash"):
// /index.html and /x.html answer 307 to / and /x, and / and /x serve the .html file. So a worker that stored a
// redirected response would fail this test, as it would in production.
function serve(root) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('.html')) {
      res.writeHead(307, { location: p.endsWith('/index.html') ? p.slice(0, -'index.html'.length) : p.slice(0, -'.html'.length) });
      return res.end();
    }
    if (p.endsWith('/')) p += 'index.html';
    else if (!extname(p) && existsSync(join(root, p + '.html'))) p += '.html';
    const f = join(root, p);
    if (!f.startsWith(root + sep) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Why: the app promises the clock, flow and ballot work with no internet; without this, a judge who opens it offline at a tournament gets a browser error page.
test('after one visit, the app opens offline and a round can be judged to a saved decision', { timeout: 120000 }, async () => {
  const out = build(join(mkdtempSync(join(tmpdir(), 'app-offline-')), 'app'));
  const { sha } = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8'));
  const server = await serve(out);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = 'http://127.0.0.1:' + server.address().port + '/';

    // 1. One online visit: the worker installs the whole release and becomes active.
    await page.goto(url);
    // Wait for the real condition: the worker is 'activated' (ready alone can resolve while it is still activating).
    const cache = await page.evaluate(async () => {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((ok) => setTimeout(ok, 20000))]);
      if (!reg) return ['no service worker became active'];
      const sw = reg.active;
      if (sw.state !== 'activated') await new Promise((ok) => sw.addEventListener('statechange', () => sw.state === 'activated' && ok()));
      return caches.keys();
    });
    assert.ok(cache.some((k) => k.startsWith('tabula-app-' + sha + '-')), 'the release cache is named after the sha: ' + cache);

    // 2. No network, then a cold reload.
    await ctx.setOffline(true);
    await page.reload();
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    assert.ok(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'the page is served by the worker');
    await page.getByRole('button', { name: 'Start judging' }).click();
    // A first visit always offers the tour 400 ms after "Start judging" (js/help.js). Wait for it and close it, so it
    // never appears later on top of a control the test is about to click.
    await page.locator('#tour-offer-no').click();

    // API calls are never cached: offline, they fail visibly instead of returning an old answer.
    assert.equal(await page.evaluate(() => fetch('/api/health').then(() => 'answered', () => 'failed')), 'failed');

    // 3. A round through the normal flow: start flowing, write on the flow, run the clock, move to the next speech.
    await page.click('#start-flow');
    const first = page.getByPlaceholder('Type here').first();
    await first.fill('1AC: inherency, plan, solvency');
    await page.uncheck('#rec-on'); // no microphone in the test: the clock runs without transcription
    await page.click('#t-start');
    await page.waitForFunction(() => document.querySelector('#clock').textContent.trim() !== '8:00'); // the clock runs
    await page.click('#t-start');
    await page.click('#t-next');

    // 4. Decide: winner, points, ranks, reason, then Save to History.
    await page.getByRole('button', { name: 'Decide', exact: true }).click();
    await page.getByRole('button', { name: 'Ballot', exact: true }).click();
    await page.check('input[name="winner"][value="aff"]');
    const speakers = ['1A', '2A', '1N', '2N'];
    for (const [i, s] of speakers.entries()) {
      await page.fill(`[data-bind="ballot.pts.${s}"]`, String(29 - i * 0.5));
      await page.check(`input[name="rank-${s}"][value="${i + 1}"]`);
    }
    await page.fill('#b-rfd', 'Aff wins on solvency; the neg never answered the plan.');
    await page.getByText('Ballot looks complete.').waitFor();
    await page.click('#b-save');
    await page.getByText('Saved to History', { exact: false }).first().waitFor();
    assert.equal(await page.evaluate(() => navigator.onLine), false, 'still offline at the end');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
