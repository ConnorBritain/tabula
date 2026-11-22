// Tests for step E4 (docs/events/LANDING.md §4.1): the room and entry model (events/js/room.js), the roster screen
// builders (events/js/room-screen.js), room setup (events/js/setup-screen.js), the screen address (routes.js) and the
// number keys (keys.js). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { parseRoom } from './js/parse.js';
import {
  ENABLED_EVENTS, MAX_ENTRIES, createRoom, codeError, setupError, entryOf, present, selectEntry, entryAtNumber, nextWaiting,
  moveEntry, markNoShow, clearNoShow, addEntry, removeEntry, restoreEntry, rosterAction, upsertRoom, findRoom,
} from './js/room.js';
import { rosterHtml, roomTitle } from './js/room-screen.js';
import { previewHtml, setupHtml, eventChoices, profileChoices } from './js/setup-screen.js';
import { parseRoute, routeHash } from './js/routes.js';
import { keymap, SHORTCUTS, pickNumber } from './js/keys.js';
import { isReservedCombo } from '../core/keys.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const readJson = async (p) => JSON.parse(read(p));
const DATA = await loadEventData(readJson);
let n = 0;
const makeId = (p) => p + (++n);
const room6 = () => createRoom({ event: DATA.events.get('exp'), profile: DATA.profiles.get('nsda-district'), entries: ['A12', 'B07', 'C33', 'D41', 'E05', 'F18'].map((code) => ({ code })), round: 'Round 2', now: 1000, makeId });
const codes = (r) => r.entries.map((e) => e.code).join(',');
const key = (k, extra) => Object.assign({ code: 'Digit' + k, key: k, meta: false, ctrl: false, alt: false, shift: false }, extra);

// Why: a room must freeze the rules it was set up with; if it only kept a link, a later profile edit would change an
// old room's ranks rule or grace after the fact (ARCHITECTURE.md §6.3).
test('a new room keeps the event id and version and a full copy of the profile', () => {
  const r = room6();
  assert.equal(r.eventId, 'exp'); assert.equal(r.eventVersion, 1); assert.equal(r.productLine, 'events');
  assert.deepEqual(r.profile.overtime, { grace: 30, effect: 'noFirst' });
  assert.equal(r.profile.key, undefined, 'the registry key is not a rule');
  assert.ok(!Object.isFrozen(r.profile), 'the copy is the room\'s own, not the frozen registry object');
  assert.deepEqual(r.entries.map((e) => [e.code, e.order, e.status]), [['A12', 1, 'waiting'], ['B07', 2, 'waiting'], ['C33', 3, 'waiting'], ['D41', 4, 'waiting'], ['E05', 5, 'waiting'], ['F18', 6, 'waiting']]);
  assert.equal(r.current, r.entries[0].id, 'the first speaker is picked');
  assert.equal(r.state, 'judging');
});

// Why: the late-arrival task in the lay test (PROTOTYPE-TEST.md task 3) must keep the speaking order 1..N with no gap,
// and Undo must put the speaker back where they were.
test('a late arrival moves to the end, the others close up, and the move undoes', () => {
  const r = room6();
  const c = r.entries[2].id;
  const res = moveEntry(r, c, r.entries.length, 2000);
  assert.ok(res.moved);
  assert.equal(codes(res.room), 'A12,B07,D41,E05,F18,C33');
  assert.deepEqual(res.room.entries.map((e) => e.order), [1, 2, 3, 4, 5, 6]);
  assert.equal(codes(r), 'A12,B07,C33,D41,E05,F18', 'the old room is unchanged');
  assert.equal(codes(moveEntry(res.room, c, res.from, 3000).room), codes(r), 'Undo puts it back');
  assert.equal(moveEntry(r, c, 3, 2000).moved, false, 'a move to its own place does nothing');
});

// Why: a no-show must leave the ranks (a no-show is not ranked) and Undo must bring the speaker back with the status
// they had; a no-show on a speaker who already spoke would throw away their time.
test('no show leaves the ranked list and undoes; a speaker with time is refused', () => {
  const r = room6();
  const b = r.entries[1].id;
  const res = markNoShow(r, b, 2000);
  assert.equal(entryOf(res.room, b).status, 'noShow');
  assert.equal(present(res.room).length, 5);
  assert.equal(res.prev, 'waiting');
  assert.equal(entryOf(clearNoShow(res.room, b, 3000, res.prev), b).status, 'waiting');
  const timed = Object.assign({}, r, { entries: r.entries.map((e) => (e.id === b ? Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { usedMs: 61000 }) }) : e)) });
  const refused = markNoShow(timed, b, 2000);
  assert.match(refused.refused, /already has time/);
  assert.equal(refused.room, timed);
});

// Why: Remove is destructive, so it must undo exactly, at the old place; a restore that doubled a code someone added
// again would give two rows the same code.
test('remove undoes at the old place and never doubles a code', () => {
  const r = room6();
  const d = r.entries[3].id;
  const res = removeEntry(selectEntry(r, d, 1500), d, 2000);
  assert.equal(codes(res.room), 'A12,B07,C33,E05,F18');
  assert.equal(entryOf(res.room, res.room.current).code, 'E05', 'the pick moves to the next row');
  assert.equal(codes(restoreEntry(res.room, res.removed, 3000)), codes(r));
  const again = addEntry(res.room, 'd41', '', 2500, 'x1').room;
  assert.equal(restoreEntry(again, res.removed, 3000), again, 'D41 was added again, so the undo is refused');
});

// Why: every row-menu action must undo from the toast (LANDING.md E4 "late arrival and no-show with Undo"); the
// undo runs on the room as it is at that moment, so a pick made in between must survive it.
test('each roster action gives a message and an undo that puts the roster back', () => {
  const r = room6();
  const [a, b, c] = r.entries.map((e) => e.id);
  for (const [action, id] of [['up', b], ['down', b], ['end', c], ['noshow', b], ['remove', c]]) {
    const res = rosterAction(r, action, id, 2000);
    assert.equal(res.refused, '', action);
    assert.ok(res.message.length > 0 && typeof res.undo === 'function', action);
    assert.notDeepEqual(res.room.entries.map((e) => e.code + e.status), r.entries.map((e) => e.code + e.status), action + ' changed the roster');
    const picked = selectEntry(res.room, a, 2500);
    const back = res.undo(picked, 3000);
    assert.deepEqual(back.entries.map((e) => [e.code, e.status, e.order]), r.entries.map((e) => [e.code, e.status, e.order]), action + ' undo');
    if (action !== 'remove') assert.equal(back.current, a, action + ' undo keeps the pick made in between');
  }
  const ns = rosterAction(r, 'noshow', b, 2000).room;
  const show = rosterAction(ns, 'show', b, 2100);
  assert.equal(entryOf(show.room, b).status, 'waiting');
  assert.equal(entryOf(show.undo(show.room, 2200), b).status, 'noShow', '"Undo no show" undoes too');
  assert.equal(rosterAction(r, 'up', a, 2000).undo, null, 'the first row cannot move up; nothing to undo');
  const running = Object.assign({}, r, { entries: r.entries.map((e) => (e.id === c ? Object.assign({}, e, { timing: Object.assign({}, e.timing, { run: { kind: 'speech', endAt: 9e12 } }) }) : e)) });
  assert.match(rosterAction(running, 'remove', c, 2000).refused, /Stop the clock/);
  assert.match(rosterAction(running, 'noshow', c, 2000).refused, /already has time/);
});

// Why: undoing the removal of the speaker the judge was on must bring the judge back to that speaker, or their next
// note lands on the wrong student.
test('undoing the removal of the current speaker picks them again', () => {
  const r = room6();
  const d = r.entries[3].id;
  const res = removeEntry(selectEntry(r, d, 1), d, 2);
  assert.equal(restoreEntry(res.room, res.removed, 3).current, d);
});

// Why: a room never holds more than 8; the model must refuse a longer list rather than drop speakers in silence.
test('createRoom refuses more than 8 entries', () => {
  assert.throws(() => createRoom({ event: DATA.events.get('oo'), profile: DATA.profiles.get('custom'), entries: Array.from({ length: 9 }, (_, i) => ({ code: 'A' + i })), now: 1 }), /at most 8/);
});

// Why: a typed code is how the judge finds a speaker on the online ballot; a duplicate or a blank code would put
// two speakers on one ballot line.
test('codes: typed codes are checked, made upper case and used once; a room holds 8', () => {
  const r = room6();
  assert.equal(codeError('', r), 'Type the entry code, for example A12.');
  assert.match(codeError('b07', r), /B07 is already in this room/);
  assert.match(codeError('A 12', r), /letters, numbers and a hyphen/);
  assert.equal(codeError('AB-104', r), '');
  const added = addEntry(r, ' g9 ', '', 2000, 'g');
  assert.equal(added.entry.code, 'G9'); assert.equal(added.entry.order, 7);
  const full = addEntry(added.room, 'H1', '', 2000, 'h').room;
  assert.equal(full.entries.length, MAX_ENTRIES);
  assert.match(addEntry(full, 'J1', '', 2000, 'j').error, /at most 8/);
});

// Why: number keys and "Next speaker" are how a judge moves on without looking away from the speaker; they must land
// on the right row and skip speakers who are done or did not show.
test('number keys pick the row at that place; Next speaker skips done and no-show rows', () => {
  const r = room6();
  assert.equal(entryAtNumber(r, 3).code, 'C33');
  assert.equal(entryAtNumber(r, 9), null);
  let x = markNoShow(r, r.entries[1].id, 2000).room;
  x = Object.assign({}, x, { entries: x.entries.map((e) => (e.code === 'C33' ? Object.assign({}, e, { status: 'done' }) : e)) });
  assert.equal(nextWaiting(x).code, 'D41');
  assert.equal(nextWaiting(selectEntry(x, x.entries[5].id, 1)).code, 'A12', 'it goes round to the top');
  assert.equal(pickNumber('pick4'), 4); assert.equal(pickNumber('next'), null);
  const ctx = { scopes: ['room'], focus: 'none' };
  assert.equal(keymap.keyAction(key('3'), ctx), 'pick3');
  assert.equal(keymap.keyAction(key('3'), { scopes: ['room'], focus: 'text' }), null, 'a number typed in a box stays in the box');
  assert.equal(keymap.keyAction(key('3'), { scopes: ['setup'], focus: 'none' }), null, 'only on the room screen');
  for (const s of SHORTCUTS) for (const p of ['mac', 'other']) assert.ok(!isReservedCombo(s.keys[p], p), s.id + ' uses a browser key');
});

// Why: setup must never start a room with unsorted lines or no speakers; a skipped "Check these" line would drop a
// speaker from the ballot in silence.
test('setup waits for "Check these", an event and at least one entry', () => {
  const text = 'Round 2\n1. A12 Maya Chen\n2. B07\nsee judge about room change\n';
  const parsed = parseRoom(text);
  assert.match(setupError(parsed, 'exp'), /Check these/);
  // E9 turned interp on, so 'di' no longer shows the refusal; an event that is not on is still refused.
  assert.equal(setupError(parsed, 'no-such-event'), 'Pick the event.', 'an event that is not turned on is refused');
  const fixed = parseRoom(text, { decided: { [parsed.check[0].key]: 'skip' } });
  assert.equal(setupError(fixed, 'exp'), '');
  assert.match(setupError(parseRoom(''), 'oo'), /Paste the room/);
  const nine = parseRoom(Array.from({ length: 9 }, (_, i) => 'A' + (i + 1)).join('\n'));
  assert.match(setupError(nine, 'oo'), /at most 8/);
  assert.deepEqual(eventChoices(DATA).map((e) => e.id), ENABLED_EVENTS);
  assert.deepEqual(profileChoices(DATA).map((p) => p.id), ['nsda-district', 'nsda-invitational', 'custom']);
  const html = previewHtml(parsed);
  assert.match(html, /2 entries, in speaking order/);
  assert.match(html, /<h3>Check these<\/h3>/);
  assert.match(html, /Lines left out \(1\)/, 'the heading line is shown, never dropped in silence');
  assert.match(setupHtml(DATA), /<option value="osw">Original Spoken Word Poetry \(5 min\)<\/option>/);
});

// Why: the roster is the judge's map of the room; every row must say its status in words (not colour alone) and the
// menu must offer the late-arrival and no-show actions.
test('the roster shows each status in words, the current row, and the row menu', () => {
  let r = room6();
  r = markNoShow(r, r.entries[1].id, 2000).room;
  const html = rosterHtml(r, r.entries[2].id);
  assert.match(html, /0 of 5 done/);
  assert.equal((html.match(/>Waiting</g) || []).length, 5 + 5, 'five rows and five phone pills say Waiting');
  assert.match(html, /<span class="pill outline">No show<\/span>/);
  assert.match(html, /aria-current="true"/);
  for (const w of ['Move up', 'Move down', 'Move to end', 'Mark no show', 'Remove']) assert.ok(html.includes('>' + w + '<'), w);
  assert.match(rosterHtml(r, r.entries[1].id), />Undo no show</);
  assert.equal(roomTitle(r, DATA.events.get('exp')), 'Expository · Round 2');
  assert.ok(!rosterHtml(Object.assign({}, r, { entries: [Object.assign({}, r.entries[0], { name: '<b>x</b>' })] })).includes('<b>x</b>'), 'names are escaped');
});

// Why: the screen lives in the address so a reload or a dropped phone tab reopens the same room screen; a bad
// address must fall back to the Rooms list, not a blank page.
test('routes round-trip and unknown addresses go to Rooms', () => {
  for (const [s, id] of [['rooms', null], ['setup', null], ['room', 'r1'], ['rank', 'r1'], ['review', 'r1']]) assert.deepEqual(parseRoute(routeHash(s, id)), { screen: s, id });
  assert.deepEqual(parseRoute('#/room/bad id'), { screen: 'rooms', id: null });
  assert.deepEqual(parseRoute('#/nope'), { screen: 'rooms', id: null });
  assert.deepEqual(parseRoute(''), { screen: 'rooms', id: null });
});

// Why: saving one room must not drop or duplicate the others in the list.
test('upsertRoom replaces by id or adds at the front', () => {
  const a = room6(), b = room6();
  let list = upsertRoom([], a);
  list = upsertRoom(list, b);
  assert.deepEqual(list.map((x) => x.id), [b.id, a.id]);
  list = upsertRoom(list, Object.assign({}, a, { round: 'R9' }));
  assert.equal(list.length, 2);
  assert.equal(findRoom(list, a.id).round, 'R9');
  assert.equal(findRoom(null, 'x'), null);
});

// Why: the events code rule (LANDING.md §3): only app.js boots the page and imports the screens; a screen that booted
// itself would run twice or out of order.
test('only app.js imports the screens, and every new file is an ES module with named exports', () => {
  const app = read('js/app.js');
  assert.match(app, /from '\.\/setup-screen\.js'/);
  assert.match(app, /from '\.\/room-screen\.js'/);
  for (const f of ['room.js', 'routes.js', 'keys.js', 'setup-screen.js', 'room-screen.js']) {
    const src = read('js/' + f);
    assert.match(src, /^export /m, f);
    assert.doesNotMatch(src, /from '\.\/[a-z-]+-screen\.js'/, f + ' must not import a screen');
    assert.doesNotMatch(src, /policyJudge\./, f);
  }
});
