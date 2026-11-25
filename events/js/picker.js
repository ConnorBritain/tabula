// Speech Events step S3 (docs/events/EXPERIENCE.md §5.2): the type picker's rows, #/pick. Pure: no DOM.
// picker-screen.js draws the list and the confirm sheet.
//   Recent: today's events, then the last 5 used (settings.recentEvents).
//   All events: grouped by family (Interp, Public address, Limited prep, Custom). An empty group is not shown. There
//   is no league pack yet, so there is no Suggested section.
// Each row: the name, one plain line (guide.js), and gray chips made from the event file, for example
//   Rank · Title · 10:00
// A new event file gets its chips with no new code.
import { ENABLED_EVENTS, CUSTOM_EVENT } from './room.js';
import { familyOf } from './data.js';
import { eventLine } from './guide.js';
import { clockText } from './timer.js';

export const GROUPS = Object.freeze([
  { id: 'interp', title: 'Interp' },
  { id: 'publicAddress', title: 'Public address' },
  { id: 'limitedPrep', title: 'Limited prep' },
  { id: 'twoRuns', title: 'Two runs' }, // family F4 (Pro Con Challenge, step S5)
  { id: 'custom', title: 'Custom' },
]);

// The chips for one event file: facts in normal case, read as words, not as code (design review §2.2 change 2). The
// time chip shows the limit the way the timer does ("10:00"). Color review §6 Picker: no "Rank" chip on every card
// (every room event is ranked, so it said nothing); a "No ranks" chip would show only where it applies.
export function chipsOf(def) {
  if (!def) return ['Timer you set'];
  const out = [];
  if ((def.checks || []).includes('titleAuthor')) out.push('Title');
  if (def.performers === 2) out.push('Pair');
  if (familyOf(def) === 'f2') out.push('Question');
  if (def.timing && def.timing.inRoomPrep) out.push('Prep in room');
  if (familyOf(def) === 'f4') out.push('Pro then con');
  out.push(clockText(Number(def.timing && def.timing.limit) || 0));
  return out;
}

// Every row the picker can show, in published order, then the Custom event. data: { events, order }.
export function pickerRows(data) {
  const rows = (data.order || []).filter((id) => ENABLED_EVENTS.includes(id)).map((id) => data.events.get(id)).filter(Boolean)
    .map((d) => ({ id: d.id, name: d.name, short: d.short, line: eventLine(d.id), chips: chipsOf(d), group: familyOf(d) === 'f4' ? 'twoRuns' : d.category }));
  rows.push({ id: CUSTOM_EVENT, name: 'Custom event', short: 'Custom', line: eventLine(CUSTOM_EVENT), chips: chipsOf(null), group: 'custom' });
  return rows;
}

// The Recent ids: today's events (in the order the cards were made), then the saved recent list. No doubles; only ids
// the picker has.
export function recentIds(rows, todayEventIds, recent) {
  const have = new Set(rows.map((r) => r.id));
  const out = [];
  for (const id of [].concat(todayEventIds || [], recent || [])) if (have.has(id) && !out.includes(id)) out.push(id);
  return out;
}

// The rows that match a search: every word must be in the name, short name, id or line.
export function searchRows(rows, q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => { const hay = (r.name + ' ' + r.short + ' ' + r.id + ' ' + r.line).toLowerCase(); return words.every((w) => hay.includes(w)); });
}

// The picker as sections: [{ id, title, rows }], with empty sections left out. A search shows one flat "Results" list.
// today (optional; color review §6 Picker): the events judged today get their own "Judged today" group first, and
// Recent keeps the rest.
export function pickerSections(rows, recent, q, today) {
  if (String(q || '').trim()) return [{ id: 'results', title: 'Results', rows: searchRows(rows, q) }];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const todayIds = [...new Set(today || [])].filter((id) => byId.has(id));
  const out = [
    { id: 'today', title: 'Judged today', rows: todayIds.map((id) => byId.get(id)) },
    { id: 'recent', title: 'Recent', rows: (recent || []).filter((id) => !todayIds.includes(id)).map((id) => byId.get(id)).filter(Boolean) },
  ];
  for (const g of GROUPS) out.push({ id: g.id, title: g.title, rows: rows.filter((r) => r.group === g.id) });
  return out.filter((s) => s.rows.length);
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).picker = Object.freeze({ GROUPS, chipsOf, pickerRows, recentIds, searchRows, pickerSections });
