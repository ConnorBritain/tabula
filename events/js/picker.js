// Speech Events step S3 (docs/events/EXPERIENCE.md §5.2): the type picker's rows, #/pick. Pure: no DOM.
// picker-screen.js draws the list and the confirm sheet.
//   Recent: today's events, then the last 5 used (settings.recentEvents).
//   All events: grouped by family (Interp, Public address, Limited prep, Custom). An empty group is not shown. There
//   is no league pack yet, so there is no Suggested section.
// Each row: the name, one plain line (guide.js), and gray chips made from the event file, for example
//   RANK · TITLE · TIMER 10:00
// A new event file gets its chips with no new code.
import { ENABLED_EVENTS, CUSTOM_EVENT } from './room.js';
import { familyOf } from './data.js';
import { eventLine } from './guide.js';
import { clockText } from './timer.js';

export const GROUPS = Object.freeze([
  { id: 'interp', title: 'Interp' },
  { id: 'publicAddress', title: 'Public address' },
  { id: 'limitedPrep', title: 'Limited prep' },
  { id: 'custom', title: 'Custom' },
]);

// The chips for one event file.
export function chipsOf(def) {
  if (!def) return ['RANK', 'TIMER YOU SET'];
  const out = ['RANK'];
  if ((def.checks || []).includes('titleAuthor')) out.push('TITLE');
  if (def.performers === 2) out.push('PAIR');
  if (familyOf(def) === 'f2') out.push('QUESTION');
  if (def.timing && def.timing.inRoomPrep) out.push('PREP IN ROOM');
  out.push('TIMER ' + clockText(Number(def.timing && def.timing.limit) || 0));
  return out;
}

// Every row the picker can show, in published order, then the Custom event. data: { events, order }.
export function pickerRows(data) {
  const rows = (data.order || []).filter((id) => ENABLED_EVENTS.includes(id)).map((id) => data.events.get(id)).filter(Boolean)
    .map((d) => ({ id: d.id, name: d.name, short: d.short, line: eventLine(d.id), chips: chipsOf(d), group: d.category }));
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
export function pickerSections(rows, recent, q) {
  if (String(q || '').trim()) return [{ id: 'results', title: 'Results', rows: searchRows(rows, q) }];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = [{ id: 'recent', title: 'Recent', rows: (recent || []).map((id) => byId.get(id)).filter(Boolean) }];
  for (const g of GROUPS) out.push({ id: g.id, title: g.title, rows: rows.filter((r) => r.group === g.id) });
  return out.filter((s) => s.rows.length);
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).picker = Object.freeze({ GROUPS, chipsOf, pickerRows, recentIds, searchRows, pickerSections });
