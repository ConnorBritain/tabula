// Fresh-page Events recovery must protect exact device data before auto-delete, AI setup or saved-data views can run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from '../build-events.mjs';

const PREFIX = 'tabulaEvents.', META = 'tabulaEventsRecovery.';
const REMEMBERED = 'synthetic-recovery-remembered-key', TAB_ONLY = 'synthetic-recovery-tab-only-key';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
function serve(root) {
  return createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(root, path === '/' ? '/index.html' : path);
    if (!file.startsWith(root + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
}
const saved = (page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tabulaEvents.'))));
const tabSaved = (page) => page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('tabulaEvents.'))));
const fault = (page, value) => page.evaluate((v) => { if (v) sessionStorage.setItem('synthetic-recovery-fault', JSON.stringify(v)); else sessionStorage.removeItem('synthetic-recovery-fault'); }, value);
async function seed(page) {
  await page.evaluate(async ({ remembered, tabOnly }) => {
    const { createRoom } = await import('/js/room.js');
    const old = Date.now() - 40 * 86400000;
    let id = 0;
    const room = createRoom({ now: old, makeId: (prefix) => prefix + (++id),
      event: { id: 'custom', version: 1, name: 'Synthetic recovery', short: 'Custom', category: 'custom', performers: 1,
        timing: { limit: 300, inRoomPrep: false, sharedClock: false }, checks: [], prompts: [], tags: [] },
      profile: { id: 'synthetic', version: 1, overtime: { grace: 30 } }, entries: [{ code: 'A12' }] });
    room.id = 'original-old-room'; room.state = 'done';
    const open = structuredClone(room); open.id = 'original-open-room'; open.state = 'judging';
    localStorage.setItem('tabulaEvents.rooms.v1', JSON.stringify([room, open]));
    localStorage.setItem('tabulaEvents.cards.v1', JSON.stringify([{ id: 'original-card', roundId: room.id, createdAt: old, submittedAt: old }]));
    localStorage.setItem('tabulaEvents.settings.v1', JSON.stringify({ theme: 'dark', timerBig: true, timerBeep: false,
      aiPreferences: { defaults: { mode: 'custom', style: 'Keep the original saved style.' } } }));
    localStorage.setItem('tabulaEvents.aiKeys.v1', JSON.stringify({ anthropic: remembered }));
    sessionStorage.setItem('tabulaEvents.aiKeys.v1', JSON.stringify({ openai: tabOnly }));
    localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":0}');
    localStorage.setItem('policyJudge.synthetic-recovery-foreign', 'untouched');
  }, { remembered: REMEMBERED, tabOnly: TAB_ONLY });
  await page.reload();
  await page.locator('#set-auto-h').waitFor();
}
async function incoming(page) {
  return page.evaluate(async () => {
    const { makeBackup } = await import('/js/settings.js');
    const room = JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1'))[0]; room.id = 'replacement-room';
    return JSON.stringify(makeBackup({ 'tabulaEvents.rooms.v1': JSON.stringify([room]),
      'tabulaEvents.settings.v1': '{"theme":"light","timerBig":false}', 'tabulaEvents.lifetime.v1': '{"days":0}' }));
  });
}
async function restore(page, text) {
  await page.locator('#set-restore').setInputFiles({ name: 'synthetic-recovery.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('heading', { name: 'This backup holds', exact: true }).waitFor();
  await page.locator('#set-check-restore').click();
  await page.locator('#ask').getByRole('button', { name: 'Replace my data', exact: true }).click();
}
async function downloadText(page, action) {
  const pending = page.waitForEvent('download');
  await action();
  const download = await pending, stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
function noKeyLeak(text) {
  assert.equal(text.includes(REMEMBERED), false);
  assert.equal(text.includes(TAB_ONLY), false);
  assert.equal(text.includes(META), false);
}

// Why: recovery that works only in the old JavaScript page is lost after a crash and cannot protect a judge's only copy.
test('actual fresh pages quarantine failed Restore and Undo, recover exact originals, and keep tab-only keys out of local storage and downloads', { timeout: 180000 }, async () => {
  const temp = mkdtempSync(join(tmpdir(), 'events-durable-recovery-')), out = build(join(temp, 'events')), server = serve(out);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { chromium } = createRequire(import.meta.url)('playwright');
  let browser, context;
  const evidence = process.env.TABULA_RECOVERY_EVIDENCE;
  const observations = [];
  try {
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Faults remain active across a real reload. Metadata writes are allowed so the test reaches destructive writes and failed rollback.
    await context.addInitScript(() => {
      const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem, get = Storage.prototype.getItem;
      window.syntheticOrdinaryWrites = [];
      const options = () => { try { return JSON.parse(get.call(sessionStorage, 'synthetic-recovery-fault') || 'null'); } catch { return null; } };
      Storage.prototype.setItem = function (key, raw) {
        if (this === localStorage && key.startsWith('tabulaEvents.')) {
          window.syntheticOrdinaryWrites.push({ action: 'set', key });
          const fault = options();
          if (fault?.key === key || (fault?.auto && (key === 'tabulaEvents.cards.v1' || (key === 'tabulaEvents.rooms.v1' && String(raw).includes('original-old-room'))))) throw new DOMException('Synthetic failed ordinary save', 'QuotaExceededError');
        }
        return set.call(this, key, raw);
      };
      Storage.prototype.removeItem = function (key) {
        if (this === localStorage && key.startsWith('tabulaEventsRecovery.journal.') && options()?.journalRemove) throw new DOMException('Synthetic failed journal cleanup', 'QuotaExceededError');
        if (this === localStorage && key.startsWith('tabulaEvents.')) {
          window.syntheticOrdinaryWrites.push({ action: 'remove', key });
          if (options()?.remove) throw new DOMException('Synthetic failed ordinary removal', 'QuotaExceededError');
        }
        return remove.call(this, key);
      };
    });
    const page = await context.newPage(), errors = [], providers = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (/api\.(openai|anthropic|x\.ai)|generativelanguage|openrouter/.test(request.url())) providers.push(request.url()); });
    const url = `http://127.0.0.1:${server.address().port}/#/settings`;
    await page.goto(url); await page.locator('#set-auto-h').waitFor();
    await seed(page);
    const defaultFile = await downloadText(page, () => page.locator('#set-backup').click());
    noKeyLeak(defaultFile);
    await page.locator('#set-backup-keys').check();
    const explicitFile = await downloadText(page, () => page.locator('#set-backup').click());
    assert.equal(explicitFile.includes(REMEMBERED), true);
    assert.equal(explicitFile.includes(TAB_ONLY), false);
    assert.equal(explicitFile.includes(META), false);
    await page.locator('#set-backup-keys').uncheck();
    await page.evaluate(() => localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":7}'));
    const original = await saved(page), originalTab = await tabSaved(page), file = await incoming(page);
    await fault(page, { key: 'tabulaEvents.settings.v1' });
    await restore(page, file);
    await page.locator('#set-recovery').waitFor();
    const partial = await saved(page);
    assert.ok(Object.keys(partial).length < Object.keys(original).length);
    const durable = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('tabulaEventsRecovery.journal.')).map(([, raw]) => JSON.parse(raw)));
    assert.equal(durable.length, 1);
    assert.deepEqual(durable[0].before, original);
    assert.equal(JSON.stringify(durable).includes(TAB_ONLY), false);
    const recoveryFile = await downloadText(page, () => page.locator('#set-recovery-backup').click());
    noKeyLeak(recoveryFile);
    const expectedExport = { ...original }; delete expectedExport['tabulaEvents.aiKeys.v1'];
    assert.deepEqual(JSON.parse(recoveryFile).storage, expectedExport);
    await page.reload();
    await page.locator('#set-recovery').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-ready'), 'false');
    assert.equal(await page.locator('header').evaluate((el) => el.inert), true);
    for (const control of ['#set-clear', '#set-wrap', '#set-auto-h', '#event-ai-preferences']) assert.equal(await page.locator(control).count(), 0);
    const quarantined = await saved(page), attempts = await page.evaluate(() => window.syntheticOrdinaryWrites.length);
    await page.keyboard.press('Control+k');
    await page.evaluate(() => { location.hash = '#/pick'; });
    await page.locator('#set-recovery').waitFor();
    const refused = await page.evaluate(async () => {
      const { createEventsStore } = await import('/js/store.js');
      return createEventsStore({ toast() {}, dismissToast() {} }).set('tabulaEvents.rooms.v1', [{ id: 'must-not-save' }]);
    });
    assert.equal(refused, false);
    assert.deepEqual(await saved(page), quarantined);
    assert.equal(await page.evaluate(() => window.syntheticOrdinaryWrites.length), attempts, 'no app action or startup auto-delete writes past quarantine');
    const reread = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.startsWith('tabulaEventsRecovery.journal.'))[1]));
    assert.deepEqual(reread.before, original);
    if (evidence) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: join(evidence, '390-crash-quarantine.jpg'), fullPage: true }); }
    await fault(page, null);
    await page.evaluate(() => { location.hash = '#/settings'; });
    await page.reload();
    await page.locator('#set-auto-h').waitFor();
    assert.deepEqual(await saved(page), original, 'fresh startup recovers originals before eligible old rounds can be deleted');
    assert.deepEqual(await tabSaved(page), originalTab);
    assert.equal(await page.locator('#set-big').isChecked(), true);
    assert.equal(await page.locator('#event-ai-preferences [data-pref="style"]').inputValue(), 'Keep the original saved style.');
    observations.push({ scenario: 'failed Restore -> actual reload quarantine -> fresh exact recovery', pass: true });

    // Failed Undo retains requested A durably, while startup first restores committed B and still blocks new work.
    await page.evaluate(() => localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":0}'));
    const a = await saved(page), aTab = await tabSaved(page);
    await restore(page, file);
    const b = await saved(page);
    assert.notDeepEqual(b, a);
    await fault(page, { key: 'tabulaEvents.settings.v1' });
    await page.getByRole('button', { name: 'Undo: restore backup', exact: true }).click();
    await page.locator('#set-recovery').waitFor();
    await page.reload(); await page.locator('#set-recovery').waitFor();
    await fault(page, null);
    await page.reload(); await page.locator('#set-recovery').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-ready'), 'false');
    assert.deepEqual(await saved(page), b, 'startup protects the committed state before failed Undo');
    const undoFile = await downloadText(page, () => page.locator('#set-recovery-backup').click());
    const aWithoutKey = { ...a }; delete aWithoutKey['tabulaEvents.aiKeys.v1'];
    noKeyLeak(undoFile);
    assert.deepEqual(JSON.parse(undoFile).storage, aWithoutKey, 'recovery download retains requested original A');
    await page.locator('#set-recover').click();
    await page.locator('#set-auto-h').waitFor();
    assert.deepEqual(await saved(page), a);
    assert.deepEqual(await tabSaved(page), aTab);
    observations.push({ scenario: 'failed Restore Undo -> fresh committed B quarantine -> explicit original A recovery', pass: true });

    // Clear's Undo can fail after Clear itself succeeded; its older original must survive a new page as well.
    const clearOriginal = await saved(page), clearTab = await tabSaved(page);
    await page.locator('#set-clear').click();
    await page.locator('#ask').getByRole('button', { name: 'Clear this device', exact: true }).click();
    assert.deepEqual(await saved(page), {});
    assert.deepEqual(await tabSaved(page), {});
    await fault(page, { key: 'tabulaEvents.settings.v1' });
    await page.getByRole('button', { name: 'Undo: clear this device', exact: true }).click();
    await page.locator('#set-recovery').waitFor();
    await fault(page, null);
    await page.reload(); await page.locator('#set-recovery').waitFor();
    assert.deepEqual(await saved(page), {});
    await page.locator('#set-recover').click(); await page.locator('#set-auto-h').waitFor();
    assert.deepEqual(await saved(page), clearOriginal);
    assert.deepEqual(await tabSaved(page), clearTab);
    observations.push({ scenario: 'failed Clear Undo -> actual reload -> complete original recovery', pass: true });

    // A proved Clear/Restore may need only cleanup. Its download remains original A; cleanup keeps B and then offers normal Undo.
    for (const action of ['clear', 'restore']) {
      const a = await saved(page), aTab = await tabSaved(page);
      await fault(page, { journalRemove: true });
      if (action === 'clear') {
        await page.locator('#set-clear').click();
        await page.locator('#ask').getByRole('button', { name: 'Clear this device', exact: true }).click();
      } else await restore(page, file);
      await page.getByRole('heading', { name: 'Finish your saved change', exact: true }).waitFor();
      const b = await saved(page), originalFile = await downloadText(page, () => page.locator('#set-recovery-backup').click());
      const aWithoutKey = { ...a }; delete aWithoutKey['tabulaEvents.aiKeys.v1'];
      noKeyLeak(originalFile);
      assert.deepEqual(JSON.parse(originalFile).storage, aWithoutKey);
      if (action === 'clear') {
        await page.evaluate(() => { location.hash = '#/'; });
        await page.waitForFunction(() => document.querySelector('header').inert);
      }
      await fault(page, null);
      await page.locator('#set-recover').click();
      assert.deepEqual(await saved(page), b, 'cleanup keeps the already committed target');
      await page.getByRole('button', { name: action === 'clear' ? 'Undo: clear this device' : 'Undo: restore backup', exact: true }).click();
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' && JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1'))?.length === 2);
      assert.deepEqual(await saved(page), a);
      assert.deepEqual(await tabSaved(page), aTab);
      await page.evaluate(() => { location.hash = '#/settings'; });
      await page.locator('#set-auto-h').waitFor();
      observations.push({ scenario: 'committed ' + action + ' -> true original download -> cleanup keeps B -> normal Undo returns exact A', pass: true });
    }

    // Startup deletion can fail after one key changed. Its original journal must precede all app work on the next page.
    await page.evaluate(() => localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":7}'));
    const autoOriginal = await saved(page), autoTab = await tabSaved(page);
    await fault(page, { auto: true });
    await page.reload(); await page.locator('#set-recovery').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-ready'), 'false');
    const failedAuto = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.startsWith('tabulaEventsRecovery.journal.'))[1]));
    assert.deepEqual(failedAuto.before, autoOriginal);
    assert.notDeepEqual(await saved(page), autoOriginal, 'the fault reached an actual partial persistent auto-delete');
    await page.reload(); await page.locator('#set-recovery').waitFor();
    await fault(page, null);
    await page.reload(); await page.locator('#set-auto-h').waitFor();
    assert.deepEqual(await saved(page), autoOriginal);
    assert.deepEqual(await tabSaved(page), autoTab);
    observations.push({ scenario: 'partial startup auto-delete -> failed rollback -> actual reload -> exact recovery before app work', pass: true });

    // A successful auto-delete followed by failed Put them back needs the same durable Undo barrier as Clear and Restore.
    await page.reload(); await page.locator('#set-putback').waitFor();
    const deleted = await saved(page);
    assert.deepEqual(JSON.parse(deleted['tabulaEvents.rooms.v1']).map((room) => room.id), ['original-open-room']);
    await fault(page, { auto: true });
    await page.locator('#set-putback').click(); await page.locator('#set-recovery').waitFor();
    const putBack = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.startsWith('tabulaEventsRecovery.journal.'))[1]));
    assert.equal(putBack.intent, 'undo');
    assert.deepEqual(putBack.before, deleted);
    assert.equal(putBack.after['tabulaEvents.aiKeys.v1'], autoOriginal['tabulaEvents.aiKeys.v1']);
    assert.equal(putBack.after['tabulaEvents.settings.v1'], autoOriginal['tabulaEvents.settings.v1']);
    await page.locator('#set-recover').click();
    assert.equal(await page.locator('#set-recovery').isVisible(), true, 'a repeated failed Put back keeps its durable target');
    await fault(page, null);
    await page.reload(); await page.locator('#set-recovery').waitFor();
    assert.deepEqual(await saved(page), deleted);
    await page.locator('#set-recover').click(); await page.locator('#set-auto-h').waitFor();
    assert.deepEqual(await saved(page), putBack.after);
    assert.deepEqual(await tabSaved(page), autoTab);
    observations.push({ scenario: 'auto-delete -> failed Put them back -> repeated failure -> fresh committed state -> exact requested target', pass: true });
    // The same completion boundary applies to committed startup deletion and committed Put them back.
    const cleanupAutoOriginal = await saved(page);
    await fault(page, { journalRemove: true });
    await page.reload(); await page.getByRole('heading', { name: 'Finish your saved change', exact: true }).waitFor();
    const cleanupDeleted = await saved(page);
    assert.deepEqual(JSON.parse(cleanupDeleted['tabulaEvents.rooms.v1']).map((room) => room.id), ['original-open-room']);
    const autoFile = await downloadText(page, () => page.locator('#set-recovery-backup').click());
    const autoWithoutKey = { ...cleanupAutoOriginal }; delete autoWithoutKey['tabulaEvents.aiKeys.v1'];
    noKeyLeak(autoFile);
    assert.deepEqual(JSON.parse(autoFile).storage, autoWithoutKey);
    await fault(page, null);
    await page.locator('#set-recover').click(); await page.locator('#set-putback').waitFor();
    assert.deepEqual(await saved(page), cleanupDeleted);
    await page.getByRole('button', { name: 'Undo: 1 old round removed', exact: true }).click();
    assert.deepEqual(await saved(page), cleanupAutoOriginal);
    observations.push({ scenario: 'committed startup delete -> cleanup keeps deletion -> normal Undo restores original', pass: true });
    await page.reload(); await page.locator('#set-putback').waitFor();
    await fault(page, { journalRemove: true });
    await page.locator('#set-putback').click(); await page.getByRole('heading', { name: 'Finish your saved change', exact: true }).waitFor();
    const cleanupPutBack = await saved(page);
    assert.deepEqual(cleanupPutBack, cleanupAutoOriginal);
    await fault(page, null);
    await page.locator('#set-recover').click(); await page.locator('#set-auto-h').waitFor();
    assert.deepEqual(await saved(page), cleanupPutBack);
    assert.equal(await page.locator('#set-putback').count(), 0);
    observations.push({ scenario: 'committed Put them back -> cleanup retains restored rounds and clears stale pending action', pass: true });
    await page.evaluate(() => localStorage.setItem('tabulaEvents.lifetime.v1', '{"days":0}'));

    // A closed tab intentionally loses its session key. A genuinely new tab must still recover exact local data.
    const closeOriginal = await saved(page);
    await fault(page, { key: 'tabulaEvents.settings.v1' });
    await restore(page, file); await page.locator('#set-recovery').waitFor();
    await page.close();
    const newTab = await context.newPage(); await newTab.goto(url); await newTab.locator('#set-auto-h').waitFor();
    assert.deepEqual(await saved(newTab), closeOriginal);
    assert.deepEqual(await tabSaved(newTab), {});
    assert.equal(await newTab.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))).includes('synthetic-recovery-tab-only-key')), false);
    assert.equal(await newTab.evaluate(() => localStorage.getItem('policyJudge.synthetic-recovery-foreign')), 'untouched');
    assert.equal(await newTab.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('tabulaEventsRecovery.journal.'))), false);
    observations.push({ scenario: 'original tab close -> new tab local recovery -> old session key forgotten', pass: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(providers, []);
    if (evidence) writeFileSync(join(evidence, 'RESULT.json'), JSON.stringify({ pass: true, observations, pageErrors: errors.length, providerRequests: providers.length, ownerDataUsed: false }, null, 2) + '\n');
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    rmSync(temp, { recursive: true, force: true });
  }
});
