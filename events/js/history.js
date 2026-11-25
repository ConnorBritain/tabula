// Speech Events step S2 (docs/events/EXPERIENCE.md §7): the History table and its exports. Pure: no DOM, no storage,
// no clock. history-screen.js draws it.
//
// One table row per round. The filter by event type adds that family's columns where the data exists today: F2 adds
// the questions written. F4 runs and the Congress columns come with those steps (S5, S6).
//
// The exports (Copy as TSV, Download CSV) have one line per entry, so each code sits in its own cell. They hold codes
// only by default: no names and no comments (§6.4, §7). The judge can choose to add them; nothing here sends them
// anywhere: the screen puts the text on the clipboard or in a file on this device.
import { roomEvent, present } from './room.js';
import { STATE_LABEL, dayOf } from './rooms.js';
import { familyOf } from './data.js';
import { questionOf } from './question.js';
import { ballotComment } from './comments.js';
import { migrateRoom } from './migrate.js';

export const LEVEL_LABEL = Object.freeze({ prelim: 'Prelim', elim: 'Elim' });

// Is the comment stage still open? The ranks are copied (sent) but not every comment is (ballot.js markCopied).
export const commentsOpen = (room) => Boolean(room && room.ranksCopiedAt) && room.state !== 'done';

const eventShort = (ev) => (ev ? ev.short || ev.name : 'Custom');
const eventName = (ev) => (ev ? ev.name : 'Custom event');

// The rows of the History table, newest first. A broken record (no id or no time) is left out, as on the Rooms list.
// events: the events registry (core/defs.js).
export function historyRows(rooms, events) {
  return (rooms || []).filter((r) => r && r.id && Number.isFinite(r.createdAt))
    .map(migrateRoom)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => {
      const ev = roomEvent(events, r);
      const list = present(r);
      return {
        id: r.id,
        date: dayOf(r.createdAt),
        tournament: String(r.tournament || ''),
        round: String(r.round || ''),
        flight: String(r.flight || ''),
        level: LEVEL_LABEL[r.level] || String(r.level || ''),
        eventId: r.customEvent ? 'custom' : String(r.eventId || ''),
        event: eventShort(ev),
        eventName: eventName(ev),
        family: familyOf(ev) || 'custom',
        entries: (r.entries || []).length,
        state: STATE_LABEL[r.state] || STATE_LABEL.setup,
        commentsOpen: commentsOpen(r),
        questions: list.filter((e) => questionOf(e)).length + ' of ' + list.length,
      };
    });
}

// The choices for the two filters: each event type and each tournament that some row has, in first-seen order.
export function filterChoices(rows) {
  const events = [], tournaments = [];
  for (const r of rows || []) {
    if (!events.some((e) => e.id === r.eventId)) events.push({ id: r.eventId, label: r.eventId === 'custom' ? 'Custom event' : r.eventName });
    if (r.tournament && !tournaments.includes(r.tournament)) tournaments.push(r.tournament);
  }
  return { events, tournaments };
}

// The rows that match the filter. filter: { eventId, tournament }; '' (or missing) means any.
export const filterRows = (rows, filter) => {
  const f = filter || {};
  return (rows || []).filter((r) => (!f.eventId || r.eventId === f.eventId) && (!f.tournament || r.tournament === f.tournament));
};

// The table's columns for the rows that show: the base columns, plus a family's own columns when every row shown is
// of that family (a filter by one event type). [{ key, label }].
const BASE_COLUMNS = Object.freeze([
  { key: 'date', label: 'Date' }, { key: 'tournament', label: 'Tournament' }, { key: 'round', label: 'Round' },
  { key: 'flight', label: 'Flight' }, { key: 'level', label: 'Level' }, { key: 'event', label: 'Event' },
  { key: 'entries', label: 'Entries' }, { key: 'state', label: 'State' },
]); // "Comments open" is a second pill in the State cell, only when true (design review §2.11), not a column
const FAMILY_COLUMNS = Object.freeze({ f2: [{ key: 'questions', label: 'Questions' }] });
export function historyColumns(rows, filter) {
  const fam = filter && filter.eventId && rows && rows.length && rows.every((r) => r.family === rows[0].family) ? rows[0].family : '';
  return BASE_COLUMNS.concat(FAMILY_COLUMNS[fam] || []);
}

// ---------- the exports ----------
// Text that starts with = + - @ runs as a formula in a spreadsheet. A leading ' keeps it text. This is a copy of the
// debate rules (logic/round.js sheetSafe, csvCell, toCSV, toTSV): the events page may not load debate files, and a new
// core/ module must also load in the debate page. events/console.test.mjs checks the two copies give the same text.
// TODO: move both to core/ when the debate page can load a new core module.
export function sheetSafe(value) {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  const v = String(value);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
// One CSV cell: a comma, a quote or a line break puts the cell in quotes, with each quote doubled (RFC 4180).
export function csvCell(value) {
  const v = sheetSafe(value);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
export const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
// A spreadsheet pastes tab-separated text into separate cells. A tab or a line break inside a value would split it,
// so it becomes one space.
export const toTSV = (rows) => rows.map((r) => r.map((v) => sheetSafe(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');

const STATUS_WORD = Object.freeze({ noShow: 'No show', done: 'Done', speaking: 'Speaking', waiting: 'Waiting' });

// The export table: a header row, then one row per entry of each round. rooms: the saved rounds; ids: the rounds to
// export (the rows that show), in that order. opts: { names, comments } (both false by default: codes only).
export function exportTable(rooms, events, ids, opts) {
  const o = opts || {};
  const head = ['Date', 'Tournament', 'Round', 'Flight', 'Level', 'Event', 'State', 'Order', 'Code', 'Status', 'Rank'];
  if (o.names) head.push('Name');
  if (o.comments) head.push('Comment');
  const out = [head];
  const byId = new Map((rooms || []).filter((r) => r && r.id).map((r) => [r.id, migrateRoom(r)]));
  for (const id of ids || []) {
    const r = byId.get(id);
    if (!r) continue;
    const ev = roomEvent(events, r);
    for (const e of r.entries || []) {
      const row = [Number.isFinite(r.createdAt) ? dayOf(r.createdAt) : '', r.tournament || '', r.round || '', r.flight || '', LEVEL_LABEL[r.level] || r.level || '',
        eventShort(ev), STATE_LABEL[r.state] || STATE_LABEL.setup, e.order == null ? '' : e.order, e.code || '', STATUS_WORD[e.status] || '', e.rank == null ? '' : String(e.rank)];
      if (o.names) row.push(e.name || '');
      if (o.comments) row.push(ballotComment(e));
      out.push(row);
    }
  }
  return out;
}

// The file name for a CSV made on a day (YYYY-MM-DD).
export const csvName = (day) => 'tabula-speech-events-history-' + day + '.csv';

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).history = Object.freeze({ LEVEL_LABEL, commentsOpen, historyRows, filterChoices, filterRows,
  historyColumns, sheetSafe, csvCell, toCSV, toTSV, exportTable, csvName });
