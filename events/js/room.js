// Speech Events step E4 (docs/events/LANDING.md §4.1): the room and entry model (primitive N1) and the roster rules
// (N7). Pure: no DOM, no storage, no clock (the caller passes `now` and an id maker). The screens call these functions
// and save the room they get back.
//
// A room is the record the judge makes (ARCHITECTURE.md §6.3). Every function here returns a NEW room and leaves the
// one it was given unchanged, so a screen can keep the old room for Undo checks and tests can compare both.
// The entries array is always in speaking order, and entry.order is always its place, 1 to N.

// The events turned on so far, in published order (setup-screen.js lists them in that order). F1a, public address
// (LANDING.md §4.1 E4): oo, inf, exp, osw. F2, extemp with a drawn question (E10): usx, ix, com, mx. F1b, F3 and
// Custom come in E9, E11 and E12.
export const ENABLED_EVENTS = Object.freeze(['oo', 'inf', 'usx', 'ix', 'com', 'exp', 'osw', 'mx']);
// The rules profile a new room starts with (the NSDA district preset).
export const DEFAULT_PROFILE = 'nsda-district';
// A room holds 1 to 8 entries (ARCHITECTURE.md §1: one judge, one room, 4 to 8 speakers; MODELS.md §3: 1..8).
export const MAX_ENTRIES = 8;

// The words for each entry status on the roster pill (DESIGN.md §4.1).
export const STATUS_LABEL = Object.freeze({ waiting: 'Waiting', speaking: 'Speaking', done: 'Done', noShow: 'No show' });

// An entry code: letters and digits with an optional hyphen, 1 to 12 characters (the paste parser makes the same
// shapes: "A12", "1024", "AB-104").
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/;
export const normCode = (s) => String(s == null ? '' : s).trim().toUpperCase();

const clone = (x) => JSON.parse(JSON.stringify(x));
const renumber = (entries) => entries.map((e, i) => Object.assign({}, e, { order: i + 1 }));
const withEntries = (room, entries, now) => Object.assign({}, room, { entries: renumber(entries), updatedAt: now });

// An id that is random and holds no tournament name or code (ARCHITECTURE.md §6.4: a room ID is a random ID).
export function newId(prefix) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(6));
  return (prefix || '') + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// One new entry. code: already checked with codeError.
export function makeEntry(code, name, id) {
  return {
    id: id || newId('e'),
    code: normCode(code),
    name: String(name || '').trim(),
    order: 0,
    status: 'waiting',
    timing: { run: null, runs: [], usedMs: 0, overLimit: false, overGrace: false },
    notes: '',
    privateNote: '',
    tags: [],
    checks: {},
    comment: null,
    commentSource: 'judge',
  };
}

// The error for a code the judge types, or '' when it is fine. room: the room it goes into (a code is used once).
// exceptId: the entry being renamed, which may keep its own code.
export function codeError(code, room, exceptId) {
  const c = normCode(code);
  if (!c) return 'Type the entry code, for example A12.';
  if (!CODE_RE.test(c)) return 'Use letters, numbers and a hyphen only, for example A12.';
  if (room && (room.entries || []).some((e) => e.code === c && e.id !== exceptId)) return c + ' is already in this room.';
  return '';
}

// A new room in the setup state. opts:
//   event, profile: the event file and rules profile objects (from the registries). The room keeps the event's id and
//     version, and a full copy of the profile, so later edits never change it (ARCHITECTURE.md §6.3, MODELS.md §3).
//   entries: [{ code, name }] in speaking order (from the paste parser or typed).
//   tournament, round, flight: optional text.   now: the time.   makeId: an id maker (newId by default).
export function createRoom(opts) {
  const o = opts || {};
  const mk = o.makeId || newId;
  if (!o.event || !o.profile) throw new Error('createRoom needs an event and a profile');
  const profile = clone(o.profile);
  delete profile.key; // the registry's own field, not a rule
  if ((o.entries || []).length > MAX_ENTRIES) throw new Error('createRoom: a room holds at most ' + MAX_ENTRIES + ' entries (setupError checks this first)');
  const seen = new Set();
  const entries = [];
  for (const x of o.entries || []) {
    const code = normCode(x.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    entries.push(makeEntry(code, x.name, mk('e')));
  }
  return {
    id: mk('r'),
    createdAt: o.now,
    updatedAt: o.now,
    productLine: 'events',
    eventId: o.event.id,
    eventVersion: o.event.version,
    profile,
    tournament: String(o.tournament || '').trim(),
    round: String(o.round || '').trim(),
    flight: String(o.flight || '').trim(),
    state: 'judging',
    current: entries.length ? entries[0].id : null,
    entries: renumber(entries),
    reasonForRank: '',
  };
}

// Why a room cannot start yet, in plain words, or '' when it can. parsed: the paste parser's result.
export function setupError(parsed, eventId) {
  if (!ENABLED_EVENTS.includes(eventId)) return 'Pick the event.';
  const n = (parsed && parsed.entries || []).length;
  const c = (parsed && parsed.check || []).length;
  if (c) return 'Sort out the ' + (c === 1 ? 'line' : c + ' lines') + ' under "Check these" first.';
  if (!n) return 'Paste the room, or type one code per line.';
  if (n > MAX_ENTRIES) return 'A room holds at most ' + MAX_ENTRIES + ' entries. This text has ' + n + '.';
  return '';
}

export const entryOf = (room, id) => (room && room.entries || []).find((e) => e.id === id) || null;
export const indexOf = (room, id) => (room && room.entries || []).findIndex((e) => e.id === id);
// The entries that are in the room (not "No show"): the ones that speak and get a rank.
export const present = (room) => (room && room.entries || []).filter((e) => e.status !== 'noShow');

// Change one entry: fn(entry) returns the new entry (or the same one for no change). Returns the new room.
export function updateEntry(room, id, fn, now) {
  let changed = false;
  const entries = room.entries.map((e) => { if (e.id !== id) return e; const n = fn(e); changed = n !== e; return n; });
  return changed ? Object.assign({}, room, { entries, updatedAt: now }) : room;
}

// Pick the entry the judge works on now.
export function selectEntry(room, id, now) {
  if (!entryOf(room, id)) return room;
  return Object.assign({}, room, { current: id, updatedAt: now });
}

// Number keys 1–8: the entry at that place on the roster (1-based), or null.
export function entryAtNumber(room, n) {
  const list = (room && room.entries) || [];
  return Number.isInteger(n) && n >= 1 && n <= list.length ? list[n - 1] : null;
}

// "Next speaker": the first waiting entry after the current one, going round to the top; else the first waiting
// entry at all; else null (every entry has spoken or is a no show).
export function nextWaiting(room) {
  const list = (room && room.entries) || [];
  const at = Math.max(0, indexOf(room, room && room.current));
  for (let k = 1; k <= list.length; k++) {
    const e = list[(at + k) % list.length];
    if (e.status === 'waiting') return e;
  }
  return null;
}

// Move an entry to a place on the roster (1-based; late arrivals). The others shift. Returns { room, from, to } with
// from and to as places; a move to the same place or outside the list returns the room unchanged and moved false.
export function moveEntry(room, id, to, now) {
  const list = room.entries.slice();
  const from = indexOf(room, id);
  const t = Math.max(1, Math.min(list.length, Number(to)));
  if (from < 0 || !Number.isInteger(Number(to)) || t === from + 1) return { room, moved: false, from: from + 1, to: from + 1 };
  const [e] = list.splice(from, 1);
  list.splice(t - 1, 0, e);
  return { room: withEntries(room, list, now), moved: true, from: from + 1, to: t };
}

// "No show": the entry stays on the roster but does not speak or get a rank. Undo puts back the status it had
// (prev). An entry with time on the clock (running or not) is refused, so no time is ever thrown away.
export function markNoShow(room, id, now) {
  const e = entryOf(room, id);
  if (!e || e.status === 'noShow') return { room, prev: null, refused: '' };
  if (e.timing.run || e.timing.usedMs > 0) return { room, prev: null, refused: e.code + ' already has time on the clock, so it cannot be a no show. Reset the time first.' };
  const list = room.entries.map((x) => (x.id === id ? Object.assign({}, x, { status: 'noShow' }) : x));
  return { room: withEntries(room, list, now), prev: e.status, refused: '' };
}
// Take back "No show" (the row menu or Undo). status: the status to give back ('waiting' when not known).
export function clearNoShow(room, id, now, status) {
  const e = entryOf(room, id);
  if (!e || e.status !== 'noShow') return room;
  const list = room.entries.map((x) => (x.id === id ? Object.assign({}, x, { status: status || 'waiting' }) : x));
  return withEntries(room, list, now);
}

// Add a late entry at the end of the roster. Returns { room, entry, error }.
export function addEntry(room, code, name, now, id) {
  const error = codeError(code, room);
  if (error) return { room, entry: null, error };
  if (room.entries.length >= MAX_ENTRIES) return { room, entry: null, error: 'A room holds at most ' + MAX_ENTRIES + ' entries.' };
  const entry = makeEntry(code, name, id);
  const next = withEntries(room, room.entries.concat([entry]), now);
  return { room: next.current ? next : Object.assign(next, { current: entry.id }), entry: entryOf(next, entry.id), error: '' };
}

// Remove an entry. Returns { room, removed: { entry, place } } for Undo (restoreEntry). The current entry moves to
// the next one on the list. A running timer must be stopped by the caller first.
export function removeEntry(room, id, now) {
  const at = indexOf(room, id);
  if (at < 0) return { room, removed: null };
  const entry = room.entries[at];
  const list = room.entries.filter((e) => e.id !== id);
  const next = withEntries(room, list, now);
  if (room.current === id) next.current = list.length ? list[Math.min(at, list.length - 1)].id : null;
  return { room: next, removed: { entry, place: at + 1, wasCurrent: room.current === id } };
}
// Undo a remove: put the entry back at its old place (or the end, if the list is shorter now). A code someone has
// added again since is not doubled: the restore is refused and the room stays as it is.
export function restoreEntry(room, removed, now) {
  if (!removed || !removed.entry || entryOf(room, removed.entry.id)) return room;
  if (room.entries.some((e) => e.code === removed.entry.code)) return room;
  const list = room.entries.slice();
  list.splice(Math.min(removed.place - 1, list.length), 0, removed.entry);
  const next = withEntries(room, list, now);
  return next.current && !removed.wasCurrent ? next : Object.assign(next, { current: removed.entry.id });
}

// One roster action from the row menu, with its Undo (DESIGN.md §4.1, §1 rule 6). action: 'up' | 'down' | 'end' |
// 'noshow' | 'show' | 'remove'. Returns { room, message, undo(room, now) -> room, refused } — refused is '' or the
// reason in words (the room is then unchanged and there is no undo). undo works on the room as it is when the judge
// taps Undo, so a change made in between (a pick, a note) is kept.
export function rosterAction(room, action, id, now) {
  const e = entryOf(room, id);
  const none = (refused) => ({ room, message: '', undo: null, refused: refused || '' });
  if (!e) return none('That entry is not in this room.');
  if (action === 'up' || action === 'down' || action === 'end') {
    const from = indexOf(room, id) + 1;
    const res = moveEntry(room, id, action === 'up' ? from - 1 : action === 'down' ? from + 1 : room.entries.length, now);
    if (!res.moved) return none();
    return { room: res.room, message: e.code + ' moved to place ' + res.to + '.', undo: (cur, t) => moveEntry(cur, id, res.from, t).room, refused: '' };
  }
  if (action === 'noshow') {
    const res = markNoShow(room, id, now);
    if (res.refused || !res.prev) return none(res.refused);
    return { room: res.room, message: e.code + ' marked no show.', undo: (cur, t) => clearNoShow(cur, id, t, res.prev), refused: '' };
  }
  if (action === 'show') {
    if (e.status !== 'noShow') return none();
    return { room: clearNoShow(room, id, now), message: e.code + ' is back on the roster.', undo: (cur, t) => markNoShow(cur, id, t).room, refused: '' };
  }
  if (action === 'remove') {
    if (e.timing.run) return none('Stop the clock for ' + e.code + ' first.');
    const res = removeEntry(room, id, now);
    return { room: res.room, message: e.code + ' removed.', undo: (cur, t) => restoreEntry(cur, res.removed, t), refused: '' };
  }
  return none('Unknown action.');
}

// Put a room into the saved list (replace the one with the same id, or add it at the front).
export function upsertRoom(rooms, room) {
  const list = Array.isArray(rooms) ? rooms.slice() : [];
  const i = list.findIndex((r) => r && r.id === room.id);
  if (i >= 0) list[i] = room; else list.unshift(room);
  return list;
}
export const findRoom = (rooms, id) => (Array.isArray(rooms) ? rooms : []).find((r) => r && r.id === id) || null;

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).room = Object.freeze({
  ENABLED_EVENTS, DEFAULT_PROFILE, MAX_ENTRIES, STATUS_LABEL, normCode, newId, makeEntry, codeError, createRoom, setupError,
  entryOf, indexOf, present, updateEntry, selectEntry, entryAtNumber, nextWaiting, moveEntry, markNoShow, clearNoShow,
  addEntry, removeEntry, restoreEntry, rosterAction, upsertRoom, findRoom,
});
