// Why: if these cue rules break, a judge who watches the speaker misses a signal, or feels and hears it twice.
// Tests for the timer cues: events/js/timer-cue.js (which cue fires when) and events/js/timer-cue-view.js (the buzz,
// the spoken line, the switches). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUE_WINDOW, PATTERNS, cueFor, cueStep, forgetCues } from './js/timer-cue.js';
import { signalPoints, timerFace, setUsedTiming, adjustTiming } from './js/timer.js';
import { sharedFace, speechLimit } from './js/prep.js';
import { withSetting, TIMER_VIBRATE_KEY, TIMER_BIG_KEY } from './js/settings.js';
import { settingsHtml } from './js/settings-screen.js';
import { vibrateOn, bigOn, canVibrate, timerCueSettingsHtml, timerCueSettingChange, cueTick, cueMount, resetCues, resetSpeechCues } from './js/timer-cue-view.js';

const L = 300, G = 30; // 5:00, grace 0:30
const P = signalPoints(L, G);

// Run the cue rules over a list of ticks. Each tick: [left, running?] (running defaults to true). Returns the cue
// texts in order (null ticks left out) and the last state.
function run(ticks, opts) {
  const o = Object.assign({ id: 'a', points: P, grace: G, state: null }, opts);
  let state = o.state;
  const out = [];
  for (const t of ticks) {
    const [left, running = true] = t;
    const res = cueStep(state, { id: o.id, left, running, points: o.points, grace: o.grace });
    state = res.state;
    if (res.cue) out.push(res.cue.text);
  }
  return { out, state };
}
// Every second from `from` down to `to` (seconds left).
const secs = (from, to) => { const l = []; for (let s = from; s >= to; s -= 1) l.push([s]); return l; };

// Why: A wrong signal can make a judge stop a speaker too early or allow excess time.
test('cueFor: the words and kind for each point', () => {
  assert.deepEqual(cueFor({ at: 120 }, G), { at: 120, kind: 'point', text: '2 minutes left', pattern: PATTERNS.point });
  assert.equal(cueFor({ at: 60 }, G).text, '1 minute left');
  assert.equal(cueFor({ at: 30 }, G).text, '30 seconds left');
  assert.deepEqual([cueFor({ at: 0 }, G).kind, cueFor({ at: 0 }, G).text], ['grace', 'Grace starts']);
  assert.deepEqual([cueFor({ at: -G }, G).kind, cueFor({ at: -G }, G).text], ['over', 'Over grace'], 'the card says Over grace too');
  // No grace: the limit is the end, so 0:00 is already over time.
  assert.deepEqual([cueFor({ at: 0 }, 0).kind, cueFor({ at: 0 }, 0).text], ['over', 'Over time']);
});

// Why: A judge who watches the speaker must be able to distinguish the signals by touch.
test('the patterns are short and tell grace from over grace without a look', () => {
  assert.notDeepEqual(PATTERNS.grace, PATTERNS.over);
  assert.notDeepEqual(PATTERNS.point, PATTERNS.grace);
  for (const p of Object.values(PATTERNS)) assert.ok(p.reduce((a, b) => a + b, 0) <= 600, 'each pattern is under 0.6 s');
  assert.ok(Object.isFrozen(PATTERNS.point));
});

// Why: Repeated or missing cues distract the room and can change the hand signals a judge gives.
test('a whole speech, one tick a second: each point fires once, in order', () => {
  const { out } = run(secs(L, -G - 20));
  assert.deepEqual(out, ['4 minutes left', '3 minutes left', '2 minutes left', '1 minute left', '30 seconds left', 'Grace starts', 'Over grace']);
});

// Why: The fast display refresh must not turn one signal into several interruptions.
test('many ticks a second (the driver ticks often): still once per point', () => {
  const ticks = [];
  for (let s = 125; s >= 115; s -= 1) for (let k = 0; k < 4; k += 1) ticks.push([s]);
  assert.deepEqual(run(ticks).out, ['2 minutes left']);
});

// Why: Pausing for an interruption must not repeat a signal already given to the speaker.
test('a pause keeps what fired: stopped ticks do nothing, and the resume does not repeat the point', () => {
  let { out, state } = run(secs(125, 119));
  assert.deepEqual(out, ['2 minutes left']);
  // Stopped at 1:59: nothing fires and nothing changes.
  const stopped = cueStep(state, { id: 'a', left: 119, running: false, points: P, grace: G });
  assert.equal(stopped.cue, null);
  assert.equal(stopped.state, state);
  ({ out } = run(secs(119, 100), { state }));
  assert.deepEqual(out, []);
});

// Why: Stopping at a signal boundary must not cause the next required cue to disappear.
test('a pause right on a point: the point still fires after the resume', () => {
  let { out, state } = run(secs(125, 121));
  assert.deepEqual(out, []);
  ({ out } = run([[121, false], [120], [119]], { state }));
  assert.deepEqual(out, ['2 minutes left']);
});

// Why: A manual correction must not make a judge give the same time signal again.
test('−10 s back above a point that fired: it does not fire again when the time passes it a second time', () => {
  let { out, state } = run(secs(122, 118));
  assert.deepEqual(out, ['2 minutes left']);
  ({ out } = run(secs(128, 110), { state })); // the judge took 10 s off: 1:58 → 2:08
  assert.deepEqual(out, []);
});

// Why: A clock correction must not replay signals whose moment has already passed.
test('+10 s just before a point: the point fires now (inside the window); +10 s far past it: marked, no cue', () => {
  // 2:02 → +10 s → 1:52 is 8 s past 2:00: the moment has gone.
  let { out, state } = run([[123], [122], [112], [111]]);
  assert.deepEqual(out, []);
  assert.ok(state.a.fired.includes(120));
  ({ out } = run(secs(110, 50), { state }));
  assert.deepEqual(out, ['1 minute left'], 'the next point still fires');
  // 2:08 → +10 s → 1:58 is 2 s past 2:00: fire it.
  assert.deepEqual(run([[129], [128], [118]]).out, ['2 minutes left']);
});

// Why: The visible chip and optional cues must use the same lateness rule.
test('the window is the same as timer.js crossedSignal (5 s)', () => {
  assert.equal(CUE_WINDOW, 5);
  assert.deepEqual(run([[121], [116]]).out, ['2 minutes left'], '4 s past: fires');
  assert.deepEqual(run([[121], [115]]).out, [], '5 s past: too late');
});

// Why: Setting elapsed time must not replay a backlog of obsolete signals.
test('"Set time" far ahead passes several points with no cue, then the next point fires', () => {
  const t0 = { run: null, runs: [], usedMs: 0, overLimit: false, overGrace: false };
  const t1 = setUsedTiming(t0, 250, 0, L, G); // 4:10 used, 0:50 left
  const face = timerFace({ timing: t1 }, L, G, 0);
  assert.equal(face.left, 50);
  let { out, state } = run([[290], [289], [face.left]]);
  assert.deepEqual(out, []);
  assert.deepEqual([...state.a.fired].sort((a, b) => b - a), [240, 180, 120, 60]);
  ({ out } = run(secs(49, 25), { state }));
  assert.deepEqual(out, ['30 seconds left']);
  // adjustTiming is the same correction by delta: −10 s back over 30 s does not bring it back.
  assert.equal(adjustTiming(t1, -10, 0, L, G).usedMs, 240000);
  ({ out } = run(secs(35, 20), { state: run(secs(49, 25), { state }).state }));
  assert.deepEqual(out, []);
});

// Why: Reopening a room must not repeat a signal the speaker has already received.
test('the first tick seen (the page opened again mid-speech): no cue for points behind it, as the chip', () => {
  assert.deepEqual(run([[-40]]).out, [], 'deep in over grace: no burst of old cues');
  assert.deepEqual(run([[118], [117]]).out, [], '2 s after 2:00 (it fired before the reload): not said again');
  assert.deepEqual(run([[120], [119]]).out, ['2 minutes left'], 'right on the point: it is now');
  const { out } = run([[118], ...secs(117, 55)]);
  assert.deepEqual(out, ['1 minute left'], 'the next point still fires');
});

// Why: A delayed tick must not play several cues at once.
test('one step past two points inside the window: only the last fires, both are marked', () => {
  const pts = signalPoints(L, 2); // grace 2 s: points at 0 and −2
  const { out, state } = run([[1], [-3]], { points: pts, grace: 2 });
  assert.deepEqual(out, ['Over grace']);
  assert.ok(state.a.fired.includes(0) && state.a.fired.includes(-2));
});

// Why: A new speech needs fresh cues, while a small time correction must keep its history.
test('"Reset time" (forgetCues) starts the cues over; −10 s down to 0:00 used does not', () => {
  let { out, state } = run(secs(L, 230));
  assert.deepEqual(out, ['4 minutes left']);
  ({ out } = run([[L], ...secs(299, 230)], { state }));
  assert.deepEqual(out, [], 'back at 0:00 by corrections: still once per speech');
  const fresh = forgetCues(state, ['a']);
  assert.deepEqual(Object.keys(fresh), []);
  assert.deepEqual(run([[L], ...secs(299, 230)], { state: fresh }).out, ['4 minutes left']);
  // Reset, then "Set time" 1:00, then Start: the speech is new, so its points fire.
  assert.deepEqual(run([[240], ...secs(239, 170)], { state: fresh }).out, ['4 minutes left', '3 minutes left']);
  assert.equal(forgetCues(state, ['zzz']), state, 'nothing to forget: the same state');
  assert.deepEqual(forgetCues(null, ['a']), {});
});

// Why: The next speaker must not inherit another speaker's signal history.
test('each entry keeps its own list; the state given in is never changed', () => {
  const a = run(secs(125, 118), { id: 'a' });
  const frozen = JSON.stringify(a.state);
  const b = run(secs(125, 118), { id: 'b', state: a.state });
  assert.deepEqual(b.out, ['2 minutes left']);
  assert.equal(JSON.stringify(a.state), frozen);
  assert.deepEqual(Object.keys(b.state).sort(), ['a', 'b']);
});

// Why: Damaged clock input must not trigger a false signal or corrupt later cues.
test('bad input fires nothing and keeps the state', () => {
  const s = { a: { fired: [120] } };
  for (const bad of [null, {}, { id: 'a', running: true, left: NaN, points: P }, { id: 'a', running: true, left: 10 }, { running: true, left: 10, points: P }]) {
    const r = cueStep(s, bad);
    assert.equal(r.cue, null);
    assert.equal(r.state, s);
  }
  assert.equal(cueStep(null, null).cue, null);
});

// Why: Short local events still need a clear end signal without an invented grace period.
test('a short event (limit under a minute) and no grace', () => {
  const pts = signalPoints(45, 0);
  assert.deepEqual(run(secs(45, -5), { points: pts, grace: 0 }).out, ['30 seconds left', 'Over time']);
});

// Why: Shared prep adjustments must not repeat speech signals.
test('a prep event: −10 s that clamps the speech to 0:00 used does not say a point again', () => {
  const pts = signalPoints(303, G); // 7:00 shared, 1:57 of prep: the speech part has 5:03
  let { out, state } = run(secs(303, 299), { points: pts });
  assert.deepEqual(out, ['5 minutes left']);
  ({ out } = run(secs(303, 290), { points: pts, state }));
  assert.deepEqual(out, []);
});

// ---------- the page side ----------
const envWith = (settings) => {
  const said = [];
  const saved = [];
  let s = settings;
  return { said, saved, settings: () => s, saveSettings: (n) => { saved.push(n); s = n; }, ui: { announce: (t) => said.push(t) } };
};
function withNavigator(nav, fn) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  try { return fn(); } finally { if (before) Object.defineProperty(globalThis, 'navigator', before); else delete globalThis.navigator; }
}
const face = (left) => ({ running: true, left, used: L - left });
const A = { id: 'a', code: '101' };

// Why: Existing devices and old backups must keep optional cues off until the judge chooses them.
test('settings: the two switches are booleans, off when missing, and a bad value is refused', () => {
  assert.equal(TIMER_VIBRATE_KEY, 'timerVibrate');
  assert.equal(TIMER_BIG_KEY, 'timerBig');
  assert.equal(vibrateOn({}), false);
  assert.equal(bigOn(undefined), false);
  const s = withSetting({}, TIMER_VIBRATE_KEY, true);
  assert.equal(vibrateOn(s), true);
  assert.equal(bigOn(withSetting(s, TIMER_BIG_KEY, true)), true);
  assert.equal(withSetting(s, TIMER_VIBRATE_KEY, 'yes')[TIMER_VIBRATE_KEY], true, 'a string is refused; the old value stays');
  assert.equal(withSetting({}, TIMER_BIG_KEY, 1)[TIMER_BIG_KEY], undefined);
});

// Why: The device must identify the timed speaker and respect the judge's vibration choice.
test('cueTick: says each point once with the speaker code; buzzes only when the switch is on and the browser can', () => {
  resetCues();
  const buzz = [];
  const nav = { vibrate: (p) => { buzz.push(p); return true; } };
  const off = envWith({});
  withNavigator(nav, () => { for (const l of [122, 121, 120, 120, 119]) cueTick(off, { id: 'r1' }, A, face(l), L, G); });
  assert.deepEqual(off.said, ['101: 2 minutes left']);
  assert.deepEqual(buzz, [], 'Vibrate is off by default');
  const on = envWith({ [TIMER_VIBRATE_KEY]: true });
  withNavigator(nav, () => { for (const l of [2, 1, 0, -1, -29, -30, -31]) cueTick(on, { id: 'r1' }, A, face(l), L, G); });
  assert.deepEqual(on.said, ['101: Grace starts', '101: Over grace']);
  assert.deepEqual(buzz, [[...PATTERNS.grace], [...PATTERNS.over]]);
  // No vibrate in this browser: the spoken line still comes, nothing throws.
  const noVib = envWith({ [TIMER_VIBRATE_KEY]: true });
  withNavigator({}, () => { for (const l of [62, 60, 59]) cueTick(noVib, { id: 'r2' }, A, face(l), L, G); });
  assert.deepEqual(noVib.said, ['101: 1 minute left']);
  // The same entry id in another room has its own list. A stopped clock says nothing.
  const other = envWith({});
  withNavigator({}, () => { for (const l of [62, 60]) cueTick(other, { id: 'r3' }, A, face(l), L, G); cueTick(other, { id: 'r4' }, A, { running: false, left: 60 }, L, G); });
  assert.deepEqual(other.said, ['101: 1 minute left']);
  resetCues();
});

// Why: Two active live regions would interrupt the same signal twice.
test('cueTick while another view speaks (quiet): no spoken line, the buzz still comes, the point is not said later', () => {
  resetCues();
  const buzz = [];
  const env = envWith({ [TIMER_VIBRATE_KEY]: true });
  withNavigator({ vibrate: (p) => { buzz.push(p); return true; } }, () => {
    for (const l of [122, 121, 120]) cueTick(env, { id: 'q' }, A, face(l), L, G, true); // the speaker view is open
    for (const l of [119, 118, 62, 61, 60]) cueTick(env, { id: 'q' }, A, face(l), L, G, false); // closed again
  });
  assert.deepEqual(env.said, ['101: 1 minute left'], 'open: silent here; closed: this module speaks');
  assert.deepEqual(buzz, [[...PATTERNS.point], [...PATTERNS.point]]);
  resetCues();
});

// Why: Prep time must reduce the speech allowance before the judge gives hand signals.
test('cueTick on a prep event counts the speech part (the limit timer-view passes is lim(e, now))', () => {
  resetCues();
  const T0 = 1_800_000_000_000;
  const shared = 420; // 7:00 for prep and speech
  // Prep used 1:57; the speech has run 2:02 (so 1:01 left of its 3:03 part).
  const timing = { prepRun: null, prepMs: 117000, run: { kind: 'speech', endAt: T0 + 61 * 1000, startLeft: 183 }, runs: [], usedMs: 0, overLimit: false, overGrace: false };
  const e = { id: 'a', code: '101', status: 'speaking', timing };
  const lim = speechLimit(timing, T0, shared);
  assert.equal(lim, 303);
  const env = envWith({});
  withNavigator({}, () => {
    for (let k = 0; k <= 3; k += 1) cueTick(env, { id: 'r' }, e, sharedFace(e, shared, G, T0 + k * 1000), lim, G);
  });
  assert.deepEqual(env.said, ['101: 1 minute left']);
  resetCues();
});

// Why: The timer display must respect saved preferences and reset signal history for a new speech.
test('cueMount: Big digits on the timer box; a speech with no time (Reset time) starts its cues over', () => {
  resetCues();
  const cls = new Set();
  const box = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } };
  const env = envWith({ [TIMER_BIG_KEY]: true });
  const room = { id: 'r', entries: [{ id: 'a', code: '101', timing: { run: null, usedMs: 130000 } }] };
  cueMount(env, box, room);
  assert.ok(cls.has('cue-big'));
  withNavigator({}, () => { for (const l of [122, 120]) cueTick(env, room, A, face(l), L, G); });
  assert.deepEqual(env.said, ['101: 2 minutes left']);
  cueMount(env, box, room); // a redraw while the speech has time: the list stays
  withNavigator({}, () => { for (const l of [128, 125, 120]) cueTick(env, room, A, face(l), L, G); });
  assert.equal(env.said.length, 1, '−10 s and back: not again');
  room.entries[0].timing = { run: null, runs: [], usedMs: 0 }; // Reset time
  resetSpeechCues(room, room.entries[0]); // the explicit Reset time action, not a draw at zero
  cueMount(envWith({}), box, room);
  assert.ok(!cls.has('cue-big'), 'Big digits off: the class goes');
  withNavigator({}, () => { for (const l of [L, 122, 120]) cueTick(env, room, A, face(l), L, G); });
  assert.deepEqual(env.said, ['101: 2 minutes left', '101: 2 minutes left'], 'after Reset time the new speech has its cues');
  cueMount(env, null, null); // a no show: no box, nothing throws
  resetCues();
});

// Why: A browser without vibration must not offer a control that cannot work.
test('canVibrate: true only where navigator.vibrate is a function', () => {
  assert.equal(canVibrate({ vibrate() {} }), true);
  assert.equal(canVibrate({}), false);
  assert.equal(canVibrate(null), false);
});

// Why: Accessible settings must expose only the device capabilities the judge can use.
test('Settings: a Timer part with the switches (role="switch"); Vibrate is hidden where the browser cannot vibrate', () => {
  const s = withSetting({}, TIMER_VIBRATE_KEY, true);
  const html = timerCueSettingsHtml(s, true);
  assert.match(html, /<h2 id="set-timer-h">Timer<\/h2>/);
  assert.match(html, /role="switch" id="set-vibrate" checked>/);
  assert.match(html, /role="switch" id="set-big">/);
  const none = timerCueSettingsHtml(s, false);
  assert.doesNotMatch(none, /set-vibrate|buzz/);
  assert.match(none, /id="set-big"/);
  // The whole Settings screen carries the part; the builder stays pure (vibrate comes in v).
  const page = settingsHtml({ settings: {}, ai: null, keys: '', offline: null, kept: null, release: 'x' });
  assert.match(page, /set-timer-h/);
  assert.doesNotMatch(page, /set-vibrate/);
  assert.match(settingsHtml({ settings: {}, ai: null, keys: '', offline: null, kept: null, release: 'x', vibrate: true }), /set-vibrate/);
});

// Why: Timer preferences must not overwrite another setting.
test('Settings: a switch change saves on this device; other inputs are left alone', () => {
  const env = envWith({});
  assert.equal(timerCueSettingChange(env, { id: 'set-big', checked: true }), true);
  assert.equal(bigOn(env.settings()), true);
  withNavigator({}, () => assert.equal(timerCueSettingChange(env, { id: 'set-vibrate', checked: false }), true));
  assert.equal(vibrateOn(env.settings()), false);
  assert.equal(timerCueSettingChange(env, { id: 'set-due', checked: true }), false);
  assert.equal(timerCueSettingChange(env, null), false);
  assert.equal(env.saved.length, 2);
});

// Why: The room must connect its shared clock to one cue path without duplicate announcements.
test('timer-view.js: one import, one tick call, one mount call; the signal is no longer spoken twice there', () => {
  const src = readFileSync(new URL('./js/timer-view.js', import.meta.url), 'utf8');
  assert.equal((src.match(/timer-cue-view\.js'/g) || []).length, 1);
  assert.equal((src.match(/\bcueTick\(/g) || []).length, 1);
  assert.equal((src.match(/\bcueMount\(/g) || []).length, 1);
  assert.match(src, /cueTick\(env\(\), r, e, face, lim\(e, now\), grace\(\), speakerOpen\(\)\)/, 'the speech part limit and the active speaker view are passed to the cue');
  assert.doesNotMatch(src, /announce\(e\.code \+ ': ' \+ label\)/, 'the chip no longer speaks');
  assert.doesNotMatch(src, /announce\([^)]*face\.word/, 'the stage word no longer speaks');
  assert.doesNotMatch(src, /data-cue|cue-menu/, 'no menu on the timer card');
});

// Why: The optional display must remain calm and work after the network is lost.
test('the cue CSS: no animation or transition, no brand green, and the file is loaded and cached', () => {
  const css = readFileSync(new URL('./js/timer-cue.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /animation|transition|@keyframes/);
  assert.doesNotMatch(css, /--brand|--green|#[0-9a-f]{3,6}\b/i);
  assert.match(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), /href="js\/timer-cue\.css"/);
  const sw = readFileSync(new URL('./sw-files.js', import.meta.url), 'utf8');
  for (const f of ['"js/timer-cue.css"', '"js/timer-cue.js"', '"js/timer-cue-view.js"']) assert.ok(sw.includes(f), f);
});
