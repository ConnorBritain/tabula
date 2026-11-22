// Tabula Speech Events: the Rooms list (docs/events/ARCHITECTURE.md §5 screen 1, §6.3 the room record; step E1). Pure:
// it groups the saved rooms by day, says what each row shows, and builds the list's HTML text. app.js puts it on the page.
import { escapeHtml as esc } from '../../core/sheets.js';

// The words for a room's state on its row.
export const STATE_LABEL = { setup: 'Set up', judging: 'Judging', ranking: 'Ranking', review: 'Review', done: 'Copied' };

// The local day of a time, as YYYY-MM-DD (the list groups by tournament day).
const dayOf = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// Rooms grouped by day, newest day first; inside a day, the newest room first. A broken record (no id or no time) is
// left out of the list, never shown half-drawn.
export function groupRoomsByDay(rooms) {
  const ok = (rooms || []).filter((r) => r && r.id && Number.isFinite(r.createdAt));
  const days = new Map();
  for (const r of ok.slice().sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))) {
    const d = dayOf(r.createdAt);
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(r);
  }
  return [...days.keys()].sort().reverse().map((day) => ({ day, rooms: days.get(day) }));
}

// What one row shows: the event name, the round, the number of entries and the state.
// events: the events registry (core/defs.js); a room names its event's id and version.
export function roomRow(room, events) {
  const ev = events && events.get(room.eventId, room.eventVersion);
  const n = (room.entries || []).length;
  return {
    id: room.id,
    name: ev ? ev.name : 'Custom event',
    round: [room.tournament, room.round, room.flight ? 'Flight ' + room.flight : ''].filter(Boolean).join(' · '),
    count: n + (n === 1 ? ' entry' : ' entries'),
    state: STATE_LABEL[room.state] || STATE_LABEL.setup,
  };
}

// The Rooms list as HTML text: one section per day, one row per room; each row opens its room (step E4). Every text
// is escaped.
export function roomsHtml(groups, events) {
  return groups.map((g) => `<section class="room-day" aria-label="${esc(g.day)}"><h2>${esc(g.day)}</h2><ul class="room-list">`
    + g.rooms.map((r) => { const row = roomRow(r, events); return `<li><a class="room-link" href="#/room/${encodeURIComponent(row.id)}"><span class="room-name">${esc(row.name)}</span><span>${esc(row.round)}</span><span class="room-meta">${esc(row.count)} · ${esc(row.state)}</span></a></li>`; }).join('')
    + '</ul></section>').join('');
}
