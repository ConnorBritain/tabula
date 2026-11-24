// Speech Events step S2 (docs/events/EXPERIENCE.md §8.1, §8.2, §8.5): the read-time migration. Pure: no DOM, no
// storage, no clock.
// Before S2 the code had no migration, and every reader of rooms.v1 assumed today's shape. New fields come with
// defaults, filled in here when a record is read, so an old room or an old backup opens with no change to what it
// already holds. The rules, for every function in this file:
//   - a field the record already has is never changed or dropped (even a value this file does not know);
//   - only a missing field gets its default;
//   - running it twice gives the same result as running it once (idempotent).
// app.js reads every room and the settings through these functions (env.rooms, the Rooms list, restore).

// The defaults for a round (room families): a tournament round, a prelim (§8.2).
export const ROUND_DEFAULTS = Object.freeze({ mode: 'tournament', level: 'prelim' });
// The defaults for the device settings (§1.1, §8.5): Judge mode, no mode menu, the system theme.
// Step S3 adds ranksDueMin (§5.3) and recentEvents (the picker's last 5 events, §5.2). A list default is copied on
// every read (fill), so two settings records never share one array.
export const SETTINGS_DEFAULTS = Object.freeze({ mode: 'judge', showModeMenu: false, theme: 'system', ranksDueMin: 10, recentEvents: Object.freeze([]) });
// Step S3 (§8.3): the defaults for a Day and a BallotCard.
export const DAY_DEFAULTS = Object.freeze({ tournament: '', checkInAt: null, standby: false });
export const CARD_DEFAULTS = Object.freeze({ role: 'judge', status: 'notStarted', tournament: '', flight: '', level: 'prelim', roomLabel: '',
  startsAt: null, ranksDueAt: null, submittedAt: null, roundId: null, cancelledAt: null });

const isRecord = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A copy of rec with each missing default filled in. rec itself is never changed.
function fill(rec, defaults) {
  const out = Object.assign({}, rec);
  for (const k of Object.keys(defaults)) if (!has(out, k)) out[k] = Array.isArray(defaults[k]) ? defaults[k].slice() : defaults[k];
  return out;
}

// One round. Something that is not a record (null, a string) is given back as it is: the readers already leave such
// a broken record out (rooms.js groupRoomsByDay), and the migration must not hide or invent one.
export const migrateRoom = (room) => (isRecord(room) ? fill(room, ROUND_DEFAULTS) : room);

// The saved list of rounds. A value that is not a list (missing, or damaged storage) reads as no rounds.
export const migrateRooms = (rooms) => (Array.isArray(rooms) ? rooms.map(migrateRoom) : []);

// The settings record. A value that is not a record reads as the defaults.
export const migrateSettings = (settings) => fill(isRecord(settings) ? settings : {}, SETTINGS_DEFAULTS);

// Step S3: the saved days and cards. A value that is not a list reads as none; an item that is not a record is given
// back as it is (the readers in cards.js leave it out), like migrateRooms.
export const migrateDays = (days) => (Array.isArray(days) ? days.map((d) => (isRecord(d) ? fill(d, DAY_DEFAULTS) : d)) : []);
export const migrateCards = (cards) => (Array.isArray(cards) ? cards.map((c) => (isRecord(c) ? fill(c, CARD_DEFAULTS) : c)) : []);

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).migrate = Object.freeze({ ROUND_DEFAULTS, SETTINGS_DEFAULTS, DAY_DEFAULTS, CARD_DEFAULTS,
  migrateRoom, migrateRooms, migrateSettings, migrateDays, migrateCards });
