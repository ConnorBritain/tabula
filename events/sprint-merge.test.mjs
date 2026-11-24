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
import { createDayStore } from './js/day-store.js';
import { createRoom } from './js/room.js';
import { eventLine } from './js/guide.js';
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

