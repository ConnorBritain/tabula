// Tests for the shared clock math, core/clock.js (docs/events/LANDING.md §3, step C6). Run with: node --test
// Debate's restore rules keep their own tests (logic-slice1.test.js, formats.test.js); they run through this file now.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as C from './clock.js';

const require = createRequire(import.meta.url);
const NOW = 1_800_000_000_000;

// Why: a speech judge must see when a speaker is on time, inside the grace period, or past it; a wrong stage gives a
// wrong rank or a wrong over-time mark on the ballot.
test('timeStage: within at or before the limit, grace inside the grace, over past it', () => {
  assert.equal(C.timeStage(12, 30), 'within');
  assert.equal(C.timeStage(0, 30), 'within', 'exactly at the limit is on time');
  assert.equal(C.timeStage(-1, 30), 'grace');
  assert.equal(C.timeStage(-30, 30), 'grace', 'the last second of the grace still counts');
  assert.equal(C.timeStage(-30.5, 30), 'over');
  assert.equal(C.timeStage(-1), 'over', 'with no grace, any time past the limit is over');
  assert.equal(C.timeStage(-1, -5), 'over', 'a negative grace counts as none');
});

// Why: the over-time flag feeds the ballot rule "no rank 1 past grace" (docs/events/PLAN.md §3 item 4); if pausing or
// adding time cleared it, the judge could rank a speaker first by mistake.
test('stickyOver: the over-grace flag sets past the grace and never clears for that run', () => {
  let over = false;
  for (const left of [10, 0, -20, -31, -10, 60]) over = C.stickyOver(over, left, 30);
  assert.equal(over, true);
  assert.equal(C.stickyOver(false, -30, 30), false);
  assert.equal(C.stickyOver(false, -0.1, 0), true);
});

// Why: in Impromptu, prep and speech share one 7-minute limit; counting them apart would give a speaker extra time.
test('sharedLeft: prep and speech use one limit together', () => {
  assert.equal(C.sharedLeft(420, [90, 300]), 30);
  assert.equal(C.sharedLeft(420, [120, 330]), -30, 'over the shared limit goes below 0, so grace and over work on it too');
  assert.equal(C.timeStage(C.sharedLeft(420, [120, 330]), 30), 'grace');
  assert.equal(C.sharedLeft(420, []), 420);
  assert.equal(C.sharedLeft(420, [-5, 'x', 60]), 360, 'a bad or negative use counts as 0');
  // The real use: the speech run's length is what is left of the shared limit after prep.
  const length = C.sharedLeft(420, [150]);
  assert.deepEqual(C.restoreTimer({ endAt: NOW + 900_000 }, NOW, { length }), { state: 'running', left: 270, endAt: NOW + 270_000, reason: 'clock-moved' }, 'a speech cannot get back the prep time');
});

// Why: a prep run must stop at 0 while a speech may run over; mixing them up would let prep run negative or cut a
// speech off at 0 after a reload.
test('restoreTimer: a speech runs over to -9:59, prep stops at 0, and a moved device clock restarts from full', () => {
  assert.deepEqual(C.restoreTimer({ endAt: NOW - 60_000 }, NOW, { length: 300 }), { state: 'running', left: -60, endAt: NOW - 60_000 });
  assert.deepEqual(C.restoreTimer({ kind: 'prep', endAt: NOW - 60_000 }, NOW, { length: 300 }), { state: 'paused', left: 0, reason: 'ran-out' });
  assert.deepEqual(C.restoreTimer({ endAt: NOW - 20 * 60_000 }, NOW, { length: 300 }), { state: 'paused', left: C.OVER_LIMIT, reason: 'over-limit' });
  assert.deepEqual(C.restoreTimer({ endAt: NOW + 400_000 }, NOW, { length: 300 }), { state: 'running', left: 300, endAt: NOW + 300_000, reason: 'clock-moved' });
  assert.equal(C.restoreTimer({ endAt: NOW + 100_000, startLeft: 60 }, NOW, { length: 300 }).reason, 'clock-moved', 'more than the time left at start');
  assert.deepEqual(C.restoreTimer({ endAt: 'soon' }, NOW, { length: 300 }), { state: 'none' });
  assert.deepEqual(C.restoreTimer({ kind: 'prep', endAt: NOW }, NOW, { length: 300 }), { state: 'paused', left: 0, reason: 'ran-out' }, 'prep at exactly 0 has run out');
  assert.deepEqual(C.restoreTimer({ kind: 'prep', endAt: NOW + 400_000 }, NOW, { length: 300 }), { state: 'running', left: 300, endAt: NOW + 300_000, reason: 'clock-moved' });
  assert.deepEqual(C.restoreTimer({ endAt: NOW }, NOW, { length: 300 }), { state: 'running', left: 0, endAt: NOW }, 'a speech at exactly 0 keeps running into over time');
  assert.deepEqual(C.restoreTimer({ endAt: NOW + 5000 }, NOW, {}), { state: 'running', left: 5, endAt: NOW + 5000 }, 'with no length there is no cap to check');
  assert.equal(C.runKind({ kind: 'prep' }), 'prep');
  assert.equal(C.runKind({}), 'speech');
  assert.equal(C.leftAt(NOW - 700_000, NOW), C.OVER_LIMIT);
});

// Why: debate's tests check the restore rules through PolicyLogic; a second copy there would let them pass on code the
// shared clock does not run.
test('PolicyLogic gives the very same shared clock functions', () => {
  const L = require('../logic.js');
  for (const k of ['OVER_LIMIT', 'leftAt', 'beepDecision']) assert.equal(L[k], C[k], k);
});

// ---------- the driver (step C7) ----------
// A fake wall clock and fake timers, so the driver runs with no real waiting.
function rig(kind) {
  const t = { now: NOW, timers: [], calls: [] };
  let store = null;
  const timers = {
    setInterval: (fn, ms) => { const h = { fn, ms }; t.timers.push(h); return h; },
    clearInterval: (h) => { t.timers = t.timers.filter((x) => x !== h); },
  };
  const d = C.createDriver({
    kind, get: () => store, set: (r) => { store = r; t.calls.push(['set', r && Object.assign({}, r)]); },
    now: () => t.now, timers,
    onStart: (r) => t.calls.push(['start', r.id, store === r, t.timers.length]),
    onStop: (r, left) => t.calls.push(['stop', r.id, left, store, t.timers.length]),
    onTick: () => t.calls.push(['tick']),
  });
  return { d, t, run: () => store, setRun: (r) => { store = r; } };
}

// Why: the app saves the run it is given; if start stored no endAt or startLeft, a reload could not tell how much time
// is left, and the clock would jump.
test('driver start: stores the run with endAt and startLeft, starts the tick, then runs onStart', () => {
  const { d, t, run } = rig('speech');
  d.start({ id: 'S1', flag: true }, 90);
  assert.deepEqual(run(), { id: 'S1', flag: true, endAt: NOW + 90_000, startLeft: 90 });
  assert.deepEqual(t.calls.at(-1), ['start', 'S1', true, 1], 'the run is stored and the tick runs before the hook');
  assert.equal(t.timers[0].ms, 200);
  t.timers[0].fn();
  assert.deepEqual(t.calls.at(-1), ['tick']);
});

// Why: pausing must keep the exact time left and stop the tick; a tick left running would redraw a stopped clock and
// waste battery in a long tournament day.
test('driver stop: clears the run and the tick first, then runs onStop with the time left; nothing runs when stopped', () => {
  const { d, t, run } = rig('speech');
  d.start({ id: 'S1' }, 60);
  t.now += 75_000;
  assert.equal(d.stop(), -15, 'a speech may be over its time');
  assert.equal(run(), null);
  assert.deepEqual(t.calls.at(-1), ['stop', 'S1', -15, null, 0]);
  assert.equal(d.stop(), null, 'a second stop does nothing');
  assert.equal(t.calls.filter((c) => c[0] === 'stop').length, 1);
});

// Why: prep must stop at 0 and keep no startLeft; a prep run saved with a speech's fields would change the saved
// round and could count below 0.
test('driver for prep: no startLeft, and stop never gives less than 0', () => {
  const { d, t, run } = rig('prep');
  d.start({ side: 'A' }, 30);
  assert.deepEqual(run(), { side: 'A', endAt: NOW + 30_000 });
  t.now += 45_000;
  assert.equal(d.stop(), 0);
});

// Why: after a reload or a change from another tab the run is already stored; the tick must follow it with no start
// or stop hook, or the app would start recording or show "paused" twice.
test('driver follow: the tick matches the stored run, with no hooks', () => {
  const { d, t, setRun } = rig('speech');
  setRun({ id: 'S2', endAt: NOW + 5000 });
  d.follow();
  assert.equal(d.ticking(), true);
  setRun(null);
  d.follow();
  assert.equal(d.ticking(), false);
  assert.equal(t.calls.filter((c) => c[0] === 'start' || c[0] === 'stop').length, 0);
  assert.throws(() => C.createDriver({}), /needs get and set/);
  assert.throws(() => C.createDriver({ get() {}, set() {}, kind: 'prp' }), /speech or prep/, 'a typo must not silently run as a speech');
  const quiet = C.createDriver({ get: () => null, set() {}, onStart: undefined, timers: { setInterval: () => 1, clearInterval() {} } });
  quiet.start({ id: 'Q' }, 5); // an undefined hook keeps the default and does not crash
  // A second start keeps one timer, so the clock never draws twice per tick.
  const two = rig('speech');
  two.d.start({ id: 'A' }, 10); two.d.start({ id: 'B' }, 10);
  assert.equal(two.t.timers.length, 1);
});
