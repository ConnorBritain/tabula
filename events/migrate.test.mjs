// Tests for step S2's read-time migration (docs/events/EXPERIENCE.md §8.1 [crit]): an old room and an old backup,
// shaped like the data judges have saved since step E13, open with no change to any field they already hold.
// The fixtures (events/fixtures/old/) were made by today's createRoom and then judged by hand: times, ranks, a no
// show, comments, a drawn question, a Custom event room and copy marks. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrateRoom, migrateRooms, migrateSettings, ROUND_DEFAULTS, SETTINGS_DEFAULTS } from './js/migrate.js';
import { readBackup, restoreItems } from './js/settings.js';
import { ROOMS_KEY, SETTINGS_KEY } from './js/store.js';
import { KEYS_KEY } from './js/ai-key.js';
import { loadEventData } from './js/data.js';
import { historyRows } from './js/history.js';
import { groupRoomsByDay, roomRow } from './js/rooms.js';
import { loadWorkspace, roundFamily } from './js/workspaces.js';
import { ranksProblems } from './js/ballot.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const OLD_ROOM_TEXT = read('fixtures/old/room-hi.json');
const OLD_BACKUP_TEXT = read('fixtures/old/backup.json');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));

// Every field of before is in after with the same value (deep), and after adds only the named defaults.
function keptAndAdded(before, after, defaults) {
  for (const k of Object.keys(before)) assert.deepEqual(after[k], before[k], k + ' is unchanged');
  for (const k of Object.keys(after)) if (!(k in before)) assert.ok(k in defaults, k + ' is a default, not an invented field');
}

// Why: a judge's saved room is the ballot they still have to copy; if the migration changed or dropped one field (a
// rank, a time, a comment), the ballot they paste into Tabroom would be wrong with no warning.
test('an old room opens with every field it had unchanged, and only mode and level added', () => {
  const before = JSON.parse(OLD_ROOM_TEXT);
  assert.ok(!('mode' in before) && !('level' in before), 'the fixture is from before S2');
  const after = migrateRoom(before);
  keptAndAdded(before, after, ROUND_DEFAULTS);
  assert.equal(after.mode, 'tournament');
  assert.equal(after.level, 'prelim');
  assert.equal(JSON.stringify(before), JSON.stringify(JSON.parse(OLD_ROOM_TEXT)), 'the record it was given is not changed in place');
});

// Why: the migration runs at every read; if a second run changed anything, each reload would drift the saved data a
// little more, and a value the judge set (an elim) would fall back to the default.
test('the migration is idempotent and never overwrites a value that is there, even one it does not know', () => {
  const once = migrateRoom(JSON.parse(OLD_ROOM_TEXT));
  assert.deepEqual(migrateRoom(once), once);
  const elim = migrateRoom(Object.assign(JSON.parse(OLD_ROOM_TEXT), { level: 'elim', mode: 'practice' }));
  assert.equal(elim.level, 'elim');
  assert.equal(elim.mode, 'practice');
  assert.equal(migrateRoom(Object.assign({}, once, { level: 'quarters' })).level, 'quarters', 'an unknown value is kept, not "fixed"');
  const s = migrateSettings({ theme: 'dark', mode: 'coach' });
  assert.deepEqual(migrateSettings(s), s);
  assert.equal(s.theme, 'dark');
  assert.equal(s.mode, 'coach');
});

// Why: damaged storage (a null, a string where a list should be) must not crash the page or make up a room; the
// Rooms list already leaves broken records out, and the migration must keep it that way.
test('broken values read safely: no rooms from a non-list, defaults from a non-record, broken records untouched', () => {
  assert.deepEqual(migrateRooms(null), []);
  assert.deepEqual(migrateRooms('oops'), []);
  assert.deepEqual(migrateRooms([null, 'x', 5]), [null, 'x', 5]);
  assert.deepEqual(migrateSettings(null), SETTINGS_DEFAULTS);
  assert.deepEqual(migrateSettings([1]), SETTINGS_DEFAULTS);
  assert.deepEqual(groupRoomsByDay(migrateRooms([null, { id: 'c' }])), []);
});

// Why: an old room must still open in its workspace and read the same in every screen after the migration; if a
// reader saw a different room, the Rooms row, History or the rank check would disagree with what the judge did.
test('an old room reads the same after the migration on the Rooms list, in History and in the rank check', async () => {
  const before = JSON.parse(OLD_ROOM_TEXT);
  const after = migrateRoom(before);
  assert.deepEqual(roomRow(after, DATA.events), roomRow(before, DATA.events));
  assert.deepEqual(ranksProblems(after), ranksProblems(before));
  assert.equal(roundFamily(DATA.events, after), 'f1');
  const ws = await loadWorkspace(roundFamily(DATA.events, after));
  assert.deepEqual(ws.summary(after), ws.summary(before));
  const [row] = historyRows([before], DATA.events);
  assert.equal(row.level, 'Prelim', 'History shows the default level for an old room');
  assert.equal(row.commentsOpen, true, 'ranks copied but comments not all copied: comments are open');
});

// Why: a backup is how a judge moves their season to a new device; if restoring an old file changed a round or the
// theme, the new device would hold different ballots than the old one.
test('an old backup restores every round and setting with no change to what it held', () => {
  const file = JSON.parse(OLD_BACKUP_TEXT);
  const oldRooms = JSON.parse(file.storage[ROOMS_KEY]);
  const b = readBackup(OLD_BACKUP_TEXT);
  assert.equal(b.rounds, 3);
  const rooms = JSON.parse(b.storage[ROOMS_KEY]);
  assert.equal(rooms.length, oldRooms.length);
  rooms.forEach((r, i) => keptAndAdded(oldRooms[i], r, ROUND_DEFAULTS));
  keptAndAdded(JSON.parse(file.storage[SETTINGS_KEY]), JSON.parse(b.storage[SETTINGS_KEY]), SETTINGS_DEFAULTS);
  assert.equal(JSON.parse(b.storage[SETTINGS_KEY]).theme, 'dark');
  assert.equal(b.storage['tabulaEvents.aiModels.v1'], file.storage['tabulaEvents.aiModels.v1'], 'a value the migration does not cover is written as it was');
  const items = restoreItems({ [KEYS_KEY]: '{"openai":"sk-local"}', [ROOMS_KEY]: '[]' }, b);
  assert.equal(items[KEYS_KEY], '{"openai":"sk-local"}', 'a backup with no key keeps the key this device has');
  assert.equal(items[ROOMS_KEY], b.storage[ROOMS_KEY]);
  assert.deepEqual(readBackup(JSON.stringify(Object.assign({}, file, { storage: b.storage }))).storage, b.storage, 'restoring a restored backup changes nothing more');
});
