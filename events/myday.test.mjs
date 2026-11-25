// Tests for step S3, My day (docs/events/EXPERIENCE.md §1.2, §1.3, §5, §8.3): the Day and BallotCard records and their
// read-time migration, the status words and sections, ranks due, the picker, the type page, the new routes, the
// ranks-due setting, and the S2 follow-ups (the palette's Undo row, focus after Undo). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom, ENABLED_EVENTS, CUSTOM_EVENT } from './js/room.js';
import { dayOf } from './js/rooms.js';
import { migrateDays, migrateCards, migrateSettings, DAY_DEFAULTS, CARD_DEFAULTS } from './js/migrate.js';
import { readBackup, withSetting, withRecentEvent, ranksDueMinOf } from './js/settings.js';
import { DAYS_KEY, CARDS_KEY } from './js/store.js';
import { makeDay, makeCard, cardStatus, STATUS_WORDS, mydayModel, ranksDueAt, dueText, nextRoundLabel, withStandby, cancelCard, moveRoom, submitCard, cardForRound, ensureDay, undoFields } from './js/cards.js';
import { createDayStore } from './js/day-store.js';
import { parseRoute, routeHash, roundTarget } from './js/routes.js';
import { chipsOf, pickerRows, recentIds, pickerSections } from './js/picker.js';
import { EVENT_LINES, guideModel, rulesLines } from './js/guide.js';
import { typeHtml, roundsOfType } from './js/type-screen.js';
import { mydayHtml, itemView, sinceText } from './js/myday-screen.js';
import { pickerListHtml, sheetHtml } from './js/picker-screen.js';
import { paletteRows, runUndo } from './js/palette.js';
import { focusIfLost } from './js/focus.js';
import { searchCommands } from '../core/keys.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const NOW = new Date(2026, 10, 23, 14, 0, 0).getTime();
const TODAY = dayOf(NOW);
let n = 0;
const mk = (p) => p + 'id' + (++n);
const DAY = makeDay({ date: TODAY, now: NOW - 3600000, makeId: () => 'd1' });

function round(eventId, over) {
  const r = createRoom({ event: DATA.events.get(eventId), profile: DATA.profiles.get('nsda-district'), entries: [{ code: 'A1' }, { code: 'B2' }], round: 'Round 1', now: NOW - 1800000, makeId: mk });
  return Object.assign(r, over || {});
}
// A round where every present speaker has finished; the last stop is `stop`.
function spoken(r, stop) {
  return Object.assign({}, r, { entries: r.entries.map((e, i) => Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { usedMs: 60000, runs: [{ kind: 'speech', startedAt: stop - 120000, stoppedAt: stop - (r.entries.length - 1 - i) * 1000 }] }) })) });
}
const card = (over) => Object.assign(makeCard({ day: DAY, event: DATA.events.get('hi'), round: 'Round 1', now: NOW - 1000, makeId: mk }), over || {});
function fakeStore() {
  const box = {};
  return { box, get: (k, d) => (k in box ? JSON.parse(box[k]) : d), set: (k, v) => { box[k] = JSON.stringify(v); return true; } };
}

// ---------- records and migration ----------

// Why: a card or day saved by an early build (missing new fields) must open with every value the judge saved intact;
// a migration that dropped submittedAt would put a submitted ballot back in "Now" and make the judge submit twice.
test('old day and card records keep every field and only get the missing defaults, and the migration is idempotent', () => {
  const oldCard = { id: 'c1', dayId: 'd1', eventKey: 'hi@1', round: 'R2', submittedAt: 123, odd: 'kept' };
  const [c] = migrateCards([oldCard]);
  for (const k of Object.keys(oldCard)) assert.deepEqual(c[k], oldCard[k], k);
  for (const k of Object.keys(c)) if (!(k in oldCard)) assert.ok(k in CARD_DEFAULTS, k + ' is a default');
  assert.equal(c.status, 'notStarted');
  assert.deepEqual(migrateCards(migrateCards([oldCard])), [c]);
  const [d] = migrateDays([{ id: 'd1', date: TODAY }]);
  assert.equal(d.standby, false);
  for (const k of Object.keys(DAY_DEFAULTS)) assert.ok(k in d, k);
  assert.deepEqual(migrateDays('oops'), []);
  assert.deepEqual(migrateCards([null, 5]), [null, 5], 'a broken item is given back, not hidden or invented');
});

// Why: the recent-events default is a list; if two settings records shared one array, a push to one would change the
// other, and the picker's Recent row would show events the judge never picked.
test('each settings read gets its own recent-events list, and the new settings have safe defaults', () => {
  const a = migrateSettings({}), b = migrateSettings(null);
  assert.equal(a.ranksDueMin, 10);
  assert.deepEqual(a.recentEvents, []);
  a.recentEvents.push('hi');
  assert.deepEqual(b.recentEvents, []);
  assert.deepEqual(migrateSettings({}).recentEvents, []);
});

// Why: restore must bring cards back in today's shape, and a damaged card list must stop the restore rather than wipe
// the judge's day with half a file.
test('a backup restores days and cards through the migration, and a damaged card list is refused', () => {
  const file = (storage) => JSON.stringify({ kind: 'backup', app: 'tabula-events', version: 1, exportedAt: '2026-11-23T00:00:00Z', storage });
  const b = readBackup(file({ [CARDS_KEY]: JSON.stringify([{ id: 'c1', dayId: 'd1', eventKey: 'oo@1' }]), [DAYS_KEY]: JSON.stringify([{ id: 'd1', date: TODAY }]) }));
  assert.equal(JSON.parse(b.storage[CARDS_KEY])[0].status, 'notStarted');
  assert.equal(JSON.parse(b.storage[DAYS_KEY])[0].standby, false);
  assert.throws(() => readBackup(file({ [CARDS_KEY]: '{"not":"a list"}' })), /damaged/);
});

// ---------- status words and sections ----------

// Why: the judge reads only these words; if a submitted ballot still said "Ranks copied", they could not tell which
// of three flights still needs Tabroom.
test('the status word comes from the card and its round', () => {
  const r = round('hi');
  assert.equal(cardStatus(card(), null), 'notStarted');
  assert.equal(cardStatus(card(), r), 'judging');
  assert.equal(cardStatus(card(), Object.assign({}, r, { state: 'ranking' })), 'judging');
  assert.equal(cardStatus(card(), Object.assign({}, r, { ranksCopiedAt: 5, state: 'review' })), 'ranksIn');
  assert.equal(cardStatus(card({ submittedAt: 9 }), Object.assign({}, r, { ranksCopiedAt: 5, state: 'review' })), 'submitted');
  assert.equal(cardStatus(card({ submittedAt: 9 }), Object.assign({}, r, { ranksCopiedAt: 5, state: 'done' })), 'done');
  assert.equal(cardStatus(cancelCard(card(), NOW), r), 'cancelled');
  assert.deepEqual(Object.values(STATUS_WORDS), ['Not started', 'Judging', 'Ranks copied (comments open)', 'Submitted', 'Done', 'Cancelled']);
});

// Why: My day is the judge's list of what to do next; a card in the wrong section is a ballot they forget.
test('My day sorts cards into Now, Later today, Done (comments open) and Done, and shows today\'s rounds with no card', () => {
  const r1 = round('hi'), r2 = Object.assign(round('oo'), { ranksCopiedAt: 1, state: 'review' }), r3 = Object.assign(round('di'), { ranksCopiedAt: 1, state: 'review' });
  const old = round('poe', { createdAt: NOW - 3 * 86400000 });
  const loose = round('pro');
  const cards = [card({ roundId: r1.id }), card({ round: 'Round 2' }), card({ roundId: r2.id }), card({ roundId: r3.id, submittedAt: 1 }), cancelCard(card({ round: 'R9' }), NOW),
    card({ dayId: 'other-day', round: 'Yesterday' })];
  const m = mydayModel({ day: DAY, cards, rounds: [r1, r2, r3, old, loose], now: NOW, ranksDueMin: 10 });
  const ids = (s) => m.sections.find((x) => x.id === s).items.map((it) => (it.card ? it.card.round + ':' + it.status : 'loose:' + it.round.eventId));
  assert.deepEqual(ids('now').sort(), ['Round 1:judging', 'Round 1:ranksIn', 'loose:pro'].sort());
  assert.deepEqual(ids('later'), ['Round 2:notStarted']);
  assert.deepEqual(ids('open'), ['Round 1:submitted']);
  assert.deepEqual(ids('done'), ['R9:cancelled']);
  assert.ok(!m.items.some((it) => it.round && it.round.id === old.id), 'an older round lives in History, not My day');
  assert.ok(!m.items.some((it) => it.card && it.card.round === 'Yesterday'), 'a card of another day is not today');
});

// Why: the Standby card must not hide a real ballot, and the "Comments still open" note must show only when the day's
// active work is over, so the judge does not leave with comments unwritten.
test('Standby and the comments note show only when nothing is in Now or Later today', () => {
  const sb = withStandby(DAY, true, NOW);
  assert.equal(mydayModel({ day: sb, cards: [], rounds: [], now: NOW }).standby, true);
  assert.equal(mydayModel({ day: sb, cards: [card()], rounds: [], now: NOW }).standby, false, 'a card waiting in Later today hides Standby');
  const r = Object.assign(round('hi'), { ranksCopiedAt: 1, state: 'review' });
  const open = mydayModel({ day: sb, cards: [card({ roundId: r.id, submittedAt: 1 })], rounds: [r], now: NOW });
  assert.equal(open.commentsNote, true);
  assert.equal(open.standby, true);
  assert.equal(mydayModel({ day: sb, cards: [card({ roundId: r.id, submittedAt: 1 }), card()], rounds: [r], now: NOW }).commentsNote, false);
  assert.equal(withStandby(withStandby(sb, false, NOW + 5), true, NOW + 9).checkInAt, NOW, 'the first check-in time stays');
});

// ---------- ranks due ----------

// Why: Tabroom wants ranks soon after the round; a countdown that started early, or never, would make a judge late.
test('ranks are due at the card\'s own time, else the last present speaker\'s stop plus the setting', () => {
  const stop = NOW - 60000;
  const r = spoken(round('hi'), stop);
  assert.equal(ranksDueAt(card(), r, 10), stop + 600000);
  assert.equal(ranksDueAt(card(), r, 15), stop + 900000);
  assert.equal(ranksDueAt(card(), r, 0), stop + 600000, 'a bad setting falls back to 10 minutes');
  assert.equal(ranksDueAt(card({ ranksDueAt: 42 }), r, 10), 42);
  const waiting = Object.assign({}, r, { entries: r.entries.map((e, i) => (i === 1 ? Object.assign({}, e, { status: 'waiting' }) : e)) });
  assert.equal(ranksDueAt(card(), waiting, 10), null, 'not due while a speaker has not spoken');
  const noShow = Object.assign({}, r, { entries: r.entries.map((e, i) => (i === 1 ? Object.assign({}, e, { status: 'noShow', timing: Object.assign({}, e.timing, { runs: [] }) }) : e)) });
  assert.equal(ranksDueAt(card(), noShow, 10), stop - 1000 + 600000, 'a no show is not the last speaker');
  assert.equal(dueText(NOW + 462000, NOW), 'Ranks due in 7:42');
  assert.equal(dueText(NOW - 130000, NOW), 'Ranks were due 2:10 ago');
  const m = mydayModel({ day: DAY, cards: [card({ roundId: r.id })], rounds: [r], now: NOW, ranksDueMin: 10 });
  assert.equal(m.sections[0].items[0].due, stop + 600000, 'the Now card carries its due time');
});

// Why: the confirm sheet guesses the next round so a judge makes a card in two taps; a wrong guess files the ballot
// under the wrong round on My day and in History, where the judge looks it up for Tabroom.
test('the next round is the last card\'s number plus one', () => {
  assert.equal(nextRoundLabel([]), 'Round 1');
  assert.equal(nextRoundLabel([{ round: 'Round 2', createdAt: 1 }, { round: 'Round 1', createdAt: 0 }]), 'Round 3');
  assert.equal(nextRoundLabel([{ round: 'R9 (B)', createdAt: 1 }]), 'R10 (B)');
  assert.equal(nextRoundLabel([{ round: 'Semis', createdAt: 1 }]), '');
});

// ---------- the store glue ----------

// Why: decision 2a says every round gets a card, linked both ways; a round with no link would show twice on My day,
// and a card with no round would stay "Not started" after the judge finished it.
test('a round started from a card links both ways, and a round from #/new gets its own card', () => {
  const st = fakeStore();
  const ds = createDayStore({ store: st, now: () => NOW, makeId: mk });
  const c = ds.addCard({ event: DATA.events.get('hi'), round: 'Round 2', flight: 'A', level: 'elim', roomLabel: '204', tournament: 'Fall' });
  assert.equal(ds.today().tournament, 'Fall', 'the day takes the first tournament');
  const r = round('hi', { round: 'Round 2', flight: 'A', tournament: 'Fall' });
  const link = ds.linkNewRound(r, c.id);
  assert.deepEqual([link.round.cardId, link.round.dayId, link.round.level, link.round.roomLabel], [c.id, ds.today().id, 'elim', '204']);
  assert.equal(ds.card(c.id).roundId, null, 'nothing is saved until the caller saves the round first');
  ds.saveCard(link.card);
  assert.equal(ds.card(c.id).roundId, r.id);
  const r2 = round('oo', { round: 'Round 3' });
  const l2 = ds.linkNewRound(r2, null);
  ds.saveCard(l2.card);
  assert.equal(l2.card.roundId, r2.id);
  assert.equal(l2.card.eventKey, 'oo@1');
  assert.equal(ds.cards().length, 2);
  const m = mydayModel({ day: ds.today(), cards: ds.cards(), rounds: [link.round, l2.round], now: NOW });
  assert.equal(m.items.length, 2, 'each round shows once');
});

// Why: a judge's standby check-in time and an old round they mark submitted must survive a reload.
test('standby and adopting an old round save through the store', () => {
  const st = fakeStore();
  const ds = createDayStore({ store: st, now: () => NOW, makeId: mk });
  assert.equal(ds.setStandby(true).checkInAt, NOW);
  assert.equal(createDayStore({ store: st, now: () => NOW + 1, makeId: mk }).today().standby, true);
  const r = Object.assign(round('hi'), { ranksCopiedAt: 1, tournament: 'Fall' });
  const c = ds.adopt(r);
  assert.equal(c.roundId, r.id);
  assert.equal(c.tournament, 'Fall');
  assert.equal(cardStatus(c, r), 'ranksIn');
  assert.equal(ensureDay(ds.days(), TODAY, NOW, mk).made, false, 'one day per date');
});

// Why: card edits come with Undo; an Undo that wrote back the whole old card would erase a change made in between.
test('card edits change one field, and Undo puts back only what the edit changed', () => {
  const c = card({ roomLabel: '101' });
  const moved = moveRoom(c, '  310 ');
  assert.equal(moved.roomLabel, '310');
  const sub = submitCard(moved, NOW);
  const back = Object.assign({}, sub, undoFields(moved, sub));
  assert.equal(back.submittedAt, null);
  assert.equal(back.roomLabel, '310', 'the earlier move is kept');
  const cx = cancelCard(c, NOW);
  const unc = Object.assign({}, cx, undoFields(c, cx));
  assert.equal(unc.status, 'notStarted', 'Undo of a cancel puts the card back');
  assert.equal(unc.cancelledAt, null);
  assert.equal(cardForRound(round('hi', { customEvent: { id: 'custom' } }), DAY, NOW, mk).eventKey, CUSTOM_EVENT);
});

// ---------- settings ----------

// Why: the ranks-due minutes drive the countdown; a bad value (0, 900, "ten") must never be saved or break it.
test('the ranks-due setting takes 1 to 60 whole minutes, and recent events keep the last 5 with no doubles', () => {
  const s = migrateSettings({});
  assert.equal(withSetting(s, 'ranksDueMin', 15).ranksDueMin, 15);
  for (const bad of [0, 61, 2.5, '10', null]) assert.equal(withSetting(s, 'ranksDueMin', bad).ranksDueMin, 10, String(bad));
  assert.equal(ranksDueMinOf({ ranksDueMin: 'x' }), 10);
  let r = s;
  for (const id of ['hi', 'oo', 'di', 'hi', 'poe', 'pro', 'usx']) r = withRecentEvent(r, id);
  assert.deepEqual(r.recentEvents, ['usx', 'pro', 'poe', 'hi', 'di']);
  assert.deepEqual(withSetting(s, 'recentEvents', ['<b>']).recentEvents, [], 'only public event ids');
});

// ---------- routes ----------

// Why: the new screens live in the address, so a reload opens the same screen; a bad address must fall back home.
test('the pick, start and type routes round-trip, and bad ones go to My day', () => {
  assert.deepEqual(parseRoute('#/pick'), { screen: 'pick', id: null });
  assert.equal(routeHash('pick'), '#/pick');
  assert.deepEqual(parseRoute(routeHash('start', 'c12ab')), { screen: 'start', id: 'c12ab' });
  assert.deepEqual(parseRoute(routeHash('type', 'hi')), { screen: 'type', id: 'hi' });
  assert.equal(roundTarget(parseRoute('#/start/c1')), null, 'setup is not a round');
  for (const bad of ['#/start', '#/start/bad id', '#/type/HI', '#/type/<b>', '#/pick/x']) assert.deepEqual(parseRoute(bad), { screen: 'rooms', id: null }, bad);
});

// ---------- picker ----------

// Why: the chips tell a first-time parent what a round needs at a glance; they come from the event file, so a new
// event gets them with no new code.
test('the picker chips come from the event file', () => {
  // Design build 2026-11-24 (review §2.2): the chips moved from all caps to normal case, and the time chip to "10:00".
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (§6 Picker: no "Rank" chip on every card). Old line:
  //   assert.equal(chipsOf(DATA.events.get('hi')).join(' · '), 'Rank · Title · 10:00');
  assert.equal(chipsOf(DATA.events.get('hi')).join(' · '), 'Title · 10:00');
  assert.ok(chipsOf(DATA.events.get('duo')).includes('Pair'));
  assert.ok(chipsOf(DATA.events.get('usx')).includes('Question'));
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (§6 Picker: no "Rank" chip on every card). Old line:
  //   assert.deepEqual(chipsOf(DATA.events.get('imp')), ['Rank', 'Prep in room', '7:00']);
  assert.deepEqual(chipsOf(DATA.events.get('imp')), ['Prep in room', '7:00']);
});

// Why: Recent must put the events of today first so a judge with three HI flights taps once; empty groups would be
// noise on a phone.
test('the picker shows Recent first, groups by family, hides empty groups, and searches', () => {
  const rows = pickerRows(DATA);
  assert.equal(rows.length, ENABLED_EVENTS.length + 1, 'every enabled event and Custom');
  assert.deepEqual(recentIds(rows, ['hi', 'oo', 'hi'], ['di', 'oo', 'gone']), ['hi', 'oo', 'di']);
  const secs = pickerSections(rows, ['hi'], '');
  assert.deepEqual(secs.map((s) => s.title), ['Recent', 'Interp', 'Public address', 'Limited prep', 'Two runs', 'Custom']);
  assert.deepEqual(pickerSections(rows, [], '').map((s) => s.id)[0], 'interp', 'no empty Recent');
  assert.deepEqual(pickerSections(rows, [], 'humor')[0].rows.map((r) => r.id), ['hi']);
  const html = pickerListHtml(secs);
  assert.match(html, /href="#\/type\/hi"/, 'each row has its "i" link');
  assert.ok(html.indexOf('All events') > html.indexOf('Recent'));
  assert.match(sheetHtml({ name: '<b>', round: 'Round 2', tournament: '"x"' }), /&lt;b&gt;.*value="Round 2"/s);
});

// ---------- guide and type page ----------

// Why: every event a judge can pick needs its plain line; an empty guide leaves a first-time parent lost.
test('every enabled event has a plain line, and the guide reads the event file and rules', () => {
  for (const id of ENABLED_EVENTS.concat(CUSTOM_EVENT)) assert.ok(EVENT_LINES[id], id);
  const g = guideModel(DATA.events.get('imp'), DATA.profiles.get('nsda-district'));
  assert.equal(g.limit, '7:00');
  assert.match(g.prep, /share the 7:00 limit/);
  assert.equal(g.grace, '30 seconds over the limit');
  assert.ok(g.checks.includes('No notes'));
  assert.deepEqual(rulesLines(DATA.profiles.get('nsda-invitational')).lines.slice(0, 1), ['Ranks and points from 70 to 100.']);
  assert.match(rulesLines(DATA.profiles.get('nsda-district')).lines.join(' '), /cannot be ranked 1st/);
});

// Why: the type page must list only that type's rounds and must refuse an id that is not an event, never draw half.
test('the type page shows Guide, Rules and the rounds of that type', () => {
  const hi = round('hi', { round: '<i>R1</i>' }), oo = round('oo');
  assert.deepEqual(roundsOfType([hi, oo, null], 'hi').map((r) => r.id), [hi.id]);
  const html = typeHtml(DATA, 'hi', [hi, oo]);
  for (const part of ['Guide', 'Rules', 'Rounds']) assert.match(html, new RegExp('<h2 [^>]*>' + part + '[ <]'));
  assert.ok(!html.includes('<i>R1</i>'), 'round names are escaped');
  assert.equal(typeHtml(DATA, 'nope', []), null);
  assert.match(typeHtml(DATA, 'custom', []), /Custom event/);
});

// ---------- My day screen builders ----------

// Why: each card must offer the right next step (Start, Open, I submitted) and never show a judge's text as HTML.
test('My day cards offer the right action for their status, and escape every text', () => {
  const r = Object.assign(round('hi'), { ranksCopiedAt: 1, state: 'review' });
  const m = mydayModel({ day: withStandby(DAY, true, NOW - 600000), cards: [card({ round: '<b>R2</b>' }), card({ roundId: r.id })], rounds: [r], now: NOW });
  const html = mydayHtml(m, DAY, DATA.events, NOW);
  assert.ok(!html.includes('<b>R2</b>'));
  assert.match(html, /href="#\/start\/c/, 'a not-started card has Start');
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E45, DESIGN.md rule 9). Old line:
  //   assert.match(html, /data-act="submit">I submitted in Tabroom/);
  assert.match(html, /data-act="submit">Mark submitted/);
  assert.match(html, /href="#\/type\/hi"/, 'the event pill opens the type page');
  const v = itemView(m.sections[1].items[0], DATA.events);
  assert.equal(v.canSubmit, false, 'nothing to submit before the round starts');
  const sb = mydayHtml(mydayModel({ day: withStandby(DAY, true, NOW - 600000), cards: [], rounds: [], now: NOW }), withStandby(DAY, true, NOW - 600000), DATA.events, NOW);
  assert.match(sb, /On standby/);
  assert.match(sb, /I got a ballot/);
  assert.match(sb, /10 min ago/);
  assert.equal(sinceText(NOW - 3900000, NOW), '1 h 5 min ago');
});

// ---------- S2 follow-ups ----------

// Why: the palette row was made when it opened; if its toast is gone or a newer Undo waits, running "whatever Undo
// waits now" would undo the wrong thing.
test('the palette lists My day and Start a round, and its Undo row runs only the Undo it names', () => {
  const rows = paletteRows({ events: DATA.events, choices: [], rooms: [], undo: '' });
  assert.ok(rows.some((x) => x.label === 'My day' && x.hash === '#/'));
  assert.ok(rows.some((x) => x.label === 'Start a round' && x.hash === '#/pick'));
  let ran = 0; const toasts = [];
  const ui = (name) => ({ pendingUndo: () => (name ? { name, run: () => { ran++; } } : null), toast: (t) => toasts.push(t) });
  assert.equal(runUndo(ui('Undo: delete R1'), { label: 'Undo: delete R1' }), true);
  assert.equal(runUndo(ui('Undo: cancel R2'), { label: 'Undo: delete R1' }), false);
  assert.equal(runUndo(ui(null), { label: 'Undo: delete R1' }), false);
  assert.equal(ran, 1);
  assert.deepEqual(toasts, ['That Undo is no longer there.', 'That Undo is no longer there.']);
});

// Why: the palette is the fast way to the rules mid-round; a Guide row that opened the wrong event (or no page) would
// show a judge the wrong time limit or rule checks while a speaker waits.
test('the palette has a Guide row for each enabled event and Custom, each opening that event\'s type page', () => {
  const choices = ENABLED_EVENTS.map((id) => DATA.events.get(id));
  const rows = paletteRows({ events: DATA.events, choices, rooms: [], undo: '' });
  const guides = rows.filter((x) => x.group === 'Guide');
  assert.equal(guides.length, ENABLED_EVENTS.length + 1);
  for (const id of ENABLED_EVENTS.concat(CUSTOM_EVENT)) {
    const g = guides.find((x) => x.id === 'guide-' + id);
    assert.ok(g, id);
    assert.deepEqual(parseRoute(g.hash), { screen: 'type', id }, id + ' opens its own type page');
    assert.ok(typeHtml(DATA, id, []), id + ' has a type page to open');
  }
  assert.equal(guides.find((x) => x.id === 'guide-hi').label, 'Guide: HI');
  assert.equal(searchCommands('guide hi', rows)[0].id, 'guide-hi');
  assert.equal(searchCommands('new hi', rows)[0].label, 'New HI round', 'Guide rows do not push the New rows down');
});

// Why: a toast's Undo button is gone after it runs; with focus left on the page body, a keyboard judge starts over
// from the top of the page.
test('after an Undo, focus that fell to the page body moves to the screen title', () => {
  let focused = null;
  const title = { focus() { focused = 'title'; } };
  const doc = { body: {}, documentElement: {}, activeElement: null, querySelector: (s) => (s === '#screen-title' ? title : null) };
  doc.activeElement = doc.body;
  assert.equal(focusIfLost(doc, ['#screen-title', '#main']), title);
  assert.equal(focused, 'title');
  const btn = {};
  assert.equal(focusIfLost(Object.assign({}, doc, { activeElement: btn }), ['#screen-title']), btn, 'focus that is somewhere real stays');
});
