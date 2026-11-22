// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C6): the clock math, with no
// DOM and no timers. A run is one clock that counts down: { kind, endAt, startLeft? }. The app owns what a run is
// for (which speech, which side's prep) and passes in its length. Generic words only (core-words.test.mjs). Loaded as
// described in core/defs.js. The start, stop and tick driver is step C7.

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

(globalThis.TabulaCore = globalThis.TabulaCore || {}).clock = Object.freeze({ OVER_LIMIT, runKind, leftAt, restoreTimer, prepWins,
  timeStage, stickyOver, sharedLeft, beepDecision });
