// Speech Events step S2 (docs/events/EXPERIENCE.md §8.1, §8.2, §8.5): the read-time migration. Pure: no DOM, no
// storage, no clock.
// Before S2 the code had no migration, and every reader of rooms.v1 assumed today's shape. New fields come with
// defaults, filled in here when a record is read, so an old room or an old backup opens with no change to what it
// already holds. The rules, for every function in this file:
//   - a field the record already has is never changed or dropped (even a value this file does not know);
//   - only a missing field gets its default;
//   - running it twice gives the same result as running it once (idempotent).
// app.js reads every room and the settings through these functions (env.rooms, the Rooms list, restore).
import { runEntryDefaults } from './runs.js';

// The defaults for a round (room families): a tournament round, a prelim (§8.2).
export const ROUND_DEFAULTS = Object.freeze({ mode: 'tournament', level: 'prelim' });
// The defaults for the device settings (§1.1, §8.5): Judge mode, no mode menu, the system theme.
export const SETTINGS_DEFAULTS = Object.freeze({ mode: 'judge', showModeMenu: false, theme: 'system' });
// Step S5 (§8.2): each entry of an F4 round (round.family 'f4', set by room.js createRoom) gets the run fields, with
// runs.js runEntryDefaults (no runs yet, no topic; a fresh list each time). Entries of other rounds get nothing new.

const isRecord = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A copy of rec with each missing default filled in. rec itself is never changed.
function fill(rec, defaults) {
  const out = Object.assign({}, rec);
  for (const k of Object.keys(defaults)) if (!has(out, k)) out[k] = defaults[k];
  return out;
}

// One round. Something that is not a record (null, a string) is given back as it is: the readers already leave such
// a broken record out (rooms.js groupRoomsByDay), and the migration must not hide or invent one.
const fillEntry = (e) => (isRecord(e) ? fill(e, runEntryDefaults()) : e);
export function migrateRoom(room) {
  if (!isRecord(room)) return room;
  const out = fill(room, ROUND_DEFAULTS);
  if (out.family === 'f4' && Array.isArray(out.entries)) out.entries = out.entries.map(fillEntry);
  return out;
}

// The saved list of rounds. A value that is not a list (missing, or damaged storage) reads as no rounds.
export const migrateRooms = (rooms) => (Array.isArray(rooms) ? rooms.map(migrateRoom) : []);

// The settings record. A value that is not a record reads as the defaults.
export const migrateSettings = (settings) => fill(isRecord(settings) ? settings : {}, SETTINGS_DEFAULTS);

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).migrate = Object.freeze({ ROUND_DEFAULTS, SETTINGS_DEFAULTS, migrateRoom, migrateRooms, migrateSettings });
