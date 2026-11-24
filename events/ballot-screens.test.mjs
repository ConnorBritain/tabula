// Tests for the 2026-11-24 design build, "Ballot screens" lane (docs/design/EVENTS-DESIGN-REVIEW.md §2.8–§2.10, §3
// top 10 #5, #6, #7; §5 bugs 5, 6, 8): number-button rows for short scales, the compact rubric with a live total, the
// rules as places on the Rank board, the comment line on each row, the Review ballot preview, comments-only Review,
// and the critique check. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom, updateEntry } from './js/room.js';
import { openBoard, withRating, withRanks } from './js/board.js';
import { withRubric, layerOf } from './js/profile-layer.js';
import { firstSentence, setNotes } from './js/comments.js';
import { critique, cards, statusText } from './js/ballot.js';
import { buttonValues, ratingHtml, rubricHtml, rubricTotalText, scoreClick, scoreKey, SHORT_SCALE_MAX } from './js/score-view.js';
import { ratingScale, graceLineText } from './js/rank.js';
import { cutLineText } from './js/profile-layer.js';
import { boardHtml } from './js/rank-screen.js';
import { boardCtx } from './js/board.js';
import { ranksStageHtml, commentsStageHtml, cardHtml, summaryHtml } from './js/review-screen.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
let n = 0;
const makeId = (p) => p + (++n);
const prof = (id, extra) => Object.assign(JSON.parse(JSON.stringify(DATA.profiles.get(id))), extra || {});
const mk = (eventId, profile, k) => createRoom({ event: DATA.events.get(eventId), profile: typeof profile === 'string' ? prof(profile) : profile, entries: Array.from({ length: k }, (_, i) => ({ code: 'A' + (i + 1) })), round: 'Round 1', now: 1000, makeId });
const ranked = (room) => openBoard(room, 2000).room;
const over = (room, i) => updateEntry(room, room.entries[i].id, (e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { usedMs: 460000, overGrace: true }) }), 3000);
// A stand-in for a DOM element: dataset, and closest() that finds itself for the number-button selector.
const btn = (dataset) => ({ dataset, closest: (sel) => (sel.includes('pick') && dataset.ract === 'pick' || sel.includes('pick') && dataset.rub === 'pick' || sel === '[data-rub]' && dataset.rub || sel === '[data-ract]' && dataset.ract ? btn(dataset) : null) });
const key = (k, dataset, mods) => Object.assign({ key: k, target: btn(dataset) }, mods || {});

// ---------- top 10 #5, bug 5: short scales are a row of buttons ----------

// Why: DESIGN.md §4.6 says a short scale is a row of buttons and only a wide range is a stepper; if the cut-off moves,
// a 70 to 100 ballot would show 31 buttons, or a 1 to 5 rating would go back to four taps.
test('buttonValues lists a short scale and refuses a wide one', () => {
  assert.deepEqual(buttonValues({ min: 1, max: 5, step: 1 }), [1, 2, 3, 4, 5]);
  assert.equal(buttonValues({ min: 1, max: 10, step: 1 }).length, SHORT_SCALE_MAX, '1 to 10 is still short');
  assert.equal(buttonValues({ min: 70, max: 100, step: 1 }), null, '70 to 100 keeps the stepper');
  assert.deepEqual(buttonValues({ min: 1, max: 3, step: 0.5 }), [1, 1.5, 2, 2.5, 3]);
  assert.equal(buttonValues({ min: 5, max: 5 }), null);
});

// Why: a judge must set a 1 to 10 rating in one tap and a screen reader must hear one radio group with the choice
// checked; a row with no Tab stop (or ten of them) would trap or slow keyboard judges.
test('a short point rating draws one radio group with one Tab stop; a wide range keeps the stepper', () => {
  const r = withRating(mk('hi', 'rate-only', 2), 'x', '', 1);
  const e = r.entries[0];
  const scale = ratingScale(r.profile);
  const html = ratingHtml(e, '7', scale, '');
  assert.match(html, /role="radiogroup" aria-label="Rating for A1, 1 to 10"/);
  assert.equal((html.match(/role="radio"/g) || []).length, 10);
  assert.equal((html.match(/tabindex="0"/g) || []).length, 1, 'one Tab stop');
  assert.match(html, /class="pick on" type="button" role="radio" aria-checked="true" tabindex="0"[^>]*data-value="7" data-key="pick-/);
  assert.match(ratingHtml(e, '', scale, ''), /aria-checked="false" tabindex="0"[^>]*data-value="1" data-key=/, 'no choice yet: the first button holds the Tab stop');
  const wide = ratingHtml(mk('hi', 'nsda-invitational', 1).entries[0], '88', ratingScale(prof('nsda-invitational')), '');
  assert.match(wide, /class="rate-num"/);
  assert.doesNotMatch(wide, /role="radio"/);
});

// Why: a tap is the whole action now; if a second tap did not clear, a judge who tapped the wrong speaker's row could
// not take the rating back, and if focus were lost after the redraw a keyboard judge would start over at the top.
test('scoreClick on a number button picks it, a second tap clears it, and the focus stays on the row', () => {
  const r = mk('hi', 'rate-only', 2);
  const id = r.entries[1].id;
  let res = scoreClick(btn({ ract: 'pick', id, value: '4' }), r, 2);
  assert.equal(res.room.entries[1].rating, '4');
  assert.equal(res.focusKey, 'pick-' + id);
  res = scoreClick(btn({ ract: 'pick', id, value: '4' }), res.room, 3);
  assert.equal(res.room.entries[1].rating, null, 'the same number again clears it');
  const rub = mk('dec', 'rubric-five', 1);
  const rid = rub.entries[0].id;
  res = scoreClick(btn({ rub: 'pick', id: rid, crit: 'delivery', value: '5' }), rub, 2);
  assert.equal(res.room.entries[0].rubric.delivery, 5);
  assert.equal(res.focusKey, 'rpick-' + rid + '-delivery');
  assert.equal(scoreClick(btn({ rub: 'pick', id: rid, crit: 'delivery', value: '5' }), res.room, 3).room.entries[0].rubric.delivery, undefined, 'a second tap clears the score');
});

// Why: the review asked to keep the number keys and arrow keys working as they did with the box (§2.9 risk note);
// a keyboard judge who typed "8" before must still get 8, and Alt+arrows must still reach the Rank board's row moves.
test('scoreKey: arrows step, Home and End jump, a digit picks, 0 is 10, and Alt keys pass through', () => {
  const r = mk('hi', 'rate-only', 1);
  const id = r.entries[0].id;
  const on = (v) => ({ ract: 'pick', id, value: String(v) });
  assert.equal(scoreKey(key('ArrowRight', on(4)), r, 1).room.entries[0].rating, '5');
  assert.equal(scoreKey(key('ArrowUp', on(10)), r, 1).room.entries[0].rating, '10', 'never past the top');
  assert.equal(scoreKey(key('ArrowLeft', on(1)), r, 1).room.entries[0].rating, '1', 'never under the bottom');
  assert.equal(scoreKey(key('ArrowDown', on(6)), r, 1).room.entries[0].rating, '5');
  assert.equal(scoreKey(key('End', on(1)), r, 1).room.entries[0].rating, '10');
  assert.equal(scoreKey(key('Home', on(7)), r, 1).room.entries[0].rating, '1');
  assert.equal(scoreKey(key('8', on(1)), r, 1).room.entries[0].rating, '8');
  const ten = scoreKey(key('0', on(1)), r, 1);
  assert.equal(ten.room.entries[0].rating, '10');
  assert.equal(ten.focusKey, 'pick-' + id);
  assert.equal(scoreKey(key('ArrowUp', on(3), { altKey: true }), r, 1), null, 'Alt+Up is the Rank row move');
  assert.equal(scoreKey(key('a', on(3)), r, 1), null, 'other keys pass through');
  assert.equal(scoreKey(key('ArrowUp', { ract: 'up', id }), r, 1), null, 'not on a number button');
  const rub = mk('dec', 'rubric-five', 1);
  const rid = rub.entries[0].id;
  const off = scoreKey(key('7', { rub: 'pick', id: rid, crit: 'content', value: '3' }), rub, 2);
  assert.equal(off.room, rub, 'a digit off the 1 to 5 scale is used up and changes nothing');
  assert.equal(scoreKey(key('4', { rub: 'pick', id: rid, crit: 'content', value: '3' }), rub, 2).room.entries[0].rubric.content, 4);
});

// Why: "Total – of 25" until the last part was set left judges unsure whether the total was live and whether Overall
// counted (§2.9); the line must count up as they score and say every part is added.
test('the rubric is one compact row per criterion with a live total that says how many parts are added', () => {
  let r = mk('dec', 'rubric-five', 1);
  const rub = layerOf(r.profile).rubric;
  const id = r.entries[0].id;
  assert.equal(rubricTotalText(r.entries[0], rub), 'Total – of 25 so far, 0 of 5 parts added');
  for (const [c, v] of [['content', 4], ['organization', 4], ['delivery', 4], ['language', 4]]) r = withRubric(r, id, c, v, 1);
  assert.equal(rubricTotalText(r.entries[0], rub), 'Total 16 of 25 so far, 4 of 5 parts added');
  r = withRubric(r, id, 'overall', 5, 1);
  assert.equal(rubricTotalText(r.entries[0], rub), 'Total 21 of 25, all 5 parts added');
  const html = rubricHtml(r.entries[0], rub);
  assert.equal((html.match(/class="rub-row"/g) || []).length, 5);
  assert.equal((html.match(/role="radiogroup" aria-labelledby="rub-/g) || []).length, 5, 'each row is named by its criterion label');
  // A wide criterion (0 to 20) keeps the stepper.
  const wide = [{ id: 'arg', label: 'Argument', min: 0, max: 20 }];
  assert.match(rubricHtml(r.entries[0], wide), /data-rub="plus"/);
  assert.doesNotMatch(rubricHtml(r.entries[0], wide), /role="radio"/);
});

// ---------- top 10 #6: rules as places on the Rank board ----------

// Why: under "top 3" the judge must see where the cut falls before they order the rest (§2.8); a pill on every lower
// row hid the line, and a screen reader must still hear which rows are not ranked.
test('top N: one labelled cut line under rank N, no per-row pill, and the rows below say "Not in top N" to a screen reader', () => {
  const r = ranked(mk('oo', 'top-three', 5));
  const html = boardHtml(r, { tapMode: false, limit: 600, now: 3000 });
  assert.equal((html.match(/class="board-line cut-line"/g) || []).length, 1);
  const rows = html.split('<li ').slice(1);
  assert.match(rows[2], /cut-line">Top 3 get a rank\. The rest are not ranked on the ballot\.</, 'the line sits in the rank 3 row');
  assert.doesNotMatch(html, /class="pill outline">Not in top/, 'the per-row pill is gone');
  assert.match(rows[3], /class="board-row below-cut"[^>]*aria-label="A4, Not in top 3, place 4"/);
  assert.equal(cutLineText(prof('top-three'), 3), '', 'no line when everyone is in the top N');
  assert.equal(cutLineText(prof('nsda-district'), 6), '', 'no line on a rank-all board');
});

// Why: the noFirst rule used to show only after a refused move (§2.8); the judge must see "Rank 1 needs a speaker
// inside grace" while a speaker is over grace, and never see it when the rule does not apply.
test('the grace line shows under rank 1 only while a speaker is over grace under the noFirst rule', () => {
  const plain = ranked(mk('oo', 'nsda-district', 3));
  assert.equal(graceLineText(boardCtx(plain)), '');
  const r = over(plain, 2);
  assert.equal(graceLineText(boardCtx(r)), 'Rank 1 needs a speaker inside grace.');
  const rows = boardHtml(r, { tapMode: false, limit: 600, now: 3000 }).split('<li ').slice(1);
  assert.match(rows[0], /class="board-line grace-line">Rank 1 needs a speaker inside grace\.</);
  assert.doesNotMatch(rows.slice(1).join(''), /grace-line/);
  const flag = over(ranked(mk('oo', prof('nsda-district', { overtime: { grace: 30, effect: 'flagOnly' } }), 3)), 2);
  assert.equal(graceLineText(boardCtx(flag)), '', 'flagOnly: the tab room applies the penalty, the judge may rank 1st');
});

// Why: judges forgot who was who at rank time and went back to the room (§2.8); each row must remind them with the
// piece and the first sentence they wrote, and the cut must come from one helper so the screens never disagree.
test('each Rank row shows the piece and the first sentence of the comment, as a button that opens the whole comment', () => {
  let r = ranked(mk('hi', 'nsda-district', 2));
  r = updateEntry(r, r.entries[0].id, (e) => Object.assign(setNotes(e, 'Strong characters. Next time slow the ending.'), { title: 'The Lottery', author: 'Shirley Jackson' }), 3);
  const rows = boardHtml(r, { tapMode: false, limit: 600, now: 3000 }).split('<li ').slice(1);
  assert.match(rows[0], /class="board-piece">“The Lottery” by Shirley Jackson</);
  assert.match(rows[0], /class="board-comment" type="button" data-ract="note"[^>]*><span class="sr-only">Read the comment for A1: <\/span>Strong characters\.<\/button>/);
  assert.doesNotMatch(rows[1], /board-comment|board-piece/, 'no empty lines for a row with no words');
});

// Why: the first-sentence cut feeds the Rank rows (and the room roster later); a cut inside "Dr. Lee" or a whole
// paragraph on one row would make the reminder wrong or push the board off a phone screen.
test('firstSentence stops at the first sentence end, skips common short forms, and cuts long text on a word', () => {
  assert.equal(firstSentence('Strong open. Next time slow.'), 'Strong open.');
  assert.equal(firstSentence('Your Dr. Lee was vivid. More.'), 'Your Dr. Lee was vivid.');
  assert.equal(firstSentence('Rated 3.5 for pace! ok'), 'Rated 3.5 for pace!');
  assert.equal(firstSentence('line one\nline two'), 'line one');
  assert.equal(firstSentence('   '), '');
  const long = firstSentence('word '.repeat(40));
  assert.ok(long.length <= 91 && long.endsWith('…') && !long.includes('word…w'), long);
});

// ---------- top 10 #7, bugs 6 and 8: Review ----------

// Why: the ranks block is what the tab room waits on (§2.10); "Over time: No" printed like "Yes" hid the one fact the
// tab room checks, and the copy button belongs with the block it copies.
test('Review stage 1 is a ballot preview: Over grace pill only when true, copy button and state in the card header', () => {
  let r = ranked(mk('oo', 'nsda-district', 3));
  r = over(r, 1);
  const html = ranksStageHtml(r);
  const head = html.slice(html.indexOf('preview-head'), html.indexOf('</div>'));
  assert.match(head, /data-what="ranks"/);
  assert.match(head, /id="ranks-state">Not sent</);
  assert.equal((html.match(/class="pill err">Over grace</g) || []).length, 1);
  assert.equal((html.match(/<span class="sr-only">No<\/span>/g) || []).length, 2);
  const sent = ranksStageHtml(Object.assign({}, r, { ranksCopiedAt: 9 }));
  assert.match(sent, /id="ranks-state">✓ Copied</);
  assert.match(sent, />Copy ranks again</);
  // Copy all and Print / PDF sit in one toolbar group with the checklist.
  assert.match(summaryHtml(r), /<ul class="checklist">[\s\S]*<div class="review-tools" role="group"[^>]*>[\s\S]*Copy all[\s\S]*Print \/ PDF/);
});

// Why: on a comments-only ballot the Ranks section, the order toggle and the rank check all asked for something that
// does not exist (bug 6); a judge would think the ballot was unfinished or go looking for ranks.
test('comments only: no Ranks stage, no Rank order toggle, no "Says why this rank" check', () => {
  let r = mk('poi', 'comments-only', 2);
  r = updateEntry(r, r.entries[0].id, (e) => setNotes(e, 'Clear voice. Next time slow the ending.'), 2);
  assert.equal(ranksStageHtml(r), '');
  const html = commentsStageHtml(r, { order: 'rank', editing: null });
  assert.doesNotMatch(html, /Rank order|order-toggle/);
  assert.doesNotMatch(html, /Says why this rank/);
  assert.match(html, /<h2 id="stage2" tabindex="-1">Comments<\/h2>/, 'no "2." when there is no stage 1');
  assert.doesNotMatch(html, /Reason for rank/, 'no reason for rank on a comments-only ballot');
  assert.deepEqual(cards(r, 'rank').map((c) => c.code), ['A1', 'A2'], 'speaking order');
  assert.doesNotMatch(cardHtml(cards(r, 'speaking')[0], false), /Says why this rank/);
  // A Rate ballot (ranks off) has no ranks either: no toggle and no rank check, but it keeps its reason card.
  const rate = mk('hi', 'rate-only', 2);
  const rateHtml = commentsStageHtml(rate, { order: 'speaking', editing: null });
  assert.doesNotMatch(rateHtml, /Rank order|Says why this rank/);
  assert.match(rateHtml, /<span>Reason for rank<\/span>/);
  // A ranked ballot keeps all three.
  const rk = ranked(mk('oo', 'nsda-district', 2));
  assert.match(commentsStageHtml(rk, { order: 'speaking', editing: null }), /Rank order[\s\S]*Says why this rank[\s\S]*Reason for rank/);
});

// Why: "Make the cutting tell a clearer, complete story." is advice to work on, and leaving the check open told the
// judge their useful comment was missing something (bug 8); praise alone must still leave it open.
test('the critique check counts a "Make the … clearer" sentence as a thing to work on, and praise alone does not', () => {
  const toWork = (t) => critique(t).find((k) => k.id === 'toWork').ok;
  assert.equal(toWork('Make the cutting tell a clearer, complete story.'), true);
  assert.equal(toWork('Focus on the ending.'), true);
  assert.equal(toWork('The ending needs to land.'), true);
  assert.equal(toWork('Great energy and clear characters.'), false);
  assert.equal(toWork('Strong, confident delivery.'), false);
  assert.equal(toWork('You make the room laugh.'), false, '"make" inside praise is not an order');
  assert.equal(toWork('Good pace. Make each character distinct.'), true, 'an order after another sentence');
  assert.deepEqual(critique('x', { ranked: false }).map((k) => k.id), ['strength', 'toWork']);
  assert.deepEqual(critique('I ranked you 2nd because of the close.', { ranked: false }).map((k) => k.ok), [false, false], 'a rank reason ticks nothing on a ballot with no ranks');
});

// Why: the phone Review shots (2026-11-24) showed "Ranks not sent" on a Rate round and a bare "–" for places past the
// top N; a judge reads the first as a missing step that does not exist, and the second as a rank they forgot to give.
test('Review words match the ballot: a Rate round says ratings, and top-N rows past N say "Not in top N"', () => {
  const rate = mk('hi', 'rate-only', 2);
  assert.equal(statusText(rate), 'Ratings not sent');
  assert.equal(statusText(Object.assign({}, rate, { ranksCopiedAt: 5 })), 'Ratings sent, comments open');
  assert.equal(statusText(ranked(mk('oo', 'nsda-district', 2))), 'Ranks not sent', 'a ranked round keeps its words');
  const html = ranksStageHtml(ranked(mk('oo', 'top-three', 5)));
  assert.equal((html.match(/class="muted preview-out">Not in top 3</g) || []).length, 2);
  assert.doesNotMatch(html, /class="preview-rank">–</);
});
