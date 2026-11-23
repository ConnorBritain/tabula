// Tests for step S2 "Console basics" (docs/events/EXPERIENCE.md §1.1, §7, §9, §11.1): the History and Settings routes,
// the History table and its TSV and CSV exports, delete with Undo, the settings and the backup file, the palette rows
// and key, and the Ready for offline check. The read-time migration has its own file (migrate.test.mjs).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isReservedCombo, searchCommands } from '../core/keys.js';
import { buildBackup } from '../core/store.js';
import { loadEventData } from './js/data.js';
import { parseRoute, routeHash, roundTarget } from './js/routes.js';
import { createRoom, removeRoom, restoreRoom, upsertRoom } from './js/room.js';
import { customEvent } from './js/custom.js';
import { roomsHtml, groupRoomsByDay } from './js/rooms.js';
import { historyRows, filterRows, filterChoices, historyColumns, exportTable, toCSV, toTSV, csvCell, sheetSafe } from './js/history.js';
import { historyTableHtml, historyHtml } from './js/history-screen.js';
import { modeMenuShown, withSetting, makeBackup, readBackup, restoreItems, BACKUP_APP } from './js/settings.js';
import { settingsHtml, aiPartHtml, keySheetHtml } from './js/settings-screen.js';
import { paletteRows } from './js/palette.js';
import { paletteListHtml } from './js/palette-screen.js';
import { eventChoices } from './js/setup-screen.js';
import { keymap, SHORTCUTS } from './js/keys.js';
import { offlineState } from './js/offline.js';
import { PREFIX, ROOMS_KEY, SETTINGS_KEY } from './js/store.js';
import { KEYS_KEY } from './js/ai-key.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const PROFILE = DATA.profiles.get('nsda-district');
let n = 0;
const makeId = (p) => p + 's2' + (++n);
const DAY1 = new Date(2026, 10, 20, 9).getTime(), DAY2 = new Date(2026, 10, 21, 9).getTime();
const room = (eventId, codes, extra) => Object.assign(createRoom({ event: eventId === 'custom' ? customEvent({ name: 'Radio', limit: '5:00' }) : DATA.events.get(eventId), profile: PROFILE,
  entries: codes.map((c) => (typeof c === 'string' ? { code: c } : c)), round: 'R1', now: DAY1, makeId }), extra || {});

// ---------- routes ----------

// Why: History and Settings live in the address so a reload reopens them; if the old room, rank, review and new
// addresses stopped parsing, live rooms and bookmarks from before S2 would land on the wrong screen.
test('#/history and #/settings round-trip, and every old route still parses as before', () => {
  for (const s of ['history', 'settings']) {
    assert.equal(routeHash(s), '#/' + s);
    assert.deepEqual(parseRoute('#/' + s), { screen: s, id: null });
    assert.equal(roundTarget(parseRoute('#/' + s)), null, 'not a round');
  }
  assert.deepEqual(parseRoute('#/history/x'), { screen: 'rooms', id: null }, 'an extra part is an unknown address');
  assert.deepEqual(parseRoute('#/new'), { screen: 'setup', id: null });
  assert.deepEqual(parseRoute('#/room/r1'), { screen: 'room', id: 'r1' });
  assert.deepEqual(roundTarget(parseRoute('#/review/r1')), { id: 'r1', stage: 'review' });
  assert.deepEqual(parseRoute('#/round/r1/rank'), { screen: 'round', id: 'r1', stage: 'rank' });
  assert.deepEqual(parseRoute(routeHash('round', 'r1')), { screen: 'round', id: 'r1', stage: null });
});

// Why: the palette's "New HI round" opens setup with the event picked; the address must carry only the public event
// code, never a query string (EXPERIENCE.md §6.4), and a bad code must not break the page.
test('#/new/<eventId> opens setup with an event, and only a plain event code is accepted', () => {
  assert.equal(routeHash('setup', 'hi'), '#/new/hi');
  assert.deepEqual(parseRoute('#/new/hi'), { screen: 'setup', id: 'hi' });
  assert.deepEqual(parseRoute('#/new/<b>'), { screen: 'rooms', id: null });
  assert.equal(routeHash('setup', 'Sam Rivera'), '#/new', 'anything that is not an event code is left out of the address');
  assert.doesNotMatch(routeHash('setup', 'hi') + routeHash('history') + routeHash('settings'), /\?/);
});

// ---------- History ----------

// Why: History is where a judge finds a past round and checks which ballots still have comments open; a wrong state,
// level or count would send them to the wrong round at the tournament.
test('History has one row per round, newest first, with level, state, entries and comments open', () => {
  const a = room('hi', ['A1', 'A2'], { createdAt: DAY1, tournament: 'Fall', ranksCopiedAt: DAY1 + 1, state: 'review' });
  const b = room('usx', ['B1'], { createdAt: DAY2, tournament: 'Winter', level: 'elim' });
  const rows = historyRows([a, b, { id: 'broken' }, null], DATA.events);
  assert.deepEqual(rows.map((r) => r.id), [b.id, a.id], 'newest first, broken records left out');
  assert.equal(rows[0].date, '2026-11-21');
  assert.equal(rows[0].level, 'Elim');
  assert.equal(rows[0].event, 'USX');
  assert.equal(rows[1].level, 'Prelim', 'an old room reads as a prelim');
  assert.equal(rows[1].entries, 2);
  assert.equal(rows[1].state, 'Review');
  assert.equal(rows[1].commentsOpen, true);
  assert.equal(rows[0].commentsOpen, false, 'no ranks sent yet: not open');
  assert.equal(historyRows([room('hi', ['A'], { state: 'done', ranksCopiedAt: 1 })], DATA.events)[0].commentsOpen, false, 'all copied: closed');
});

// Why: a judge with a full season filters to one event or one tournament; a filter that dropped or kept the wrong rows
// would make the export hold the wrong ballots.
test('the filter by event type and by tournament, and a family column only where the data exists', () => {
  const rows = historyRows([
    room('hi', ['A'], { tournament: 'Fall' }),
    room('usx', ['B1', 'B2'], { tournament: 'Fall' }),
    room('custom', ['C'], { tournament: 'Winter' }),
  ], DATA.events);
  const ch = filterChoices(rows);
  assert.deepEqual(ch.events.map((e) => e.id).sort(), ['custom', 'hi', 'usx']);
  assert.deepEqual(ch.tournaments, ['Fall', 'Winter']);
  assert.equal(filterRows(rows, { tournament: 'Fall' }).length, 2);
  assert.equal(filterRows(rows, { eventId: 'custom', tournament: 'Fall' }).length, 0);
  assert.equal(filterRows(rows, {}).length, 3);
  const usx = filterRows(rows, { eventId: 'usx' });
  assert.ok(historyColumns(usx, { eventId: 'usx' }).some((c) => c.key === 'questions'), 'an F2 filter adds the questions column');
  assert.ok(!historyColumns(rows, {}).some((c) => c.key === 'questions'), 'no family column with every event shown');
  assert.ok(!historyColumns(filterRows(rows, { eventId: 'hi' }), { eventId: 'hi' }).some((c) => c.key === 'questions'), 'F1 has no family column today');
  const q = room('usx', ['Q1', 'Q2']);
  q.entries[0].question = 'Is it?';
  assert.equal(historyRows([q], DATA.events)[0].questions, '1 of 2');
});

// Why: names and comments must never leave the device unless the judge picks them (EXPERIENCE.md §6.4, §7); a
// default export with a student's name in it would break that promise in a file that is easy to share.
test('the export holds codes only by default, and names and comments only when the judge picks them', () => {
  const r = room('hi', [{ code: 'A12', name: 'Sam Rivera' }, { code: 'B07', name: 'Jo Chen' }], { tournament: 'Fall' });
  r.entries[0].comment = 'Great energy';
  r.entries[0].rank = '1';
  const plain = exportTable([r], DATA.events, [r.id]);
  assert.deepEqual(plain[0], ['Date', 'Tournament', 'Round', 'Flight', 'Level', 'Event', 'State', 'Order', 'Code', 'Status', 'Rank']);
  assert.deepEqual(plain[1], ['2026-11-20', 'Fall', 'R1', '', 'Prelim', 'HI', 'Judging', 1, 'A12', 'Waiting', '1']);
  const text = toCSV(plain) + toTSV(plain);
  for (const secret of ['Sam Rivera', 'Jo Chen', 'Great energy']) assert.ok(!text.includes(secret), secret + ' is not in a default export');
  const full = exportTable([r], DATA.events, [r.id], { names: true, comments: true });
  assert.deepEqual(full[0].slice(-2), ['Name', 'Comment']);
  assert.deepEqual(full[1].slice(-2), ['Sam Rivera', 'Great energy']);
  assert.equal(exportTable([r], DATA.events, ['gone']).length, 1, 'a round that is not saved adds no lines');
});

// Why: a comma, a quote or a line break in a tournament name or a comment would shift every cell after it, and a
// cell that starts with = + - @ would run as a formula when a coach opens the file (CSV injection).
test('CSV quotes commas, quotes and line breaks; TSV flattens them; a formula start gets a leading quote', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell('cr\rhere'), '"cr\rhere"');
  for (const s of ['=SUM(A1)', '+1', '-2', '@x']) assert.equal(sheetSafe(s), "'" + s, s);
  assert.equal(csvCell('=1,2'), '"\'=1,2"');
  assert.equal(sheetSafe(3), '3');
  assert.equal(sheetSafe(null), '');
  assert.equal(toCSV([['a', 'b'], ['c,d', '=e']]), 'a,b\r\n"c,d",\'=e');
  assert.equal(toTSV([['a\tb', 'c\nd'], ['=x', 'y']]), 'a b\tc d\n\'=x\ty');
});

// Why: History draws text the judge typed (tournament, round); an unescaped "<" would run code in the page that holds
// the judge's rounds and AI key.
test('the History table escapes typed text and opens each round by its router address', () => {
  const r = room('hi', ['A'], { round: '<img src=x>', tournament: '<b>T</b>' });
  const rows = historyRows([r], DATA.events);
  const html = historyTableHtml(rows, historyColumns(rows, {}));
  assert.ok(!html.includes('<img') && !html.includes('<b>T'), 'escaped');
  assert.match(html, new RegExp('href="#/round/' + r.id + '"'));
  assert.match(html, new RegExp('data-del="' + r.id + '"'));
  assert.match(historyTableHtml([], []), /No rounds match/);
  assert.match(historyHtml(rows, {}), /Include names and comments/);
  assert.doesNotMatch(historyHtml(rows, {}), /id="hist-private" checked/, 'the names box starts off');
});

// ---------- delete with Undo ----------

// Why: delete has Undo (DESIGN.md §1 rule 6); if Undo put the round back in another place, or doubled it, the judge's
// list would reorder or show a round twice.
test('removeRoom and restoreRoom put a deleted round back in the same place, never doubled', () => {
  const list = ['a', 'b', 'c'].map((id) => ({ id }));
  const res = removeRoom(list, 'b');
  assert.deepEqual(res.rooms.map((r) => r.id), ['a', 'c']);
  assert.deepEqual(list.map((r) => r.id), ['a', 'b', 'c'], 'the list it was given is unchanged');
  assert.deepEqual(restoreRoom(res.rooms, res.removed).map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(restoreRoom(upsertRoom(res.rooms, { id: 'n' }), res.removed).map((r) => r.id), ['n', 'b', 'a', 'c'], 'same index after a new round was added');
  assert.deepEqual(restoreRoom([{ id: 'a' }], res.removed).map((r) => r.id), ['a', 'b'], 'a shorter list puts it at the end');
  assert.deepEqual(restoreRoom(list, res.removed).map((r) => r.id), ['a', 'b', 'c'], 'a round that is back already is not doubled');
  assert.equal(removeRoom(list, 'zz').removed, null);
  assert.deepEqual(removeRoom(null, 'a').rooms, []);
});

// Why: a judge deletes a test round from the Rooms list too; the button must name the round for a screen reader and
// carry only the round id.
test('the Rooms list has a named Delete button on each row', () => {
  const r = room('hi', ['A'], { createdAt: DAY1, round: 'R3' });
  const html = roomsHtml(groupRoomsByDay([r]), DATA.events);
  assert.match(html, new RegExp('data-del="' + r.id + '" aria-label="Delete Humorous Interpretation R3"'));
});

// ---------- Settings ----------

// Why: a parent who judges once must never see a mode menu (EXPERIENCE.md §1.1); it shows only after Coach or
// Student, or when turned on.
test('the mode menu shows only for Coach or Student or when turned on, and a bad setting value is refused', () => {
  assert.equal(modeMenuShown({}), false);
  assert.equal(modeMenuShown(null), false);
  assert.equal(modeMenuShown({ mode: 'coach' }), true);
  assert.equal(modeMenuShown({ mode: 'student' }), true);
  assert.equal(modeMenuShown({ mode: 'judge', showModeMenu: true }), true);
  assert.equal(withSetting({}, 'mode', 'coach').mode, 'coach');
  assert.equal(withSetting({}, 'mode', 'admin').mode, 'judge');
  assert.equal(withSetting({ theme: 'dark' }, 'theme', 'neon').theme, 'dark');
  assert.equal(withSetting({}, 'theme', 'light').theme, 'light');
  assert.equal(withSetting({}, 'showModeMenu', 'yes').showModeMenu, false);
  assert.equal(withSetting({}, 'other', 1).other, undefined);
});

// Why: index.html's theme script reads the theme from the settings key before the first paint; if Settings saved it
// under another name or shape, a dark-mode judge would get a white flash and the wrong theme.
test('the theme the Settings screen saves is the one the head script reads', () => {
  const html = read('index.html');
  assert.match(html, new RegExp('data-settings="' + SETTINGS_KEY.replace(/\./g, '\\.') + '"'));
  const saved = JSON.stringify(withSetting({}, 'theme', 'dark'));
  assert.equal(JSON.parse(saved).theme, 'dark', 'theme-boot.js reads settings.theme');
  const view = settingsHtml({ settings: withSetting({}, 'theme', 'dark'), ai: null, keys: '', offline: null });
  assert.match(view, /name="set-theme" value="dark" checked/);
  assert.match(view, /name="set-mode" value="judge" checked/);
});

// Why: AI that is off by policy must be gone, not greyed (AI-POLICY.md §3); a Connect AI button there would invite a
// judge to paste a key the school does not allow.
test('the AI part is built only when the gate allows a key, and the keyboard sheet lists the palette key', () => {
  assert.equal(aiPartHtml({ allowed: false }), '');
  assert.equal(aiPartHtml(null), '');
  assert.match(aiPartHtml({ allowed: true, connected: false }), /id="set-ai-connect"/);
  assert.match(aiPartHtml({ allowed: true, connected: true, providerName: '<OpenAI>' }), /Connected: &lt;OpenAI&gt;.*id="set-ai-forget"/s);
  const sheet = keySheetHtml(keymap.shortcutRows(true, true));
  assert.match(sheet, /Search and commands<\/dt><dd><kbd>⌘K<\/kbd>/);
  assert.match(keySheetHtml(keymap.shortcutRows(false, true)), /Ctrl\+K/);
});

// Why: a backup file is easy to share by mistake, so the AI key must stay out unless the judge ticks the box; and a
// file from Tabula Debate must be refused by name, or restoring it would wipe the judge's speech rounds.
test('the backup leaves the AI key out unless picked, and restore refuses another app\'s file with a clear message', () => {
  const saved = { [ROOMS_KEY]: '[]', [SETTINGS_KEY]: '{"theme":"light"}', [KEYS_KEY]: '{"openai":"sk-x"}' };
  const plain = makeBackup(saved, { now: '2026-11-22T00:00:00.000Z' });
  assert.equal(plain.app, BACKUP_APP);
  assert.ok(!(KEYS_KEY in plain.storage) && plain.includesKeys === false);
  const withKey = makeBackup(saved, { includeKeys: true, now: '2026-11-22T00:00:00.000Z' });
  assert.equal(withKey.storage[KEYS_KEY], '{"openai":"sk-x"}');
  const back = readBackup(JSON.stringify(withKey));
  assert.equal(back.rounds, 0);
  assert.equal(restoreItems({ [KEYS_KEY]: 'mine' }, back)[KEYS_KEY], '{"openai":"sk-x"}', 'a backup with a key restores that key');
  assert.ok(Object.keys(back.storage).every((k) => k.startsWith(PREFIX)));
  const debate = JSON.stringify(buildBackup({ 'policyJudge.round.v1': '{}' }, { prefix: 'policyJudge.' }));
  assert.throws(() => readBackup(debate), /Tabula Debate backup/);
  assert.throws(() => readBackup(JSON.stringify({ app: 'other', kind: 'backup', version: 1, storage: {} })), /another app/);
  assert.throws(() => readBackup('not json'), /not JSON/);
  assert.throws(() => readBackup(JSON.stringify({ app: BACKUP_APP, kind: 'backup', version: 1, storage: { [ROOMS_KEY]: '{bad' } })), /damaged/);
});

// ---------- palette ----------

// Why: the palette is the fast way to start or reopen a round; each enabled event needs its "New" row, each saved
// round its "Open" row, and every row must lead to a real address.
test('the palette lists New for each enabled event, Open for each round, History and Settings, and finds them', () => {
  const r = room('hi', ['A'], { tournament: 'Fall', round: 'R3', flight: 'B' });
  const rows = paletteRows({ events: DATA.events, choices: eventChoices(DATA), rooms: [r], undo: '' });
  for (const ev of eventChoices(DATA)) assert.ok(rows.some((x) => x.label === 'New ' + ev.short + ' round' && x.hash === '#/new/' + ev.id), ev.id);
  const open = rows.find((x) => x.id === 'open-' + r.id);
  assert.equal(open.label, 'Open HI · Fall · R3 · Flight B');
  assert.equal(open.hash, '#/round/' + r.id);
  assert.ok(rows.some((x) => x.label === 'History' && x.hash === '#/history'));
  assert.ok(rows.some((x) => x.label === 'Settings' && x.hash === '#/settings'));
  assert.ok(!rows.some((x) => /^Guide/.test(x.label)), 'no Guide rows until a guide route exists');
  assert.ok(!rows.some((x) => x.act === 'undo'), 'no Undo row with nothing to undo');
  assert.equal(searchCommands('new hi', rows)[0].label, 'New HI round');
  assert.equal(searchCommands('settings', rows)[0].id, 'go-settings');
  for (const x of rows) if (x.hash) assert.ok(x.hash === '#/' || parseRoute(x.hash).screen !== 'rooms', x.label + ' leads to a real screen');
  assert.equal(paletteRows({ undo: 'Undo: delete R1' })[0].act, 'undo');
  assert.ok(!paletteListHtml([{ label: '<b>', group: 'G' }], 0, true).includes('<b>'), 'labels are escaped');
});

// Why: ⌘K must open the palette from anywhere, even from a text box, but must not steal a browser key, and the room's
// one-key shortcuts must still never fire while the judge types.
test('the palette key works on every screen and in a text box, uses no browser key, and the digits still wait', () => {
  const k = { code: 'KeyK', key: 'k', meta: true };
  assert.equal(keymap.keyAction(k, { scopes: ['global'], focus: 'none' }), 'palette');
  assert.equal(keymap.keyAction(k, { scopes: ['global', 'history'], focus: 'text' }), 'palette');
  assert.equal(keymap.keyAction({ code: 'KeyK', key: 'k', ctrl: true }, { scopes: ['global'], focus: 'text' }), 'palette', 'Ctrl+K on Windows');
  assert.equal(keymap.keyAction(k, { scopes: ['global'], focus: 'none', modal: true }), null, 'not over a dialog');
  assert.equal(keymap.keyAction({ code: 'KeyK', key: 'k' }, { scopes: ['global'], focus: 'none' }), null, 'a plain k types');
  assert.equal(keymap.keyAction({ code: 'Digit1', key: '1' }, { scopes: ['global', 'room'], focus: 'text' }), null);
  const pal = SHORTCUTS.find((s) => s.action === 'palette');
  for (const p of ['mac', 'other']) assert.ok(!isReservedCombo(pal.keys[p], p), p);
});

// ---------- offline ----------

// Why: the judge checks "Ready for offline" before a school with no wifi; saying ready when the page is not cached
// would leave them with a blank screen at the tournament.
test('Ready for offline says ready only when a worker runs the page and the cache holds it', () => {
  assert.equal(offlineState({ supported: true, controlled: true, cached: true }).ready, true);
  assert.equal(offlineState({ supported: true, controlled: false, cached: true }).ready, false);
  assert.equal(offlineState({ supported: true, controlled: true, cached: false }).ready, false);
  assert.equal(offlineState({ supported: false }).ready, false);
  assert.equal(offlineState(null).ready, false);
});

// Why: a new S2 module missing from the service worker list would fail cold at a school with no wifi (EXPERIENCE.md
// §9): History or Settings would not open.
test('every S2 module is in the service worker list', () => {
  const ctx = vm.createContext({ self: {} });
  vm.runInContext(read('sw-files.js'), ctx);
  for (const f of ['migrate', 'settings', 'history', 'palette', 'history-screen', 'settings-screen', 'palette-screen', 'ai-connect']) {
    assert.ok(ctx.self.TABULA_EVENTS_FILES.includes('js/' + f + '.js'), f + ' is cached; run node events/build-sw.mjs');
  }
});
