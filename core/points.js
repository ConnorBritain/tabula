// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C9): a points range, the
// error for a range a judge types, and the − / + stepper. Each app passes in its own default range. Generic words
// only (core-words.test.mjs). No DOM. Loaded as described in core/defs.js.

// The allowed bounds of any range: whole numbers from 0 to 100. The stepper moves by 0.1. Both are debate's rules; a
// Congress scale (1–6 or 1–8, whole steps) adds an option when its step needs one (LANDING.md §4.3 K4).
const POINTS_BOUNDS = { lo: 0, hi: 100 };
const toNum = (v) => (v === '' || v == null ? NaN : Number(v)); // the same rule as num() in logic/round.js

// A range that is safe to use: { min, max }, whole numbers inside POINTS_BOUNDS with min < max. Anything else gives a
// copy of fallback (the app's own default, for example 25–30; required).
export function pointsRange(r, fallback) {
  const min = Number(r && r.min), max = Number(r && r.max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < POINTS_BOUNDS.lo || max > POINTS_BOUNDS.hi || min >= max) return { min: fallback.min, max: fallback.max };
  return { min, max };
}

// The error for a range the judge typed, or '' when it is fine.
export function rangeError(min, max) {
  const ok = (v) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= POINTS_BOUNDS.lo && Number(v) <= POINTS_BOUNDS.hi;
  if (!ok(min) || !ok(max)) return 'Use a number from ' + POINTS_BOUNDS.lo + ' to ' + POINTS_BOUNDS.hi + '.';
  if (Number(min) >= Number(max)) return 'The lowest score must be less than the highest.';
  return '';
}

// The − and + buttons: steps of 0.1 inside range. range must come from pointsRange (the caller checks it first, as
// debate's stepPoints does). An empty box starts 60% of the way up the range, near where most scores sit. The result is
// rounded to one decimal, so no float noise such as 28.300000000000001.
export function stepPoints(value, dir, r) {
  const v = toNum(value);
  if (Number.isNaN(v)) return Math.round(r.min + (r.max - r.min) * 0.6);
  const next = Math.round((v + (dir < 0 ? -0.1 : 0.1)) * 10) / 10;
  return Math.min(r.max, Math.max(r.min, next));
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).points = Object.freeze({ pointsRange, rangeError, stepPoints });
