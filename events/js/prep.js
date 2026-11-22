// Speech Events step E11 (docs/events/LANDING.md §4.1; MODELS.md §4.3, family F3: IMP): the in-room prep phase on one
// shared limit (primitive N6). Pure: the time is passed in.
//
// In Impromptu the speaker draws in the room and prep and speech share one limit (NSDA: 7:00 in all). The judge starts
// prep, then taps "Speech started" (DESIGN.md §4.2: the two-step bar "Prep" then "Speech"). What prep used comes off the
// speech: the speech part's own limit is what is left of the shared limit after prep (core/clock.js sharedLeft). So
// timer.js works unchanged on the speech part with that limit: the face, the grace, the sticky over-grace flag, the
// signals and the corrections all count against the shared 7:00.
//
// entry.timing adds (ARCHITECTURE.md §6.3 "prepMs?"):
//   prepRun: the running prep run, or null. { kind: 'prep', endAt, startLeft, startedAt } — core/clock.js createDriver
//            (kind 'prep', which never counts below 0) writes it; startLeft is the shared time left when it started.
//   prepMs:  the prep time used by finished prep runs, with the judge's corrections.
// Prep is a phase before the speech: once the speech has time, prep is closed (it cannot start again).
import { leftAt, restoreTimer, sharedLeft } from '../../core/clock.js';
import { usedAt, stoppedTiming, restoreRoom, resetTiming, clockText, timerFace } from './timer.js';
import { updateEntry } from './room.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
// The note when a damaged save held more than one running clock (the same words as timer.js restoreRoom).
const TWO_CLOCKS = 'Two clocks were running, so one was stopped. Check the times.';

// Does this event time prep in the room on one shared limit? (v1: Impromptu. A separate prep cap, timing.prepMax, is a
// later primitive: MODELS.md §4.3.)
export const hasSharedPrep = (event) => Boolean(event && event.timing && event.timing.inRoomPrep && event.timing.sharedClock);

// The seconds of prep used now, whole (rounded down while it counts, like the speech face). limit: the shared limit.
export function prepUsedAt(timing, now, limit) {
  const t = timing || {};
  if (t.prepRun && Number.isFinite(t.prepRun.endAt)) return clamp(Math.floor(limit - leftAt(t.prepRun.endAt, now, 0)), 0, limit);
  return clamp(Math.round((Number(t.prepMs) || 0) / 1000), 0, limit);
}

// The speech part's own limit: what is left of the shared limit after prep. For an entry with no prep it is the limit.
export const speechLimit = (timing, now, limit) => sharedLeft(limit, [prepUsedAt(timing, now, limit)]);

// The total time used, prep and speech, against the limit (the roster, the rank board and the print sheet show this).
// For an event with no prep it is the same as timer.js usedAt.
export const totalUsedAt = (timing, now, limit) => prepUsedAt(timing, now, limit) + usedAt(timing, now, speechLimit(timing, now, limit));

// Where an entry is: 'ready' (nothing yet), 'prep' (prep runs), 'prepStopped' (prep paused, no speech yet) or 'speech'
// (the speech runs or has time).
export function prepPhase(timing) {
  const t = timing || {};
  if (t.run || (Number(t.usedMs) || 0) > 0) return 'speech';
  if (t.prepRun) return 'prep';
  if ((Number(t.prepMs) || 0) > 0) return 'prepStopped';
  return 'ready';
}

// The seconds left to start (or resume) prep with: the shared time not yet used by prep.
export const prepStartLeft = (timing, now, limit) => limit - prepUsedAt(timing, now, limit);

// The timing after the prep run stops with `left` shared seconds left (createDriver onStop gives it).
export function stoppedPrep(timing, run, left, limit, now) {
  const used = clamp(Math.floor(limit - left), 0, limit);
  const startedAt = run && Number.isFinite(run.startedAt) ? run.startedAt : now;
  return Object.assign({}, timing, { prepRun: null, prepMs: used * 1000, runs: (timing.runs || []).concat([{ kind: 'prep', startedAt, stoppedAt: now }]) });
}

// Correct the prep time by delta seconds (the −10 s and +10 s buttons while prep is on screen). It stays from 0 to the
// limit. A running prep run keeps running.
export function adjustPrep(timing, delta, now, limit) {
  const used = clamp(prepUsedAt(timing, now, limit) + delta, 0, limit);
  if (timing.prepRun) return Object.assign({}, timing, { prepRun: Object.assign({}, timing.prepRun, { endAt: now + (limit - used) * 1000, startLeft: Math.max(Number(timing.prepRun.startLeft) || 0, limit - used) }) });
  return Object.assign({}, timing, { prepMs: used * 1000 });
}

// "Reset time" on a prep event: no prep, no speech, no flags.
export const resetAll = (timing) => Object.assign(resetTiming(timing), { prepRun: null, prepMs: 0 });

// What the timer card shows on a prep event. Before the speech: the prep phase, counting the shared time down. Once the
// speech has time: timer.js timerFace on the speech part's own limit. Adds:
//   phase (prepPhase), prepUsed, total (prep and speech used), limit (the shared limit).
export function sharedFace(entry, limit, grace, now) {
  const t = (entry && entry.timing) || {};
  const phase = prepPhase(t);
  const prepUsed = prepUsedAt(t, now, limit);
  if (phase === 'speech') {
    const f = timerFace(entry, speechLimit(t, now, limit), grace, now);
    return Object.assign(f, { phase, prepUsed, total: prepUsed + f.used, limit });
  }
  const left = limit - prepUsed;
  const base = { phase, prepUsed, total: prepUsed, limit, used: 0, left, digits: clockText(left), sub: 'left for prep and speech', overLimit: false, overGrace: false };
  if (phase === 'ready') return Object.assign(base, { stage: 'ready', word: 'Ready', running: false });
  if (phase === 'prep') return Object.assign(base, { stage: 'prep', word: left > 0 ? 'Prep' : 'Prep · no time left', running: true });
  return Object.assign(base, { stage: 'stopped', word: 'Prep stopped at ' + clockText(prepUsed), running: false });
}

// A room after a reload, for a prep event: each saved speech run and prep run comes back (core/clock.js restoreTimer).
// Only one clock may run in a room: among prep runs the one started last keeps running; a prep run beats a speech run
// (core/clock.js prepWins: a prep start always stops the speech). The others stop at their time now.
// Returns { room, runId, prepId, notes } (runId: the running speech's entry; prepId: the running prep's entry).
export function restoreSharedRoom(room, now, limit, grace) {
  const notes = [];
  const note = (s) => { if (s && !notes.includes(s)) notes.push(s); };
  const sp = restoreRoom(room, now, (e) => speechLimit(e.timing, now, limit), grace);
  sp.notes.forEach(note);
  let r = sp.room;
  let runId = sp.runId;
  let prepId = null;
  const preps = r.entries.filter((e) => e.timing && e.timing.prepRun).sort((a, b) => b.timing.prepRun.endAt - a.timing.prepRun.endAt);
  preps.forEach((e, i) => {
    const run = e.timing.prepRun;
    let timing;
    if (i > 0) { timing = stoppedPrep(e.timing, run, leftAt(run.endAt, now, 0), limit, now); note(TWO_CLOCKS); }
    else {
      const res = restoreTimer(run, now, { kind: 'prep', length: Number.isFinite(run.startLeft) ? run.startLeft : limit });
      if (res.state === 'none') { timing = Object.assign({}, e.timing, { prepRun: null }); note('A saved prep clock could not be read, so it was stopped. Check the time.'); }
      else if (res.state === 'paused') { timing = stoppedPrep(e.timing, run, 0, limit, now); note('Prep ran out of time while the page was closed. If the speech started, tap Speech started and set the time.'); }
      else if (res.reason === 'clock-moved') { timing = Object.assign({}, e.timing, { prepRun: Object.assign({}, run, { endAt: res.endAt }) }); note("This device's clock changed, so prep started again from where it began. Check the time."); }
      else timing = e.timing;
    }
    r = updateEntry(r, e.id, (x) => Object.assign({}, x, { timing }), now);
    if (i === 0 && timing.prepRun) prepId = e.id;
  });
  if (prepId && runId) {
    // Both still run: the speech stops at its time now (the prepWins rule).
    const e = r.entries.find((x) => x.id === runId);
    const lim = speechLimit(e.timing, now, limit);
    r = updateEntry(r, runId, (x) => Object.assign({}, x, { status: 'done', timing: stoppedTiming(x.timing, x.timing.run, lim - usedAt(x.timing, now, lim), lim, grace, now) }), now);
    note(TWO_CLOCKS);
    runId = null;
  }
  return { room: r, runId, prepId, notes };
}

