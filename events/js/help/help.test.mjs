// Why: if this breaks, a first-time parent judge loses the room walk or sees it every round, an event opens with no "What to listen for" card or one that disagrees with the type page, or "How to rank" states a time rule the tournament did not set.
// Tests for the judge help (events/js/help/help.js, listen-for.js) and its hooks. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from '../data.js';
import { ENABLED_EVENTS, CUSTOM_EVENT, DEFAULT_PROFILE, createRoom } from '../room.js';
import { guideModel } from '../guide.js';
import { typeHtml } from '../type-screen.js';
import { createStore } from '../../../core/store.js';
import { PREFIX } from '../store.js';
import { makeBackup, readBackup, restoreItems } from '../settings.js';
import {
  HELP_KEY, readHelp, walkDue, markWalkSeen, resetWalk, WALK_STEPS, walkHtml, listenBullets, listenModel, listenOpen,
  listenHtml, rankHelpLines, rankHelpHtml, tipsPartHtml, TIPS_AGAIN,
} from './help.js';
import { LISTEN_FOR } from './listen-for.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read('../../' + p)));
const PUB = JSON.parse(read('../../published.json'));

// A localStorage stand-in, so the real core store runs in Node.
function memStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const newStore = () => createStore({ prefixes: [PREFIX], storage: memStorage() });
const roomFor = (id, profileId = DEFAULT_PROFILE, extra = {}) => Object.assign(createRoom({ event: DATA.events.get(id), profile: DATA.profiles.get(profileId), entries: [{ code: 'A1' }, { code: 'B2' }], now: 1 }), extra);

// ---------- 1. the first-room walk ----------
test('the walk has 3 short steps: timer, comments, then rank and copy', () => {
  assert.equal(WALK_STEPS.length, 3);
  assert.match(WALK_STEPS[0].title + WALK_STEPS[0].text, /Start/);
  assert.match(WALK_STEPS[1].title + WALK_STEPS[1].text, /comment/i);
  assert.match(WALK_STEPS[2].title, /Rank/);
  assert.match(WALK_STEPS[2].text, /copy/i);
  for (const s of WALK_STEPS) assert.ok(s.text.length <= 140, s.title + ' is short');
});

test('the walk is a card in the page, never a modal, and it can be skipped at every step', () => {
  for (let i = 0; i < 3; i++) {
    const h = walkHtml(i);
    assert.doesNotMatch(h, /role="(alert)?dialog"|aria-modal|<dialog/);
    assert.match(h, /data-hact="skip"/);
    assert.match(h, new RegExp('Step ' + (i + 1) + ' of 3'));
  }
  assert.match(walkHtml(0), /data-hact="next"/);
  assert.doesNotMatch(walkHtml(0), /data-hact="back"/);
  assert.match(walkHtml(2), /data-hact="done"[^>]*>Got it/);
  assert.match(walkHtml(99), /Step 3 of 3/, 'a step past the end shows the last one');
  assert.match(walkHtml(-1), /Step 1 of 3/);
});

test('the walk shows once per device: due until marked, then not, and Settings can bring it back', () => {
  const store = newStore();
  assert.equal(walkDue(store), true);
  markWalkSeen(store);
  assert.equal(walkDue(store), false);
  assert.deepEqual(readHelp(store), { walkSeen: true });
  resetWalk(store);
  assert.equal(walkDue(store), true);
});

test('a damaged or odd help value reads as "not seen", never as an error', () => {
  for (const raw of ['{bad json', '"yes"', '[]', 'null', '{"walkSeen":"true"}']) {
    const s = memStorage();
    s.setItem(HELP_KEY, raw);
    assert.equal(walkDue(createStore({ prefixes: [PREFIX], storage: s })), true, raw);
  }
});

test('the help flag is a tabulaEvents.* value: in the backup, back on restore, gone after Clear this device', () => {
  assert.ok(HELP_KEY.startsWith(PREFIX));
  const store = newStore();
  markWalkSeen(store);
  const file = makeBackup(store.snapshot(PREFIX), { now: '2026-11-25T10:00:00Z' });
  assert.ok(HELP_KEY in file.storage, 'the backup holds the flag');
  // Clear this device (settings-screen.js): replaceAll(PREFIX, {}) on the page store.
  store.replaceAll(PREFIX, {});
  assert.equal(walkDue(store), true, 'Clear this device resets it');
  const b = readBackup(JSON.stringify(file));
  store.replaceAll(PREFIX, restoreItems(store.snapshot(PREFIX), b));
  assert.equal(walkDue(store), false, 'a restore brings it back');
});

// ---------- 2. what to listen for ----------
test('every published event and the Custom event has 3 to 5 plain bullets; no list for an unknown event', () => {
  const published = new Set(PUB.defs.map((f) => f.split('/').pop().split('.')[0]));
  for (const id of new Set([...ENABLED_EVENTS, ...published, CUSTOM_EVENT])) {
    const list = LISTEN_FOR[id];
    assert.ok(Array.isArray(list), id + ' has a card');
    assert.ok(list.length >= 3 && list.length <= 5, id + ' has 3 to 5 bullets');
    for (const b of list) {
      assert.equal(typeof b, 'string');
      assert.ok(b.trim() === b && b.length >= 10 && b.length <= 120, id + ': "' + b + '" is one short line');
      assert.match(b, /[.?]$/, id + ': a bullet ends as a sentence');
    }
    assert.equal(new Set(list).size, list.length, id + ' has no double bullet');
  }
  for (const id of Object.keys(LISTEN_FOR)) assert.ok(id === CUSTOM_EVENT || ENABLED_EVENTS.includes(id), id + ' is an event this app has');
  assert.deepEqual(listenBullets('nope'), []);
});

test('the card takes its line, time and grace from the type page Guide (one source, no copy drift)', () => {
  for (const id of ENABLED_EVENTS) {
    const room = roomFor(id);
    const def = DATA.events.get(id);
    const g = guideModel(def, room.profile);
    const m = listenModel(def, room);
    assert.equal(m.intro, g.line, id + ': the same plain line');
    assert.ok(m.facts.includes(g.limit) && m.facts.includes(g.grace), id + ': the same limit and grace');
    if (g.material) assert.ok(m.facts.includes(g.material), id + ': the same material');
    // The type page shows that same line.
    assert.ok(typeHtml(DATA, id, []).includes(g.line.replace(/'/g, '&#39;')), id + ': the type page has the line');
    assert.deepEqual(m.bullets, LISTEN_FOR[id]);
  }
});

test('the card follows the round: its own grace, and a Custom round gets the Custom list with no limit', () => {
  const room = roomFor('oo');
  room.profile = Object.assign({}, room.profile, { overtime: { grace: 15, effect: 'noFirst' } });
  assert.match(listenModel(DATA.events.get('oo'), room).facts, /Grace: 15 seconds/);
  const custom = listenModel(null, Object.assign({}, room, { customEvent: { name: 'Local' } }));
  assert.deepEqual(custom.bullets, LISTEN_FOR.custom);
  assert.doesNotMatch(custom.facts, /Time:/);
});

test('the card is open in the device\'s first round on a wide screen, and closed after that or on a phone', () => {
  assert.equal(listenOpen([], 'r1'), true);
  assert.equal(listenOpen([{ id: 'r1', state: 'done' }], 'r1'), true, 'this room itself does not count');
  assert.equal(listenOpen([{ id: 'r0', state: 'judging' }, { id: 'r1', state: 'judging' }], 'r1'), true, 'an unfinished round does not count');
  for (const state of ['ranking', 'review', 'done']) assert.equal(listenOpen([{ id: 'r0', state }], 'r1'), false, state);
  assert.equal(listenOpen([], 'r1', true), false, 'a phone keeps the timer near the top: closed');
  assert.match(listenHtml({ intro: 'x', facts: 'y', bullets: ['a.'] }, true), /<details class="fold help-listen"[^>]* open>/);
  assert.doesNotMatch(listenHtml({ intro: 'x', facts: 'y', bullets: ['a.'] }, false), / open>/);
});

test('the listen card escapes its words', () => {
  const h = listenHtml({ intro: '<b>', facts: '&', bullets: ['<i>.'] }, false);
  assert.doesNotMatch(h, /<b>|<i>/);
});

// ---------- 3. how to rank ----------
test('How to rank: 1 is best, no ties, and the bias line in our own words', () => {
  const lines = rankHelpLines(roomFor('oo'));
  assert.match(lines[0], /Rank 1 is the best/);
  assert.match(lines[1], /No ties/);
  assert.match(lines.at(-1), /not count/);
  assert.match(rankHelpHtml(roomFor('oo')), /<details class="fold help-rank"/);
  assert.doesNotMatch(rankHelpHtml(roomFor('oo')), / open>/, 'folded by default');
});

test('How to rank reads the time rule from the round\'s profile, never a fixed number', () => {
  const at = (overtime, more = {}) => rankHelpLines({ profile: Object.assign({ overtime }, more) }).join(' ');
  assert.match(at({ grace: 30, effect: 'noFirst' }), /more than 30 seconds over the time limit cannot get rank 1/);
  assert.match(at({ grace: 45, effect: 'noFirst' }), /more than 45 seconds/);
  assert.doesNotMatch(at({ grace: 45, effect: 'noFirst' }), /30 seconds/);
  assert.match(at({ grace: 0, effect: 'noFirst' }), /A speaker over the time limit cannot get rank 1/);
  assert.match(at({ grace: 60, effect: 'flagOnly' }), /more than 60 seconds .* note for the tab room/);
  assert.match(at({ grace: 30, effect: 'none' }), /does not change the rank/);
  assert.match(at({ grace: 30, effect: 'noFirst' }, { rating: { min: 70, max: 100, step: 1 }, rankRatingRule: true }), /same or more points/);
  // The published profiles: each one's own grace shows.
  for (const p of DATA.profiles.list ? DATA.profiles.list() : PUB.profiles.map((f) => JSON.parse(read('../../profiles/' + f)))) {
    const g = p.overtime && Number.isFinite(p.overtime.grace) ? p.overtime.grace : 30;
    const text = rankHelpLines({ profile: p }).join(' ');
    if (g > 0 && (p.overtime || {}).effect !== 'none') assert.match(text, new RegExp(g + ' seconds'), p.id);
  }
});

test('How to rank says when only the top N go on the ballot', () => {
  const text = rankHelpLines({ profile: JSON.parse(read('../../profiles/v2/top-three.v1.json')) }).join(' ');
  assert.match(text, /top 3 go on the ballot/);
});

test('the judge help copies no league text: the tournament\'s own bias note is never in the fold', () => {
  const room = roomFor('oo');
  room.profile = Object.assign({}, room.profile, { biasNote: 'OFFICIAL LEAGUE TEXT' });
  assert.doesNotMatch(rankHelpHtml(room), /OFFICIAL LEAGUE TEXT/);
});

// ---------- the hooks and the file area ----------
test('each screen hooks in with one import and one call; the Rank screen keeps its bias reminder', () => {
  const room = read('../room-screen.js'), rank = read('../rank-screen.js'), set = read('../settings-screen.js');
  assert.equal((room.match(/help\/help-view\.js/g) || []).length, 1);
  assert.equal((room.match(/mountRoomHelp\(/g) || []).length, 1);
  assert.equal((rank.match(/help\/help\.js/g) || []).length, 1);
  assert.equal((rank.match(/rankHelpHtml\(/g) || []).length, 1);
  assert.match(rank, /Judge the performance, not the person\./);
  assert.equal((set.match(/help\/help-view\.js/g) || []).length, 1);
  assert.equal((set.match(/mountTipsPart\(/g) || []).length, 1);
  assert.match(read('../../index.html'), /<link rel="stylesheet" href="js\/help\/help\.css">/);
});

test('the Settings line names the reset in plain words', () => {
  assert.equal(TIPS_AGAIN, 'Show the first-room tips again');
  assert.match(tipsPartHtml(), /id="help-tips-again"/);
});

test('the help files make no network calls and use no brand fill or stripes', () => {
  for (const f of ['help.js', 'help-view.js', 'listen-for.js']) assert.doesNotMatch(read(f), /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//, f);
  const css = read('help.css');
  assert.doesNotMatch(css, /--brand|repeating-linear-gradient|text-decoration:\s*underline|--ok|--caution|--error/);
});
