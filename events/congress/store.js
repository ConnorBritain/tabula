// Speech Events step S6 (docs/events/CONGRESS.md §6, EXPERIENCE.md §8.1): the Congress store. Pure: no DOM, no
// storage, no clock. The page reads and writes the one value under CONGRESS_KEY through these functions.
//
// Congress chambers and sessions live under their own key, tabulaEvents.congress.v1, and never in rooms.v1: every
// rooms.v1 reader assumes a room with entries[], so a Congress session there would break the Rooms list, History and
// the backup reader (EXPERIENCE.md §8.1 [crit]). Nothing in this folder reads or writes ROOMS_KEY.
//
// The saved value: { v: 1, chambers: [Chamber], sessions: [CongressSession], prefs: { profileId?, scale? } }.
// Read-time migration (the same rules as events/js/migrate.js): a field a record has is never changed or dropped;
// only a missing field gets its default; running it twice gives the same result as once.
import { PREFIX } from '../js/store.js';
import { dayOf } from '../js/rooms.js';

export const CONGRESS_KEY = PREFIX + 'congress.v1';

const isRecord = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const list = (x) => (Array.isArray(x) ? x : []);

// A copy of rec with each missing default filled in. A default that is a list or a record is made fresh for each
// record, so two records never share one mutable default.
function fill(rec, defaults) {
  const out = Object.assign({}, rec);
  for (const k of Object.keys(defaults)) if (!has(out, k)) out[k] = typeof defaults[k] === 'function' ? defaults[k]() : defaults[k];
  return out;
}

export const CHAMBER_DEFAULTS = Object.freeze({ house: 'house', role: 'scorer', legislators: () => [], docket: () => [], sessionIds: () => [] });
export const LEGISLATOR_DEFAULTS = Object.freeze({ status: 'present' });
export const SESSION_DEFAULTS = Object.freeze({ speeches: () => [], poTerms: () => [], ranks: () => [], recency: () => [], live: null, itemId: null });
export const SPEECH_DEFAULTS = Object.freeze({ side: 'aff', type: 'rebuttal', speakMs: 0, questionMs: 0, questionerIds: () => [], points: null, penalty: null, comment: '', commentSource: 'judge' });

export function migrateChamber(c) {
  if (!isRecord(c)) return c;
  const out = fill(c, CHAMBER_DEFAULTS);
  out.legislators = list(out.legislators).map((l) => (isRecord(l) ? fill(l, LEGISLATOR_DEFAULTS) : l));
  return out;
}

export function migrateSession(s) {
  if (!isRecord(s)) return s;
  const out = fill(s, SESSION_DEFAULTS);
  out.speeches = list(out.speeches).map((x) => (isRecord(x) ? fill(x, SPEECH_DEFAULTS) : x));
  return out;
}

// The whole saved value. Something that is not a record (missing, or damaged storage) reads as an empty store.
export function migrateCongress(raw) {
  const r = isRecord(raw) ? raw : {};
  return Object.assign({}, r, {
    v: has(r, 'v') ? r.v : 1,
    chambers: list(r.chambers).map(migrateChamber),
    sessions: list(r.sessions).map(migrateSession),
    prefs: isRecord(r.prefs) ? r.prefs : {},
  });
}

const upsert = (arr, rec) => {
  const out = arr.slice();
  const i = out.findIndex((x) => x && x.id === rec.id);
  if (i < 0) out.push(rec); else out[i] = rec;
  return out;
};

export const withChamber = (state, chamber) => Object.assign({}, state, { chambers: upsert(state.chambers, chamber) });
export const withSession = (state, session) => Object.assign({}, state, { sessions: upsert(state.sessions, session) });
export const findChamber = (state, id) => state.chambers.find((c) => c && c.id === id) || null;
export const findSession = (state, id) => state.sessions.find((s) => s && s.id === id) || null;
// The sessions of one chamber, by session number.
export const chamberSessions = (state, chamberId) => state.sessions.filter((s) => s && s.chamberId === chamberId).sort((a, b) => a.number - b.number);

// The page's reader and writer over a core/store.js store (env.store). Every read goes through the migration.
export function congressIO(store) {
  return Object.freeze({
    read: () => migrateCongress(store.get(CONGRESS_KEY, null)),
    write: (state) => store.set(CONGRESS_KEY, state),
  });
}

// Congress chambers in use today (step S6 keeps them in tabulaEvents.congress.v1, apart from rounds and cards): a chamber
// made today, or one with a session made or saved today. state: the migrated Congress value. Returns [{ id, label }].
// My day (events/js/myday-screen.js) shows these through env.congressToday, so it never reads the Congress shape.
export function congressToday(state, now) {
  const today = dayOf(now);
  const s = state || {};
  const touched = (t) => Number.isFinite(t) && dayOf(t) === today;
  return (Array.isArray(s.chambers) ? s.chambers : []).filter((c) => c && c.id && (touched(c.createdAt)
    || (Array.isArray(s.sessions) ? s.sessions : []).some((x) => x && x.chamberId === c.id && (touched(x.createdAt) || touched(x.updatedAt)))))
    .map((c) => ({ id: c.id, label: [c.house === 'senate' ? 'Senate' : 'House', c.tournament, c.roomLabel ? 'Room ' + c.roomLabel : ''].filter(Boolean).join(' · ') }));
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressStore = Object.freeze({ CONGRESS_KEY, migrateCongress, migrateChamber, migrateSession,
  withChamber, withSession, findChamber, findSession, chamberSessions, congressIO, congressToday });
