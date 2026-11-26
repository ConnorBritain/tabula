// Tests for data safety in Speech Events: the install manifest, asking the browser to keep the saved data, the
// end-of-day backup reminder, Clear this device, and the source-code link. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import '../core/policy.js'; // a head file: it sets globalThis.TabulaCore.policy, which the Settings screen reads
import { pageFiles } from './build-sw.mjs';
import { createEventsStore, askToKeepOnce, storageKept, PREFIX, ROOMS_KEY, CARDS_KEY, SETTINGS_KEY, DAYS_KEY, BACKUP_AT_KEY, PERSIST_ASKED_KEY } from './js/store.js';
import { keptText, lastChangeAt, backupReminderDue, CLEAR_WHAT } from './js/settings.js';
import { createSettingsScreen, settingsHtml } from './js/settings-screen.js';
import { mydayHtml } from './js/myday-screen.js';
import { makeDay, makeCard, submitCard, mydayModel, withStandby } from './js/cards.js';
import { dayOf } from './js/rooms.js';
import { KEYS_KEY } from './js/ai-key.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// A localStorage stand-in with the same calls the store uses.
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}
const quietUi = () => ({ toast() {}, dismissToast() {} });
const tick = () => new Promise((r) => setTimeout(r, 0));

// A navigator.storage stand-in that counts the asks.
function fakeNav({ persisted = false, grant = true, throws = false } = {}) {
  const calls = { persist: 0, persisted: 0 };
  return {
    calls,
    storage: {
      persisted: async () => { calls.persisted++; if (throws) throw new Error('no'); return persisted; },
      persist: async () => { calls.persist++; if (throws) throw new Error('no'); return grant; },
    },
  };
}

// The width and height in a PNG's header.
function pngSize(path) {
  const b = readFileSync(new URL(path, import.meta.url));
  assert.equal(b.toString('latin1', 1, 4), 'PNG', path + ' is a PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

// ---------- the install manifest ----------

// Why: without a valid manifest the app cannot be installed, and Safari may then clear a judge's rounds after a week
// away; a start_url or scope that is not relative breaks the app when it moves to the root of its own host.
test('the manifest is valid: name, relative start_url and scope, standalone, grey colors, 192, 512 and maskable icons', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Tabula Speech Events');
  assert.ok(m.short_name && m.short_name.length <= 15, 'a short name that fits under a home-screen icon');
  for (const k of ['start_url', 'scope', 'id']) assert.equal(m[k], './', k + ' is relative to the manifest');
  assert.equal(m.display, 'standalone');
  assert.equal(m.background_color, '#f4f5f7', 'the cool grey canvas (core/tokens.css)');
  assert.equal(m.theme_color, '#f4f5f7', 'the grey canvas: the brand green shows only in the header mark');
  const want = [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']];
  for (const [sizes, purpose] of want) {
    const icon = m.icons.find((i) => i.sizes === sizes && i.purpose === purpose);
    assert.ok(icon, sizes + ' ' + purpose + ' icon');
    assert.equal(icon.type, 'image/png');
    assert.ok(!/^\/|^[a-z]+:/i.test(icon.src), icon.src + ' is relative');
    assert.ok(existsSync(new URL(icon.src, import.meta.url)), icon.src + ' exists');
    assert.deepEqual(pngSize(icon.src), sizes.split('x').map(Number), icon.src + ' is ' + sizes);
  }
  assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);
});

// Why: a manifest that is not linked is never read, and one the offline cache does not hold fails to load at a
// tournament with no internet; the page icons must be cached too or the installed app shows a blank icon offline.
test('index.html links the manifest, the apple-touch-icon and theme-color, and the offline cache holds them', async () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(html, /<meta name="theme-color" content="#f4f5f7" media="\(prefers-color-scheme: light\)">/);
  assert.match(html, /<meta name="theme-color" content="#0f1114" media="\(prefers-color-scheme: dark\)">/);
  const files = await pageFiles();
  for (const f of ['events/manifest.webmanifest', 'events/icons/apple-touch-icon.png', 'events/icons/icon-192.png', 'events/icons/icon-512.png']) {
    assert.ok(files.includes(f), f + ' is in the crawl');
  }
  const sw = read('sw-files.js');
  for (const f of ['"manifest.webmanifest"', '"icons/icon-192.png"', '"icons/icon-512.png"', '"icons/apple-touch-icon.png"']) assert.ok(sw.includes(f), f + ' is in sw-files.js');
});

// ---------- asking the browser to keep the data ----------

// Why: the browser must be asked once, after there is a round worth keeping; asking on every save would show Firefox's
// prompt again and again in the middle of a round.
test('askToKeepOnce asks the browser once, marks the ask, and reports the answer', async () => {
  const store = createEventsStore(quietUi(), memStorage(), { nav: null });
  const nav = fakeNav({ grant: true });
  assert.equal(await askToKeepOnce(store, () => 111, nav), 'kept');
  assert.equal(nav.calls.persist, 1);
  assert.equal(store.get(PERSIST_ASKED_KEY, null), 111);
  assert.equal(await askToKeepOnce(store, () => 222, nav), 'asked-before');
  assert.equal(nav.calls.persist, 1, 'no second ask');

  const s2 = createEventsStore(quietUi(), memStorage(), { nav: null });
  assert.equal(await askToKeepOnce(s2, () => 1, fakeNav({ grant: false })), 'may-clear');
  const already = fakeNav({ persisted: true });
  assert.equal(await askToKeepOnce(createEventsStore(quietUi(), memStorage(), { nav: null }), () => 1, already), 'kept');
  assert.equal(already.calls.persist, 0, 'a browser that already keeps the data is not asked');
});

// Why: many browsers (older Safari, some school-managed ones) have no navigator.storage; a throw there would stop the
// round from saving or the Settings screen from drawing.
test('a browser without the storage API, or one whose API fails, never throws', async () => {
  const store = createEventsStore(quietUi(), memStorage(), { nav: null });
  for (const nav of [undefined, null, {}, { storage: {} }, { storage: { persisted: 1, persist: 2 } }]) {
    assert.equal(await askToKeepOnce(store, () => 1, nav), 'unknown');
    assert.equal(await storageKept(nav), 'unknown');
  }
  assert.equal(store.get(PERSIST_ASKED_KEY, null), null, 'no API: nothing is marked, nothing is asked');
  assert.equal(await askToKeepOnce(store, () => 1, fakeNav({ throws: true })), 'unknown');
  assert.equal(await storageKept(fakeNav({ throws: true })), 'unknown');
  assert.equal(await storageKept(fakeNav({ persisted: true })), 'kept');
  assert.equal(await storageKept(fakeNav({ persisted: false })), 'may-clear');
  // The store still saves when the page has no navigator at all.
  const bare = createEventsStore(quietUi(), memStorage(), { nav: undefined });
  assert.equal(bare.set(ROOMS_KEY, []), true);
  await tick();
});

// Why: the ask must come with the first saved round or ballot card (not on first paint, not on a theme change), and
// only once even across page loads, so a judge is never interrupted twice.
test('the events store asks on the first saved round only, and not again after a reload', async () => {
  const storage = memStorage();
  const nav = fakeNav({ grant: true });
  const store = createEventsStore(quietUi(), storage, { nav, now: () => 5 });
  store.set(SETTINGS_KEY, { theme: 'dark' });
  store.set(DAYS_KEY, []);
  await tick();
  assert.equal(nav.calls.persist, 0, 'settings and days do not ask');
  store.set(ROOMS_KEY, [{ id: 'r1' }]);
  store.set(CARDS_KEY, []);
  store.set(ROOMS_KEY, [{ id: 'r1' }, { id: 'r2' }]);
  await tick(); await tick();
  assert.equal(nav.calls.persist, 1, 'one ask for many saves');
  const again = createEventsStore(quietUi(), storage, { nav, now: () => 9 });
  again.set(ROOMS_KEY, []);
  await tick(); await tick();
  assert.equal(nav.calls.persist, 1, 'a new page load does not ask again');
  assert.equal(again.get(PERSIST_ASKED_KEY, null), 5);
});

// Why: a lay judge reads this line to decide whether to install or back up; a wrong "keeps" would let rounds vanish.
test('Settings says plainly whether this browser keeps the rounds', () => {
  assert.equal(keptText('kept', false), 'This browser keeps your rounds.');
  assert.match(keptText('may-clear', false), /may clear your rounds.*Install it or download a backup/);
  assert.match(keptText('unknown', false), /may clear your rounds/, 'unknown is never shown as safe');
  assert.match(keptText('may-clear', true), /installed/);
  const html = settingsHtml({ settings: { theme: 'system', drawGapMin: 7 }, ai: null, keys: '', offline: null, kept: keptText('kept') });
  assert.match(html, /<p id="set-kept" role="status">This browser keeps your rounds\.<\/p>/);
  assert.match(html, /<button class="b" type="button" id="set-clear">Clear this device<\/button>/);
});

// ---------- the end-of-day backup reminder ----------

const NOW = new Date(2026, 10, 14, 17, 0).getTime();
const DAY = makeDay({ date: dayOf(NOW), now: NOW - 9 * 3600e3, makeId: () => 'd1' });
let ids = 0;
const card = (over) => Object.assign(makeCard({ day: DAY, event: 'oo', tournament: 'Fall Classic', round: 'Round 1', now: NOW - 8 * 3600e3, makeId: () => 'c' + (++ids) }), over);
const doneRound = (id, at) => ({ id, createdAt: at - 3600e3, updatedAt: at, state: 'done', profile: { id: 'x' }, entries: [] });
function dayEnd({ backupAt = null, dismissedAt = null, extraCards = [], day = DAY, chambers = [] } = {}) {
  const r = doneRound('r1', NOW - 3600e3);
  const cards = [submitCard(card({ roundId: 'r1' }), NOW - 1800e3), ...extraCards];
  const model = mydayModel({ day, cards, rounds: [r], now: NOW, ranksDueMin: 10 });
  return backupReminderDue({ model, chambers, lastChange: lastChangeAt([r], cards), lastBackupAt: backupAt, dismissedAt });
}

// Why: a judge who leaves a shared laptop with rounds only in the browser can lose every ballot comment about a minor;
// the reminder must show when the day is over and there is no backup since the last change.
test('the reminder shows when the day is done and nothing is backed up since the last change', () => {
  assert.equal(dayEnd(), true);
  assert.equal(dayEnd({ backupAt: NOW - 3600e3 }), true, 'a backup older than the last change does not count');
  assert.equal(dayEnd({ backupAt: NOW - 1800e3 }), false, 'a backup at the last change counts');
  assert.equal(dayEnd({ backupAt: NOW }), false);
});

// Why: the reminder must not interrupt a judge who still has a round to judge or is waiting for the next ballot.
test('the reminder waits while a ballot is still to judge, on standby, or in a Congress chamber', () => {
  assert.equal(dayEnd({ extraCards: [card({})] }), false, 'a card still to start (Later today)');
  assert.equal(dayEnd({ day: withStandby(DAY, true, NOW) }), false, 'on standby for another ballot');
  assert.equal(dayEnd({ chambers: [{ id: 'ch1', label: 'Chamber 1' }] }), false, 'a Congress chamber in use');
  const empty = mydayModel({ day: DAY, cards: [], rounds: [], now: NOW, ranksDueMin: 10 });
  assert.equal(backupReminderDue({ model: empty, chambers: [], lastChange: 0, lastBackupAt: null }), false, 'no ballots today');
  assert.equal(backupReminderDue(null), false);
});

// Why: "Not now" must hide the reminder until the judge changes something, so it never nags on every visit to My day
// yet still comes back if a later round has no backup.
test('"Not now" hides the reminder until the next change', () => {
  const r = doneRound('r1', NOW - 3600e3);
  const cards = [submitCard(card({ roundId: 'r1' }), NOW - 1800e3)];
  const last = lastChangeAt([r], cards);
  assert.equal(last, NOW - 1800e3, 'the latest of round updatedAt and card submittedAt');
  assert.equal(dayEnd({ dismissedAt: last }), false);
  assert.equal(dayEnd({ dismissedAt: last - 1 }), true, 'a newer change brings it back');
  assert.equal(lastChangeAt([], []), 0);
  assert.equal(lastChangeAt([null, { updatedAt: 'x' }], [{ cancelledAt: 7 }]), 7);
});

// Why: the reminder must offer the download and a way to dismiss it, in plain words, and nothing when it is not due.
test('My day draws the reminder with Download backup and Not now only when it is due', () => {
  const m = mydayModel({ day: DAY, cards: [], rounds: [], now: NOW, ranksDueMin: 10 });
  const events = new Map();
  const on = mydayHtml(m, DAY, events, NOW, [], null, true);
  assert.match(on, /<section class="md-backup" aria-labelledby="md-bk-h">/);
  assert.match(on, /id="md-backup">Download backup<\/button>/);
  assert.match(on, /id="md-backup-later">Not now<\/button>/);
  assert.doesNotMatch(mydayHtml(m, DAY, events, NOW, [], null, false), /md-backup/);
  assert.doesNotMatch(mydayHtml(m, DAY, events, NOW, []), /md-backup/);
});

// ---------- Clear this device ----------

// A Settings screen with stand-ins for the page parts. answer: what the confirm dialog returns.
function settingsRig(local, tab, answer) {
  const prevSession = globalThis.sessionStorage;
  globalThis.sessionStorage = tab;
  const toasts = [], asks = [];
  let forgot = 0, reloads = 0, clickHandler = null;
  const node = () => ({ focus() {}, textContent: '', innerHTML: '', checked: false, value: 'defaults', click() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => node() });
  const ui = {
    toast: (msg, opts) => toasts.push({ msg, opts: opts || {} }),
    dismissToast() {},
    ask: async (o) => { asks.push(o); return answer; },
  };
  const env = {
    el: { innerHTML: '', addEventListener: (t, f) => { if (t === 'click') clickHandler = f; }, removeEventListener() {}, querySelector: () => node() },
    ui, now: () => NOW,
    store: createEventsStore(ui, local, { nav: null }),
    settings: () => ({ theme: 'system', drawGapMin: 7, ranksDueMin: 10 }),
    saveSettings() {},
    ai: { gate: globalThis.TabulaCore.policy.gateFor({ record: null, now: NOW, off: false }), own: { hasKey: () => false, providerName: () => '', forget: () => { forgot++; } } },
    reload: () => { reloads++; },
  };
  const screen = createSettingsScreen(env);
  screen.show();
  globalThis.sessionStorage = prevSession;
  return { click: (id) => clickHandler({ target: { id } }), toasts, asks, get forgot() { return forgot; }, get reloads() { return reloads; } };
}

// Why: on a shared school laptop, Clear this device must remove every Speech Events value (rounds, comments about
// minors, the AI key) and must never touch Tabula Debate's saved data on the same browser.
test('Clear this device removes every tabulaEvents.* key, in this tab too, and leaves debate keys alone; Undo puts it back', async () => {
  const before = { [ROOMS_KEY]: '[{"id":"r1"}]', [CARDS_KEY]: '[]', [SETTINGS_KEY]: '{"theme":"dark"}', [KEYS_KEY]: '{"anthropic":"k"}', [BACKUP_AT_KEY]: '5', 'tabulaEvents.congress.v1': '{}',
    'policyJudge.rounds': '[1]', 'tabula.settings': '{"x":1}', 'other': 'y' };
  const local = memStorage(before);
  const tab = memStorage({ [KEYS_KEY]: '{"openai":"t"}', 'policyJudge.tab': 'z' });
  const prev = globalThis.sessionStorage;
  globalThis.sessionStorage = tab; // the screen's tab store reads sessionStorage when used
  try {
    const rig = settingsRig(local, tab, 'clear');
    await rig.click('set-clear');
    assert.equal(rig.asks.length, 1);
    const ask = rig.asks[0];
    assert.equal(ask.title, 'Clear this device?');
    assert.ok(ask.body.join(' ').includes(CLEAR_WHAT), 'the dialog says what goes');
    assert.match(ask.body.join(' '), /Download a backup first/);
    assert.deepEqual(ask.buttons.map((b) => b.value), [null, 'backup', 'clear']);
    assert.equal(ask.buttons[2].kind, 'danger');
    assert.deepEqual(local.dump(), { 'policyJudge.rounds': '[1]', 'tabula.settings': '{"x":1}', 'other': 'y' }, 'only tabulaEvents.* keys are gone');
    assert.deepEqual(tab.dump(), { 'policyJudge.tab': 'z' });
    assert.equal(rig.forgot, 1, 'the AI key in memory is forgotten too');
    assert.equal(rig.reloads, 1, 'the screens redraw with the empty data');
    const t = rig.toasts.find((x) => x.opts.key === 'clear');
    assert.ok(t && t.opts.action && t.opts.action.label === 'Undo', 'the toast offers Undo');
    const prevLoc = globalThis.location;
    let reloaded = 0;
    globalThis.location = { reload: () => { reloaded++; } };
    try { t.opts.action.run(); } finally { globalThis.location = prevLoc; }
    assert.deepEqual(local.dump(), before, 'Undo puts every value back');
    assert.deepEqual(tab.dump(), { [KEYS_KEY]: '{"openai":"t"}', 'policyJudge.tab': 'z' });
    assert.equal(reloaded, 1, 'a page that had an AI key reloads to read it again');
  } finally { globalThis.sessionStorage = prev; }
});

// Why: a judge who cancels, or picks "Download backup first", must lose nothing.
test('Clear this device does nothing on Cancel, and "Download backup first" keeps the data', async () => {
  for (const answer of [null, 'backup']) {
    const before = { [ROOMS_KEY]: '[]', 'policyJudge.rounds': '[1]' };
    const local = memStorage(before);
    const tab = memStorage({});
    const prev = globalThis.sessionStorage;
    globalThis.sessionStorage = tab;
    const prevDoc = globalThis.document, prevURL = globalThis.URL.createObjectURL;
    // "Download backup first" saves a file; stand in for the page's download link.
    globalThis.document = { createElement: () => ({ click() {} }) };
    globalThis.URL.createObjectURL = () => 'blob:x';
    const prevTimer = globalThis.setTimeout;
    globalThis.setTimeout = () => 0; // the download link's 10 s clean-up timer would hold the test run open
    try {
      const rig = settingsRig(local, tab, answer);
      await rig.click('set-clear');
      const after = local.dump();
      assert.equal(after[ROOMS_KEY], '[]', String(answer) + ': the rounds stay');
      assert.equal(after['policyJudge.rounds'], '[1]');
      if (answer === 'backup') assert.equal(after[BACKUP_AT_KEY], String(NOW), 'the backup time is noted');
      else assert.equal(after[BACKUP_AT_KEY], undefined);
      assert.equal(rig.forgot, 0);
    } finally {
      globalThis.sessionStorage = prev; globalThis.document = prevDoc; globalThis.URL.createObjectURL = prevURL; globalThis.setTimeout = prevTimer;
    }
  }
});

// ---------- About ----------

// Why: the AGPL requires that people who use the hosted app can find its source; without this link a judge or
// tournament using the app has no way to get it.
test('Settings links to the source code under the AGPL', () => {
  const html = settingsHtml({ settings: { theme: 'system', drawGapMin: 7 }, ai: null, keys: '', offline: null, kept: null });
  assert.ok(html.includes('<a href="https://github.com/TabulaSpeech/tabula" rel="noopener">Source code (AGPL)</a>'));
});
