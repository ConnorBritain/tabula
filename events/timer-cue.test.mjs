// Why: if these cue rules break, a judge who watches the speaker misses a signal, or feels and hears it twice.
// Tests for the timer cues: events/js/timer-cue.js (which cue fires when) and events/js/timer-cue-view.js (the buzz,
// the spoken line, the switches). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUE_WINDOW, PATTERNS, cueFor, cueStep } from './js/timer-cue.js';
import { signalPoints, timerFace, setUsedTiming, adjustTiming } from './js/timer.js';
import { withSetting } from './js/settings.js';
import { settingsHtml } from './js/settings-screen.js';
import {
  VIBRATE_KEY, BIG_KEY, vibrateOn, bigOn, canVibrate, cueMenuHtml, timerCueSettingsHtml, timerCueSettingChange, cueTick, resetCues,
} from './js/timer-cue-view.js';

const L = 300, G = 30; // 5:00, grace 0:30
const P = signalPoints(L, G);

// Run the cue rules over a list of ticks. Each tick: [left, used?, running?] (used defaults to L - left, running to
// true). Returns the cue texts in order (null ticks left out) and the last state.
function run(ticks, opts) {
  const o = Object.assign({ id: 'a', points: P, grace: G, state: null }, opts);
  let state = o.state;
  const out = [];
  for (const t of ticks) {
    const [left, used = L - left, running = true] = t;
    const res = cueStep(state, { id: o.id, left, used, running, points: o.points, grace: o.grace });
    state = res.state;
    if (res.cue) out.push(res.cue.text);
  }
  return { out, state };
}
// Every second from `from` down to `to` (seconds left).
const secs = (from, to) => { const l = []; for (let s = from; s >= to; s -= 1) l.push([s]); return l; };

test('cueFor: the words and kind for each point', () => {
  assert.deepEqual(cueFor({ at: 120 }, G), { at: 120, kind: 'point', text: '2 minutes left', pattern: PATTERNS.point });
  assert.equal(cueFor({ at: 60 }, G).text, '1 minute left');
  assert.equal(cueFor({ at: 30 }, G).text, '30 seconds left');
  assert.deepEqual([cueFor({ at: 0 }, G).kind, cueFor({ at: 0 }, G).text], ['grace', 'Grace']);
  assert.deepEqual([cueFor({ at: -G }, G).kind, cueFor({ at: -G }, G).text], ['over', 'Over time']);
  // No grace: the limit is the end, so 0:00 is already over time.
  assert.deepEqual([cueFor({ at: 0 }, 0).kind, cueFor({ at: 0 }, 0).text], ['over', 'Over time']);
});

test('the patterns are short and tell grace from over grace without a look', () => {
  assert.notDeepEqual(PATTERNS.grace, PATTERNS.over);
  assert.notDeepEqual(PATTERNS.point, PATTERNS.grace);
  for (const p of Object.values(PATTERNS)) assert.ok(p.reduce((a, b) => a + b, 0) <= 600, 'each pattern is under 0.6 s');
  assert.ok(Object.isFrozen(PATTERNS.point));
});

test('a whole speech, one tick a second: each point fires once, in order', () => {
  const { out } = run(secs(L, -G - 20));
  assert.deepEqual(out, ['4 minutes left', '3 minutes left', '2 minutes left', '1 minute left', '30 seconds left', 'Grace', 'Over time']);
});

test('many ticks a second (the driver ticks often): still once per point', () => {
  const ticks = [];
  for (let s = 125; s >= 115; s -= 1) for (let k = 0; k < 4; k += 1) ticks.push([s]);
  assert.deepEqual(run(ticks).out, ['2 minutes left']);
});

test('a pause keeps what fired: stopped ticks do nothing, and the resume does not repeat the point', () => {
  let { out, state } = run(secs(125, 119));
  assert.deepEqual(out, ['2 minutes left']);
  // Stopped at 1:59: nothing fires and nothing changes.
  const stopped = cueStep(state, { id: 'a', left: 119, used: L - 119, running: false, points: P, grace: G });
  assert.equal(stopped.cue, null);
  assert.equal(stopped.state, state);
  ({ out } = run(secs(119, 100), { state }));
  assert.deepEqual(out, []);
});

test('a pause right on a point: the point still fires after the resume', () => {
  let { out, state } = run(secs(125, 121));
  assert.deepEqual(out, []);
  ({ out } = run([[121, L - 121, false], [120], [119]], { state }));
  assert.deepEqual(out, ['2 minutes left']);
});

test('−10 s back above a point that fired: it does not fire again when the time passes it a second time', () => {
  let { out, state } = run(secs(122, 118));
  assert.deepEqual(out, ['2 minutes left']);
  ({ out } = run(secs(128, 110), { state })); // the judge took 10 s off: 1:58 → 2:08
  assert.deepEqual(out, []);
});

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

test('the window is the same as timer.js crossedSignal (5 s)', () => {
  assert.equal(CUE_WINDOW, 5);
  assert.deepEqual(run([[121], [116]]).out, ['2 minutes left'], '4 s past: fires');
  assert.deepEqual(run([[121], [115]]).out, [], '5 s past: too late');
});

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

test('a reload or a sleeping phone deep in a speech: no burst of old cues', () => {
  assert.deepEqual(run([[-40]]).out, [], 'first tick already over grace by 10 s');
  assert.deepEqual(run([[-31]]).out, ['Over time'], 'first tick 1 s past grace: the point is now');
});

test('one step past two points inside the window: only the last fires, both are marked', () => {
  const pts = signalPoints(L, 2); // grace 2 s: points at 0 and −2
  const { out, state } = run([[1], [-3]], { points: pts, grace: 2 });
  assert.deepEqual(out, ['Over time']);
  assert.ok(state.a.fired.includes(0) && state.a.fired.includes(-2));
});

test('time used back at 0:00 while running (Reset time, then Start) starts the cues over', () => {
  let { out, state } = run(secs(L, 230));
  assert.deepEqual(out, ['4 minutes left']);
  ({ out, state } = run([[L, 0], [299, 1], ...secs(298, 238)], { state }));
  assert.deepEqual(out, ['4 minutes left']);
});

test('each entry keeps its own list; the state given in is never changed', () => {
  const a = run(secs(125, 118), { id: 'a' });
  const frozen = JSON.stringify(a.state);
  const b = run(secs(125, 118), { id: 'b', state: a.state });
  assert.deepEqual(b.out, ['2 minutes left']);
  assert.equal(JSON.stringify(a.state), frozen);
  assert.deepEqual(Object.keys(b.state).sort(), ['a', 'b']);
});

test('bad input fires nothing and keeps the state', () => {
  const s = { a: { fired: [120] } };
  for (const bad of [null, {}, { id: 'a', running: true, left: NaN, points: P }, { id: 'a', running: true, left: 10 }, { running: true, left: 10, points: P }]) {
    const r = cueStep(s, bad);
    assert.equal(r.cue, null);
    assert.equal(r.state, s);
  }
  assert.equal(cueStep(null, null).cue, null);
});

test('a short event (limit under a minute) and no grace', () => {
  const pts = signalPoints(45, 0);
  assert.deepEqual(run(secs(45, -5), { points: pts, grace: 0 }).out, ['30 seconds left', 'Over time']);
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

test('settings: the two switches are booleans, off when missing, and a bad value is refused', () => {
  assert.equal(vibrateOn({}), false);
  assert.equal(bigOn(undefined), false);
  const s = withSetting({}, VIBRATE_KEY, true);
  assert.equal(vibrateOn(s), true);
  assert.equal(bigOn(withSetting(s, BIG_KEY, true)), true);
  assert.equal(withSetting(s, VIBRATE_KEY, 'yes')[VIBRATE_KEY], true, 'a string is refused; the old value stays');
  assert.equal(withSetting({}, BIG_KEY, 1)[BIG_KEY], undefined);
});

test('cueTick: speaks once per point through ui.announce; buzzes only when the switch is on and the browser can', () => {
  resetCues();
  const buzz = [];
  const nav = { vibrate: (p) => { buzz.push(p); return true; } };
  const off = envWith({});
  withNavigator(nav, () => { for (const l of [122, 121, 120, 120, 119]) cueTick(off, { id: 'r1' }, { id: 'a' }, face(l), L, G); });
  assert.deepEqual(off.said, ['2 minutes left']);
  assert.deepEqual(buzz, [], 'Vibrate is off by default');
  const on = envWith({ [VIBRATE_KEY]: true });
  withNavigator(nav, () => { for (const l of [2, 1, 0, -1, -29, -30, -31]) cueTick(on, { id: 'r1' }, { id: 'a' }, face(l), L, G); });
  assert.deepEqual(on.said, ['Grace', 'Over time']);
  assert.deepEqual(buzz, [[...PATTERNS.grace], [...PATTERNS.over]]);
  // No vibrate in this browser: the spoken line still comes, nothing throws.
  const noVib = envWith({ [VIBRATE_KEY]: true });
  withNavigator({}, () => { for (const l of [62, 60, 59]) cueTick(noVib, { id: 'r2' }, { id: 'a' }, face(l), L, G); });
  assert.deepEqual(noVib.said, ['1 minute left']);
  // The same entry id in another room has its own list.
  const other = envWith({});
  withNavigator({}, () => { for (const l of [62, 60]) cueTick(other, { id: 'r3' }, { id: 'a' }, face(l), L, G); });
  assert.deepEqual(other.said, ['1 minute left']);
  resetCues();
});

test('canVibrate: true only where navigator.vibrate is a function', () => {
  assert.equal(canVibrate({ vibrate() {} }), true);
  assert.equal(canVibrate({}), false);
  assert.equal(canVibrate(null), false);
});

test('the "⋯" menu: closed, a labelled button, switches with role="switch"; Vibrate only where it works', () => {
  const html = cueMenuHtml({ [BIG_KEY]: true }, true);
  assert.match(html, /aria-label="Timer options"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="cue-menu"[^>]*hidden/);
  assert.match(html, /role="switch" data-cue="vibrate">/, 'Vibrate shows, off');
  assert.match(html, /role="switch" data-cue="big" checked>/, 'Big digits shows, on');
  assert.doesNotMatch(cueMenuHtml({}, false), /data-cue="vibrate"/);
});

test('Settings: a Timer part with the switches; Vibrate is hidden where the browser cannot vibrate', () => {
  const s = withSetting({}, VIBRATE_KEY, true);
  const html = timerCueSettingsHtml(s, true);
  assert.match(html, /<h2 id="set-timer-h">Timer<\/h2>/);
  assert.match(html, /id="set-vibrate" checked/);
  assert.match(html, /id="set-big">/);
  const none = timerCueSettingsHtml(s, false);
  assert.doesNotMatch(none, /set-vibrate|buzz/);
  assert.match(none, /id="set-big"/);
  // The whole Settings screen carries the part.
  const page = settingsHtml({ settings: {}, ai: null, keys: '', offline: null, kept: null, release: 'x', vibrate: false });
  assert.match(page, /set-timer-h/);
  assert.doesNotMatch(page, /set-vibrate/);
});

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

test('timer-view.js: the hook is one import, one tick call and one mount call; the old double announcements are gone', () => {
  const src = readFileSync(new URL('./js/timer-view.js', import.meta.url), 'utf8');
  assert.equal((src.match(/timer-cue-view\.js'/g) || []).length, 1);
  assert.equal((src.match(/\bcueTick\(/g) || []).length, 1);
  assert.equal((src.match(/\bcueMount\(/g) || []).length, 1);
  assert.doesNotMatch(src, /ui\.announce\(/, 'the signal is spoken once, by the cue module');
});

test('the cue CSS: no animation or transition, no brand green, and the file is loaded and cached', () => {
  const css = readFileSync(new URL('./js/timer-cue.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const outsideReduce = css.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\}\s*\}/g, '');
  assert.doesNotMatch(outsideReduce, /animation|transition|@keyframes/);
  assert.doesNotMatch(css, /--brand|--green|#[0-9a-f]{3,6}\b/i);
  assert.match(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), /href="js\/timer-cue\.css"/);
  const sw = readFileSync(new URL('./sw-files.js', import.meta.url), 'utf8');
  for (const f of ['"js/timer-cue.css"', '"js/timer-cue.js"', '"js/timer-cue-view.js"']) assert.ok(sw.includes(f), f);
});
