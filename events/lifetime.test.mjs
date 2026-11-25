// Why: if these rules break, auto-delete can remove a round a judge still needs (open comments, not yet submitted, an open Congress chamber) or a restore can change data before the judge agrees.
// Tests for data lifetime in Speech Events (Settings → Data): auto-delete old rounds, Check a backup, and Wrap up the
// season. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import '../core/policy.js'; // a head file: it sets globalThis.TabulaCore.policy, which the Settings screen reads
import { createEventsStore, PREFIX, ROOMS_KEY, CARDS_KEY, DAYS_KEY, SETTINGS_KEY, BACKUP_AT_KEY } from './js/store.js';
import { CONGRESS_KEY } from './congress/store.js';
import { makeBackup, readBackup, CLEAR_WHAT } from './js/settings.js';
import { createSettingsScreen, settingsHtml, checkHtml, AUTO_DELETE_CHOICES } from './js/settings-screen.js';
import { LIFETIME_KEY, AUTO_DELETE_TOAST_KEY, pendingPutBack, forgetRemoved, putBackRemoved, AUTO_DELETE_DAYS, autoDeleteDaysOf, lifetimeValue, calendarDays, pickOld, removeOld, putBack, removedText, autoDeleteAtStart,
  backupSummary, backupSummaryRows, autoDeleteHelp, autoDeletePaused, deviceSummaryText } from './js/lifetime.js';

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
function screenRig(local) {
  const ui = fakeUi();
  const handlers = {};
  let reloads = 0, html = '';
  const node = () => ({ focus() {}, textContent: '', innerHTML: '', checked: false, click() {} });
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
  globalThis.sessionStorage = memStorage({});
  const screen = createSettingsScreen(env);
  screen.show();
  globalThis.sessionStorage = prevSession;
  const pickFile = async (text) => { await handlers.change({ target: { id: 'set-restore', value: 'x', files: [{ text: async () => text }] } }); };
  return { ui, env, pickFile, click: (id) => handlers.click({ target: { id } }), change: (t) => handlers.change({ target: t }), get html() { return html; }, get reloads() { return reloads; } };
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
