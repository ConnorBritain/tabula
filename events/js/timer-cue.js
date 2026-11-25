// Timer cues (pure: no DOM, no timers). A judge watches the speaker, not the screen, so each signal point can also
// buzz the phone (a short pattern) and be spoken once to a screen reader. This module decides which cue fires when.
// The points are timer.js signalPoints(limit, grace): seconds left at each point (5, 4, 3, 2, 1 min, 30 s, 0, -grace).
// The DOM side (vibration, the spoken line, the switches) is in timer-cue-view.js.
//
// The rules:
// - A point fires once per speech. It fires when the time left reaches it, or up to 4 s after (a slow tick, a +10 s
//   just before the point). A point passed by more than that (a reload, a sleeping phone, "Set time") is marked as
//   passed with no cue: the moment has gone.
// - A pause keeps what has fired. "−10 s" or "Set time" back above a point does not make it fire again.
// - Time used back at 0:00 while the clock runs (a new start after "Reset time", or "Set time" to 0:00) starts over.
// - When one step passes more than one point inside the window, only the last one fires (the others are marked).

// Seconds after a point that it may still fire (the same window as timer.js crossedSignal).
export const CUE_WINDOW = 5;

// The vibration patterns (ms on, off, on ...). Each is short; each kind feels different without a look at the screen.
export const PATTERNS = Object.freeze({
  point: Object.freeze([150]), // a minute or 30 s point: one tap
  grace: Object.freeze([90, 90, 90]), // time is up, grace starts: two taps
  over: Object.freeze([90, 90, 90, 90, 90]), // over grace (or over time with no grace): three taps
});

// The cue for one signal point. point: { at } from signalPoints. grace: seconds of grace.
// Returns { at, kind ('point' | 'grace' | 'over'), text, pattern }.
export function cueFor(point, grace) {
  const at = point.at;
  let kind = 'over';
  let text = 'Over time';
  if (at > 0) {
    kind = 'point';
    text = at % 60 === 0 ? (at / 60) + (at === 60 ? ' minute left' : ' minutes left') : at + ' seconds left';
  } else if (at === 0 && grace > 0) {
    kind = 'grace';
    text = 'Grace';
  }
  return { at, kind, text, pattern: PATTERNS[kind] };
}

// One step of the cue state. state: what cueStep returned last time (or null). input:
//   id       the entry whose clock this is (each entry keeps its own list of fired points)
//   running  true while its clock runs; a stopped clock fires nothing and changes nothing
//   left     whole seconds left (negative past the limit), as timer.js timerFace gives it
//   used     whole seconds used
//   points   timer.js signalPoints(limit, grace)
//   grace    seconds of grace
// Returns { state, cue } where cue is cueFor(...) or null. The state given in is never changed.
export function cueStep(state, input) {
  const all = state && typeof state === 'object' ? state : {};
  const i = input || {};
  if (!i.running || !i.id || !Number.isFinite(i.left) || !Array.isArray(i.points)) return { state: all, cue: null };
  const before = i.used === 0 ? [] : (all[i.id] && all[i.id].fired) || [];
  const fired = before.slice();
  let hit = null;
  for (const p of i.points) {
    if (!Number.isFinite(p.at) || fired.includes(p.at) || i.left > p.at) continue;
    fired.push(p.at);
    if (i.left > p.at - CUE_WINDOW && (!hit || p.at < hit.at)) hit = p;
  }
  const prev = all[i.id];
  const same = prev && prev.fired.length === fired.length && fired.every((at, k) => prev.fired[k] === at);
  const next = same ? all : Object.assign({}, all, { [i.id]: { fired } });
  return { state: next, cue: hit ? cueFor(hit, i.grace) : null };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).timerCue = Object.freeze({ CUE_WINDOW, PATTERNS, cueFor, cueStep });
