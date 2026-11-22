// Tests for step E5 (docs/events/LANDING.md §4.1): the timer rules (events/js/timer.js) and the timer card builder
// (events/js/timer-view.js). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriver } from '../core/clock.js';
import {
  maxUsed, graceOf, clockText, parseClock, usedAt, timerFace, startLeft, stoppedTiming, adjustTiming, setUsedTiming,
  clearedTiming, resetTiming, restoreTiming, signalPoints, crossedSignal,
} from './js/timer.js';
import { timerHtml, rowTimeHtml } from './js/timer-view.js';
import { keymap } from './js/keys.js';

const L = 300, G = 30; // Expository: 5:00, NSDA grace 0:30
const T0 = 1_800_000_000_000;
const fresh = () => ({ run: null, runs: [], usedMs: 0, overLimit: false, overGrace: false });
const entry = (timing, status) => ({ id: 'a', code: 'A12', status: status || 'waiting', timing });
// A run started at `at` with `left` seconds left, as core/clock.js createDriver stores it.
const runFrom = (at, left) => ({ kind: 'speech', endAt: at + left * 1000, startLeft: left });

// Why: the room must survive a reload, a crash or a sleeping phone in the middle of a speech (LANDING.md E5 "a reload
// mid-speech resumes the right time"); a count kept in memory would restart at 0 or lose the minutes.
test('a reload mid-speech resumes the right time from the saved run', () => {
  let saved = null;
  const timers = { setInterval: () => 1, clearInterval: () => {} };
  let now = T0;
  const d = createDriver({ get: () => saved, set: (r) => { saved = r; }, now: () => now, timers });
  const t = Object.assign(fresh(), { usedMs: 60_000 }); // one minute used before a pause
  d.start({ kind: 'speech' }, startLeft(t, L));
  const stored = JSON.parse(JSON.stringify(Object.assign({}, t, { run: saved }))); // what localStorage keeps
  now = T0 + 95_000; // the page reloads 1:35 later
  const back = restoreTiming(stored, now, L, G);
  assert.equal(back.note, '');
  assert.ok(back.timing.run, 'it is still running');
  assert.equal(usedAt(back.timing, now, L), 155, '1:00 before + 1:35 since');
  assert.equal(timerFace(entry(back.timing, 'speaking'), L, G, now).digits, '2:25');
});

// Why: a device clock moved back must not hand the speaker extra minutes, and a clock left running for an hour must
// not show a silly time; the judge is told to check.
test('a reload with a moved clock or a run far past the limit is handled and named', () => {
  const t = Object.assign(fresh(), { run: runFrom(T0, 240) });
  const moved = restoreTiming(t, T0 - 3_600_000, L, G);
  assert.match(moved.note, /clock changed/);
  assert.equal(usedAt(moved.timing, T0 - 3_600_000, L), 60, 'it starts again from where this run began (4:00 left)');
  const far = restoreTiming(t, T0 + 3_600_000, L, G);
  assert.equal(far.timing.run, null);
  assert.equal(far.timing.usedMs, maxUsed(L) * 1000, 'stopped at 9:59 over');
  assert.equal(far.timing.overGrace, true);
  assert.match(far.note, /9:59/);
});

// Why: the stage word and fill are what a judge reads at a glance (DESIGN.md §3); a wrong stage means a wrong signal
// to the speaker or a wrong rank rule.
test('the timer face counts down, then up, with the stage words of DESIGN.md §3', () => {
  const at = (used, running) => timerFace(entry(running ? Object.assign(fresh(), { run: runFrom(T0, L - used) }) : Object.assign(fresh(), { usedMs: used * 1000 })), L, G, T0);
  assert.deepEqual([at(0).stage, at(0).word, at(0).digits], ['ready', 'Ready', '5:00']);
  assert.deepEqual([at(30, true).stage, at(30, true).word, at(30, true).digits, at(30, true).sub], ['speaking', 'Speaking', '4:30', 'left']);
  assert.deepEqual([at(240, true).stage, at(240, true).word], ['last', '1 minute left']);
  assert.deepEqual([at(300, true).stage, at(300, true).digits], ['last', '0:00'], 'exactly 0:00 is still on time');
  assert.deepEqual([at(312, true).stage, at(312, true).word, at(312, true).digits], ['grace', 'Grace +0:12', '+0:12']);
  assert.deepEqual([at(330, true).stage], ['grace'], 'the last second of grace is still grace');
  assert.deepEqual([at(341, true).stage, at(341, true).word, at(341, true).overGrace], ['over', 'Over grace +0:41', true]);
  assert.deepEqual([at(587).stage, at(587).word], ['stopped', 'Done 9:47']);
});

// Why: the over-grace flag decides the NSDA "no rank 1" rule; a ±10 s or Set time correction must never clear it by
// itself (LANDING.md E5, DESIGN.md §4.2), or a judge could erase an over-grace speech by accident.
test('a correction never clears over grace by itself; only "Clear over grace" does, and only if the clock agrees', () => {
  let t = setUsedTiming(fresh(), 345, T0, L, G);
  assert.equal(t.overGrace, true);
  for (let i = 0; i < 10; i++) t = adjustTiming(t, -10, T0, L, G);
  assert.equal(usedAt(t, T0, L), 245);
  assert.equal(t.overGrace, true, 'still flagged after -100 s');
  t = setUsedTiming(t, 0, T0, L, G);
  assert.equal(t.overGrace, true, 'still flagged after Set time 0:00');
  assert.equal(clearedTiming(t, T0, L, G).overGrace, false, 'the judge clears it on purpose');
  const still = setUsedTiming(fresh(), 345, T0, L, G);
  assert.equal(clearedTiming(still, T0, L, G).overGrace, true, 'a speech really past grace keeps its flag');
  // A running clock: the correction moves the run, and it keeps running.
  const run = Object.assign(fresh(), { run: runFrom(T0, 100) });
  const plus = adjustTiming(run, 10, T0, L, G);
  assert.equal(usedAt(plus, T0, L), 210);
  assert.ok(plus.run, 'still running');
  const minus = adjustTiming(run, -10, T0, L, G);
  assert.equal(restoreTiming(minus, T0 + 1000, L, G).note, '', 'a -10 s correction is not read as a moved device clock');
  assert.equal(usedAt(adjustTiming(fresh(), -10, T0, L, G), T0, L), 0, 'never below 0');
});

// Why: stopping a run must keep the time used and the flags; a stop that lost the over-grace flag would let an
// over-time speaker be ranked 1st.
test('stopping keeps the time used, the flags and a record of the run', () => {
  const t = Object.assign(fresh(), { usedMs: 20_000 });
  const run = runFrom(T0, 280);
  const s = stoppedTiming(Object.assign({}, t, { run: null }), run, -40, L, G, T0 + 320_000);
  assert.equal(s.usedMs, 340_000);
  assert.deepEqual([s.overLimit, s.overGrace, s.run], [true, true, null]);
  assert.deepEqual(s.runs, [{ kind: 'speech', startedAt: T0, stoppedAt: T0 + 320_000 }]);
  assert.deepEqual(resetTiming(s), Object.assign({}, s, fresh()), 'Reset time clears time, runs and flags');
});

// Why: the signal chip tells the judge when to raise a card (N5); a missed or repeated signal misleads the speaker,
// and a signal after a reload or a correction would show a moment that has passed.
test('signals: whole minutes inside the limit, 30 s, time and grace end, once each, never after a jump', () => {
  assert.deepEqual(signalPoints(300, 30).map((p) => p.label), ['Show 4', 'Show 3', 'Show 2', 'Show 1', 'Show 30 s', 'Show time: 0', 'Grace is over']);
  assert.deepEqual(signalPoints(600, 30).slice(0, 2).map((p) => p.at), [300, 240], 'a 10-minute speech starts at 5');
  const pts = signalPoints(300, 30);
  assert.equal(crossedSignal(240.4, 239.6, pts).label, 'Show 4');
  assert.equal(crossedSignal(239.6, 239.4, pts), null, 'once');
  assert.equal(crossedSignal(0.2, -0.2, pts).label, 'Show time: 0');
  assert.equal(crossedSignal(-29.9, -30.1, pts).label, 'Grace is over');
  assert.equal(crossedSignal(250, 200, pts), null, 'a jump past the point (reload, correction) shows nothing');
  assert.equal(crossedSignal(null, 239, pts), null, 'no signal on the first tick');
});

// Why: Set time is typed by a judge in a hurry; a misread time would move the clock by minutes.
test('typed times: m:ss and plain minutes; anything else is refused', () => {
  assert.equal(parseClock('4:30'), 270);
  assert.equal(parseClock(' 4 '), 240);
  assert.equal(parseClock('0:05'), 5);
  for (const bad of ['4:60', 'abc', '', '1:2:3', '-1']) assert.equal(parseClock(bad), null, bad);
  assert.equal(clockText(587), '9:47');
  assert.equal(graceOf({ profile: { overtime: { grace: 15 } } }), 15);
  assert.equal(graceOf({ profile: {} }), 30, 'the default grace (ARCHITECTURE.md §6.2)');
});

// Why: the card must say the stage in words and offer the corrections; a no-show must have no clock to start, and
// Space must reach the clock only when no button or box has focus.
test('the timer card shows words, the flag with its clear button, and the controls', () => {
  const over = setUsedTiming(fresh(), 345, T0, L, G);
  const face = timerFace(entry(over, 'done'), L, G, T0);
  const html = timerHtml(entry(over, 'done'), face, L, G);
  assert.match(html, /class="timer-card stage-stopped"/);
  assert.match(html, />Done 5:45</);
  assert.match(html, /<span class="pill err">Over grace<\/span>/);
  for (const w of ['Clear over grace', 'Resume', '−10 s', '+10 s', 'Set time', 'Reset time']) assert.ok(html.includes('>' + w + '<'), w);
  assert.match(html, /Limit 5:00 · grace 0:30/);
  assert.doesNotMatch(timerHtml(entry(fresh(), 'noShow'), timerFace(entry(fresh()), L, G, T0), L, G), /data-tact="startstop"/);
  assert.equal(rowTimeHtml(entry(fresh()), 0), '', 'no time on a row before the speech');
  assert.match(rowTimeHtml(entry(over), 345), />5:45</);
  const space = { code: 'Space', key: ' ', meta: false, ctrl: false, alt: false, shift: false };
  assert.equal(keymap.keyAction(space, { scopes: ['room'], focus: 'none' }), 'startStop');
  assert.equal(keymap.keyAction(space, { scopes: ['room'], focus: 'control' }), null, 'Space presses a focused button instead');
});
