// Tests for step E10 (docs/events/LANDING.md §4.1; MODELS.md §4.2): extemp events (USX, IX, COM, MX) with a drawn
// question per entry, and speakers who start in any order (events/js/question.js, the comment sheet, the review card).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDriver } from '../core/clock.js';
import { loadEventData } from './js/data.js';
import { ENABLED_EVENTS, createRoom, selectEntry, updateEntry, entryOf, nextWaiting, rosterAction } from './js/room.js';
import { limitOf, graceOf, startLeft, stoppedTiming } from './js/timer.js';
import { asksQuestion, questionOf, setQuestion, QUESTION_MAX } from './js/question.js';
import { sheetHtml } from './js/comment-view.js';
import { rosterHtml } from './js/room-screen.js';
import { eventChoices } from './js/setup-screen.js';
import { setNotes, ballotComment } from './js/comments.js';
import { cards, copyAllText, printModel } from './js/ballot.js';
import { cardHtml } from './js/review-screen.js';
import { sourceText } from './js/cleanup.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const USX = DATA.events.get('usx');
const T0 = 1_800_000_000_000;
let n = 0;
const makeId = (p) => p + (++n);
const CODES = ['A12', 'B07', 'C33', 'D41'];
const usxRoom = () => createRoom({ event: USX, profile: JSON.parse(JSON.stringify(DATA.profiles.get('nsda-district'))), entries: CODES.map((code) => ({ code })), round: 'Round 1', now: T0, makeId });
const idOf = (r, code) => r.entries.find((e) => e.code === code).id;
const Q = (code) => 'Will ' + code + ' change trade policy this year?';

// One speaker as the Room screen runs them: the judge picks the row, types the question the speaker drew, starts the
// clock (core/clock.js createDriver, saving the run on the entry as timer-view.js does), and stops it `secs` later.
function judgeOne(state, code, secs) {
  const limit = limitOf(USX);
  const grace = graceOf(state.room);
  const id = idOf(state.room, code);
  state.room = selectEntry(state.room, id, state.now);
  state.room = setQuestion(state.room, Q(code), state.now);
  const change = (fn) => { state.room = updateEntry(state.room, id, fn, state.now); };
  const driver = createDriver({
    kind: 'speech',
    get: () => entryOf(state.room, id).timing.run,
    set: (run) => change((e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { run }) })),
    onStart: () => change((e) => Object.assign({}, e, { status: 'speaking' })),
    onStop: (run, left) => change((e) => Object.assign({}, e, { status: 'done', timing: stoppedTiming(e.timing, run, left, limit, grace, state.now) })),
    now: () => state.now,
    timers: { setInterval: () => 1, clearInterval: () => {} },
  });
  driver.start({ kind: 'speech' }, startLeft(entryOf(state.room, id).timing, state.now, limit));
  state.now += secs * 1000;
  driver.stop();
  state.now += 7 * 60 * 1000; // the next speaker arrives about 7 minutes later (EVENTS.md §3)
}
const permutations = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations(xs.slice(0, i).concat(xs.slice(i + 1))).map((p) => [x].concat(p))));

// Why: extemp speakers draw outside the room and arrive one at a time, not in roster order (EVENTS.md §3); if any
// arrival order lost a time, a question or a status, the judge would have to wait for the "right" speaker or re-type.
test('any entry starts in any order: every one of the 24 orders ends with each time and question kept', () => {
  for (const order of permutations(CODES)) {
    const state = { room: usxRoom(), now: T0 };
    order.forEach((code, i) => judgeOne(state, code, 300 + i * 10));
    for (const [i, code] of order.entries()) {
      const e = entryOf(state.room, idOf(state.room, code));
      assert.equal(e.status, 'done', order.join(',') + ': ' + code);
      assert.equal(e.timing.usedMs, (300 + i * 10) * 1000, order.join(',') + ': ' + code + ' time');
      assert.equal(questionOf(e), Q(code), order.join(',') + ': ' + code + ' question');
    }
    assert.deepEqual(state.room.entries.map((e) => e.code), CODES, 'the roster keeps the posted order (the ballot order)');
  }
});

// Why: the screen a judge sees mid-round must show who already spoke when the third speaker on the list came first,
// and the drawn question must come back on the sheet when the judge picks that speaker again to finish the comment.
test('screen: the third speaker starts first; the roster shows it done and its sheet shows its question', () => {
  const state = { room: usxRoom(), now: T0 };
  judgeOne(state, 'C33', 412);
  const html = rosterHtml(state.room, null);
  assert.match(html, /C33<\/span><\/span>[\s\S]*?class="pill outline">Done</, 'C33 is done on its roster row');
  assert.equal((html.match(/class="pill">Waiting</g) || []).length, 3, 'the other three rows still wait');
  // Next speaker goes on from C33 to the next waiting entry, and then round to the top.
  assert.equal(nextWaiting(state.room).code, 'D41');
  judgeOne(state, 'A12', 380);
  const back = selectEntry(state.room, idOf(state.room, 'C33'), state.now);
  const sheet = sheetHtml(back, entryOf(back, back.current), USX);
  assert.match(sheet, /Question drawn/);
  assert.match(sheet, new RegExp('id="question"[^>]*value="' + Q('C33').replace('?', '\\?') + '"'));
  // The question field comes first on the sheet, above the chips (MODELS.md §4.2: "at the top").
  assert.ok(sheet.indexOf('id="question"') < sheet.indexOf('class="chip-group"'));
});

// Why: LANDING.md E10's done-check: the question shows on the review card, so the judge can match the comment to what
// the speaker was asked; it must also reach Copy all and the print sheet, which stand in for the paper ballot.
test('screen: the drawn question shows on the review card, Copy all and the print sheet', () => {
  const state = { room: usxRoom(), now: T0 };
  for (const code of ['D41', 'B07']) judgeOne(state, code, 400);
  state.room = updateEntry(state.room, idOf(state.room, 'D41'), (e) => setNotes(e, 'You answered the question early.'), state.now);
  const list = cards(state.room, 'speaking');
  const d = list.find((c) => c.code === 'D41');
  assert.equal(d.question, Q('D41'));
  assert.match(cardHtml(d, false), new RegExp('class="card-question"><span class="muted">Question:</span> ' + Q('D41').replace('?', '\\?')));
  assert.equal(list.find((c) => c.code === 'A12').question, '', 'a speaker with no question yet has none');
  assert.doesNotMatch(cardHtml(list.find((c) => c.code === 'A12'), false), /card-question/, 'no empty question line');
  assert.match(copyAllText(state.room, USX), new RegExp('D41\\nQuestion: ' + Q('D41').replace('?', '\\?') + '\\nYou answered'));
  const text = printModel(state.room, USX, 420).sections.find((s) => s.title === 'D41').text;
  assert.equal(text, 'Question: ' + Q('D41') + '\n\nYou answered the question early.');
});

// Why: the question is the speaker's own topic, not the judge's comment; if it leaked into the ballot comment it would
// be pasted twice into Tabroom, and if it reached the AI clean-up text it could go to a server beside the code
// (MODELS.md §4.2: it never goes to hosted AI with a code beside it).
test('the question never joins the ballot comment or the clean-up text', () => {
  const state = { room: usxRoom(), now: T0 };
  judgeOne(state, 'B07', 400);
  const e0 = entryOf(state.room, idOf(state.room, 'B07'));
  const e = setNotes(e0, 'Strong sources.');
  assert.equal(ballotComment(e), 'Strong sources.');
  assert.equal(sourceText(e), 'Strong sources.');
  assert.doesNotMatch(ballotComment(e) + sourceText(e), /trade policy/);
});

// Why: only the drawn-question events get the field; a prepared event or impromptu with a "Question drawn" box would
// confuse the judge, and an extemp event without it would lose the question (EVENTS.md §3, §4; MODELS.md §4.3).
test('the question field shows for USX, IX, COM and MX only, and these four can be picked in setup', () => {
  const asks = DATA.order.filter((id) => asksQuestion(DATA.events.get(id)));
  assert.deepEqual(asks.sort(), ['com', 'ix', 'mx', 'usx']);
  for (const id of asks) assert.ok(ENABLED_EVENTS.includes(id), id + ' is on');
  assert.deepEqual(eventChoices(DATA).filter((e) => asksQuestion(e)).map((e) => e.id).sort(), ['com', 'ix', 'mx', 'usx']);
  const oo = createRoom({ event: DATA.events.get('oo'), profile: DATA.profiles.get('nsda-district'), entries: [{ code: 'A1' }], now: T0, makeId });
  assert.doesNotMatch(sheetHtml(oo, oo.entries[0], DATA.events.get('oo')), /Question drawn/);
  assert.equal(asksQuestion(DATA.events.get('imp')), false, 'impromptu draws a topic in the room, not an extemp question');
});

// Why: the field is one line and autosaves each keystroke; a pasted page or a line break would break the card layout
// and the copy text, and a save on every unchanged event would churn storage.
test('setQuestion keeps one line, caps the length, changes only the current entry, and skips no-op saves', () => {
  let r = usxRoom();
  const a = r.entries[0].id;
  r = setQuestion(r, 'Line one\nline two', T0 + 1);
  assert.equal(entryOf(r, a).question, 'Line one line two');
  assert.equal(r.entries[1].question, undefined, 'the other entries are untouched');
  assert.equal(setQuestion(r, 'Line one line two', T0 + 2), r, 'same text: same room, no save');
  assert.equal(entryOf(setQuestion(r, 'x'.repeat(QUESTION_MAX + 50), T0 + 3), a).question.length, QUESTION_MAX);
  assert.equal(setQuestion(Object.assign({}, r, { current: null }), 'x', T0 + 4).current, null, 'no current entry: no change');
  assert.equal(questionOf({ question: '  Why   now? ' }), 'Why now?');
  assert.equal(questionOf({}), '');
});

// Why: a late extemp speaker who never comes is a no-show; the question the judge may have typed must not block the
// no-show or come back wrong after Undo.
test('a no-show with a typed question still undoes with the question kept', () => {
  let r = setQuestion(usxRoom(), Q('A12'), T0);
  const a = r.entries[0].id;
  const res = rosterAction(r, 'noshow', a, T0 + 1);
  assert.equal(res.refused, '');
  r = res.undo(res.room, T0 + 2);
  assert.equal(entryOf(r, a).status, 'waiting');
  assert.equal(questionOf(entryOf(r, a)), Q('A12'));
});
