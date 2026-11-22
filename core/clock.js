// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C6): the clock math, with no
// DOM and no timers. A run is one clock that counts down: { kind, endAt, startLeft? }. The app owns what a run is
// for (which speech, which side's prep) and passes in its length. Generic words only (core-words.test.mjs). Loaded as
// described in core/defs.js. createDriver (step C7, at the end) starts, stops and ticks one clock.

// A run never counts below -9:59 (599 s over), on screen and after a reload.
export const OVER_LIMIT = -599;
// kind: 'speech' may go over its time down to OVER_LIMIT; 'prep' stops at 0. These are the only two kinds today; any
// other value is treated as 'speech' until a step adds its own rule.
export const runKind = (run) => (run && run.kind === 'prep' ? 'prep' : 'speech');

// Seconds left on a run now, never below floor (a prep run passes floor 0).
export const leftAt = (endAt, now, floor = OVER_LIMIT) => Math.max(floor, (endAt - now) / 1000);

// A run after a reload, a crash or sleep. Time always comes from the wall clock, so a closed tab keeps "running".
// opts: { length (the full time in seconds), kind ('speech' | 'prep'; run.kind when not given) }.
// - More time left than the run can have means the device clock was moved back: it starts again from the full time
//   (reason 'clock-moved'). For a speech, run.startLeft (the time left when it was started) caps it too, plus 2 s for
//   rounding.
// - A speech more than OVER_LIMIT over comes back paused at OVER_LIMIT ('over-limit'); a prep run at 0 or below comes
//   back paused at 0 ('ran-out').
// Returns { state: 'none' } or { state: 'running' | 'paused', left, endAt (running only), reason? }.
export function restoreTimer(run, now, opts) {
  const o = opts || {};
  if (!run || typeof run !== 'object') return { state: 'none' };
  if (typeof run.endAt !== 'number' || !Number.isFinite(run.endAt) || !Number.isFinite(now)) return { state: 'none' };
  const kind = o.kind || runKind(run);
  const len = o.length;
  const left = (run.endAt - now) / 1000;
  const fresh = () => ({ state: 'running', left: len, endAt: now + len * 1000, reason: 'clock-moved' });
  if (kind === 'prep') {
    if (left <= 0) return { state: 'paused', left: 0, reason: 'ran-out' };
    if (Number.isFinite(len) && left > len) return fresh();
    return { state: 'running', left, endAt: run.endAt };
  }
  if (Number.isFinite(len)) {
    const cap = Number.isFinite(run.startLeft) ? Math.min(len, run.startLeft + 2) : len;
    if (left > cap) return fresh();
  }
  if (left < OVER_LIMIT) return { state: 'paused', left: OVER_LIMIT, reason: 'over-limit' };
  return { state: 'running', left, endAt: run.endAt };
}

// Only one clock may run. A prep start always pauses the speech, so when a damaged file or a race saved both as
// running, prep wins and the speech is paused at its restored time.
export function prepWins(speech, prep) {
  if (speech.state === 'running' && prep.state === 'running') return { state: 'paused', left: speech.left, reason: 'prep-running' };
  return speech;
}

// ---------- the limit, the grace period and over time ----------
// The stage of a run with this much time left (per run, or of a shared limit). grace: the seconds past the limit that
// still count as on time.
//   'within' at or before the limit; 'grace' past it but inside the grace; 'over' past the grace.
// At exactly 0:00 the stage is still 'within' while the 0:00 signal plays (beepDecision). A driver should pass whole
// seconds, so a rounding crumb such as -0.0001 does not flash 'grace' (step C7).
export function timeStage(left, grace = 0) {
  if (left >= 0) return 'within';
  return left >= -Math.max(0, grace) ? 'grace' : 'over';
}
// The over-grace flag is sticky: once a run goes past its grace it stays flagged, even if the judge pauses, resumes or
// adds time. wasOver: the flag so far. It is set by the same test as the 'over' stage (left < -grace); the app clears
// it only on purpose, by storing false (a judge's reset).
export const stickyOver = (wasOver, left, grace = 0) => Boolean(wasOver) || left < -Math.max(0, grace);
// One limit shared by several runs (prep and speech together in a limited-prep event): the seconds left of it.
// used: the seconds each run has used so far.
export const sharedLeft = (limit, used) => limit - (used || []).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);

// The 0:00 signal plays once. It is skipped (but marked as done) when the page wakes or reloads more than 5 s late.
// Returns 'beep', 'skip' (mark it done, no sound) or null (nothing to do).
export function beepDecision(left, beeped) {
  if (beeped || !(left <= 0)) return null;
  return left > -5 ? 'beep' : 'skip';
}

// ---------- the driver (step C7): start, stop and tick one clock ----------
// The app keeps the run where it saves it (get and set read and write it), so a reload or a second tab sees the same
// run. The driver owns only the tick timer and the order of the steps.
// opts:
//   get(): the run now, or null.       set(run | null): store the run (the app saves it).
//   kind: 'speech' (the run keeps startLeft and may go to OVER_LIMIT) or 'prep' (stops at 0). The kind lives on the
//   driver, not on the run; restoreTimer is told the kind the same way (opts.kind).
//   onStart(run): after a run starts and the tick runs.  onStop(run, left): after it stops, with the seconds left.
//   onTick(): every tickMs (200 ms by default) while a run is stored.  now(): the wall clock (Date.now).
//   timers: { setInterval, clearInterval } (globalThis; tests pass fakes).
export function createDriver(opts) {
  const given = {}; // an undefined hook keeps the default
  for (const k of Object.keys(opts || {})) if (opts[k] !== undefined) given[k] = opts[k];
  const o = Object.assign({ kind: 'speech', tickMs: 200, onStart() {}, onStop() {}, onTick() {}, now: () => Date.now(), timers: globalThis }, given);
  if (typeof o.get !== 'function' || typeof o.set !== 'function') throw new Error('createDriver needs get and set');
  if (o.kind !== 'speech' && o.kind !== 'prep') throw new Error('createDriver kind must be speech or prep');
  const floor = o.kind === 'prep' ? 0 : OVER_LIMIT;
  let timer = null;
  const tickOn = () => { o.timers.clearInterval(timer); timer = o.timers.setInterval(() => o.onTick(), o.tickMs); };
  const tickOff = () => { o.timers.clearInterval(timer); timer = null; };
  return Object.freeze({
    // Start a run with this many seconds left. fields: the app's own run fields (an id, a side, flags).
    start(fields, left) {
      const now = o.now();
      const run = Object.assign({}, fields, { endAt: now + left * 1000 }, o.kind === 'prep' ? {} : { startLeft: left });
      o.set(run); tickOn(); o.onStart(run);
      return run;
    },
    // Stop the run. Returns the seconds left (never below the floor), or null when none runs.
    stop() {
      const run = o.get();
      if (!run) return null;
      const left = leftAt(run.endAt, o.now(), floor);
      o.set(null); tickOff(); o.onStop(run, left);
      return left;
    },
    // Make the tick match the stored run, with no hooks: after a reload restored it, or another tab changed it.
    follow() { if (o.get()) tickOn(); else tickOff(); },
    ticking: () => timer !== null,
  });
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).clock = Object.freeze({ OVER_LIMIT, runKind, leftAt, restoreTimer, prepWins,
  timeStage, stickyOver, sharedLeft, beepDecision, createDriver });
