// Tests for step E11 (docs/events/LANDING.md §4.1; MODELS.md §4.3; primitive N6): Impromptu, with prep in the room and
// one shared limit for prep and speech (events/js/prep.js and the timer card in events/js/timer-view.js).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDriver } from '../core/clock.js';
import { loadEventData } from './js/data.js';
import { ENABLED_EVENTS, createRoom, updateEntry, entryOf, rosterAction } from './js/room.js';
import { limitOf, graceOf, startLeft, stoppedTiming, timerFace, adjustTiming, restoreRoom } from './js/timer.js';
import {
  hasSharedPrep, prepUsedAt, speechLimit, totalUsedAt, prepPhase, prepStartLeft, stoppedPrep, adjustPrep, resetAll, sharedFace,
  restoreSharedRoom,
} from './js/prep.js';
import { timerHtml, rowTimeHtml } from './js/timer-view.js';
import { eventChoices } from './js/setup-screen.js';
import { printModel } from './js/ballot.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const IMP = DATA.events.get('imp');
const USX = DATA.events.get('usx');
const L = limitOf(IMP); // 420: 7:00 for prep and speech together (NSDA)
const T0 = 1_800_000_000_000;
let n = 0;
const makeId = (p) => p + (++n);
const impRoom = (event) => createRoom({ event: event || IMP, profile: JSON.parse(JSON.stringify(DATA.profiles.get('nsda-district'))), entries: ['A12', 'B07'].map((code) => ({ code })), round: 'Round 1', now: T0, makeId });
const fakeTimers = { setInterval: () => 1, clearInterval: () => {} };

// The Room screen's two clocks for one entry, as timer-view.js wires them: a prep driver and a speech driver that keep
// their runs on the entry (timing.prepRun and timing.run), with a clock the test moves.
function clocks(state, id) {
  const grace = graceOf(state.room);
  const change = (fn) => { state.room = updateEntry(state.room, id, fn, state.now); };
  const timing = () => entryOf(state.room, id).timing;
  const prep = createDriver({
    kind: 'prep', now: () => state.now, timers: fakeTimers,
    get: () => timing().prepRun || null,
    set: (prepRun) => change((e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { prepRun }) })),
    onStop: (run, left) => change((e) => Object.assign({}, e, { timing: stoppedPrep(e.timing, run, left, L, state.now) })),
  });
  const speech = createDriver({
    kind: 'speech', now: () => state.now, timers: fakeTimers,
    get: () => timing().run || null,
    set: (run) => change((e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { run }) })),
    onStop: (run, left) => change((e) => Object.assign({}, e, { status: 'done', timing: stoppedTiming(e.timing, run, left, speechLimit(e.timing, state.now, L), grace, state.now) })),
  });
  return {
    startPrep: () => { const left = prepStartLeft(timing(), state.now, L); prep.start({ kind: 'prep', startLeft: left, startedAt: state.now }, left); },
    // "Speech started": prep stops, the speech starts on what is left of the shared limit.
    speechStarted: () => { if (timing().prepRun) prep.stop(); speech.start({ kind: 'speech' }, startLeft(timing(), state.now, speechLimit(timing(), state.now, L))); },
    stopSpeech: () => speech.stop(),
    wait: (sec) => { state.now += sec * 1000; },
  };
}

// Why: LANDING.md E11's done-check, "the shared 7:00 covers prep and speech": if prep did not come off the speech, an
// impromptu speaker with 2:00 of prep could talk 7:00 more and never be flagged, and the "no rank 1" rule would fail.
test('the shared 7:00 covers prep and speech: prep comes off the speech, and over grace counts the total', () => {
  const state = { room: impRoom(), now: T0 };
  const id = state.room.entries[0].id;
  const c = clocks(state, id);
  c.startPrep();
  c.wait(90);
  assert.equal(sharedFace(entryOf(state.room, id), L, 30, state.now).digits, '5:30', 'prep counts the shared time down');
  c.speechStarted();
  let face = sharedFace(entryOf(state.room, id), L, 30, state.now);
  assert.equal(face.phase, 'speech');
  assert.equal(face.digits, '5:30', 'the speech starts with what prep left');
  assert.equal(entryOf(state.room, id).timing.prepMs, 90000);
  c.wait(330);
  face = sharedFace(entryOf(state.room, id), L, 30, state.now);
  assert.equal(face.stage, 'last', 'still inside the limit at exactly 0:00 (the last-minute stage)');
  assert.equal(face.digits, '0:00', 'at 1:30 prep + 5:30 speech the shared 7:00 is used');
  c.wait(31);
  face = sharedFace(entryOf(state.room, id), L, 30, state.now);
  assert.equal(face.stage, 'over', '7:31 in all is past the 30 s grace');
  assert.equal(face.total, 451);
  c.stopSpeech();
  const t = entryOf(state.room, id).timing;
  assert.equal(t.usedMs, 361000, 'the speech part is 6:01');
  assert.equal(t.overLimit, true);
  assert.equal(t.overGrace, true, 'the sticky flag is set from the shared limit');
  assert.equal(totalUsedAt(t, state.now, L), 451);
  assert.deepEqual(t.runs.map((r) => r.kind), ['prep', 'speech'], 'both runs are recorded');
  // The same 6:01 speech in a 7:00 extemp room (no prep) is on time: only the prep event shares its limit.
  assert.equal(timerFace({ timing: { usedMs: 361000 } }, limitOf(USX), 30, state.now).overGrace, false);
});

// Why: LANDING.md E11's done-check, "both runs restore after a reload": a judge's phone that sleeps or reloads during
// prep or during the speech must come back with the right time on the right clock, not restart prep or lose it.
test('both runs restore after a reload: a running prep, and a running speech after prep', () => {
  // Prep running when the page reloads, 40 s later.
  let state = { room: impRoom(), now: T0 };
  let id = state.room.entries[0].id;
  let c = clocks(state, id);
  c.wait(5); c.startPrep(); c.wait(75);
  const saved = JSON.parse(JSON.stringify(state.room)); // what the store kept
  let res = restoreSharedRoom(saved, state.now + 40000, L, 30);
  assert.equal(res.prepId, id); assert.equal(res.runId, null); assert.deepEqual(res.notes, []);
  assert.equal(prepUsedAt(entryOf(res.room, id).timing, state.now + 40000, L), 115, 'prep kept counting while the page was closed');
  assert.equal(sharedFace(entryOf(res.room, id), L, 30, state.now + 40000).word, 'Prep');
  // The speech running when the page reloads, after 2:00 of prep.
  state = { room: impRoom(), now: T0 };
  id = state.room.entries[0].id;
  c = clocks(state, id);
  c.startPrep(); c.wait(120); c.speechStarted(); c.wait(200);
  res = restoreSharedRoom(JSON.parse(JSON.stringify(state.room)), state.now + 30000, L, 30);
  assert.equal(res.runId, id); assert.equal(res.prepId, null); assert.deepEqual(res.notes, []);
  const face = sharedFace(entryOf(res.room, id), L, 30, state.now + 30000);
  assert.equal(face.phase, 'speech');
  assert.equal(face.prepUsed, 120, 'the prep time is kept');
  assert.equal(face.digits, '1:10', '7:00 − 2:00 prep − 3:50 speech');
});

// Why: a reload long after the limit (a judge who closed the tab) must not leave a prep clock stuck below zero or a
// damaged save with two clocks running; each case is stopped and named so the judge checks the time.
test('restore: prep that ran out stops at the full limit; two running clocks keep prep and stop the speech', () => {
  let state = { room: impRoom(), now: T0 };
  const a = state.room.entries[0].id;
  clocks(state, a).startPrep();
  let res = restoreSharedRoom(state.room, T0 + 500000, L, 30);
  assert.equal(res.prepId, null);
  assert.equal(entryOf(res.room, a).timing.prepMs, L * 1000);
  assert.match(res.notes.join(' '), /Prep ran out of time/);
  // A damaged save: B07's speech and A12's prep both running.
  state = { room: impRoom(), now: T0 };
  const a2 = state.room.entries[0].id;
  const b = state.room.entries[1].id;
  const cb = clocks(state, b); cb.speechStarted(); cb.wait(60);
  clocks(state, a2).startPrep();
  res = restoreSharedRoom(state.room, state.now + 10000, L, 30);
  assert.equal(res.prepId, a2, 'prep wins (core/clock.js prepWins)');
  assert.equal(res.runId, null);
  assert.equal(entryOf(res.room, b).timing.run, null);
  assert.equal(entryOf(res.room, b).timing.usedMs, 70000, 'the speech stopped at its time now');
  assert.match(res.notes.join(' '), /Two clocks were running/);
});

// Why: the judge reads the phase from the card; the two-step bar and the button words must say what a tap does next
// (DESIGN.md §4.2: "Prep" then "Speech", the judge taps "Speech started"), and the limit line must say it is shared.
test('screen: the timer card shows the two-step bar and the right buttons for ready, prep and speech', () => {
  const state = { room: impRoom(), now: T0 };
  const id = state.room.entries[0].id;
  const c = clocks(state, id);
  const html = () => { const e = entryOf(state.room, id); return timerHtml(e, sharedFace(e, L, 30, state.now), L, 30); };
  let h = html();
  assert.match(h, /class="phase-bar"/);
  assert.doesNotMatch(h, /aria-current="step"/, 'nothing is on yet');
  assert.match(h, /data-tact="prep"[^>]*>Start prep</);
  assert.match(h, />Start speech</);
  assert.match(h, /Limit 7:00 for prep and speech · grace 0:30/);
  c.startPrep(); c.wait(45);
  h = html();
  assert.match(h, /<li class="on" aria-current="step">Prep 0:45<\/li><li class="">Speech<\/li>/);
  assert.match(h, /data-tact="speech"[^>]*>Speech started</);
  assert.match(h, />Stop prep</);
  assert.doesNotMatch(h, /Set time/, 'Set time is for the speech part');
  c.speechStarted(); c.wait(10);
  h = html();
  assert.match(h, /<li class="done">Prep 0:45<\/li><li class="on" aria-current="step">Speech<\/li>/);
  assert.match(h, /data-tact="startstop"[^>]*>Stop</);
  assert.match(h, /6:05/, '7:00 − 0:45 − 0:10');
  assert.match(rowTimeHtml(entryOf(state.room, id), totalUsedAt(entryOf(state.room, id).timing, state.now, L)), />0:55</, 'the roster shows prep and speech');
  // A prepared event's card has no bar and keeps its own words.
  const exp = { id: 'x', code: 'X1', status: 'waiting', timing: { run: null, runs: [], usedMs: 0 } };
  assert.doesNotMatch(timerHtml(exp, timerFace(exp, 300, 30, T0), 300, 30), /phase-bar|for prep and speech/);
});

// Why: a judge who started prep late taps +10 s; the correction must move prep (and so shorten the speech), stay
// between 0 and the limit, and once the speech runs, a speech correction must still count against the shared limit.
test('corrections: ±10 s moves prep before the speech, and the speech after it, within the shared limit', () => {
  let t = { run: null, runs: [], usedMs: 0, prepRun: null, prepMs: 0 };
  t = adjustPrep(t, -10, T0, L);
  assert.equal(t.prepMs, 0, 'never below 0');
  t = adjustPrep(t, 10, T0, L);
  assert.equal(speechLimit(t, T0, L), 410);
  // Running prep: +10 s moves its end time, so it shows 10 s more used at once.
  let run = { prepRun: { kind: 'prep', endAt: T0 + 410000, startLeft: 410, startedAt: T0 }, prepMs: 10000, usedMs: 0, runs: [] };
  run = adjustPrep(run, 10, T0, L);
  assert.equal(prepUsedAt(run, T0, L), 20);
  assert.equal(prepUsedAt(adjustPrep(t, 999, T0, L), T0, L), L, 'never above the limit');
  // After 3:00 of prep, a speech set to 4:20 is 7:20 in all: inside the grace, so over the limit but not over grace.
  const s = adjustTiming({ run: null, usedMs: 0, prepMs: 180000, runs: [] }, 260, T0, speechLimit({ prepMs: 180000 }, T0, L), 30);
  assert.equal(s.overLimit, true);
  assert.equal(s.overGrace, false);
});

// Why: prep time is real time on the clock; a no-show, a remove or a reset that ignored it would throw away a
// speaker's prep or leave a prep clock running for an entry that is gone.
test('prep time blocks a no-show, a running prep blocks remove, and Reset time clears prep and speech', () => {
  const state = { room: impRoom(), now: T0 };
  const id = state.room.entries[0].id;
  clocks(state, id).startPrep();
  assert.match(rosterAction(state.room, 'noshow', id, T0).refused, /time on the clock/);
  assert.match(rosterAction(state.room, 'remove', id, T0).refused, /Stop the clock/);
  const stopped = updateEntry(state.room, id, (e) => Object.assign({}, e, { timing: stoppedPrep(e.timing, e.timing.prepRun, 400, L, T0 + 20000) }), T0);
  assert.match(rosterAction(stopped, 'noshow', id, T0).refused, /time on the clock/, 'stopped prep still counts');
  const t = resetAll(Object.assign({}, entryOf(stopped, id).timing, { usedMs: 5000, overGrace: true }));
  assert.equal(prepPhase(t), 'ready');
  assert.deepEqual([t.prepMs, t.prepRun, t.usedMs, t.overGrace, t.runs.length], [0, null, 0, false, 0]);
});

// Why: the print sheet and rank board stand in for the paper ballot; for impromptu the time the tab room needs is the
// total against 7:00, so a 5:00 speech after 2:31 of prep must read 7:31, not 5:00.
test('the print sheet shows the total time, prep and speech, for an impromptu speaker', () => {
  let r = impRoom();
  const id = r.entries[0].id;
  r = updateEntry(r, id, (e) => Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { prepMs: 151000, usedMs: 300000, overLimit: true, overGrace: true }) }), T0);
  const table = printModel(r, IMP, L).sections.find((s) => s.kind === 'table');
  assert.equal(table.rows[0][2].text, '7:31');
});

// Why: only events whose file says prep is in the room on a shared clock get the prep phase; an extemp room with a
// prep bar would take time off a speech that has its full 7:00 (EVENTS.md §3, §4).
test('only Impromptu has the shared prep phase, and it can be picked in setup', () => {
  assert.deepEqual(DATA.order.filter((k) => hasSharedPrep(DATA.events.get(k))), ['imp']);
  assert.ok(ENABLED_EVENTS.includes('imp'));
  assert.ok(eventChoices(DATA).some((e) => e.id === 'imp'));
  // A prepared or extemp entry: no prep, the speech limit is the whole limit, and the total is the speech time.
  const t = { run: null, usedMs: 120000 };
  assert.equal(speechLimit(t, T0, 420), 420);
  assert.equal(totalUsedAt(t, T0, 420), 120);
});

// Why: timer.js restoreRoom now takes a limit per entry (for prep events); a plain number must still work the same, or
// every prepared and extemp room would restore its clocks wrong.
test('restoreRoom still takes one limit for the whole room, and a function per entry gives the same result', () => {
  const room = impRoom(USX);
  const a = room.entries[0].id;
  const r = updateEntry(room, a, (e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { run: { kind: 'speech', endAt: T0 + 300000, startLeft: 420 } }) }), T0);
  const one = restoreRoom(r, T0 + 150000, 420, 30);
  const fn = restoreRoom(r, T0 + 150000, () => 420, 30);
  assert.deepEqual(fn, one);
  assert.equal(one.runId, a);
});

// Why: a judge who fixes prep with −10 s or +10 s and then reloads must get the corrected prep back; if the saved run's
// startLeft were stale, the reload would read the change as a moved device clock and restart prep from the wrong time.
test('restore after a correction to a running prep keeps the corrected time, with no clock-moved note', () => {
  for (const delta of [-10, 10]) {
    const state = { room: impRoom(), now: T0 };
    const id = state.room.entries[0].id;
    const c = clocks(state, id);
    c.startPrep(); c.wait(30);
    state.room = updateEntry(state.room, id, (e) => Object.assign({}, e, { timing: adjustPrep(e.timing, delta, state.now, L) }), state.now);
    const res = restoreSharedRoom(JSON.parse(JSON.stringify(state.room)), state.now + 20000, L, 30);
    assert.deepEqual(res.notes, [], 'delta ' + delta);
    assert.equal(res.prepId, id);
    assert.equal(prepUsedAt(entryOf(res.room, id).timing, state.now + 20000, L), 50 + delta, 'delta ' + delta);
  }
});
