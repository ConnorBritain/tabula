// Tests for step S1 (docs/events/EXPERIENCE.md §2, §9, §11.1): the derived family (events/js/data.js familyOf), the
// round-type router's registry (events/js/workspaces.js), the room workspace contract (events/js/room-workspace.js),
// the round routes and their old aliases (events/js/routes.js), and the offline list for registry modules.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadEventData, familyOf } from './js/data.js';
import { WORKSPACES, loadWorkspace, roundFamily } from './js/workspaces.js';
import { parseRoute, roundTarget } from './js/routes.js';
import { createRoom, markNoShow, selectEntry } from './js/room.js';
import { ranksProblems, cards, checklist } from './js/ballot.js';
import { customEvent } from './js/custom.js';
import { keymap } from './js/keys.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const readJson = async (p) => JSON.parse(read(p));
const DATA = await loadEventData(readJson);
const PROFILE = DATA.profiles.get('nsda-district');
let n = 0;
const makeId = (p) => p + (++n);
const roomOf = (eventId, codes) => createRoom({ event: DATA.events.get(eventId), profile: PROFILE, entries: codes.map((code) => ({ code })), round: 'R1', now: 1000, makeId });

// Why: the family picks the workspace a round opens in; a wrong family would open IMP without its prep clock or put
// an extemp room in a workspace that has no question card.
test('each published event gets the family EXPERIENCE.md §2.1 gives it, and Custom is custom', () => {
  const want = { oo: 'f1', inf: 'f1', exp: 'f1', dec: 'f1', osw: 'f1', di: 'f1', hi: 'f1', duo: 'f1', poi: 'f1', pro: 'f1', poe: 'f1', sto: 'f1',
    usx: 'f2', ix: 'f2', com: 'f2', mx: 'f2', imp: 'f3' };
  for (const id of DATA.order) assert.equal(DATA.events.get(id).family, want[id], id);
  assert.deepEqual(Object.keys(want).sort(), [...DATA.order].sort(), 'every published event is in this table');
  assert.equal(familyOf(customEvent({ name: 'Radio', limit: '5:00' })), 'custom');
  assert.equal(familyOf({ id: 'zz', category: 'congress', timing: {} }), null, 'an unknown category has no family, not a guessed one');
  assert.equal(familyOf(null), null);
});

// Why: if a family had no workspace, or its module lacked a contract member, every round of that family would fail
// to open at the tournament.
test('every room family loads the room workspace, and it has each §2.3 contract member', async () => {
  assert.deepEqual(Object.keys(WORKSPACES).sort(), ['custom', 'f1', 'f2', 'f3']);
  for (const fam of Object.keys(WORKSPACES)) {
    const ws = await loadWorkspace(fam);
    assert.ok(ws.families.includes(fam), fam + ' is one of the keys the module says it serves');
    for (const m of ['newRound', 'stages', 'mount', 'keys', 'validate', 'summary', 'rankModel', 'reviewModel']) assert.equal(typeof ws[m], 'function', fam + ' ' + m);
    assert.equal(typeof ws.family, 'string');
  }
  await assert.rejects(loadWorkspace('congress'), /No workspace/, 'a family with no workspace is an error, not a blank screen');
  await assert.rejects(loadWorkspace('toString'), /No workspace/, 'an object method name is not a family');
});

// Why: a workspace module missing from the service worker list fails cold at a school with no wifi: the judge opens
// a round and gets nothing (EXPERIENCE.md §9).
test('every registry module is in the service worker list (events/sw-files.js)', () => {
  const ctx = vm.createContext({ self: {} });
  vm.runInContext(read('sw-files.js'), ctx);
  const files = ctx.self.TABULA_EVENTS_FILES;
  for (const p of Object.values(WORKSPACES)) {
    const path = new URL(p, new URL('./js/workspaces.js', import.meta.url)).href.slice(new URL('./', import.meta.url).href.length);
    assert.ok(files.includes(path), path + ' is cached for offline; run node events/build-sw.mjs');
  }
});

// Why: judges have live rooms and bookmarks on the old addresses; if an alias stopped matching the new route, a
// reload mid-round would drop the judge on the Rooms list.
test('the round routes parse, and each old address opens the same round and stage as its new one', () => {
  assert.deepEqual(parseRoute('#/round/r1'), { screen: 'round', id: 'r1', stage: null });
  assert.deepEqual(parseRoute('#/round/r1/rank'), { screen: 'round', id: 'r1', stage: 'rank' });
  for (const [old, now] of [['#/room/r1', '#/round/r1/judge'], ['#/rank/r1', '#/round/r1/rank'], ['#/review/r1', '#/round/r1/review']]) {
    assert.deepEqual(roundTarget(parseRoute(old)), roundTarget(parseRoute(now)), old);
  }
  assert.deepEqual(roundTarget(parseRoute('#/round/r1')), { id: 'r1', stage: null });
  assert.deepEqual(parseRoute('#/new'), { screen: 'setup', id: null }, '#/new still opens room setup');
  assert.equal(roundTarget(parseRoute('#/new')), null);
  assert.equal(roundTarget(parseRoute('#/')), null);
  for (const bad of ['#/round', '#/round/bad id', '#/round/r1/Rank', '#/round/r1/rank/x']) assert.deepEqual(parseRoute(bad), { screen: 'rooms', id: null }, bad);
});

// Why: the number keys pick speakers only in the 'room' scope; if the judge stage reported another scope, keys 1 to 8
// would stop working mid-round.
test('the room workspace has the shipped stages, and the judge stage keeps the room key scope', async () => {
  const ws = await loadWorkspace('f1');
  const r = roomOf('oo', ['A1', 'B2']);
  assert.deepEqual([...ws.stages(r)], ['judge', 'rank', 'review']);
  assert.equal(ws.keys(r, 'judge').scope, 'room');
  assert.ok(keymap.keyAction({ code: 'Digit1', key: '1' }, { scopes: [ws.keys(r, 'judge').scope], focus: 'none' }), 'a number key matches in the judge stage scope');
  assert.equal(ws.keys(r, 'judge').run('pick1'), false, 'with nothing mounted, a key does nothing');
});

// Why: the router must make and read rounds exactly as the shipped room did; a different record or summary would
// change what a judge sees, which S1 must not do.
test('the room workspace makes the shipped room record and reads it with the shipped checks', async () => {
  const ws = await loadWorkspace('f2');
  const input = { entries: [{ code: 'A1' }, { code: 'B2' }, { code: 'C3' }], round: 'R1', now: 1000 };
  n = 0; const viaWs = ws.newRound(DATA.events.get('usx'), PROFILE, Object.assign({ makeId }, input));
  n = 0; const shipped = createRoom(Object.assign({ event: DATA.events.get('usx'), profile: PROFILE, makeId }, input));
  assert.deepEqual(viaWs, shipped);
  let r = markNoShow(viaWs, viaWs.entries[2].id, 2000).room;
  r = Object.assign({}, r, { entries: r.entries.map((e, i) => (i === 0 ? Object.assign({}, e, { status: 'done' }) : e)) });
  r = selectEntry(r, r.entries[0].id, 3000);
  assert.deepEqual(ws.summary(r), { status: 'Judging', done: 1, total: 2, next: 'B2' }, 'a no-show is not counted');
  assert.deepEqual(ws.validate(r), ranksProblems(r));
  assert.deepEqual(ws.reviewModel(r).cards, cards(r));
  assert.deepEqual(ws.reviewModel(r).checklist, checklist(r));
  assert.deepEqual(Object.keys(ws.rankModel(r).ranks).sort(), [r.entries[0].id, r.entries[1].id].sort());
});

// Why: a room whose event file is not on this device opened in the room screen before S1; if the router found no
// family for it, that judge's saved ballot would no longer open.
test('a round opens in the room workspace by its event, and one with no event file on this device still opens', () => {
  assert.equal(roundFamily(DATA.events, roomOf('imp', ['A1'])), 'f3');
  assert.equal(roundFamily(DATA.events, { id: 'x', eventId: 'gone', eventVersion: 9, entries: [] }), 'custom');
  const custom = createRoom({ event: customEvent({ name: 'Radio', limit: '5:00' }), profile: DATA.profiles.get('custom'), entries: [{ code: 'A1' }], now: 1, makeId });
  assert.equal(roundFamily(DATA.events, custom), 'custom');
});

// Why: mount and unmount are how every stage opens and closes; if unmount skipped the screen's hide, a room's click
// handlers and clock view would stay live under the next screen, and keys would reach a screen that is gone.
test('the room workspace shows the shipped screen for a stage, sends it the keys, and hides it on unmount', async () => {
  const ws = await loadWorkspace('custom');
  const log = [];
  const fake = (name) => ({ show: (id) => log.push(name + ' show ' + id), hide: () => log.push(name + ' hide'), run: (a) => { log.push(name + ' run ' + a); return true; } });
  const el = {};
  const env = { el, roomScreens: { judge: fake('judge'), rank: fake('rank'), review: fake('review') } };
  const r = roomOf('oo', ['A1']);
  const unmount = ws.mount(el, env, r, 'rank');
  assert.equal(ws.keys(r, 'rank').run('x'), true);
  unmount();
  assert.equal(ws.keys(r, 'rank').run('y'), false, 'no key reaches a screen after unmount');
  assert.deepEqual(log, ['rank show ' + r.id, 'rank run x', 'rank hide']);
  assert.throws(() => ws.mount(el, env, r, 'log'), /no screen/, 'a stage this workspace does not have is an error');
  assert.throws(() => ws.mount({}, env, r, 'judge'), /env\.el/, 'the screens draw only in the box they were made with');
});
