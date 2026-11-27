// Offline open, end to end: build the app, serve it, load it once, cut the network, reload, and judge a round to a
// saved decision through the normal flow. Needs Playwright and Chromium. Plain `node --test` runs it (CI, before each
// merge); the deploy build runs only the *.test.* files, which need no browser (see wrangler.app.jsonc).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
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

// A phone judge must be able to save an entry through the offline flow and return to the clock without losing it.
test('a phone can switch to the item flow and reopen a saved occurrence offline', { timeout: 120000 }, async () => {
  const out = build(join(mkdtempSync(join(tmpdir(), 'app-offline-')), 'app'));
  const server = await serve(out);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('policyJudge.settings.v1')) {
        localStorage.setItem('policyJudge.settings.v1', JSON.stringify({ setupDone: true, tourOffered: true, d2NoteShown: true }));
      }
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    await page.goto(url);
    const cacheInstalled = await page.evaluate(async () => {
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((done) => setTimeout(done, 20000))]);
      const worker = registration?.active;
      if (!worker) return false;
      if (worker.state !== 'activated') await new Promise((done) => worker.addEventListener('statechange', done, { once: true }));
      return worker.state === 'activated' && (await caches.keys()).some((key) => key.startsWith('tabula-app-'));
    });
    assert.ok(cacheInstalled);
    // This worker does not take over a page that was already open when it activated.
    const controlled = await page.goto(url + '?resume=1');
    assert.ok(controlled.fromServiceWorker());
    await ctx.setOffline(true);
    await page.reload();
    assert.ok(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
    assert.equal(await page.locator('#clock-view').isVisible(), false, 'Speech focus is the default phone view');
    await page.getByRole('button', { name: 'Just start flowing' }).tap();
    const title = page.getByRole('textbox', { name: 'New analytic', exact: true });
    await title.fill('Aff solvency');
    await title.press('Enter');
    await title.press('Escape');
    await page.getByRole('button', { name: 'Edit Aff solvency' }).waitFor();
    await page.getByRole('button', { name: 'Clocks', exact: true }).tap();
    await page.locator('#cv-start').waitFor();
    await page.reload();
    assert.equal(await page.locator('#clock-view').isVisible(), false, 'Speech focus is the default phone view');
    await page.getByRole('button', { name: 'Edit Aff solvency' }).waitFor();
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

// Why: a judge must keep speech columns, sheet actions, and both prep clocks distinct while flowing at any desktop width.
test('the flow ribbon keeps actions scoped and speech boundaries visible in both themes', { timeout: 120000 }, async () => {
  const scratch = existsSync('/Volumes/cre-scratch') ? '/Volumes/cre-scratch' : tmpdir();
  const temp = mkdtempSync(join(scratch, 'flow-layout-'));
  const server = await serve(build(join(temp, 'app')));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1067, height: 805 }, colorScheme: theme });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port + '/?theme=' + theme);
      await page.getByRole('button', { name: 'Start judging', exact: true }).click();
      await page.locator('#tour-offer-no').click();
      await page.locator('#start-flow').click();
      await page.locator('[data-item-action="cancel-editor"]').click();
      if (process.env.FLOW_LAYOUT_CAPTURE_DIR) {
        for (const button of await page.getByRole('button', { name: 'Dismiss message', exact: true }).all()) await button.click();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: join(process.env.FLOW_LAYOUT_CAPTURE_DIR, 'after-' + theme + '.jpg'), type: 'jpeg', quality: 90 });
      }

      assert.equal(await page.locator('[data-item-assist]').isVisible(), false, 'AI settings must not compete with argument navigation');
      // Changed with the owner's object-menu design: rename now belongs to the sheet tab.
      await page.locator('#flow-tabs button[data-i="0"]').click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Rename sheet', exact: true }).click();
      await page.getByLabel('Sheet name', { exact: true }).fill('Case notes');
      await page.locator('#ask').getByRole('button', { name: 'Save', exact: true }).click();
      assert.equal(await page.locator('#flow-tabs button.on[data-i="0"]').textContent(), 'Case notes', 'renaming must retain the current sheet scope');
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Case notes', 'Save must return keyboard focus to the renamed sheet tab');
      await page.keyboard.press('Shift+F10');
      assert.equal(await page.getByRole('menu', { name: 'Case notes sheet actions', exact: true }).isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.flow-context-menu').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Case notes');
      await page.getByRole('button', { name: 'Add an argument group in Case notes', exact: true }).click();
      assert.equal(await page.getByRole('heading', { name: 'Add argument group in Case notes', exact: true }).isVisible(), true);
      await page.locator('#ask').getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.locator('[data-item-action="review"]').click();
      assert.equal(await page.getByRole('region', { name: 'Flow Check', exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('heading', { name: 'Flow Check', exact: true }).isVisible(), true);
      assert.equal(await page.getByText('Check spoken order, unconfirmed entries, and suggested matches after a speech. Apply or dismiss corrections below.', { exact: true }).isVisible(), true);
      await page.locator('[data-item-action="close-review"]').click();

      await page.getByText('Flow options', { exact: true }).click();
      await page.locator('.flow-options > summary').press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'flow-note-length', 'keyboard users must reach the first disclosed setting');
      await page.getByLabel('AI note length', { exact: true }).selectOption('detailed');
      assert.equal(await page.locator('[data-item-assist]').isVisible(), true, 'a display redraw must not close the settings being edited');
      await page.getByLabel('Match transcript to my notes', { exact: true }).selectOption('auto');
      assert.equal(await page.getByRole('button', { name: 'Documents', exact: true }).isVisible(), true, 'documents must have their own place outside display settings');
      assert.equal(await page.locator('.flow-options [data-act="map-docs"]').count(), 0);
      await page.locator('[data-item-assist]').press('Escape');
      assert.equal(await page.locator('.flow-options').getAttribute('open'), null);
      assert.equal(await page.evaluate(() => document.activeElement.matches('.flow-options > summary')), true);
      await page.reload();
      await page.getByText('Flow options', { exact: true }).click();
      assert.equal(await page.locator('[data-item-level]').inputValue(), 'detailed');
      assert.equal(await page.locator('[data-item-assist]').inputValue(), 'auto');
      await page.locator('.flow-options > summary').press('Escape');

      for (const width of [820, 1067, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.getByRole('button', { name: 'Speeches', exact: true }).isVisible(), true, `Speeches remains a navigation control at ${width}`);
        const geometry = await page.evaluate(() => {
          const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
          const guides = [...document.querySelectorAll('.item-column-guides > div')];
          const heads = [...document.querySelectorAll('.item-head')];
          return {
            preps: [...document.querySelectorAll('.rb-prep')].map(rect),
            main: rect(document.querySelector('.rb-main')),
            footer: rect(document.querySelector('.roundbar')),
            content: rect(document.querySelector('.item-flow-grid')),
            guides: guides.map((el, i) => ({ ...rect(el), edge: getComputedStyle(el).borderRightWidth, head: rect(heads[i]) })),
          };
        });
        assert.equal(geometry.guides.length, 7);
        for (const guide of geometry.guides.slice(0, -1)) {
          assert.ok(Math.abs(guide.right - guide.head.right) < 1, 'each divider must line up with its speech header');
          assert.ok(Math.abs(guide.bottom - geometry.content.bottom) < 1, 'speech dividers must reach the bottom of the unused flow');
          assert.equal(guide.edge, '1px');
        }
        const [aff, neg] = geometry.preps;
        assert.ok(Math.abs(aff.top - neg.top) < 1, `both prep clocks must stay on one row at ${width}`);
        assert.ok(aff.right < neg.left && neg.right <= geometry.footer.right, 'the prep pair must fit without wrapping');
        assert.ok(geometry.main.bottom < aff.top, 'prep must have its own row beneath the speech controls');
      }

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Flow tools', exact: true }).click();
      await page.getByText('Flow options', { exact: true }).click();
      const panel = await page.locator('.flow-options-body').boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= 390, 'flow options must fit the phone viewport');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'only the flow grid may scroll sideways');
      if (process.env.FLOW_LAYOUT_CAPTURE_DIR) await page.screenshot({ path: join(process.env.FLOW_LAYOUT_CAPTURE_DIR, 'phone-' + theme + '.jpg'), type: 'jpeg', quality: 90 });
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
    rmSync(temp, { recursive: true, force: true });
  }
});

// Why: slow script loads must not throw startup errors before a judge can open an offline round.
test('flow status waits for the workspace while the AI script is delayed', { timeout: 120000 }, async () => {
  const scratch = existsSync('/Volumes/cre-scratch') ? '/Volumes/cre-scratch' : tmpdir();
  const temp = mkdtempSync(join(scratch, 'flow-startup-'));
  const server = await serve(build(join(temp, 'app')));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  let release;
  const aiScript = new Promise((done) => { release = done; });
  try {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.route('**/js/ai.js', async (route) => { await aiScript; await route.continue(); });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const navigation = page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof FlowItems !== 'undefined');
    // Hold the later script past a status-timer tick, not just past its request.
    await page.waitForTimeout(1500);
    assert.deepEqual(errors, [], 'the pending AI script must not cause a status-timer exception');
    release();
    await navigation;
    await page.getByRole('button', { name: 'Start judging', exact: true }).waitFor();
    assert.deepEqual(errors, [], 'finishing startup must also remain error-free');
  } finally {
    release();
    await browser.close();
    server.close();
    rmSync(temp, { recursive: true, force: true });
  }
});

// Why: object menus must change the intended sheet/group, and imported evidence must enter the speech the judge selected.
test('object menus and the Documents panel preserve target, Undo, and speech assignment', { timeout: 120000 }, async () => {
  const scratch = existsSync('/Volumes/cre-scratch') ? '/Volumes/cre-scratch' : tmpdir();
  const temp = mkdtempSync(join(scratch, 'flow-context-'));
  const server = await serve(build(join(temp, 'app')));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1067, height: 805 }, colorScheme: 'dark', hasTouch: true });
    await ctx.route('**/api/speechdrop/**', (route) => route.request().url().includes('/file/')
      ? route.fulfill({ status: 200, contentType: 'text/plain', body: '## Extended link\nThe link still applies.' })
      : route.fulfill({ status: 200, json: { files: [{ i: 0, name: '2NC extension.txt' }] } }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/?theme=dark');
    await page.getByRole('button', { name: 'Start judging', exact: true }).click();
    await page.locator('#tour-offer-no').click();
    await page.locator('#start-flow').click();
    await page.locator('[data-item-action="cancel-editor"]').click();
    assert.equal(await page.locator('.item-group').count(), 0, 'a lone unnamed holding group must not add an unexplained heading');
    for (const name of ['Links', 'Impacts']) {
      await page.getByRole('button', { name: 'Add an argument group in Case', exact: true }).click();
      await page.getByLabel('Argument group name', { exact: true }).fill(name);
      await page.locator('#ask').getByRole('button', { name: 'Add group', exact: true }).click();
    }
    const links = page.locator('.item-group').filter({ hasText: 'Links' });
    await links.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Move group down', exact: true }).click();
    assert.deepEqual(await page.locator('.item-group strong').allTextContents(), ['Other notes', 'Impacts', 'Links']);
    await links.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Rename group', exact: true }).click();
    await page.getByLabel('Group name', { exact: true }).fill('Link answers');
    await page.locator('#ask').getByRole('button', { name: 'Save', exact: true }).click();
    assert.deepEqual(await page.locator('.item-group strong').allTextContents(), ['Other notes', 'Impacts', 'Link answers']);
    assert.equal(await page.getByText('General', { exact: true }).count(), 0);

    const deletedName = await page.locator('#flow-tabs button[data-i="1"]').textContent();
    await page.locator('#flow-tabs button[data-i="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete sheet', exact: true }).click();
    assert.equal(await page.locator('#flow-tabs button[data-i]').filter({ hasText: new RegExp('^' + deletedName + '$') }).count(), 0, 'right-click Delete must remove its target rather than the previously active Case sheet');
    assert.equal(await page.getByRole('button', { name: 'Case', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: /Undo: delete sheet/ }).click();
    assert.equal(await page.locator('#flow-tabs button[data-i="1"]').textContent(), deletedName);
    await page.locator('#flow-tabs button[data-i="0"]').click();

    await page.getByRole('button', { name: 'Documents', exact: true }).click();
    const documents = page.getByRole('region', { name: 'Documents', exact: true });
    await documents.getByLabel('For speech', { exact: true }).selectOption('1NC');
    await page.locator('#flow-tabs button[data-i="0"]').click({ button: 'right' });
    assert.equal(await page.getByRole('menu', { name: 'Case sheet actions', exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.flow-context-menu').count(), 0, 'Escape must close the object menu before an underlying panel');
    assert.equal(await documents.isVisible(), true, 'closing a context menu must preserve the open Documents panel');
    await page.getByText('Flow options', { exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.flow-options').getAttribute('open'), null);
    assert.equal(await documents.isVisible(), true, 'Escape must also close Flow options before Documents');
    assert.equal(await documents.getByRole('heading', { name: 'From SpeechDrop', exact: true }).isVisible(), true);
    if (process.env.FLOW_LAYOUT_CAPTURE_DIR) await page.screenshot({ path: join(process.env.FLOW_LAYOUT_CAPTURE_DIR, 'documents.jpg'), type: 'jpeg', quality: 90 });
    const chooserPromise = page.waitForEvent('filechooser');
    await documents.getByRole('button', { name: 'Add document', exact: true }).click();
    await (await chooserPromise).setFiles({ name: 'Neg evidence.txt', mimeType: 'text/plain', buffer: Buffer.from('## No new emissions\nThe plan does not increase emissions.') });
    await page.locator('.item-cell[data-column="1"]').getByRole('button', { name: /Edit No new emissions/ }).waitFor();
    assert.equal(await page.locator('.item-cell[data-column="0"] .flow-item').count(), 0, 'the new document must not be assigned to the default affirmative speech');
    await documents.getByLabel('SpeechDrop room code', { exact: true }).fill('abc123');
    await documents.getByRole('button', { name: 'Get files', exact: true }).click();
    await documents.locator('[data-sd-i="0"]').check();
    await documents.locator('[data-sd-speech="0"]').selectOption('2NC');
    await documents.getByRole('button', { name: 'Add selected', exact: true }).click();
    const extension = page.locator('.item-cell[data-column="3"] .flow-item').filter({ hasText: 'Extended link' });
    await extension.waitFor();
    assert.equal(await extension.locator('.item-speech').textContent(), '2NC');
    await documents.getByRole('button', { name: 'Close documents', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Documents');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Viewed speech', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Options for Case sheet', exact: true }).tap();
    const menu = await page.getByRole('menu', { name: 'Case sheet actions', exact: true }).boundingBox();
    assert.ok(menu.x >= 0 && menu.x + menu.width <= 390, 'the touch menu must fit the phone viewport');
    assert.equal(await page.getByRole('menuitem', { name: 'Rename sheet', exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
    rmSync(temp, { recursive: true, force: true });
  }
});

// Why: judges must find and close speech navigation, and understand Flow Check without receiving duplicate spoken help.
test('Speeches remains reachable while open and Flow Check explains itself once in both themes', { timeout: 120000 }, async () => {
  const scratch = existsSync('/Volumes/cre-scratch') ? '/Volumes/cre-scratch' : tmpdir();
  const temp = mkdtempSync(join(scratch, 'flow-check-'));
  const server = await serve(build(join(temp, 'app')));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1067, height: 805 }, colorScheme: theme });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port + '/?theme=' + theme);
      await page.getByRole('button', { name: 'Start judging', exact: true }).click();
      await page.locator('#tour-offer-no').click();
      await page.locator('#start-flow').click();
      await page.locator('[data-item-action="cancel-editor"]').click();
      const speeches = page.getByRole('button', { name: 'Speeches', exact: true });
      assert.ok((await speeches.boundingBox()).height > (await page.locator('#flow-tabs button[data-i="0"]').boundingBox()).height, 'speech navigation must stand apart from the argument tabs');
      await speeches.click();
      assert.equal(await page.locator('#tab-timer').isVisible(), true);
      assert.equal(await speeches.getAttribute('aria-expanded'), 'true');
      const pane = await page.locator('#tab-timer').boundingBox();
      const toolbar = await page.locator('.flowbar').boundingBox();
      assert.ok(pane.y >= toolbar.y + toolbar.height, 'the speech panel must leave the navigation controls reachable');
      await speeches.click();
      assert.equal(await page.locator('#tab-timer').isVisible(), false);
      assert.equal(await speeches.getAttribute('aria-expanded'), 'false');

      const flowCheck = page.getByRole('button', { name: 'Flow Check', exact: true });
      await flowCheck.hover();
      await page.locator('#tip-label').waitFor({ state: 'visible' });
      const explanation = 'Compare your flow with this speech. Check spoken order, unconfirmed arguments, and suggested matches.';
      assert.equal(await page.locator('#tip-label').textContent(), explanation);
      const descriptions = await flowCheck.evaluate((button) => (button.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent));
      assert.deepEqual(descriptions, [explanation], 'screen-reader users must receive the hover explanation exactly once');
      await page.mouse.move(0, 0);
      await page.locator('#tip-label').waitFor({ state: 'hidden' });
      await flowCheck.click();
      assert.equal(await page.getByRole('heading', { name: 'Flow Check', exact: true }).isVisible(), true);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
    rmSync(temp, { recursive: true, force: true });
  }
});
