// Speech Events: checks where steps S3, S4 and S5 meet after the parallel sprint merge. Each step had its own tests;
// these cover the seams between them. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { pickerRows, pickerSections } from './js/picker.js';
import { pickerListHtml } from './js/picker-screen.js';
import { paletteRows } from './js/palette.js';
import { eventChoices } from './js/setup-screen.js';
import { parseRoute } from './js/routes.js';
import { searchCommands } from '../core/keys.js';
import { mydayHtml } from './js/myday-screen.js';
import { congressToday } from './congress/store.js';
import { createDayStore } from './js/day-store.js';
import { createRoom } from './js/room.js';
import { mydayModel, makeDay, makeCard, linkRoundToCard, cardStatus, ranksDueAt } from './js/cards.js';
import { eventLine, rulesLines } from './js/guide.js';
import * as runsWs from './js/runs-workspace.js';
import * as roomWs from './js/room-workspace.js';

const read = (p) => readFileSync(new URL('./' + p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));

// Why: S5 added Pro Con Challenge after S3 built the picker; if PCC has no group or line, a judge never finds the event on the picker.
test('the picker lists Pro Con Challenge under Two runs, with a plain line and a Pro then Con chip', () => {
  const pcc = pickerRows(DATA).find((r) => r.id === 'pcc');
  assert.ok(pcc, 'PCC is a picker row');
  assert.equal(pcc.group, 'twoRuns');
  assert.ok(eventLine('pcc').length > 20);
  assert.ok(pcc.chips.includes('PRO THEN CON'));
  assert.ok(pcc.chips.includes('TIMER 10:30'));
  const group = pickerSections(pickerRows(DATA), [], '').find((s) => s.id === 'twoRuns');
  assert.deepEqual(group.rows.map((r) => r.id), ['pcc']);
});

const screen = (name) => ({ name, shown: null, show(id) { this.shown = id; }, hide() {}, run: () => true });
const fakeEnv = () => {
  const el = {};
  return { el, roomScreens: { judge: screen('judge'), rank: screen('rank'), rate: screen('rate'), review: screen('review') }, runsScreens: { judge: screen('runs-judge') } };
};

// Why: S4 made a ranks-off profile draw the Rate screen and S5 made its own workspace; if the F4 workspace ignores the profile, a PCC round under a rate-only ballot asks the judge for ranks the tournament does not want.
test('a PCC round follows the profile layer: ranks off draws the Rate screen, the judge stage stays the runs screen', () => {
  const env = fakeEnv();
  const round = { id: 'r1', profile: { ranks: 'off' } };
  runsWs.mount(env.el, env, round, 'rank');
  assert.equal(env.roomScreens.rate.shown, 'r1');
  assert.equal(env.roomScreens.rank.shown, null);
  runsWs.mount(env.el, env, round, 'judge');
  assert.equal(env.runsScreens.judge.shown, 'r1');
});

// Why: S4 drops the Rank stage for a comments-only profile; if the shared mounter still opened it, a judge could reach a rank board the ballot does not have.
test('both room-family workspaces refuse a stage the round profile does not have', () => {
  const env = fakeEnv();
  const round = { id: 'r2', profile: { critiqueOnly: true } };
  assert.ok(!roomWs.stages(round).includes('rank'));
  assert.throws(() => roomWs.mount(env.el, env, round, 'rank'));
  assert.throws(() => runsWs.mount(env.el, env, round, 'rank'));
});

// Why: S6 built the Congress scorer after S3 built the picker; without a Congress row a judge who scores Congress has no way in from "Start a round".
test('the picker has a Congress group before Custom that opens chamber setup, and search results leave it out', () => {
  const html = pickerListHtml(pickerSections(pickerRows(DATA), [], ''));
  assert.match(html, /href="#\/chamber\/new"/);
  assert.ok(html.indexOf('pk-h-congress') < html.indexOf('pk-h-custom'), 'Congress comes before Custom');
  assert.doesNotMatch(pickerListHtml(pickerSections(pickerRows(DATA), [], 'humor')), /chamber/);
});

// Why: the palette is the fast way around the app; without a Guide row per event, a judge mid-round cannot pull up an event's rules from the keyboard.
test('the palette has a Guide row for each enabled event that opens its type page, and search finds it', () => {
  const rows = paletteRows({ events: DATA.events, choices: eventChoices(DATA), rooms: [], undo: '' });
  for (const ev of eventChoices(DATA)) {
    const g = rows.find((x) => x.id === 'guide-' + ev.id);
    assert.ok(g, ev.id + ' has a Guide row');
    assert.deepEqual(parseRoute(g.hash), { screen: 'type', id: ev.id });
  }
  assert.equal(searchCommands('guide humorous', rows)[0].id, 'guide-hi');
});

const memStore = () => { const m = new Map(); return { get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d), set: (k, v) => { m.set(k, JSON.stringify(v)); return true; } }; };

// Why: S3's card and S4's setup Level field both hold the level; if the setup choice is dropped, an elim round is judged with prelim rules (or the reverse) and the panel line is wrong.
test('a round started from a card keeps the level the judge last picked on the setup form', () => {
  let n = 0;
  const ds = createDayStore({ store: memStore(), now: () => Date.UTC(2026, 10, 23, 15), makeId: (p) => (p || '') + 'id' + (++n) });
  const c = ds.addCard({ event: DATA.events.get('hi'), round: 'Round 2', level: 'elim', roomLabel: '204' });
  const r = createRoom({ event: DATA.events.get('hi'), profile: DATA.profiles.get('nsda-district'), entries: [{ code: 'A1' }], round: 'Round 2', level: 'prelim', now: 1, makeId: (p) => p + 'x' });
  const kept = ds.linkNewRound(r, c.id, { level: 'prelim' });
  assert.equal(kept.round.level, 'prelim', 'the judge changed elim to prelim on the setup form');
  assert.equal(kept.card.level, 'prelim');
  assert.equal(ds.linkNewRound(r, c.id).round.level, 'elim', 'with no edit, the card level still wins (S3 rule)');
});

// Why: a round started at 23:58 is still being judged at 00:10; if My day hides it at midnight, the judge loses the countdown to ranks due and the "I submitted" tick for a live ballot.
test('My day keeps an earlier day\'s open ballot (judging or comments open) and drops its finished or never-started ones', () => {
  const t0 = new Date(2026, 10, 23, 23, 58).getTime();
  const t1 = new Date(2026, 10, 24, 0, 10).getTime();
  let n = 0; const mk = (p) => (p || '') + 'k' + (++n);
  const yday = makeDay({ now: t0, makeId: mk });
  const today = makeDay({ now: t1, makeId: mk });
  const hi = DATA.events.get('hi');
  const live = linkRoundToCard(createRoom({ event: hi, profile: DATA.profiles.get('nsda-district'), entries: [{ code: 'A1' }], now: t0, makeId: mk }), makeCard({ day: yday, event: hi, round: 'R1', now: t0, makeId: mk }));
  const idle = makeCard({ day: yday, event: hi, round: 'R2', now: t0, makeId: mk });
  const m = mydayModel({ day: today, cards: [live.card, idle], rounds: [live.round], now: t1 });
  assert.deepEqual(m.items.map((x) => x.card.id), [live.card.id], 'the live ballot stays; the never-started one does not');
  assert.equal(m.items[0].earlier, true);
  assert.equal(m.sections.find((s) => s.id === 'now').items.length, 1);
});

// Why: a comments-only ballot (S4) has no ranks to copy; if My day (S3) waits for ranks, the card says "Judging" with a ranks-due timer forever and never moves to Done.
test('My day treats a comments-only round as done when its comments are copied, with no ranks-due timer', () => {
  const prof = DATA.profiles.get('comments-only');
  const ended = { id: 'r9', state: 'done', profile: prof, entries: [{ id: 'e', status: 'done', timing: { runs: [{ stoppedAt: 1000 }] } }] };
  const mid = Object.assign({}, ended, { state: 'review' });
  assert.equal(cardStatus({ status: 'notStarted' }, ended), 'done');
  assert.equal(cardStatus({ status: 'notStarted' }, mid), 'judging');
  assert.equal(ranksDueAt({}, mid, 10), null);
});

// Why: the type page (S3) is where a parent judge learns the ballot; telling them a comments-only or rate-only ballot is "Ranks only" (S4 shapes) sends them to rank a room that takes no ranks.
test('the type page Rules words each S4 ballot shape correctly', () => {
  const words = (id) => rulesLines(DATA.profiles.get(id)).lines.join(' ');
  assert.match(words('comments-only'), /^Comments only: no ranks and no points\./);
  assert.doesNotMatch(words('comments-only'), /ranked 1st|Ranks only/);
  assert.match(words('rate-only'), /^No ranks\./);
  assert.match(words('top-three'), /Rank the top 3 only/);
  assert.match(words('rubric-five'), /A rubric with 5 parts/);
  assert.match(words('elim-large'), /Up to 12 speakers/);
  assert.match(words('nsda-district'), /^Ranks only, no points\./, 'a v1 profile reads as before');
});

// Why: S6 keeps Congress apart from rounds and cards; if My day (S3) never shows today's chamber, a scorer mid-session sees "No ballots yet" or "On standby" and has no way back to the chamber from home.
test('My day lists today\'s Congress chambers with an Open link, and hides Standby while one is in use', () => {
  const now = new Date(2026, 10, 24, 10).getTime();
  const old = new Date(2026, 10, 20, 10).getTime();
  const state = { chambers: [{ id: 'ch1', house: 'senate', tournament: 'Fall', roomLabel: '12', createdAt: now }, { id: 'ch2', house: 'house', createdAt: old }, { id: 'ch3', house: 'house', createdAt: old }],
    sessions: [{ id: 's1', chamberId: 'ch3', createdAt: old, updatedAt: now }] };
  const list = congressToday(state, now);
  assert.deepEqual(list.map((c) => c.id), ['ch1', 'ch3'], 'made today, or a session saved today');
  assert.equal(list[0].label, 'Senate · Fall · Room 12');
  const day = { id: 'd', date: '2026-11-24', standby: true, checkInAt: now - 60000 };
  const html = mydayHtml(mydayModel({ day, cards: [], rounds: [], now }), day, DATA.events, now, list);
  assert.match(html, /href="#\/chamber\/ch1"/);
  assert.doesNotMatch(html, /On standby|No ballots yet/);
});
