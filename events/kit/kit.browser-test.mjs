// Needs Playwright and Chromium. Plain `node --test` runs it; the deploy build runs only the *.test.* files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

// Serves the repo root, as the events page is opened in development (/events/kit/index.html).
function serve() {
  const server = createServer((req, res) => {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const LONG = 'W'.repeat(80); // the most a field takes (maxlength), in a wide letter

// Why: printed cards must stay usable with long event text, or judges can lose the instructions they need in the room.
test('the judge card fills, switches layout, keeps its QR code, and fits the paper with the longest text', { timeout: 60000 }, async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ colorScheme: 'dark' });
    const outside = [];
    const errors = [];
    page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:' + server.address().port + '/')) outside.push(r.url()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/events/kit/index.html');
    await page.waitForSelector('#kit-card .kc-qr svg');
    const url = page.url();
    const qr = await page.innerHTML('#kit-card .kc-qr');

    // Empty fields hide their lines; the not-affiliated line is filled in.
    assert.equal(await page.isHidden('#kit-card .kc-event'), true);
    assert.equal(await page.isHidden('#kit-card .kc-help'), true);
    assert.equal(await page.textContent('#kit-card [data-kit="affiliation"]'), 'Tabula is not affiliated with the NSDA.');

    // Typed text shows as text, on every card, and changes nothing else.
    await page.fill('#kit-name', 'Spring <b>Invitational</b>');
    await page.fill('#kit-help', 'Tab room');
    assert.equal(await page.textContent('#kit-card .kc-event'), 'Spring <b>Invitational</b>');
    assert.equal(await page.textContent('#kit-card [data-kit="help"]'), 'Tab room');
    await page.check('input[value="two"]');
    assert.equal(await page.locator('.kit-card').count(), 2);
    assert.equal(await page.locator('.kit-card[aria-hidden="true"]').count(), 1, 'the copy is hidden from screen readers');
    assert.equal(await page.locator('[id="kit-card"]').count(), 1, 'no duplicate id');
    await page.fill('#kit-name', 'Fall Classic');
    assert.deepEqual(await page.locator('.kc-event').allTextContents(), ['Fall Classic', 'Fall Classic']);
    await page.check('input[value="one"]');
    await page.check('input[value="two"]');
    assert.equal(await page.locator('.kit-card').count(), 2, 'switching back and forth keeps two cards');
    assert.equal(await page.locator('.kit-card .kc-qr svg').count(), 2);
    assert.equal(await page.innerHTML('#kit-card .kc-qr'), qr, 'typing never changes the QR code');
    assert.equal(page.url(), url, 'typing never changes the URL');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0, 'nothing is saved');

    // Print: the longest text, both layouts, the printable width of Letter (7.5 in) and A4 (7.27 in) at 96 px per inch.
    await page.fill('#kit-name', LONG);
    await page.fill('#kit-help', LONG);
    await page.emulateMedia({ media: 'print' });
    for (const [paper, w, h] of [['Letter', 7.5, 10], ['A4', 7.27, 10.69]]) {
      await page.setViewportSize({ width: Math.floor(w * 96), height: 1200 });
      for (const two of [false, true]) {
        await page.emulateMedia({ media: 'screen' });
        await page.check(two ? 'input[value="two"]' : 'input[value="one"]');
        await page.emulateMedia({ media: 'print' });
        const geo = await page.evaluate(() => {
          const r = (el) => el.getBoundingClientRect();
          const cards = [...document.querySelectorAll('.kit-card')];
          return {
            bg: getComputedStyle(document.body).backgroundColor,
            top: r(cards[0]).top,
            bottom: r(cards[cards.length - 1]).bottom,
            right: Math.max(...cards.map((c) => r(c).right)),
            spill: cards.map((c) => [...c.querySelectorAll('.kc-foot p, .kc-steps, .kc-code')].map((el) => r(el).bottom - r(c).bottom)).flat(),
          };
        });
        const where = paper + (two ? ' two cards' : ' one card');
        assert.equal(geo.bg, 'rgb(255, 255, 255)', where + ': the page prints white in the dark theme');
        assert.ok(geo.right <= w * 96 + 1, where + ': the card fits the width');
        assert.ok(geo.bottom - geo.top <= h * 96, where + ': the cards fit one page (' + Math.round(geo.bottom - geo.top) + ' px)');
        assert.ok(geo.spill.every((d) => d <= 0), where + ': the required lines and steps stay inside the card (' + geo.spill.map(Math.round) + ')');
      }
    }
    assert.deepEqual(outside, [], 'no request leaves this site');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
