// Speech Events step S4 (docs/events/EXPERIENCE.md §3, §3.2, §8.2, §8.5): the F2 (extemp) parts that change in elims,
// and the F2 draw gap. Pure: no DOM, no storage, no clock (the caller passes now).
//
// Cross-ex in elims. A rules profile with elim.cx turns on a cross-ex phase for F2 events, in elim rounds only. Each
// speaker is asked by another speaker ("Q: speaker X"); by default the one before them on the roster (the first
// speaker by the last). The judge can pick another.
// Not verified, so not in any data: who asks whom at a given league, and how long cross-ex lasts. A profile may give
// elim.timing.cx (seconds); with none, the cross-ex clock counts up with no limit and the judge follows the tab room.
//
// Same-school warning: when the asker and the speaker have the same Entry.school, the stage says so. School is
// optional and typed by the judge (it stays on this device).
//
// Entry.cx: { by: entryId | null, ms, run: { startedAt } | null } — the asker and the cross-ex time.
// Entry.school: text, optional.
//
// Draw gap. An extemp speaker draws a question and preps outside, so the next speaker comes in some minutes after the
// last one. The gap (7 or 10 minutes) is not confirmed, so it is a setting (settings.js drawGapMin, drawGapOf).
import { familyOf } from './data.js';
import { entryOf, updateEntry, present } from './room.js';

export const SCHOOL_MAX = 60;

const asText = (v) => (v == null ? '' : String(v).trim());
const cxOf = (e) => (e && e.cx && typeof e.cx === 'object' ? e.cx : { by: null, ms: 0, run: null });

// Is the cross-ex phase on for this round? F2 event, elim round, and a profile with elim.cx.
export function cxOn(room, event) {
  const elim = room && room.profile && room.profile.elim;
  return familyOf(event) === 'f2' && Boolean(room) && room.level === 'elim' && Boolean(elim && elim.cx === true);
}

// The cross-ex limit in seconds from the profile, or null (not given: the clock counts up).
export function cxLimit(profile) {
  const t = profile && profile.elim && profile.elim.timing;
  const s = t && t.cx;
  return Number.isInteger(s) && s > 0 ? s : null;
}

// The asker of an entry: the one the judge picked (when still in the room and not the entry itself), else the present
// entry before it on the roster, going round (the first is asked by the last). null when no one else is present.
export function askerOf(room, id) {
  const e = entryOf(room, id);
  if (!e) return null;
  const by = cxOf(e).by;
  const picked = by && by !== id ? entryOf(room, by) : null;
  if (picked && picked.status !== 'noShow') return picked;
  const list = present(room);
  const at = list.findIndex((x) => x.id === id);
  if (list.length < 2) return null;
  const i = at < 0 ? list.length - 1 : (at - 1 + list.length) % list.length;
  return list[i].id === id ? null : list[i];
}

const withCx = (room, id, fn, now) => updateEntry(room, id, (x) => Object.assign({}, x, { cx: fn(cxOf(x)) }), now);

export const setAsker = (room, id, by, now) => withCx(room, id, (c) => Object.assign({}, c, { by: by && by !== id ? by : null }), now);

export function setSchool(room, id, school, now) {
  return updateEntry(room, id, (x) => Object.assign({}, x, { school: asText(school).slice(0, SCHOOL_MAX) }), now);
}

// The same-school warning for an entry, or ''. Schools match with case and spaces ignored.
export function sameSchoolWarning(room, id) {
  const e = entryOf(room, id);
  const a = askerOf(room, id);
  const norm = (s) => asText(s).toLowerCase().replace(/\s+/g, ' ');
  if (!e || !a || !norm(e.school) || norm(e.school) !== norm(a.school)) return '';
  return 'Same school: ' + a.code + ' would ask ' + e.code + '. Check with the tab room before cross-ex.';
}

// The cross-ex time used, in ms, at now.
export function cxUsed(entry, now) {
  const c = cxOf(entry);
  return (c.ms || 0) + (c.run && Number.isFinite(c.run.startedAt) ? Math.max(0, now - c.run.startedAt) : 0);
}
export const cxRunning = (entry) => Boolean(cxOf(entry).run);

// Start the cross-ex clock. Refused while the entry's speech clock runs (one clock at a time for one speaker).
export function startCx(room, id, now) {
  const e = entryOf(room, id);
  if (!e || cxRunning(e)) return { room, refused: '' };
  if (e.timing && (e.timing.run || e.timing.prepRun)) return { room, refused: 'Stop the speech clock first.' };
  return { room: withCx(room, id, (c) => Object.assign({}, c, { run: { startedAt: now } }), now), refused: '' };
}
export function stopCx(room, id, now) {
  const e = entryOf(room, id);
  if (!e || !cxRunning(e)) return room;
  return withCx(room, id, () => Object.assign({}, cxOf(e), { ms: cxUsed(e, now), run: null }), now);
}
export function resetCx(room, id, now) {
  return withCx(room, id, (c) => Object.assign({}, c, { ms: 0, run: null }), now);
}

// The phase bar for one entry: [{ id, label, state: 'done' | 'now' | 'next' }] and the "Next:" line. Speak is done
// once the speech has time and its clock is stopped; Cross-ex once it has time and its clock is stopped.
export function phases(entry, limitSec, cxSec, now) {
  const t = (entry && entry.timing) || {};
  const speakDone = (t.usedMs || 0) > 0 && !t.run;
  const cxDone = cxUsed(entry, now) > 0 && !cxRunning(entry);
  const label = (word, sec) => word + (sec ? ' ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') : '');
  const list = [
    { id: 'speak', label: label('Speak', limitSec), done: speakDone },
    { id: 'cx', label: label('Cross-ex', cxSec), done: cxDone },
  ];
  const at = list.findIndex((p) => !p.done);
  const out = list.map((p, i) => ({ id: p.id, label: p.label, state: p.done ? 'done' : i === at ? 'now' : 'next' }));
  const nextLine = at < 0 ? 'Both phases done.' : at === 0 && !list[1].done ? 'Next: ' + list[1].label : 'Now: ' + list[at].label;
  return { list: out, nextLine };
}

// ---------- the draw gap ----------
// The gap in minutes comes from the settings (settings.js drawGapOf); the caller passes it in.

// The "Waiting for next speaker · about N min" line for an F2 room, or ''. It shows when no clock runs, the current
// entry has not spoken, and the last speech stopped less than the gap ago. N rounds up, so it never says 0 min.
export function waitingLine(room, event, now, gapMin) {
  if (familyOf(event) !== 'f2' || !room) return '';
  const cur = entryOf(room, room.current);
  if (!cur || (cur.status !== 'waiting' && cur.status !== 'crossEntered')) return '';
  if (room.entries.some((e) => e.timing && (e.timing.run || e.timing.prepRun))) return '';
  let last = -Infinity;
  for (const e of room.entries) for (const r of (e.timing && e.timing.runs) || []) if (Number.isFinite(r.stoppedAt)) last = Math.max(last, r.stoppedAt);
  if (!Number.isFinite(last)) return '';
  const left = gapMin * 60000 - (now - last);
  if (left <= 0) return '';
  return 'Waiting for next speaker · about ' + Math.ceil(left / 60000) + ' min';
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).crossEx = Object.freeze({
  SCHOOL_MAX, cxOn, cxLimit, askerOf, setAsker, setSchool, sameSchoolWarning, cxUsed, cxRunning, startCx, stopCx, resetCx, phases,
  waitingLine,
});
