// Tests for step E8 (docs/events/LANDING.md §4.1): review and copy in two stages, and the print sheet
// (events/js/ballot.js, events/js/review-screen.js). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom, rosterAction, updateEntry } from './js/room.js';
import { openBoard, withRating, withRanks } from './js/board.js';
import { setNotes, setPrivateNote, toggleCheck } from './js/comments.js';
import {
  ranksBlock, ranksProblems, critique, cards, checklist, statusText, markCopied, setComment, setReasonReview, copyAllText, printModel,
} from './js/ballot.js';
import { ranksStageHtml, cardHtml, commentsStageHtml, summaryHtml } from './js/review-screen.js';
import { printSheetHtml } from '../core/sheets.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const EXP = DATA.events.get('exp');
const prof = (id) => JSON.parse(JSON.stringify(DATA.profiles.get(id)));
// A judged room: four speakers, B07 went over grace, ranks D41, A12, C33, B07 (speaking order A12, B07, C33, D41).
function judged(profileId) {
  let r = openBoard(createRoom({ event: EXP, profile: prof(profileId), entries: ['A12', 'B07', 'C33', 'D41'].map((code) => ({ code })), round: 'Round 2', tournament: 'Fall Classic', now: 1 }), 2).room;
  const id = (code) => r.entries.find((e) => e.code === code).id;
  r = withRanks(r, { [id('D41')]: '1', [id('A12')]: '2', [id('C33')]: '3', [id('B07')]: '4' }, 3);
  r = updateEntry(r, id('B07'), (e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { usedMs: 345000, overGrace: true, overLimit: true }) }), 4);
  for (const code of ['A12', 'B07', 'C33', 'D41']) r = updateEntry(r, id(code), (e) => setNotes(e, code + ': clear structure. Next time, slow down. Ranked here because of the close.'), 5);
  r = updateEntry(r, id('A12'), (e) => toggleCheck(setPrivateNote(e, 'blue jacket'), 'noAiText'), 6);
  return Object.assign({}, r, { reasonForRank: 'D41 had the clearest structure.' });
}
const idOf = (r, code) => r.entries.find((e) => e.code === code).id;

// Why: the tab room wants ranks first, and Tabroom locks them on submit (DESIGN.md §4.7); the ranks block must carry
// every entry's rank, rating and over-time answer, in the order the online ballot lists them, so nothing is typed
// against the wrong code (LANDING.md E8 "ranks and ratings copy first").
test('stage 1: the ranks block lists code, rank, rating and over time, in speaking order', () => {
  const r0 = judged('nsda-invitational');
  const r = [['A12', '95'], ['B07', '80'], ['C33', '88'], ['D41', '97']].reduce((x, [code, v]) => withRating(x, idOf(r0, code), v, 7), r0);
  const block = ranksBlock(r);
  assert.equal(block.text, ['A12\tRank 2\tRating 95\tOver time: No', 'B07\tRank 4\tRating 80\tOver time: Yes', 'C33\tRank 3\tRating 88\tOver time: No', 'D41\tRank 1\tRating 97\tOver time: No'].join('\n'));
  assert.deepEqual(ranksProblems(r), []);
  assert.doesNotMatch(ranksBlock(judged('nsda-district')).text, /Rating/, 'no rating column when the profile has none');
  const html = ranksStageHtml(r);
  assert.match(html, /<th>Rating<\/th>/);
  assert.match(html, />Copy ranks</);
  // The ranks block holds no comment, private note or flag.
  assert.doesNotMatch(block.text, /structure|blue jacket|Flag/);
});

// Why: copying a broken ballot (a missing rating, a tie) would send the tab room ranks it must reject; the screen
// must name the problem and send the judge back to Rank instead of offering the copy.
test('stage 1 refuses to copy until the board is right, and names why', () => {
  const r = judged('nsda-invitational');
  assert.ok(ranksProblems(r).some((p) => /Give A12 a rating\./.test(p)));
  const html = ranksStageHtml(r);
  assert.doesNotMatch(html, /data-what="ranks"/);
  assert.match(html, /Fix these before you copy the ranks/);
  assert.match(html, /href="#\/rank\//);
});

// Why: each comment copies on its own (LANDING.md E8), because the online ballot has one box per speaker; a comment
// that carried the private note or a rule-check flag would show the student the judge's private memory.
test('stage 2: one card per speaker, each comment on its own, never the private note or a flag', () => {
  const r = judged('nsda-district');
  const list = cards(r, 'speaking');
  assert.deepEqual(list.map((c) => c.code), ['A12', 'B07', 'C33', 'D41']);
  assert.deepEqual(cards(r, 'rank').map((c) => c.code), ['D41', 'A12', 'C33', 'B07']);
  const a = list[0];
  assert.equal(a.comment, 'A12: clear structure. Next time, slow down. Ranked here because of the close.');
  assert.ok(!a.comment.includes('blue jacket') && !a.comment.includes('Flag'));
  const html = cardHtml(a, false);
  assert.match(html, />Copy comment</);
  assert.match(html, />Edit</);
  assert.match(cardHtml(Object.assign({}, a, { copied: true }), false), />✓ Copied</);
  assert.doesNotMatch(cardHtml(Object.assign({}, a, { comment: '' }), false), /Copy comment/, 'nothing to copy, no button');
  assert.match(cardHtml(a, true), /<textarea id="edit-[^"]+" class="card-edit"/);
  assert.match(commentsStageHtml(r, { order: 'speaking', editing: null }), />Copy reason</);
  assert.doesNotMatch(copyAllText(r, EXP), /blue jacket|Flag:/, 'Copy all carries no private note either');
});

// Why: the room's state tells the judge what is left; "Copied" while a speaker still has no comment, or after a
// comment changed, would let a ballot go out unfinished.
test('copy marks: ranks first, then every comment and the reason; an edit means copy again', () => {
  let r = judged('nsda-district');
  assert.equal(statusText(r), 'Ranks not sent');
  r = markCopied(r, 'ranks', 10);
  assert.equal(statusText(r), 'Ranks sent, comments open');
  assert.equal(r.state, 'review');
  for (const e of r.entries) r = markCopied(r, e.id, 11);
  assert.equal(r.state, 'review', 'the reason for rank is not copied yet');
  r = markCopied(r, 'reason', 12);
  assert.equal(r.state, 'done'); assert.equal(statusText(r), 'Copied'); assert.equal(r.copiedAt, 12);
  const edited = setComment(r, idOf(r, 'B07'), 'B07: new words.', 13);
  assert.equal(edited.state, 'review');
  assert.equal(cards(edited, 'speaking')[1].copied, false, 'the changed comment must be copied again');
  assert.match(cardHtml(cards(edited, 'speaking')[1], true), />Copy comment</, 'the card offers the copy again while the box is open');
  assert.doesNotMatch(cardHtml(cards(edited, 'speaking')[1], true), /✓ Copied/);
  assert.equal(edited.entries.find((e) => e.code === 'B07').commentSource, 'judge');
  assert.equal(setReasonReview(r, 'New reason.', 14).reasonCopiedAt, null);
  // A speaker with no comment keeps the room open.
  const base = judged('nsda-district');
  let empty = updateEntry(base, idOf(base, 'C33'), (e) => setNotes(e, ''), 15);
  empty = ['ranks', 'reason'].concat(empty.entries.map((e) => e.id)).reduce((x, w) => markCopied(x, w, 16), empty);
  assert.equal(empty.state, 'review');
  // A no-show is not on the ballot and does not hold the room open.
  let ns = rosterAction(base, 'noshow', idOf(base, 'C33'), 17);
  assert.equal(ns.refused, '');
  ns = ['ranks', 'reason'].concat(ns.room.entries.filter((e) => e.status !== 'noShow').map((e) => e.id)).reduce((x, w) => markCopied(x, w, 18), ns.room);
  assert.equal(ns.state, 'done');
  assert.ok(!ranksBlock(ns).text.includes('C33'));
});

// Why: the critique helper nudges a lay judge toward kind, useful comments (DESIGN.md §4.4); it must tick from the
// text and never block copying, or a judge could not send a comment the checks do not like.
test('the critique checklist ticks from the text, and the top checklist counts in words', () => {
  assert.deepEqual(critique('Great energy. Next time, slow down. I ranked you 2nd because of the close.').map((k) => k.ok), [true, true, true]);
  assert.deepEqual(critique('').map((k) => k.ok), [false, false, false]);
  assert.deepEqual(critique('You spoke.').map((k) => k.label), ['Names one strength', 'Names one thing to work on', 'Says why this rank']);
  const base = judged('nsda-district');
  const html = cardHtml(cards(updateEntry(base, idOf(base, 'A12'), (e) => setNotes(e, 'You spoke.'), 1), 'speaking')[0], false);
  assert.match(html, />Copy comment</, 'unticked checks never hide the copy button');
  const r = updateEntry(base, idOf(base, 'C33'), (e) => setNotes(e, ''), 1);
  assert.deepEqual(checklist(r).map((c) => [c.label, c.ok]), [['4 of 4 ranked', true], ['3 of 4 comments', false], ['Reason for rank written', true]]);
  assert.match(summaryHtml(r), />Copy all</);
  assert.match(summaryHtml(r), />Print \/ PDF</);
});

// Why: the print sheet is the paper ballot when the Wi-Fi is down (LANDING.md E8 "print sheet test"); it must hold
// every rank and comment and never the private note or a flag.
test('the print sheet has the facts, the ranks table, each comment and the reason, and nothing private', () => {
  const r = judged('nsda-district');
  const sheet = printModel(r, EXP, 300);
  assert.equal(sheet.title, 'Ballot · EXP · Round 2');
  const html = printSheetHtml(sheet);
  assert.match(html, /<dt>Event<\/dt><dd>Expository<\/dd>/);
  assert.match(html, /<dt>Tournament<\/dt><dd>Fall Classic<\/dd>/);
  assert.match(html, /<dt>Time limit<\/dt><dd>5:00<\/dd>/);
  assert.match(html, /<th>Code<\/th><th>Rank<\/th><th>Time<\/th><th>Over time<\/th>/);
  assert.match(html, /<tr><td>B07<\/td><td>4<\/td><td>5:45<\/td><td>Yes<\/td><\/tr>/);
  assert.match(html, /<h2 class="ps-entry">D41 · rank 1<\/h2><div class="ps-text">D41: clear structure/);
  assert.match(html, /<h2 class="ps-reason">Reason for rank<\/h2><div class="ps-text">D41 had the clearest structure\.<\/div>/);
  assert.doesNotMatch(html, /blue jacket|Flag:/);
  assert.match(read('app.css'), /body\.printing > :not\(#print-sheet\) \{ display: none !important; \}/, 'only the sheet prints');
});
