// Speech Events step S4 (docs/events/EXPERIENCE.md §3): the F2 draw gap. Pure: no DOM, no storage, no clock.
// An extemp speaker draws a question and preps outside, so the next speaker comes in some minutes after the last one.
// The gap (7 or 10 minutes) is not confirmed, so it is a setting (settings.js DRAW_GAPS, drawGapOf); the caller
// passes the gap in minutes.
import { familyOf } from './data.js';
import { entryOf } from './room.js';

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

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).drawGap = Object.freeze({ waitingLine });
