// Why: if these rules break, auto-delete can remove a round a judge still needs (open comments, not yet submitted, an open Congress chamber) or a restore can change data before the judge agrees.
// Tests for data lifetime in Speech Events (Settings → Data): auto-delete old rounds, Check a backup, and Wrap up the
// season. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import '../core/policy.js'; // a head file: it sets globalThis.TabulaCore.policy, which the Settings screen reads
import { createEventsStore as makeEventsStore, PREFIX, ROOMS_KEY, CARDS_KEY, DAYS_KEY, SETTINGS_KEY, BACKUP_AT_KEY } from './js/store.js';
import { CONGRESS_KEY } from './congress/store.js';
import { dayOf } from './js/rooms.js';
import { migrateSettings } from './js/migrate.js';
import { createOwnKey, KEYS_KEY } from './js/ai-key.js';
import { JOURNAL_PREFIX } from './js/data-journal.js';
import { makeBackup, readBackup, CLEAR_WHAT } from './js/settings.js';
import { createSettingsScreen, settingsHtml, checkHtml, AUTO_DELETE_CHOICES } from './js/settings-screen.js';
import { LIFETIME_KEY, AUTO_DELETE_TOAST_KEY, pendingPutBack, forgetRemoved, putBackRemoved, finishLifetimeRecovery, AUTO_DELETE_DAYS, autoDeleteDaysOf, lifetimeValue, calendarDays, pickOld, removeOld, putBack, removedText, autoDeleteAtStart,
  backupSummary, backupSummaryRows, autoDeleteHelp, autoDeletePaused, deviceSummaryText } from './js/lifetime.js';

import { heldWriter } from './fixtures/held-writer.mjs';
const createEventsStore = (ui, storage, opts = {}) => makeEventsStore(ui, storage, { ...opts, writer: heldWriter });

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 25, 15, 0); // 2026-11-25, mid-afternoon in most time zones
const ago = (d) => NOW - d * DAY;

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
const fakeUi = () => {
  const toasts = [], asks = [];
  return { toasts, asks, answers: [], toast: (msg, opts) => toasts.push({ msg, opts: opts || {} }), dismissToast() {},
    async ask(o) { asks.push(o); return this.answers.length ? this.answers.shift() : null; } };
};

// A round whose comments are closed (state 'done'), and its card. at: the round's time; submitted: the card's submit time.
const round = (id, at, extra = {}) => Object.assign({ id, createdAt: at, updatedAt: at, state: 'done', entries: [], profile: {} }, extra);
const card = (id, roundId, submittedAt, extra = {}) => Object.assign({ id, roundId, createdAt: submittedAt || NOW - 400 * DAY, submittedAt: submittedAt ?? null, status: 'notStarted' }, extra);
const pick = (v) => pickOld(Object.assign({ rooms: [], cards: [], congress: null, days: 30, now: NOW }, v));

// ---------- the setting ----------

// Why: auto-delete removes data, so a judge who never chose it must never lose a round to it.
test('auto-delete is off by default and only 7, 30 or 90 days turn it on', () => {
  assert.deepEqual(AUTO_DELETE_DAYS, [7, 30, 90]);
  for (const bad of [null, undefined, {}, { days: 1 }, { days: '30' }, { days: -7 }, [30], 'x']) assert.equal(autoDeleteDaysOf(bad), 0, JSON.stringify(bad));
  for (const n of [7, 30, 90]) assert.equal(autoDeleteDaysOf({ days: n }), n);
  assert.deepEqual(lifetimeValue('30'), { days: 30 });
  assert.deepEqual(lifetimeValue('0'), { days: 0 });
  assert.deepEqual(lifetimeValue('45'), { days: 0 }, 'a value not offered saves off');
  assert.deepEqual(AUTO_DELETE_CHOICES.map((c) => c.id), ['0', '7', '30', '90']);
  const html = settingsHtml({ settings: { theme: 'system', drawGapMin: 7 }, ai: null, keys: '', offline: null, kept: null });
  assert.match(html, /name="set-auto" value="0" checked> Off/, 'Off is picked when nothing is saved');
  assert.doesNotMatch(html, /name="set-auto" value="(7|30|90)" checked/);
  assert.doesNotMatch(html, /set-mode|>Mode</, 'no Mode setting comes back');
});

// Why: with the setting off, start-up must not touch the saved rounds at all.
test('autoDeleteAtStart with the setting off changes nothing', () => {
  const ui = fakeUi();
  const before = { [ROOMS_KEY]: JSON.stringify([round('r1', ago(400))]), [CARDS_KEY]: JSON.stringify([card('c1', 'r1', ago(400))]) };
  const local = memStorage(before);
  const store = createEventsStore(ui, local, { nav: null });
  assert.equal(autoDeleteAtStart({ store, ui, now: () => NOW }), 0);
  assert.deepEqual(local.dump(), before);
  assert.equal(ui.toasts.length, 0);
});

// ---------- which rounds may go ----------

// Why: a round marked submitted with its comments closed is the only round the judge is done with.
test('a submitted round with comments closed goes once it is old enough, with its card', () => {
  const p = pick({ rooms: [round('r1', ago(40))], cards: [card('c1', 'r1', ago(40))] });
  assert.deepEqual(p.roundIds, ['r1']);
  assert.deepEqual(p.cardIds, ['c1']);
  assert.equal(p.clockOk, true);
  assert.deepEqual(pick({ rooms: [round('r1', ago(40))], cards: [card('c1', 'r1', ago(40))], days: 0 }).roundIds, [], 'off removes nothing');
});

// Why: comments still open means the judge has more to write; deleting them loses work for a student.
test('a round with open comments is kept, however old', () => {
  const p = pick({ rooms: [round('r1', ago(400), { state: 'judging' })], cards: [card('c1', 'r1', ago(400))], days: 7 });
  assert.deepEqual(p.roundIds, []);
  assert.deepEqual(p.cardIds, []);
});

// Why: a round not yet marked submitted may still be owed to the tab room.
test('a round not marked submitted is kept, however old; so is a round with no card', () => {
  assert.deepEqual(pick({ rooms: [round('r1', ago(400))], cards: [card('c1', 'r1', null)], days: 7 }).roundIds, [], 'not submitted');
  assert.deepEqual(pick({ rooms: [round('r1', ago(400))], cards: [], days: 7 }).roundIds, [], 'no card');
  assert.deepEqual(pick({ rooms: [round('r1', ago(400))], cards: [card('c1', 'r1', ago(400), { status: 'cancelled' })], days: 7 }).roundIds, [], 'only a cancelled card');
  // Two cards hold one round: one done, one not submitted. The round stays.
  assert.deepEqual(pick({ rooms: [round('r1', ago(400))], cards: [card('c1', 'r1', ago(400)), card('c2', 'r1', null)], days: 7 }).roundIds, []);
});

// Why: a submitted round must stay for the full time the judge chose, not a day less.
test('a submitted round is kept until it reaches the age: the boundary day for 7, 30 and 90', () => {
  for (const days of [7, 30, 90]) {
    const keep = pick({ rooms: [round('r1', ago(days - 1))], cards: [card('c1', 'r1', ago(days - 1))], days });
    assert.deepEqual(keep.roundIds, [], days + ': one day short stays');
    const go = pick({ rooms: [round('r1', ago(days))], cards: [card('c1', 'r1', ago(days))], days });
    assert.deepEqual(go.roundIds, ['r1'], days + ': on the day it goes');
  }
  // The age counts from the latest touch: a comment edited last week keeps a round made two months ago.
  assert.deepEqual(pick({ rooms: [round('r1', ago(60), { updatedAt: ago(5) })], cards: [card('c1', 'r1', ago(60))] }).roundIds, []);
  assert.deepEqual(pick({ rooms: [round('r1', ago(60))], cards: [card('c1', 'r1', ago(3))] }).roundIds, [], 'submitted 3 days ago');
  // A round with no good time stays.
  assert.deepEqual(pick({ rooms: [round('r1', 'x', { updatedAt: null })], cards: [card('c1', 'r1', null, { submittedAt: 'y' })] }).roundIds, []);
});

// Why: a device clock set back makes every age wrong; the safe choice is to delete nothing.
test('a clock set back (now earlier than a saved time) removes nothing', () => {
  const p = pick({ rooms: [round('r1', ago(400)), round('r2', NOW + 2 * DAY)], cards: [card('c1', 'r1', ago(400))], days: 7 });
  assert.equal(p.clockOk, false);
  assert.deepEqual(p.roundIds, []);
  const q = pick({ rooms: [round('r1', ago(400))], cards: [card('c1', 'r1', ago(400))], congress: { chambers: [{ id: 'ch1', createdAt: NOW + 60000 }], sessions: [] }, days: 7 });
  assert.equal(q.clockOk, false, 'a Congress time counts too');
  const r = pick({ rooms: [round('r1', ago(400), { ranksCopiedAt: NOW + DAY })], cards: [card('c1', 'r1', ago(400))], days: 7 });
  assert.equal(r.clockOk, false, 'every time the age reads is checked too');
  // Settings says why nothing goes.
  const store = createEventsStore(fakeUi(), memStorage({ [LIFETIME_KEY]: '{"days":7}', [ROOMS_KEY]: JSON.stringify([round('r2', NOW + 2 * DAY)]) }), { nav: null });
  assert.equal(autoDeletePaused(store, NOW), true);
  assert.match(autoDeleteHelp(7, false), /Paused now: a saved round has a time later than this device's clock\./);
  assert.doesNotMatch(autoDeleteHelp(7, true), /Paused/);
  assert.equal(autoDeletePaused(createEventsStore(fakeUi(), memStorage({}), { nav: null }), NOW), false, 'off is never paused');
});

// Why: a daylight saving change must not move the line by a day: the rule counts dates, not hours.
test('the age counts calendar days, so a clock change for daylight saving moves nothing', () => {
  const prev = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    // Spring forward on 2026-03-08: midnight to midnight 7 dates later is one hour short of 7 × 24 hours (in UTC it
    // would be exactly 7 days, so this also proves the time zone took effect). Hours would say 6 days; dates say 7.
    const from = new Date(2026, 2, 7, 0, 0).getTime();
    const to = new Date(2026, 2, 14, 0, 0).getTime();
    assert.equal(to - from, 7 * DAY - 3600e3);
    assert.equal(calendarDays(from, to), 7);
    // Fall back on 2026-11-01: 23:59 on day 6 is more than 7 × 24 hours later, but it is still day 6.
    const f2 = new Date(2026, 9, 29, 0, 1).getTime();
    assert.ok(new Date(2026, 10, 4, 23, 59).getTime() - f2 > 7 * DAY);
    assert.equal(calendarDays(f2, new Date(2026, 10, 4, 23, 59).getTime()), 6);
    assert.equal(calendarDays(f2, new Date(2026, 10, 5, 0, 0).getTime()), 7);
    const round7 = pick({ rooms: [round('r1', from)], cards: [card('c1', 'r1', from)], days: 7, now: to });
    assert.deepEqual(round7.roundIds, ['r1']);
    assert.deepEqual(pick({ rooms: [round('r1', from)], cards: [card('c1', 'r1', from)], days: 7, now: to - 3600e3 }).roundIds, [], 'the day before stays');
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  }
  assert.equal(calendarDays(NOW, NOW - DAY), -1);
});

// Why: a Congress chamber with a session still open may still be scored; it must never go.
test('a Congress chamber still open is kept; a closed one goes with its sessions once old', () => {
  const ch = (id) => ({ id, createdAt: ago(100) });
  const ses = (id, chamberId, submittedAt) => ({ id, chamberId, number: 1, createdAt: ago(100), submittedAt });
  const congress = { v: 1, chambers: [ch('open'), ch('empty'), ch('done'), ch('young')], prefs: {},
    sessions: [ses('s1', 'open', ago(100)), Object.assign(ses('s2', 'open', null), { number: 2 }), ses('s3', 'done', ago(100)), ses('s4', 'young', ago(2))] };
  const p = pick({ congress, days: 30 });
  assert.deepEqual(p.chamberIds, ['done'], 'open (one session not submitted), empty (no session) and young stay');
  assert.deepEqual(p.sessionIds, ['s3']);
  assert.equal(removedText(0, 1), '1 old Congress chamber removed.');
  assert.equal(removedText(3, 0), '3 old rounds removed.');
  assert.equal(removedText(1, 2), '1 old round and 2 Congress chambers removed.');
});

// Why: Undo must bring the removed rounds back without wiping a round the judge made after the delete.
test('removeOld takes whole records; putBack returns them and keeps what was made since', () => {
  const saved = { rooms: [round('r1', ago(40)), round('r2', ago(1))], cards: [card('c1', 'r1', ago(40)), card('c2', 'r2', ago(1))],
    congress: { v: 1, chambers: [{ id: 'ch1' }], sessions: [{ id: 's1', chamberId: 'ch1' }], prefs: { x: 1 } } };
  const { next, removed } = removeOld(saved, { roundIds: ['r1'], cardIds: ['c1'], chamberIds: ['ch1'], sessionIds: ['s1'] });
  assert.deepEqual(next.rooms.map((r) => r.id), ['r2']);
  assert.deepEqual(next.cards.map((c) => c.id), ['c2']);
  assert.deepEqual(next.congress, { v: 1, chambers: [], sessions: [], prefs: { x: 1 } });
  assert.deepEqual(saved.rooms.length, 2, 'the input is not changed');
  const later = { rooms: next.rooms.concat(round('r3', NOW)), cards: next.cards, congress: next.congress };
  const back = putBack(later, removed);
  assert.deepEqual(back.rooms.map((r) => r.id).sort(), ['r1', 'r2', 'r3']);
  assert.deepEqual(back.cards.map((c) => c.id).sort(), ['c1', 'c2']);
  assert.deepEqual(back.congress.chambers.map((c) => c.id), ['ch1']);
  assert.deepEqual(putBack(back, removed).rooms.length, 3, 'running it twice adds nothing twice');
});

// ---------- the start-up run ----------

function startRig(extra = {}) {
  const ui = fakeUi();
  const init = Object.assign({
    [LIFETIME_KEY]: JSON.stringify({ days: 30 }),
    [ROOMS_KEY]: JSON.stringify([round('r1', ago(40)), round('r2', ago(50)), round('r3', ago(60)), round('open', ago(60), { state: 'judging' }), round('new', ago(2))]),
    [CARDS_KEY]: JSON.stringify([card('c1', 'r1', ago(40)), card('c2', 'r2', ago(50)), card('c3', 'r3', ago(60)), card('c4', 'open', ago(60)), card('c5', 'new', ago(2))]),
    'policyJudge.rounds': '[1]',
  }, extra);
  const local = memStorage(init);
  const store = createEventsStore(ui, local, { nav: null });
  let refreshed = 0;
  const deps = { store, ui, now: () => NOW, refresh: () => { refreshed++; } };
  return { ui, local, store, init, deps, get refreshed() { return refreshed; } };
}

// Why: the judge must see what went and be able to take it back while the tab is open.
test('autoDeleteAtStart removes the old rounds, says "3 old rounds removed.", and Undo puts them back', () => {
  const rig = startRig();
  assert.equal(autoDeleteAtStart(rig.deps), 3);
  const ids = (k) => JSON.parse(rig.local.dump()[k]).map((x) => x.id);
  assert.deepEqual(ids(ROOMS_KEY), ['open', 'new']);
  assert.deepEqual(ids(CARDS_KEY), ['c4', 'c5']);
  assert.equal(rig.local.dump()['policyJudge.rounds'], '[1]', 'debate data is never touched');
  assert.equal(rig.local.dump()[CONGRESS_KEY], undefined, 'no Congress value is made');
  const t = rig.ui.toasts[0];
  assert.equal(t.msg, '3 old rounds removed.');
  assert.equal(t.opts.action.label, 'Undo');
  assert.equal(t.opts.action.name, 'Undo: 3 old rounds removed');
  t.opts.action.run();
  assert.deepEqual(ids(ROOMS_KEY).sort(), ['new', 'open', 'r1', 'r2', 'r3']);
  assert.deepEqual(ids(CARDS_KEY).sort(), ['c1', 'c2', 'c3', 'c4', 'c5']);
  assert.equal(rig.refreshed, 1);
  assert.equal(rig.ui.toasts.at(-1).msg, 'The removed rounds are back.');
  assert.equal(pendingPutBack(), null, 'nothing waits once they are back');
});

// Why: the toast lasts seconds and may show while the judge looks away; the rounds must still come back in this tab,
// next to any round made since.
test('after the toast, Settings can put the removed rounds back for the rest of the tab, keeping rounds made since', () => {
  const rig = startRig({ [CONGRESS_KEY]: JSON.stringify({ v: 1, chambers: [], sessions: [], prefs: { keep: 1 } }) });
  const congressBefore = rig.local.dump()[CONGRESS_KEY];
  autoDeleteAtStart(rig.deps);
  assert.equal(rig.local.dump()[CONGRESS_KEY], congressBefore, 'a value with nothing removed is not rewritten');
  assert.deepEqual(pendingPutBack(), { rounds: 3, chambers: 0 });
  const list = JSON.parse(rig.local.dump()[ROOMS_KEY]);
  rig.local.setItem(ROOMS_KEY, JSON.stringify(list.concat(round('made-later', NOW))));
  assert.equal(putBackRemoved(rig.deps), true);
  assert.deepEqual(JSON.parse(rig.local.dump()[ROOMS_KEY]).map((r) => r.id).sort(), ['made-later', 'new', 'open', 'r1', 'r2', 'r3']);
  assert.equal(putBackRemoved(rig.deps), false, 'a second put back does nothing');
  autoDeleteAtStart(rig.deps);
  forgetRemoved();
  assert.equal(pendingPutBack(), null);
});

// Why: a round whose ranks are copied and submitted but whose comments are still open is still being written.
test('a submitted round with ranks copied but comments open is kept', () => {
  const p = pick({ rooms: [round('r1', ago(400), { state: 'review', ranksCopiedAt: ago(400) })], cards: [card('c1', 'r1', ago(400))], days: 7 });
  assert.deepEqual(p.roundIds, []);
});

// Why: a failed save must never leave the judge with half the data gone and no word about it.
test('autoDeleteAtStart puts the data back when a save fails, and a broken value never stops the page', () => {
  const rig = startRig();
  const realSet = rig.local.setItem;
  let n = 0;
  rig.local.setItem = (k, v) => { if (k === CARDS_KEY && n++ === 0) throw new Error('full'); realSet(k, v); };
  const err = console.error; console.error = () => {};
  try {
    assert.equal(autoDeleteAtStart(rig.deps), 0);
    assert.deepEqual(JSON.parse(rig.local.dump()[ROOMS_KEY]).length, 5, 'the rounds went back');
    assert.deepEqual(JSON.parse(rig.local.dump()[CARDS_KEY]).length, 5, 'the cards were never changed');
    assert.equal(rig.ui.toasts.some((t) => t.opts.key === 'auto-delete'), false, 'no "removed" toast');
    assert.equal(pendingPutBack(), null);
    // Undo whose cards save fails: the rounds it saved go back out, so no round comes back without its card.
    const u = startRig();
    autoDeleteAtStart(u.deps);
    const set2 = u.local.setItem;
    u.local.setItem = (k, v) => { if (k === CARDS_KEY) throw new Error('full'); set2(k, v); };
    assert.equal(putBackRemoved(u.deps), false);
    assert.deepEqual(JSON.parse(u.local.dump()[ROOMS_KEY]).map((r) => r.id), ['open', 'new'], 'all or nothing');
    assert.equal(u.ui.toasts.at(-1).opts.kind, 'error');
    assert.deepEqual(pendingPutBack(), { rounds: 3, chambers: 0 }, 'kept for another try');
    u.local.setItem = set2;
    assert.equal(putBackRemoved(u.deps), true, 'the next try works');
    assert.equal(JSON.parse(u.local.dump()[CARDS_KEY]).length, 5);
    // Start-up save fails and the rollback fails too: an error toast offers Put back.
    const f = startRig();
    const set3 = f.local.setItem;
    f.local.setItem = (k, v) => { if (k === CARDS_KEY) throw new Error('full'); if (k === ROOMS_KEY && JSON.parse(v).length === 5) throw new Error('full'); set3(k, v); };
    assert.equal(autoDeleteAtStart(f.deps), 0);
    const t = f.ui.toasts.at(-1);
    assert.equal(t.opts.kind, 'error');
    assert.equal(t.opts.action.label, 'Put back');
    f.local.setItem = set3;
    t.opts.action.run();
    assert.equal(JSON.parse(f.local.dump()[ROOMS_KEY]).length, 5, 'Put back brings them all back');
    const broken = startRig({ [ROOMS_KEY]: '{not json', [CARDS_KEY]: '7' });
    assert.equal(autoDeleteAtStart(broken.deps), 0);
    assert.equal(autoDeleteAtStart({ store: { get() { throw new Error('blocked'); } }, ui: fakeUi(), now: () => NOW }), 0);
  } finally { console.error = err; }
});

// ---------- check a backup ----------

const backupText = (storage, opts = {}) => JSON.stringify(makeBackup(storage, Object.assign({ now: '2026-06-01T10:00:00.000Z', release: 'abc1234 2026-05-30' }, opts)));
const FULL = {
  [ROOMS_KEY]: JSON.stringify([round('r1', ago(10)), round('r2', ago(9))]),
  [DAYS_KEY]: JSON.stringify([{ id: 'd1', date: '2026-05-30' }, { id: 'd2', date: '2026-05-31' }, { id: 'd3', date: '2026-06-01' }]),
  [CONGRESS_KEY]: JSON.stringify({ v: 1, chambers: [{ id: 'ch1' }], sessions: [{ id: 's1', chamberId: 'ch1' }, { id: 's2', chamberId: 'ch1' }], prefs: {} }),
  [SETTINGS_KEY]: '{"theme":"dark"}',
};

// Why: a judge must see what a file holds before a restore replaces everything on the device.
test('backupSummary lists the days, rounds, chambers, release id and date in a backup', () => {
  const sum = backupSummary(readBackup(backupText(FULL)));
  assert.deepEqual(sum, { days: 3, rounds: 2, chambers: 1, sessions: 2, autoDelete: 0, release: 'abc1234 2026-05-30', date: '2026-06-01', includesKeys: false });
  assert.deepEqual(backupSummaryRows(sum).map((r) => r.label + ': ' + r.value), ['Saved on: 2026-06-01', 'Release: abc1234 2026-05-30', 'Days: 3', 'Rounds: 2',
    'Congress chambers: 1 (2 sessions)', 'Your AI key: Not in the file', 'Auto-delete in the file: Off (this device keeps its own choice)']);
  const bare = backupSummary(readBackup(JSON.stringify({ app: 'tabula-events', kind: 'backup', version: 1, storage: {} })));
  assert.deepEqual(backupSummaryRows(bare).slice(0, 2).map((r) => r.value), ['Not named in the file', 'Not named in the file'], 'an older file with no release id or date');
  assert.equal(bare.rounds, 0);
  assert.equal(deviceSummaryText(sum), '2 rounds, 1 Congress chamber');
  assert.equal(deviceSummaryText(bare), '0 rounds');
});

// A Settings screen with stand-ins for the page parts; it keeps both the click and the change handlers.
function screenRig(local, session = memStorage({})) {
  const ui = fakeUi();
  const handlers = {};
  let reloads = 0, html = '';
  const node = () => ({ focus() {}, textContent: '', innerHTML: '', checked: false, click() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => ({ value: 'defaults', textContent: '', disabled: false, hidden: false }) });
  const env = {
    el: { get innerHTML() { return html; }, set innerHTML(v) { html = v; }, addEventListener: (t, f) => { handlers[t] = f; }, removeEventListener() {}, querySelector: () => node() },
    ui, now: () => NOW,
    store: createEventsStore(ui, local, { nav: null }),
    settings: () => ({ theme: 'system', drawGapMin: 7, ranksDueMin: 10 }),
    saveSettings() {},
    ai: { gate: globalThis.TabulaCore.policy.gateFor({ record: null, now: NOW, off: false }), own: { hasKey: () => false, providerName: () => '', forget() {} } },
    reload: () => { reloads++; },
  };
  const prevSession = globalThis.sessionStorage;
  globalThis.sessionStorage = session;
  const screen = createSettingsScreen(env);
  screen.show();
  globalThis.sessionStorage = prevSession;
  const pickFile = async (text) => { await handlers.change({ target: { id: 'set-restore', value: 'x', files: [{ text: async () => text }] } }); };
  return { ui, env, session, pickFile, click: (id) => handlers.click({ target: { id } }), change: (t) => handlers.change({ target: t }), get html() { return html; }, get reloads() { return reloads; } };
}

// Why: checking a file must never change data; only Restore does, and Undo must put the device back.
test('Check a backup shows the contents and changes nothing until Restore; Undo puts the old data back', async () => {
  const before = { [ROOMS_KEY]: JSON.stringify([round('mine', ago(1))]), 'policyJudge.rounds': '[1]' };
  const local = memStorage(before);
  const rig = screenRig(local);
  assert.match(rig.html, /id="set-restore-btn">Check a backup<\/button>/);
  await rig.pickFile(backupText(FULL));
  assert.deepEqual(local.dump(), before, 'picking a file writes nothing');
  assert.equal(rig.ui.asks.length, 0, 'no dialog: the result shows on the screen');
  assert.match(rig.html, /<h3 id="set-check-h" tabindex="-1">This backup holds<\/h3>/);
  for (const want of ['<dt>Days</dt><dd>3</dd>', '<dt>Rounds</dt><dd>2</dd>', '<dt>Congress chambers</dt><dd>1 (2 sessions)</dd>', '<dt>Release</dt><dd>abc1234 2026-05-30</dd>', '<dt>Saved on</dt><dd>2026-06-01</dd>']) assert.ok(rig.html.includes(want), want);
  assert.match(rig.html, /Nothing changes until you tap Restore/);
  assert.match(rig.html, /\(now: 1 round\)/, 'it says what the device holds now');
  rig.click('set-check-close');
  assert.doesNotMatch(rig.html, /set-check-h/, 'Close hides the result');
  assert.deepEqual(local.dump(), before);
  await rig.pickFile(backupText(FULL));
  rig.ui.answers.push(false); // Cancel in the confirm
  await rig.click('set-check-restore');
  assert.equal(rig.ui.asks.at(-1).title, 'Restore this backup?');
  assert.deepEqual(rig.ui.asks.at(-1).buttons.map((x) => [x.value, x.kind]), [[false, undefined], [true, 'danger']]);
  assert.match(rig.ui.asks.at(-1).body.join(' '), /now: 1 round/);
  assert.deepEqual(local.dump(), before, 'Cancel changes nothing');
  rig.ui.answers.push(true);
  await rig.click('set-check-restore');
  const after = local.dump();
  assert.deepEqual(JSON.parse(after[ROOMS_KEY]).map((r) => r.id), ['r1', 'r2']);
  assert.equal(after['policyJudge.rounds'], '[1]');
  assert.equal(after[BACKUP_AT_KEY], String(NOW));
  assert.equal(rig.reloads, 1);
  const t = rig.ui.toasts.find((x) => x.msg === 'Backup restored.');
  assert.equal(t.opts.action.label, 'Undo');
  t.opts.action.run();
  assert.deepEqual(local.dump(), before, 'Undo puts every value back');
});

// Why: a bad or foreign file must give a plain error and leave the data alone.
test('Check a backup gives a plain error for a bad or foreign file and changes nothing', async () => {
  const cases = [
    ['not json', /not a Tabula backup \(it is not JSON\)/],
    [JSON.stringify({ app: 'tabula', kind: 'backup', version: 1, storage: {} }), /Tabula Debate backup\. Restore it in Tabula Debate/],
    [JSON.stringify({ app: 'other', kind: 'backup', version: 1, storage: {} }), /from another app/],
    [JSON.stringify({ app: 'tabula-events', kind: 'backup', version: 2, storage: {} }), /newer version/],
    [backupText({ [ROOMS_KEY]: '{"x":1}' }), /rounds in this backup are damaged/],
  ];
  for (const [text, want] of cases) {
    const before = { [ROOMS_KEY]: '[]' };
    const local = memStorage(before);
    const rig = screenRig(local);
    await rig.pickFile(text);
    assert.match(rig.html, want);
    assert.match(rig.html, /<h3 id="set-check-h" tabindex="-1">/, 'focus moves to the heading (no second alert)');
    assert.match(rig.html, /Nothing on this device changed\./);
    assert.doesNotMatch(rig.html, /set-check-restore/, 'no Restore button for a bad file');
    rig.ui.answers.push(true);
    await rig.click('set-check-restore');
    assert.deepEqual(local.dump(), before);
  }
  const unreadable = screenRig(memStorage({}));
  await unreadable.change({ id: 'set-restore', value: 'x', files: [{ text: async () => { throw new Error('io'); } }] });
  assert.match(unreadable.html, /This file could not be read/);
  assert.equal(checkHtml(null), '');
});

// Why: the setting must save in its own tabulaEvents.* key, so a backup carries it and Clear this device removes it.
test('picking an auto-delete choice saves it and says so', () => {
  const local = memStorage({});
  const rig = screenRig(local);
  rig.change({ name: 'set-auto', value: '90' });
  assert.equal(local.dump()[LIFETIME_KEY], '{"days":90}');
  assert.equal(rig.ui.toasts.at(-1).msg, 'Auto-delete is on: 90 days after the round.');
  assert.ok(LIFETIME_KEY.startsWith(PREFIX));
  rig.change({ name: 'set-auto', value: '0' });
  assert.equal(local.dump()[LIFETIME_KEY], '{"days":0}');
  assert.equal(rig.ui.toasts.at(-1).msg, 'Auto-delete is off.');
});

// ---------- wrap up the season ----------

// The download link the backup uses needs document and URL; stand in for them.
async function withDownload(fn) {
  const prevDoc = globalThis.document, prevURL = globalThis.URL.createObjectURL, prevTimer = globalThis.setTimeout;
  let downloads = 0;
  globalThis.document = { createElement: () => ({ click() { downloads++; } }) };
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.setTimeout = () => 0;
  try { await fn(() => downloads); } finally { globalThis.document = prevDoc; globalThis.URL.createObjectURL = prevURL; globalThis.setTimeout = prevTimer; }
}

// Why: the season's rounds must never be cleared unless the judge saved a backup or chose to skip it.
test('Wrap up the season: backup, confirm it saved, then Clear this device; Cancel at any step clears nothing', async () => {
  await withDownload(async (downloads) => {
    // Cancel at the first step, and at the "did it save?" step.
    for (const answers of [[null], ['backup', null]]) {
      const local = memStorage({ [ROOMS_KEY]: '[]' });
      const rig = screenRig(local);
      rig.ui.answers.push(...answers);
      await rig.click('set-wrap');
      assert.equal(local.dump()[ROOMS_KEY], '[]', JSON.stringify(answers) + ': nothing cleared');
      assert.equal(rig.ui.asks.some((a) => a.title === 'Clear this device?'), false);
    }
    // Backup, "Download again", "Yes, it saved", then the clear dialog, which the judge cancels.
    const local = memStorage({ [ROOMS_KEY]: '[]' });
    const rig = screenRig(local);
    const start = downloads();
    rig.ui.answers.push('backup', 'again', 'saved', null);
    await rig.click('set-wrap');
    assert.deepEqual(rig.ui.asks.map((a) => a.title), ['Wrap up the season', 'Did the backup save?', 'Did the backup save?', 'Clear this device?']);
    assert.equal(downloads() - start, 2, 'two backup files');
    assert.equal(local.dump()[BACKUP_AT_KEY], String(NOW));
    assert.match(rig.ui.asks[1].body.join(' '), /tabula-speech-events-backup-2026-11-25\.json/);
    const clear = rig.ui.asks[3];
    assert.ok(clear.body.join(' ').includes(CLEAR_WHAT));
    assert.match(clear.body.join(' '), /Your backup is saved/);
    assert.deepEqual(clear.buttons.map((b) => b.value), [null, 'clear'], 'no second backup offer');
    assert.equal(local.dump()[ROOMS_KEY], '[]', 'cancel in the clear dialog keeps the data');
    // The same path to the end clears the device.
    const rig2 = screenRig(local);
    rig2.ui.answers.push('backup', 'saved', 'clear');
    await rig2.click('set-wrap');
    assert.deepEqual(Object.keys(local.dump()).filter((k) => k.startsWith(PREFIX)), []);
  });
});

// Why: skipping the backup must be a choice the judge makes on purpose, and the clear dialog must say what that means.
test('Wrap up the season: "Skip the backup" goes to Clear this device and says the rounds cannot come back', async () => {
  await withDownload(async (downloads) => {
    const local = memStorage({ [ROOMS_KEY]: '[]', 'policyJudge.rounds': '[1]' });
    const rig = screenRig(local);
    rig.ui.answers.push('skip', 'clear');
    await rig.click('set-wrap');
    const first = rig.ui.asks[0];
    assert.deepEqual(first.buttons.map((b) => b.value), [null, 'skip', 'backup']);
    assert.equal(downloads(), 0, 'no file');
    assert.match(rig.ui.asks[1].body.join(' '), /You skipped the backup\. Once this tab closes, your rounds cannot come back\./);
    assert.deepEqual(local.dump(), { 'policyJudge.rounds': '[1]' });
    assert.ok(rig.ui.toasts.find((t) => t.opts.key === 'clear' && t.opts.action), 'the existing Clear this device Undo is there');
  });
});

// Why: an old backup with auto-delete on must not quietly remove the rounds it just brought back; a cleared or
// replaced device must never get auto-deleted rounds back.
test('restore keeps this device\'s auto-delete choice, and Restore or Clear forget the rounds waiting to go back', async () => {
  const before = { [ROOMS_KEY]: '[]' };
  const local = memStorage(before);
  const rig = screenRig(local);
  await rig.pickFile(backupText(Object.assign({}, FULL, { [LIFETIME_KEY]: '{"days":7}' })));
  assert.ok(rig.html.includes('<dt>Auto-delete in the file</dt><dd>7 days (this device keeps its own choice)</dd>'));
  const s = startRig();
  autoDeleteAtStart(s.deps);
  assert.ok(pendingPutBack());
  rig.ui.answers.push(true);
  await rig.click('set-check-restore');
  assert.equal(local.dump()[LIFETIME_KEY], undefined, 'the file\'s 7 days did not come in');
  assert.equal(pendingPutBack(), null, 'restore forgets the removed rounds');
  // With a choice on the device, the device's choice stays.
  const l2 = memStorage({ [LIFETIME_KEY]: '{"days":90}' });
  const r2 = screenRig(l2);
  await r2.pickFile(backupText(Object.assign({}, FULL, { [LIFETIME_KEY]: '{"days":7}' })));
  r2.ui.answers.push(true);
  await r2.click('set-check-restore');
  assert.equal(l2.dump()[LIFETIME_KEY], '{"days":90}');
  // Clear this device forgets them too.
  const s2 = startRig();
  autoDeleteAtStart(s2.deps);
  const r3 = screenRig(memStorage({}));
  r3.ui.answers.push('clear');
  await r3.click('set-clear');
  assert.equal(pendingPutBack(), null);
});

// Why: the page reads the AI key once at load; an Undo that changes the key must reload, or the page keeps a stale key.
test('restoring a backup with an AI key, then Undo, reloads the page', async () => {
  const KEY = 'tabulaEvents.aiKeys.v1';
  const before = { [ROOMS_KEY]: '[]' };
  const local = memStorage(before);
  const rig = screenRig(local);
  await rig.pickFile(backupText(Object.assign({}, FULL, { [KEY]: '{"anthropic":"k"}' }), { includeKeys: true }));
  assert.ok(rig.html.includes('<dt>Your AI key</dt><dd>In the file</dd>'));
  rig.ui.answers.push(true);
  await rig.click('set-check-restore');
  assert.equal(local.dump()[KEY], '{"anthropic":"k"}');
  const prevLoc = globalThis.location;
  let reloaded = 0;
  globalThis.location = { reload: () => { reloaded++; } };
  try { rig.ui.toasts.find((t) => t.msg === 'Backup restored.').opts.action.run(); } finally { globalThis.location = prevLoc; }
  assert.equal(reloaded, 1);
  assert.deepEqual(local.dump(), before);
});

// Why: after the toast is gone, the judge needs a plain way back in Settings.
test('Settings shows "Put them back" while removed rounds wait, and it brings them back', () => {
  const s = startRig();
  autoDeleteAtStart(s.deps);
  const rig = screenRig(s.local);
  assert.match(rig.html, /3 old rounds removed when the app started\.<\/span><button class="b" type="button" id="set-putback">Put them back<\/button>/);
  rig.click('set-putback');
  assert.equal(JSON.parse(s.local.dump()[ROOMS_KEY]).length, 5);
  assert.equal(rig.reloads, 1);
  assert.doesNotMatch(rig.html, /set-putback/);
  assert.equal(AUTO_DELETE_TOAST_KEY, 'auto-delete');
});

// Why: a day with no rounds left is clutter that still names a tournament; but a day still in use, or today, must stay.
test('a day emptied by auto-delete goes with its round-less cards, inside the same Undo; a day in use or today stays', () => {
  const D = (d) => dayOf(ago(d));
  const rooms = [round('r1', ago(40)), round('r2', ago(40)), round('r3', ago(40), { state: 'judging' }), round('r4', ago(40))];
  const cards = [
    card('c1', 'r1', ago(40), { dayId: 'dOld' }), card('cx', null, null, { dayId: 'dOld' }), // emptied: the day and its round-less card go
    card('c2', 'r2', ago(40), { dayId: 'dMixed' }), card('c3', 'r3', ago(40), { dayId: 'dMixed' }), // r3 still open: the day stays
    card('c4', 'r4', ago(40), { dayId: 'dToday' }), // a round from long ago on a day dated today: the day stays
  ];
  const dayList = [{ id: 'dOld', date: D(40) }, { id: 'dMixed', date: D(40) }, { id: 'dToday', date: D(0) }, { id: 'dHand', date: D(0) }];
  const p = pick({ rooms, cards, dayList });
  assert.deepEqual(p.roundIds, ['r1', 'r2', 'r4']);
  assert.deepEqual(p.dayIds, ['dOld']);
  assert.deepEqual(p.cardIds.sort(), ['c1', 'c2', 'c4', 'cx']);
  assert.deepEqual(pick({ rooms, cards, dayList: [{ id: 'dOld', date: 'bad' }] }).dayIds, [], 'a day with a bad date stays');

  const rig = startRig({ [ROOMS_KEY]: JSON.stringify(rooms), [CARDS_KEY]: JSON.stringify(cards), [DAYS_KEY]: JSON.stringify(dayList) });
  assert.equal(autoDeleteAtStart(rig.deps), 3);
  const ids = (k) => JSON.parse(rig.local.dump()[k]).map((x) => x.id);
  assert.deepEqual(ids(DAYS_KEY), ['dMixed', 'dToday', 'dHand']);
  assert.deepEqual(ids(CARDS_KEY), ['c3']);
  rig.ui.toasts[0].opts.action.run();
  assert.deepEqual(ids(DAYS_KEY).sort(), ['dHand', 'dMixed', 'dOld', 'dToday'], 'Undo brings the day back');
  assert.deepEqual(ids(CARDS_KEY).sort(), ['c1', 'c2', 'c3', 'c4', 'cx']);
  // With no day emptied, the days value is not rewritten.
  const quiet = startRig({ [DAYS_KEY]: '[{"id":"dHand","date":"2026-11-25"}]' });
  autoDeleteAtStart(quiet.deps);
  assert.equal(quiet.local.dump()[DAYS_KEY], '[{"id":"dHand","date":"2026-11-25"}]');
  forgetRemoved();
});

// Why: a malformed date must never turn an uncertain day record into an automatic deletion.
test('calendar-shaped invalid day dates stay on the device', () => {
  for (const date of ['2026-00-01', '2026-02-30', '2025-02-29', '2026-13-01']) {
    const result = pick({ rooms: [round('r1', ago(400))], cards: [card('c1', 'r1', ago(400), { dayId: 'bad-day' })], dayList: [{ id: 'bad-day', date }] });
    assert.deepEqual(result.dayIds, [], date);
  }
});

// Why: a slow file read must not replace the newer backup the judge has chosen to inspect.
test('the latest selected backup wins when an older file read finishes later', async () => {
  const rig = screenRig(memStorage({}));
  let finish;
  const slow = new Promise((resolve) => { finish = resolve; });
  rig.change({ id: 'set-restore', value: 'x', files: [{ text: () => slow }] });
  await rig.pickFile(backupText(FULL));
  finish(backupText({ [ROOMS_KEY]: JSON.stringify([round('slow', ago(1))]) }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(rig.html, /<dt>Rounds<\/dt><dd>2<\/dd>/);
});

// Why: closing a backup preview must cancel its pending read rather than reopen a panel the judge dismissed.
test('closing a pending backup check prevents its late result from appearing', async () => {
  const rig = screenRig(memStorage({}));
  let finish;
  const slow = new Promise((resolve) => { finish = resolve; });
  rig.change({ id: 'set-restore', value: 'x', files: [{ text: () => slow }] });
  rig.click('set-check-close');
  finish(backupText(FULL));
  await new Promise((resolve) => setImmediate(resolve));
  assert.doesNotMatch(rig.html, /id="set-check-h"/);
});

// Why: a restore whose rollback also fails must offer the original data instead of falsely reporting no change.
test('a failed restore and rollback retain the original snapshot for a later recovery', async () => {
  const before = { [ROOMS_KEY]: JSON.stringify([round('original', ago(1))]), [SETTINGS_KEY]: '{"theme":"dark"}' };
  const local = memStorage(before);
  const rig = screenRig(local);
  await rig.pickFile(backupText(FULL));
  const set = local.setItem;
  local.setItem = (key, value) => { if (key.startsWith(PREFIX)) throw new Error('app-data writes blocked'); set(key, value); };
  rig.ui.answers.push(true);
  const error = console.error; console.error = () => {};
  try { await rig.click('set-check-restore'); } finally { console.error = error; }
  assert.doesNotMatch(rig.ui.toasts.at(-1).msg, /Your data is as it was/);
  assert.match(rig.html, /Put original data back/);
  local.setItem = set;
  await rig.click('set-recover');
  assert.deepEqual(local.dump(), before);
  assert.doesNotMatch(rig.html, /id="set-recovery"/);
});

// Why: a single failed write must leave the original data intact when storage allows the rollback.
test('a failed restore that can roll back leaves all prior values unchanged', async () => {
  const before = { [ROOMS_KEY]: JSON.stringify([round('original', ago(1))]), [SETTINGS_KEY]: '{"theme":"dark"}' };
  const local = memStorage(before);
  const sessionBefore = { [KEYS_KEY]: '{"openai":"synthetic-rollback-tab-key"}' };
  const session = memStorage(sessionBefore), rig = screenRig(local, session);
  await rig.pickFile(backupText(FULL));
  const set = local.setItem;
  let failed = false, prepared = false;
  local.setItem = (key, value) => {
    if (!failed && key.startsWith(PREFIX)) {
      prepared = Object.keys(local.dump()).some((key) => key.startsWith(JOURNAL_PREFIX) && JSON.parse(local.dump()[key]).phase === 'pending');
      failed = true; throw new Error('quota during ordinary data write');
    }
    set(key, value);
  };
  rig.ui.answers.push(true);
  const error = console.error; console.error = () => {};
  try { await rig.click('set-check-restore'); } finally { console.error = error; }
  assert.equal(failed, true, 'the fixture rejected an actual ordinary data write');
  assert.equal(prepared, true, 'recovery was prepared before the rejected destructive write');
  assert.deepEqual(session.dump(), sessionBefore);
  assert.deepEqual(local.dump(), before);
  assert.match(rig.ui.toasts.at(-1).msg, /Your data is as it was/);
});

// Why: restoring settings must preserve all current timer and AI preferences, including the device's own deletion choice.
test('restore and Undo keep timer and AI settings complete', async () => {
  const settings = migrateSettings({ timerBig: true, timerVibrate: true, aiPreferences: { defaults: { mode: 'custom', style: 'Short feedback' } }, feedbackEdit: { mode: 'custom', request: 'Use short sentences' }, roomJudging: { priorities: 'Evidence first' } });
  const before = { [SETTINGS_KEY]: JSON.stringify(settings), [LIFETIME_KEY]: '{"days":30}' };
  const local = memStorage(before), rig = screenRig(local);
  const incoming = { ...FULL, [SETTINGS_KEY]: JSON.stringify({ ...settings, timerBig: false }), [LIFETIME_KEY]: '{"days":7}' };
  await rig.pickFile(backupText(incoming));
  rig.ui.answers.push(true); await rig.click('set-check-restore');
  assert.deepEqual(JSON.parse(local.dump()[SETTINGS_KEY]), { ...settings, timerBig: false });
  assert.equal(local.dump()[LIFETIME_KEY], '{"days":30}');
  rig.ui.toasts.find((toast) => toast.msg === 'Backup restored.').opts.action.run();
  assert.deepEqual(local.dump(), before);
});

// Why: a restored key must become active without losing Undo or making a provider request.
test('restore refreshes the in-memory AI key and Undo restores both key stores', async () => {
  const before = { [KEYS_KEY]: '{"anthropic":"synthetic-local-before"}' };
  const sessionBefore = { [KEYS_KEY]: '{"anthropic":"synthetic-tab-before"}' };
  const local = memStorage(before), session = memStorage(sessionBefore);
  const rig = screenRig(local, session);
  let calls = 0;
  const own = createOwnKey({ local: rig.env.store, session: createEventsStore(rig.ui, session, { nav: null }),
    policy: globalThis.TabulaCore.policy, online: () => false, fetch: async () => { calls++; throw new Error('no provider call expected'); } });
  rig.env.ai.own = own;
  assert.equal(own.provider(), 'anthropic');
  await rig.pickFile(backupText({ [KEYS_KEY]: '{"openai":"synthetic-restored"}' }, { includeKeys: true }));
  rig.ui.answers.push(true); await rig.click('set-check-restore');
  assert.equal(own.provider(), 'openai');
  assert.equal(session.getItem(KEYS_KEY), null);
  rig.ui.toasts.find((toast) => toast.msg === 'Backup restored.').opts.action.run();
  assert.equal(own.provider(), 'anthropic');
  assert.deepEqual(local.dump(), before);
  assert.deepEqual(session.dump(), sessionBefore);
  assert.equal(calls, 0);
});

// Why: a failed clear must not discard the only in-tab recovery for rounds removed when the app started.
test('failed Clear keeps auto-deleted rounds recoverable after storage recovers', async () => {
  const start = startRig();
  autoDeleteAtStart(start.deps);
  const pending = pendingPutBack();
  const rig = screenRig(start.local);
  const remove = start.local.removeItem;
  start.local.removeItem = () => { throw new Error('blocked'); };
  rig.ui.answers.push('clear');
  const error = console.error; console.error = () => {};
  try { await rig.click('set-clear'); } finally { console.error = error; }
  assert.deepEqual(pendingPutBack(), pending);
  start.local.removeItem = remove;
  await rig.click('set-recover');
  assert.equal(putBackRemoved(start.deps), true);
  assert.equal(JSON.parse(start.local.dump()[ROOMS_KEY]).length, 5);
});

// Why: a damaged Congress value must not be presented as an empty chamber list and then overwrite good device data.
test('Check a backup refuses damaged Congress records without changing the device', async () => {
  for (const value of ['not json', 'null', '[]', '{"chambers":"bad"}', '{"sessions":7}']) {
    const before = { [ROOMS_KEY]: '[]', [CONGRESS_KEY]: '{"v":1,"chambers":[],"sessions":[],"prefs":{}}' };
    const local = memStorage(before), rig = screenRig(local);
    await rig.pickFile(backupText({ [CONGRESS_KEY]: value }));
    assert.match(rig.html, /Congress data in this backup is damaged/);
    assert.doesNotMatch(rig.html, /id="set-check-restore"/);
    assert.deepEqual(local.dump(), before);
  }
});

// Why: a second destructive flow must wait until the original snapshot is safe again.
test('pending restore recovery blocks Clear and Wrap up before either asks or writes', async () => {
  for (const action of ['set-clear', 'set-wrap']) {
    const before = { [ROOMS_KEY]: JSON.stringify([round('original', ago(1))]),
      [SETTINGS_KEY]: JSON.stringify(migrateSettings({ timerBig: true, timerVibrate: true, aiPreferences: { defaults: { mode: 'custom', style: 'Keep my detail' } } })) };
    const local = memStorage(before), rig = screenRig(local);
    await rig.pickFile(backupText(FULL));
    const set = local.setItem;
    local.setItem = (key, value) => { if (key === SETTINGS_KEY) throw new Error('blocked setting'); set(key, value); };
    const error = console.error; console.error = () => {};
    try {
      rig.ui.answers.push(true); await rig.click('set-check-restore');
      assert.equal(Object.keys(local.dump()).filter((key) => key.startsWith(PREFIX)).length, 1, 'failed rollback left only part of the original data');
      assertRecoveryJournal(local, before);
      const partial = local.dump(), asks = rig.ui.asks.length;
      rig.ui.answers.push(...(action === 'set-wrap' ? ['skip', 'clear'] : ['clear']));
      await rig.click(action);
      assert.equal(rig.ui.asks.length, asks, action + ' is blocked before a confirmation can start');
      assert.deepEqual(local.dump(), partial, action + ' makes no storage change');
      assert.match(rig.html, /id="set-recovery"/);
    } finally { console.error = error; }
  }
});

// Why: repeated failures and dismissed messages must not replace the sole complete copy with a later partial snapshot.
test('recovery keeps the earliest complete snapshot through Clear, Wrap up, dismiss and failed retries', async () => {
  const settings = migrateSettings({ timerBig: true, timerVibrate: true, aiPreferences: { defaults: { mode: 'custom', style: 'Original AI style' } }, roomJudging: { priorities: 'Original priorities' } });
  const before = { [ROOMS_KEY]: JSON.stringify([round('original', ago(1))]), [SETTINGS_KEY]: JSON.stringify(settings),
    [KEYS_KEY]: '{"anthropic":"synthetic-original-key"}', [LIFETIME_KEY]: '{"days":30}' };
  const sessionBefore = { [KEYS_KEY]: '{"openai":"synthetic-original-tab-key"}' };
  const local = memStorage(before), session = memStorage(sessionBefore), rig = screenRig(local, session);
  await rig.pickFile(backupText(FULL));
  const set = local.setItem, remove = local.removeItem;
  let blockedSettings = true, blockedRemoval = false;
  local.setItem = (key, value) => { if (blockedSettings && key === SETTINGS_KEY) throw new Error('blocked setting'); set(key, value); };
  local.removeItem = (key) => { if (blockedRemoval) throw new Error('blocked removal'); remove(key); };
  const error = console.error; console.error = () => {};
  try {
    rig.ui.answers.push(true); await rig.click('set-check-restore');
    assert.equal(Object.keys(local.dump()).filter((key) => key.startsWith(PREFIX)).length, 1, 'the live store is partial but recovery holds the complete original');
    assertRecoveryJournal(local, before, 'synthetic-original-tab-key');
    blockedRemoval = true;
    for (const action of ['set-clear', 'set-wrap']) {
      rig.ui.answers.push(...(action === 'set-wrap' ? ['skip', 'clear'] : ['clear']));
      await rig.click(action);
      rig.ui.answers.length = 0;
    }
    rig.ui.toasts.length = 0; // Messages have been dismissed; the view-level recovery must remain.
    await rig.click('set-recover'); await rig.click('set-recover');
    assert.match(rig.html, /id="set-recovery"/);
    blockedRemoval = false; blockedSettings = false;
    await rig.click('set-recover');
    assert.deepEqual(local.dump(), before, 'every original key, including timer/AI state, returns');
    assert.deepEqual(session.dump(), sessionBefore);
    assert.equal(JSON.parse(local.dump()[SETTINGS_KEY]).timerBig, true);
    assert.equal(JSON.parse(local.dump()[SETTINGS_KEY]).aiPreferences.defaults.style, 'Original AI style');
    assert.doesNotMatch(rig.html, /id="set-recovery"/);
  } finally { console.error = error; }
});

// Why: an older Undo must not bypass pending recovery, write a different snapshot, or reload away the only complete copy.
for (const source of ['restore', 'clear']) test(`a stale ${source} Undo waits for recovery and cannot reload or overwrite its snapshot`, async () => {
  const initial = { [ROOMS_KEY]: JSON.stringify([round('initial', ago(1))]), [SETTINGS_KEY]: JSON.stringify(migrateSettings({ timerBig: false })),
    [KEYS_KEY]: '{"anthropic":"synthetic-initial-key"}' };
  const local = memStorage(initial), rig = screenRig(local);
  if (source === 'restore') {
    await rig.pickFile(backupText({ ...FULL, [KEYS_KEY]: '{"openai":"synthetic-current-key"}' }, { includeKeys: true }));
    rig.ui.answers.push(true); await rig.click('set-check-restore');
  } else {
    rig.ui.answers.push('clear'); await rig.click('set-clear');
  }
  const staleUndo = rig.ui.toasts.find((toast) => toast.opts.key === source && toast.opts.action).opts.action.run;
  if (source === 'clear') {
    local.setItem(ROOMS_KEY, JSON.stringify([round('new-work-after-clear', ago(1))]));
    local.setItem(SETTINGS_KEY, JSON.stringify(migrateSettings({ timerBig: true, timerVibrate: true, aiPreferences: { defaults: { mode: 'custom', style: 'Current saved style' } } })));
    local.setItem(KEYS_KEY, '{"openai":"synthetic-current-key"}');
  }
  const earliest = local.dump(), earliestSession = rig.session.dump();
  await rig.pickFile(backupText({ ...FULL, [ROOMS_KEY]: JSON.stringify([round('changed-again', ago(2))]) }));
  const set = local.setItem;
  let blocked = true;
  local.setItem = (key, value) => { if (blocked && key === SETTINGS_KEY) throw new Error('blocked setting'); set(key, value); };
  const error = console.error; console.error = () => {};
  try {
    rig.ui.answers.push(true); await rig.click('set-check-restore');
    assert.match(rig.html, /id="set-recovery"/);
    const partial = local.dump();
    blocked = false; // Storage recovered, but the retained snapshot must still be restored before any other action.
    const location = globalThis.location;
    let reloads = 0;
    globalThis.location = { reload: () => { reloads++; } };
    try { staleUndo(); } finally { globalThis.location = location; }
    assert.equal(reloads, 0, 'a stale Undo cannot discard in-tab recovery with a page reload');
    assert.deepEqual(local.dump(), partial, 'a stale Undo makes no write while recovery is pending');
    await rig.click('set-recover');
    assert.deepEqual(local.dump(), earliest);
    assert.deepEqual(rig.session.dump(), earliestSession);
    assert.doesNotMatch(rig.html, /id="set-recovery"/);
  } finally { console.error = error; }
});

// Why: recovery created while a dialog waits must stop the resumed action before it writes, downloads or clears the retained copy.
for (const flow of ['restore', 'clear-backup', 'wrap-backup', 'wrap-again', 'wrap-saved']) test(`pending ${flow} confirmation rechecks recovery before it resumes`, async () => {
  await withDownload(async (downloads) => {
    const settings = migrateSettings({ timerBig: true, timerVibrate: true, aiPreferences: { defaults: { mode: 'custom', style: 'Earliest saved style' } } });
    const original = { [ROOMS_KEY]: JSON.stringify([round('original', ago(1))]), [SETTINGS_KEY]: JSON.stringify(settings),
      [KEYS_KEY]: '{"anthropic":"synthetic-original-key"}', [LIFETIME_KEY]: '{"days":30}' };
    const local = memStorage(original), rig = screenRig(local);
    await rig.pickFile(backupText(FULL));
    rig.ui.answers.push(true); await rig.click('set-check-restore');
    const undo = rig.ui.toasts.find((toast) => toast.msg === 'Backup restored.').opts.action.run;
    await rig.pickFile(backupText({ [ROOMS_KEY]: JSON.stringify([round('waiting-backup', ago(2))]), [SETTINGS_KEY]: '{"theme":"light"}' }));
    let resume;
    rig.ui.ask = (options) => {
      rig.ui.asks.push(options);
      if ((flow === 'wrap-again' || flow === 'wrap-saved') && options.title === 'Wrap up the season') return Promise.resolve('backup');
      if (!resume) return new Promise((resolve) => { resume = resolve; });
      return Promise.resolve(null);
    };
    const action = flow === 'restore' ? 'set-check-restore' : flow === 'clear-backup' ? 'set-clear' : 'set-wrap';
    const pending = rig.click(action);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(typeof resume, 'function', 'the real view is waiting for its confirmation');
    const set = local.setItem;
    let blocked = true;
    local.setItem = (key, value) => { if (blocked && key === SETTINGS_KEY) throw new Error('blocked setting'); set(key, value); };
    const error = console.error; console.error = () => {};
    try {
      undo(); // The toast action is reachable while the other confirmation waits.
      assert.match(rig.html, /id="set-recovery"/);
      const partial = local.dump(), downloadsBefore = downloads(), asksBefore = rig.ui.asks.length;
      blocked = false;
      resume(flow === 'restore' ? true : flow === 'wrap-again' ? 'again' : flow === 'wrap-saved' ? 'saved' : 'backup');
      await pending;
      assert.deepEqual(local.dump(), partial, 'resuming the confirmation cannot write over pending recovery');
      assert.equal(downloads(), downloadsBefore, 'resuming cannot export the partial store as a new backup');
      assert.equal(rig.ui.asks.length, asksBefore, 'resuming cannot start another confirmation during recovery');
      assert.match(rig.html, /id="set-recovery"/);
      await rig.click('set-recover');
      assert.deepEqual(local.dump(), original, 'all original keys and AI/timer settings remain recoverable');
      assert.doesNotMatch(rig.html, /id="set-recovery"/);
    } finally { console.error = error; }
  });
});

// The new metadata is checked explicitly: it must not be hidden by a narrower fixture dump.
function assertRecoveryJournal(local, original, tabOnly = 'synthetic-no-tab-key') {
  const all = local.dump(), journal = Object.keys(all).filter((key) => key.startsWith(JOURNAL_PREFIX));
  assert.equal(journal.length, 1, 'one durable journal protects the incomplete operation');
  assert.deepEqual(Object.keys(all).sort(), [ROOMS_KEY, journal[0]].sort(), 'the sole other key is the expected recovery journal');
  const saved = JSON.parse(all[journal[0]]);
  assert.deepEqual(saved.before, original, 'the complete original snapshot is durable');
  assert.equal(saved.scope, 'local');
  assert.equal(JSON.stringify(saved).includes(tabOnly), false, 'a tab-only key is absent from local recovery');
  assert.equal('sessionBefore' in saved || 'sessionAfter' in saved, false);
}

// Why: reading only part of either store cannot provide the complete original required for Clear or Restore recovery.
for (const source of ['local', 'session']) test(`Clear aborts before any write when the ${source} original snapshot cannot be read`, async () => {
  const local = memStorage({ [ROOMS_KEY]: JSON.stringify([round('original', ago(1))]), [SETTINGS_KEY]: '{"timerBig":true}' });
  const session = memStorage({ [KEYS_KEY]: '{"openai":"synthetic-tab-only"}' }), rig = screenRig(local, session);
  const localBefore = local.dump(), sessionBefore = session.dump(), storage = source === 'local' ? local : session, get = storage.getItem;
  storage.getItem = (key) => { if (key === (source === 'local' ? SETTINGS_KEY : KEYS_KEY)) throw new Error('original read refused'); return get(key); };
  rig.ui.answers.push('clear');
  await rig.click('set-clear');
  assert.deepEqual(local.dump(), localBefore);
  assert.deepEqual(session.dump(), sessionBefore);
  assert.equal(rig.reloads, 0);
  assert.match(rig.ui.toasts.at(-1).msg, /complete device data could not be read/);
  assert.equal(Object.keys(local.dump()).some((key) => key.startsWith(JOURNAL_PREFIX)), false);
});

// Why: copying critique-only comments closes that view but does not prove the judge submitted its ballot.
test('critique-only rounds without an actual submission marker survive every auto-delete age', () => {
  const critique = round('critique', ago(400), { profile: { critiqueOnly: true } });
  for (const days of AUTO_DELETE_DAYS) {
    for (const submittedAt of [null, undefined, '', NaN]) {
      const result = pick({ rooms: [critique], cards: [card('critique-card', critique.id, submittedAt)], days });
      assert.deepEqual(result.roundIds, [], String(submittedAt) + ': no submission, no deletion');
      assert.deepEqual(result.cardIds, []);
    }
    assert.deepEqual(pick({ rooms: [critique], cards: [card('critique-card', critique.id, ago(400))], days }).roundIds, ['critique']);
    assert.deepEqual(pick({ rooms: [{ ...critique, state: 'review' }], cards: [card('critique-card', critique.id, ago(400))], days }).roundIds, []);
  }
});

async function withDownloadContents(run) {
  const doc = globalThis.document, makeUrl = globalThis.URL.createObjectURL, timer = globalThis.setTimeout;
  const blobs = [];
  globalThis.document = { createElement: () => ({ click() {} }) };
  globalThis.URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:synthetic-original'; };
  globalThis.setTimeout = () => 0;
  try { await run(async () => JSON.parse(await blobs.at(-1).text())); }
  finally { globalThis.document = doc; globalThis.URL.createObjectURL = makeUrl; globalThis.setTimeout = timer; }
}

// Why: completing cleanup of a committed change must keep its result, its true original download and its normal Undo.
for (const action of ['clear', 'restore']) test(`committed ${action} cleanup preserves original download and installs normal Undo after recovery`, async () => {
  await withDownloadContents(async (downloaded) => {
    const before = { [ROOMS_KEY]: JSON.stringify([round('original', ago(1))]), [SETTINGS_KEY]: JSON.stringify(migrateSettings({ timerBig: true, aiPreferences: { defaults: { mode: 'custom', style: 'Original style' } } })),
      [KEYS_KEY]: '{"anthropic":"synthetic-remembered-original"}', 'policyJudge.foreign': 'untouched' };
    const tabBefore = { [KEYS_KEY]: '{"openai":"synthetic-tab-original"}' }, local = memStorage(before), session = memStorage(tabBefore), rig = screenRig(local, session);
    if (action === 'restore') await rig.pickFile(backupText(FULL));
    const remove = local.removeItem;
    local.removeItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('only local journal removal refused'); remove(key); };
    rig.ui.answers.push(action === 'clear' ? 'clear' : true);
    const err = console.error; console.error = () => {};
    try { await rig.click(action === 'clear' ? 'set-clear' : 'set-check-restore'); }
    finally { console.error = err; }
    assert.equal(rig.env.store.journal.state().phase, 'after');
    assert.match(rig.html, /Finish your saved change/);
    const committed = Object.fromEntries(Object.entries(local.dump()).filter(([key]) => key.startsWith(PREFIX)));
    if (action === 'clear') assert.deepEqual(committed, {});
    else assert.equal(JSON.parse(committed[ROOMS_KEY]).length, 2);
    await rig.click('set-recovery-backup');
    const file = await downloaded(), original = { ...before }; delete original[KEYS_KEY]; delete original['policyJudge.foreign'];
    assert.deepEqual(file.storage, original);
    assert.equal(JSON.stringify(file).includes('synthetic-remembered-original'), false);
    assert.equal(JSON.stringify(file).includes('synthetic-tab-original'), false);
    assert.equal(JSON.stringify(file).includes(JOURNAL_PREFIX), false);
    local.removeItem = remove;
    await rig.click('set-recover');
    assert.deepEqual(Object.fromEntries(Object.entries(local.dump()).filter(([key]) => key.startsWith(PREFIX))), committed, 'cleanup keeps committed B');
    assert.doesNotMatch(rig.html, /id="set-recovery"/);
    const undo = rig.ui.toasts.findLast((toast) => toast.opts.action?.name === (action === 'clear' ? 'Undo: clear this device' : 'Undo: restore backup'));
    assert.ok(undo, 'the ordinary successful action remains undoable after delayed completion');
    const location = globalThis.location; let reloads = 0;
    globalThis.location = { reload() { reloads++; } };
    try { undo.opts.action.run(); } finally { globalThis.location = location; }
    assert.deepEqual(local.dump(), before);
    assert.deepEqual(session.dump(), tabBefore);
    if (action === 'clear') assert.equal(reloads, 1);
  });
});

// Why: a cleanup fault after committed auto-delete must not be mistaken for a failed delete and implicitly put rounds back.
test('auto-delete cleanup keeps committed deletion and restores its normal Undo after cleanup', () => {
  const r = startRig(), remove = r.local.removeItem;
  r.local.removeItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('cleanup refused'); remove(key); };
  const err = console.error; console.error = () => {};
  try { assert.equal(autoDeleteAtStart(r.deps), 3); } finally { console.error = err; }
  assert.equal(r.store.journal.state().phase, 'after');
  assert.deepEqual(JSON.parse(r.local.dump()[ROOMS_KEY]).map((round) => round.id), ['open', 'new']);
  assert.deepEqual(pendingPutBack(), { rounds: 3, chambers: 0 });
  r.local.removeItem = remove;
  const result = r.store.journal.recover();
  assert.equal(result.phase, 'after');
  assert.equal(finishLifetimeRecovery(result), true);
  const undo = r.ui.toasts.findLast((toast) => toast.opts.action?.name === 'Undo: 3 old rounds removed');
  assert.ok(undo);
  undo.opts.action.run();
  assert.deepEqual(JSON.parse(r.local.dump()[ROOMS_KEY]).map((round) => round.id).sort(), ['new', 'open', 'r1', 'r2', 'r3']);
  assert.deepEqual(JSON.parse(r.local.dump()[CARDS_KEY]).map((card) => card.id).sort(), ['c1', 'c2', 'c3', 'c4', 'c5']);
  assert.equal(pendingPutBack(), null);
});

// Why: committed Put back must finish as a success after cleanup rather than keep an obsolete pending recovery action.
test('Put back cleanup keeps restored rounds and clears its pending action after cleanup', () => {
  const r = startRig(); autoDeleteAtStart(r.deps);
  const remove = r.local.removeItem;
  r.local.removeItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('cleanup refused'); remove(key); };
  const err = console.error; console.error = () => {};
  try { assert.equal(putBackRemoved(r.deps), false); } finally { console.error = err; }
  assert.equal(r.store.journal.state().phase, 'after');
  assert.equal(JSON.parse(r.local.dump()[ROOMS_KEY]).length, 5);
  r.local.removeItem = remove;
  const result = r.store.journal.recover();
  assert.equal(result.phase, 'after');
  assert.equal(finishLifetimeRecovery(result), true);
  assert.equal(JSON.parse(r.local.dump()[ROOMS_KEY]).length, 5);
  assert.equal(pendingPutBack(), null);
  assert.equal(r.ui.toasts.at(-1).msg, 'The removed rounds are back.');
});

// Why: a committed Restore delayed by cleanup must activate its restored key before showing success or offering Undo.
test('Restore cleanup activates the committed key and normal Undo restores both original key stores without provider calls', async () => {
  const before = { [KEYS_KEY]: '{"anthropic":"synthetic-local-before-cleanup"}', [SETTINGS_KEY]: '{"timerBig":true}' };
  const tabBefore = { [KEYS_KEY]: '{"anthropic":"synthetic-tab-before-cleanup"}' }, local = memStorage(before), session = memStorage(tabBefore), rig = screenRig(local, session);
  let calls = 0;
  const own = createOwnKey({ local: rig.env.store, session: createEventsStore(rig.ui, session, { nav: null }), policy: globalThis.TabulaCore.policy,
    online: () => false, fetch: async () => { calls++; throw new Error('no real provider request'); } });
  rig.env.ai.own = own;
  await rig.pickFile(backupText({ [KEYS_KEY]: '{"openai":"synthetic-restored-after-cleanup"}' }, { includeKeys: true }));
  const remove = local.removeItem;
  local.removeItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('only cleanup failed'); remove(key); };
  rig.ui.answers.push(true);
  const error = console.error; console.error = () => {};
  try { await rig.click('set-check-restore'); } finally { console.error = error; }
  assert.equal(rig.env.store.journal.state().phase, 'after');
  local.removeItem = remove;
  await rig.click('set-recover');
  assert.equal(own.provider(), 'openai');
  const undo = rig.ui.toasts.findLast((toast) => toast.opts.action?.name === 'Undo: restore backup');
  assert.ok(undo);
  const location = globalThis.location; globalThis.location = { reload() {} };
  try { undo.opts.action.run(); } finally { globalThis.location = location; }
  assert.equal(own.provider(), 'anthropic');
  assert.deepEqual(local.dump(), before);
  assert.deepEqual(session.dump(), tabBefore);
  assert.equal(calls, 0);
});
