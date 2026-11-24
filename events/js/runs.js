// Speech Events step S5 (docs/events/EXPERIENCE.md §3 F4 row, §8.2): two runs in one entry (family F4, Pro Con
// Challenge). Pure: no DOM, no storage; the time is passed in.
//
// PCC is one clock with a split (docs/events/VENN.md §6): one limit (10:30) covers the Pro run and then the Con run.
// So the entry's clock stays the shipped one (entry.timing, timer.js): the face, the grace, the sticky flags, the
// signals, the corrections, the rank board and the print sheet all count the whole entry against the one limit. This
// file adds only the split:
//   entry.runs   [{ side, startedAt, ms }] in the order of the event file's runs ('pro', then 'con'). Each run but the
//                last is fixed when the judge marks the next one ("Con started"). The last run holds the rest of the
//                time on the clock. Empty until the clock has time.
//   entry.topic  the student's own pick, as typed (PCC draws nothing: VENN.md §6).
// There is NO minimum time for a run (VENN.md §6 item 1): the app shows each run's time and never warns about it.
import { usedAt, clockText } from './timer.js';

// The run fields of an F4 entry and their defaults (migrate.js fills them in at read time; a fresh copy each time).
export const runEntryDefaults = () => ({ runs: [], topic: '' });
// The longest topic kept (a debate resolution or a bill title fits easily).
export const TOPIC_MAX = 300;

// The event file's runs: [{ side, label }], or [] for an event with one run.
export const eventRuns = (event) => (Array.isArray(event && event.runs) ? event.runs : []);
// Does this event split one entry into two or more runs?
export const hasRuns = (event) => eventRuns(event).length > 1;
export const labelOf = (event, side) => (eventRuns(event).find((r) => r.side === side) || {}).label || side;

// When the clock first started for this entry: the first finished speech run, else the running one.
function firstStart(timing, now) {
  const t = timing || {};
  const done = (t.runs || []).find((r) => r && r.kind === 'speech' && Number.isFinite(r.startedAt));
  if (done) return done.startedAt;
  if (t.run && Number.isFinite(t.run.endAt) && Number.isFinite(t.run.startLeft)) return Math.round(t.run.endAt - t.run.startLeft * 1000);
  return now;
}
const hasTime = (timing, ms) => Boolean((timing && timing.run) || ms > 0);
const storedRuns = (entry) => (Array.isArray(entry && entry.runs) ? entry.runs.filter((r) => r && typeof r.side === 'string') : []);

// The runs as they stand now, in the stored shape [{ side, startedAt, ms }]. The last run holds what the clock used
// past the fixed runs; with no stored split yet, the first run holds all of it. limit: the event's limit (seconds).
// For the screen, a fixed run never shows more than the clock has used (a −10 s after the split can take the clock
// under it); the stored value is kept, so a +10 s gives it back.
export function runsAt(entry, event, now, limit) {
  const t = (entry && entry.timing) || {};
  const totalMs = usedAt(t, now, limit) * 1000;
  if (!hasTime(t, totalMs) || !hasRuns(event)) return [];
  const stored = storedRuns(entry);
  if (!stored.length) return [{ side: eventRuns(event)[0].side, startedAt: firstStart(t, now), ms: totalMs }];
  let left = totalMs;
  return stored.map((r, i) => {
    if (i === stored.length - 1) return Object.assign({}, r, { ms: left });
    const ms = Math.min(Math.max(0, Number(r.ms) || 0), left);
    left -= ms;
    return Object.assign({}, r, { ms });
  });
}

// The entry with its stored runs brought up to date with the clock (timer-view.js calls it after each change to the
// entry: start, stop, a correction, Undo). The fixed runs are never changed here; only the last run's ms is written.
// With no time on the clock the runs stay as they are: a stop passes through "no run, no time" for a moment (the
// clock clears its run before it writes the time used), and that must not wipe the split. Reset time clears the runs
// on purpose, with resetRunFields. Returns the same entry when nothing changes.
export function syncRuns(entry, event, now, limit) {
  if (!entry || !hasRuns(event)) return entry;
  const t = entry.timing || {};
  const totalMs = usedAt(t, now, limit) * 1000;
  if (!hasTime(t, totalMs)) return entry;
  const stored = storedRuns(entry);
  let next;
  if (!stored.length) next = [{ side: eventRuns(event)[0].side, startedAt: firstStart(t, now), ms: totalMs }];
  else {
    const fixed = stored.slice(0, -1).reduce((s, r) => s + Math.max(0, Number(r.ms) || 0), 0);
    next = stored.slice(0, -1).concat([Object.assign({}, stored[stored.length - 1], { ms: Math.max(0, totalMs - fixed) })]);
  }
  return JSON.stringify(next) === JSON.stringify(entry.runs || []) ? entry : Object.assign({}, entry, { runs: next });
}

// Every entry of a room brought up to date with its clock (syncRuns), as after a reload brought back a saved clock.
// Returns the same room when nothing changes. updateEntry: room.js updateEntry (passed in, so this file stays free of
// the room model).
export function syncAll(room, event, now, limit, updateEntry) {
  let next = room;
  for (const e of (room && room.entries) || []) next = updateEntry(next, e.id, (x) => syncRuns(x, event, now, limit), now);
  return next;
}

// The fields "Reset time" clears on an F4 entry, beside the clock (timer-view.js resetFields; its Undo puts them back).
export const resetRunFields = () => ({ runs: [] });

// "Con started": the run on now is fixed at the time on the clock, and the next run starts now. Returns
// { entry, refused } — refused is '' or the reason in words (the entry is then unchanged).
export function markNextRun(entry, event, now, limit) {
  const sides = eventRuns(event);
  const runs = runsAt(entry, event, now, limit);
  if (!hasRuns(event)) return { entry, refused: 'This event has one run.' };
  if (!runs.length) return { entry, refused: 'Start the clock for ' + sides[0].label + ' first.' };
  if (runs.length >= sides.length) return { entry, refused: 'Every run has started.' };
  const side = sides[runs.length];
  return { entry: Object.assign({}, entry, { runs: runs.concat([{ side: side.side, startedAt: now, ms: 0 }]) }), refused: '' };
}

// Undo "Con started": the split goes, and its time goes back to the run before (syncRuns works that out).
export function unmarkLastRun(entry, event, now, limit) {
  const stored = storedRuns(entry);
  if (stored.length < 2) return entry;
  return syncRuns(Object.assign({}, entry, { runs: stored.slice(0, -1) }), event, now, limit);
}

// Where the entry is, for the phase bar: index -1 (no time yet), 0 .. n-1 (that run is on), or n (every run is
// done: the clock stopped during the last run).
export function runsPhase(entry, event, now, limit) {
  const n = eventRuns(event).length;
  const runs = runsAt(entry, event, now, limit);
  const running = Boolean(entry && entry.timing && entry.timing.run);
  if (!runs.length) return { index: -1 };
  const at = runs.length - 1;
  return { index: at === n - 1 && !running ? n : at };
}

// The phase bar model (phase-bar.js) for an F4 entry: one phase per run, with its time once it has one, and the
// "Next: ..." line.
export function runsBarModel(entry, event, now, limit) {
  const sides = eventRuns(event);
  const runs = runsAt(entry, event, now, limit);
  const { index } = runsPhase(entry, event, now, limit);
  const phases = sides.map((s, i) => ({ id: s.side, label: s.label, time: runs[i] ? clockText(Math.floor(runs[i].ms / 1000)) : '' }));
  let next;
  if (index < 0) next = 'Next: ' + sides[0].label + '. Start the clock when the ' + sides[0].label + ' speech begins.';
  else if (index < sides.length - 1) next = 'Next: ' + sides[index + 1].label + '. Tap ' + sides[index + 1].label + ' started when it begins.';
  else if (index === sides.length - 1) next = 'Next: stop the clock when the ' + sides[index].label + ' speech ends.';
  else next = sides.map((s) => s.label).join(' and ') + ' are done.';
  return { label: sides.map((s) => s.label).join(', then '), phases, current: index, next };
}

// The text of each run for a roster row or a card: "Pro 4:12 · Con 3:58" ('' with no time yet).
export const runsLine = (entry, event, now, limit) => runsAt(entry, event, now, limit).map((r) => labelOf(event, r.side) + ' ' + clockText(Math.floor(r.ms / 1000))).join(' · ');

// The student's topic, as typed (cut to TOPIC_MAX). Returns the new entry.
export const setTopic = (entry, text) => Object.assign({}, entry, { topic: String(text == null ? '' : text).slice(0, TOPIC_MAX) });

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).runs = Object.freeze({
  runEntryDefaults, TOPIC_MAX, eventRuns, hasRuns, runsAt, syncRuns, syncAll, resetRunFields, labelOf, markNextRun, unmarkLastRun, runsPhase, runsBarModel, runsLine, setTopic,
});
