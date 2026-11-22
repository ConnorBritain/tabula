// Speech Events step E5 (docs/events/LANDING.md §4.1): the timer rules for one entry. Pure: the time is passed in.
// The clock math comes from core/clock.js (leftAt, restoreTimer, timeStage, stickyOver); this file adds what a speech
// room needs: the limit and grace of the room, the sticky over-grace flag (N4), the signal points (N5), the ±10 s
// corrections and "Set time".
//
// entry.timing (ARCHITECTURE.md §6.3):
//   run:      the running run, or null. { kind: 'speech', endAt, startLeft } — core/clock.js createDriver writes it.
//             It is wall-clock based (an end time, not a count), so a reload or a sleeping phone resumes the right time.
//   runs:     the finished runs, [{ kind, startedAt, stoppedAt }] (a record; the time used is usedMs).
//   usedMs:   the time used by finished runs, with the judge's corrections.
//   overLimit, overGrace: sticky flags. Once set, only the judge clears them, on purpose ("Clear over grace", which
//             works the flags out again from the time on the clock) or with "Reset time".
// All times on screen are whole seconds (core/clock.js timeStage asks for whole seconds).
import { leftAt, restoreTimer, timeStage, stickyOver, OVER_LIMIT } from '../../core/clock.js';
import { updateEntry } from './room.js';

// The most time a speech can show: the limit plus 9:59 over (core/clock.js OVER_LIMIT).
export const maxUsed = (limit) => limit - OVER_LIMIT;

// The room's limit (seconds, from the event file) and grace (seconds, from the room's frozen rules profile; 30 s when
// the profile has none, the default in ARCHITECTURE.md §6.2).
export const limitOf = (event) => Number(event && event.timing && event.timing.limit) || 0;
export function graceOf(room) {
  const g = Number(room && room.profile && room.profile.overtime && room.profile.overtime.grace);
  return Number.isFinite(g) && g >= 0 ? g : 30;
}

// m:ss for a number of whole seconds (no sign). Debate's formatter (L.formatClock in js/logic.js) is a classic script
// outside core/, so the events app keeps this small one.
export function clockText(sec) {
  const s = Math.max(0, Math.floor(Math.abs(sec)));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
// A time the judge types: "4:30", "4" (minutes) or "0:45" (two digits after the colon, so "4:5" is not read as
// 4:05). Returns seconds, or null when it is not a time.
export function parseClock(text) {
  const m = /^\s*(\d{1,2})(?::([0-5]\d))?\s*$/.exec(String(text == null ? '' : text));
  if (!m) return null;
  return m[2] == null ? Number(m[1]) * 60 : Number(m[1]) * 60 + Number(m[2]);
}

// The seconds used now, whole (rounded down while it counts, so the face never shows a time the speaker has not used).
export function usedAt(timing, now, limit) {
  const t = timing || {};
  if (t.run && Number.isFinite(t.run.endAt)) return Math.min(maxUsed(limit), Math.max(0, Math.floor(limit - leftAt(t.run.endAt, now))));
  return Math.max(0, Math.round((Number(t.usedMs) || 0) / 1000));
}

// The flags for this much time used: the stored flags stay (sticky); the time can only add one.
export function flagsFor(timing, used, limit, grace) {
  const t = timing || {};
  return { overLimit: Boolean(t.overLimit) || used > limit, overGrace: stickyOver(t.overGrace, limit - used, grace) };
}

// What the timer card shows (DESIGN.md §3 and §4.2). Returns:
//   { stage: 'ready' | 'speaking' | 'last' | 'grace' | 'over' | 'stopped', word, digits, sub, used, left, running,
//     overLimit, overGrace }
// digits: "2:14" before the limit (it counts down; sub says "left"), "+0:12" after it (it counts up).
export function timerFace(entry, limit, grace, now) {
  const t = (entry && entry.timing) || {};
  const running = Boolean(t.run);
  const used = usedAt(t, now, limit);
  const left = limit - used;
  const flags = flagsFor(t, used, limit, grace);
  const digits = left >= 0 ? clockText(left) : '+' + clockText(-left);
  const sub = left >= 0 ? 'left' : 'over the limit';
  const base = { used, left, running, digits, sub, overLimit: flags.overLimit, overGrace: flags.overGrace };
  if (!running && used === 0) return Object.assign(base, { stage: 'ready', word: 'Ready' });
  if (!running) return Object.assign(base, { stage: 'stopped', word: 'Done ' + clockText(used) });
  const st = timeStage(left, grace);
  if (st === 'grace') return Object.assign(base, { stage: 'grace', word: 'Grace +' + clockText(-left) });
  if (st === 'over') return Object.assign(base, { stage: 'over', word: 'Over grace +' + clockText(-left) });
  if (left <= 60) return Object.assign(base, { stage: 'last', word: '1 minute left' });
  return Object.assign(base, { stage: 'speaking', word: 'Speaking' });
}

// The seconds left to start a run with (the driver's start(fields, left)).
export const startLeft = (timing, now, limit) => limit - usedAt(timing, now, limit);

// The timing after a run stops with `left` seconds left (core/clock.js createDriver onStop gives it).
export function stoppedTiming(timing, run, left, limit, grace, now) {
  // Rounded down, as the face shows it while it runs: a stop never adds a second (or a flag) the face did not show.
  const used = Math.min(maxUsed(limit), Math.max(0, Math.floor(limit - left)));
  const startedAt = run && Number.isFinite(run.endAt) && Number.isFinite(run.startLeft) ? Math.round(run.endAt - run.startLeft * 1000) : now;
  const flags = flagsFor(timing, used, limit, grace);
  return Object.assign({}, timing, { run: null, usedMs: used * 1000, runs: (timing.runs || []).concat([{ kind: 'speech', startedAt, stoppedAt: now }]) }, flags);
}

// Correct the time used by delta seconds (the −10 s and +10 s buttons: "+10 s" means the speaker has used 10 s more,
// as after a late start). It stays from 0 to the most a speech can show. A running clock keeps running. The flags
// stay as they were, or are added by the new time; a correction never clears over grace by itself (DESIGN.md §4.2).
export function adjustTiming(timing, delta, now, limit, grace) {
  return setUsedTiming(timing, usedAt(timing, now, limit) + delta, now, limit, grace);
}
// "Set time": the time used is now `sec` seconds.
export function setUsedTiming(timing, sec, now, limit, grace) {
  const used = Math.min(maxUsed(limit), Math.max(0, Math.round(sec)));
  const flags = flagsFor(timing, used, limit, grace);
  if (timing.run) {
    const left = limit - used;
    // startLeft moves with the correction, so core/clock.js restoreTimer does not read a −10 s as a moved device clock.
    return Object.assign({}, timing, { run: Object.assign({}, timing.run, { endAt: now + left * 1000, startLeft: Math.max(Number(timing.run.startLeft) || 0, left) }) }, flags);
  }
  return Object.assign({}, timing, { usedMs: used * 1000 }, flags);
}

// "Clear over grace": the judge says the time was wrong. The over-grace flag is worked out again from the time on
// the clock now, so a speech that really is over grace keeps it. Only over grace is cleared (DESIGN.md §4.2); the
// over-limit record stays until "Reset time".
export function clearedTiming(timing, now, limit, grace) {
  const used = usedAt(timing, now, limit);
  return Object.assign({}, timing, { overGrace: flagsFor({}, used, limit, grace).overGrace });
}
// "Reset time": back to no time and no flags (a run must be stopped first).
export const resetTiming = (timing) => Object.assign({}, timing, { run: null, runs: [], usedMs: 0, overLimit: false, overGrace: false });

// A saved run after a reload (core/clock.js restoreTimer). Returns { timing, note } where note is '' or a sentence
// for the judge. A run whose device clock moved back starts again from where that run started; a run more than
// 9:59 over stops at the most a speech can show.
export function restoreTiming(timing, now, limit, grace) {
  if (!timing || !timing.run) return { timing, note: '' };
  const run = timing.run;
  const r = restoreTimer(run, now, { length: Number.isFinite(run.startLeft) ? run.startLeft : limit, kind: 'speech' });
  if (r.state === 'none') return { timing: Object.assign({}, timing, { run: null }), note: 'A saved clock could not be read, so it was stopped. Check the time.' };
  if (r.state === 'paused') return { timing: stoppedTiming(timing, run, r.left, limit, grace, now), note: 'A clock ran past 9:59 over the limit, so it stopped there.' };
  if (r.reason === 'clock-moved') return { timing: Object.assign({}, timing, { run: Object.assign({}, run, { endAt: r.endAt }) }), note: "This device's clock changed, so the running speech started again from where it began. Check the time." };
  return { timing, note: '' };
}

// A room after a reload: each saved run comes back (restoreTiming). Only one clock may run in a room, so when a
// damaged save holds more than one, the one started last keeps running and the others stop at their time now.
// limit: the room's limit in seconds, or a function (entry) -> that entry's limit (a prep event, step E11: prep.js
// speechLimit). grace is the room's. Returns { room, runId (the running entry, or null), notes: [sentences] }.
export function restoreRoom(room, now, limitIn, grace) {
  const lim = typeof limitIn === 'function' ? limitIn : () => limitIn;
  const notes = [];
  let runId = null;
  let r = room;
  const running = room.entries.filter((e) => e.timing && e.timing.run).sort((a, b) => b.timing.run.endAt - a.timing.run.endAt);
  running.forEach((e, i) => {
    const limit = lim(e);
    const res = i === 0 ? restoreTiming(e.timing, now, limit, grace)
      : { timing: stoppedTiming(e.timing, e.timing.run, limit - usedAt(e.timing, now, limit), limit, grace, now), note: 'Two clocks were running, so one was stopped. Check the times.' };
    if (res.note && !notes.includes(res.note)) notes.push(res.note);
    r = updateEntry(r, e.id, (x) => Object.assign({}, x, { timing: res.timing, status: res.timing.run ? 'speaking' : 'done' }), now);
    if (i === 0 && res.timing.run) runId = e.id;
  });
  return { room: r, runId, notes };
}

// The signal points (N5), as seconds left: whole minutes from 5 down (those inside the limit), 30 s, 0 (time) and the
// end of grace. Labels say what to show the speaker. The v1 event files have no signal field, so every v1 event
// uses this plan (DESIGN.md §4.2's example).
export function signalPoints(limit, grace) {
  const pts = [];
  for (const m of [5, 4, 3, 2, 1]) if (m * 60 < limit) pts.push({ at: m * 60, label: 'Show ' + m });
  if (limit > 30) pts.push({ at: 30, label: 'Show 30 s' });
  pts.push({ at: 0, label: 'Show time: 0' });
  if (grace > 0) pts.push({ at: -grace, label: 'Grace is over' });
  return pts;
}
// The signal crossed between two ticks (seconds left before and now), or null. A jump of more than 5 s past a point
// (a reload, a sleeping phone, a correction) shows nothing for it: the moment has passed.
export function crossedSignal(prevLeft, left, points) {
  if (!Number.isFinite(prevLeft) || !Number.isFinite(left) || left >= prevLeft) return null;
  let hit = null;
  for (const p of points) if (prevLeft > p.at && left <= p.at && left > p.at - 5) hit = p;
  return hit;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).timer = Object.freeze({
  maxUsed, limitOf, graceOf, clockText, parseClock, usedAt, flagsFor, timerFace, startLeft, stoppedTiming, adjustTiming,
  setUsedTiming, clearedTiming, resetTiming, restoreTiming, restoreRoom, signalPoints, crossedSignal,
});
