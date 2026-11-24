// Tests for step E7, the screen part (docs/events/LANDING.md §4.1): the room-to-rules glue (events/js/board.js) and
// the Rank screen builders (events/js/rank-screen.js). The rank, overtime and rating rules themselves are tested in
// rank.test.mjs. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom, rosterAction } from './js/room.js';
import { boardCtx, ranksOf, withRanks, withRating, openBoard, fillRest, restoreRanks, stepRating } from './js/board.js';
import { dropPlace } from './js/rank-drag.js';
import { stepPoints } from '../core/points.js';
import { boardHtml, problemsHtml } from './js/rank-screen.js';
import { ratingHtml } from './js/score-view.js'; // step S4 moved it here: the Rate screen draws it too
import { moveTo, tapRank, ratingScale, FLAG_ONLY_NOTE } from './js/rank.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const profile = (id, extra) => Object.assign(JSON.parse(JSON.stringify(DATA.profiles.get(id))), extra || {});
const mk = (prof) => createRoom({ event: DATA.events.get('exp'), profile: prof, entries: ['A12', 'B07', 'C33', 'D41'].map((code) => ({ code })), now: 1 });
// Mark an entry over grace (the sticky flag the timer stores, step E5).
const over = (room, code) => Object.assign({}, room, { entries: room.entries.map((e) => (e.code === code ? Object.assign({}, e, { timing: Object.assign({}, e.timing, { usedMs: 345000, overLimit: true, overGrace: true }) }) : e)) });
const order = (room) => Object.entries(ranksOf(room)).sort((a, b) => a[1] - b[1]).map(([id]) => room.entries.find((e) => e.id === id).code).join(',');
const view = { tapMode: false, limit: 300, now: 0 };

// Why: under the NSDA rule an over-grace speaker may not be ranked 1st (LANDING.md E7); if the board on screen
// let a drag or a tap put one there, the ballot would break the tournament's rule.
test('noFirst: an over-grace entry cannot be dragged or tapped to rank 1, and the row says why', () => {
  let r = openBoard(over(mk(profile('nsda-district')), 'C33'), 2).room;
  const c = r.entries[2].id;
  const res = moveTo(ranksOf(r), c, 1, boardCtx(r));
  assert.equal(res.refused, 'over-grace-first');
  assert.match(res.message, /C33 went over grace, so it can't be ranked 1st/);
  assert.equal(tapRank({}, c, '1', boardCtx(r)).refused, 'over-grace-first');
  const html = boardHtml(r, view);
  assert.match(html, /<span class="pill err">Over grace<\/span>/);
  assert.match(html, /Can't be ranked 1st\./);
  r = withRanks(r, moveTo(ranksOf(r), c, 2, boardCtx(r)).ranks, 4);
  assert.equal(order(r), 'A12,C33,B07,D41', 'rank 2 is fine');
});

// Why: under flagOnly the tab room applies the penalty, so the judge must see the note and still rank freely; a
// refused move here would force the wrong ranks onto the ballot.
test('flagOnly: the note shows and an over-grace entry may be ranked 1st', () => {
  const r = openBoard(over(mk(profile('nsda-district', { overtime: { grace: 30, effect: 'flagOnly' } })), 'C33'), 2).room;
  const html = boardHtml(r, view);
  assert.ok(html.includes(FLAG_ONLY_NOTE));
  assert.match(html, /Over grace/);
  const res = moveTo(ranksOf(r), r.entries[2].id, 1, boardCtx(r));
  assert.equal(res.refused, undefined);
  assert.equal(order(withRanks(r, res.ranks, 3)), 'C33,A12,B07,D41');
});

// Why: a board that starts in speaking order and keeps the judge's ranks when they come back is what lets a judge
// leave and return; resetting it would lose minutes of work, and a no-show keeping a rank would put a gap or a tie
// on the ballot.
test('the board opens in speaking order once, keeps ranks after, and drops a no-show from the board', () => {
  const first = openBoard(mk(profile('nsda-district')), 2);
  assert.ok(first.started);
  assert.equal(first.room.state, 'ranking');
  assert.equal(order(first.room), 'A12,B07,C33,D41');
  const moved = withRanks(first.room, moveTo(ranksOf(first.room), first.room.entries[3].id, 1, boardCtx(first.room)).ranks, 3);
  const again = openBoard(moved, 4);
  assert.equal(again.started, false);
  assert.equal(order(again.room), 'D41,A12,B07,C33', 'the judge\'s ranks stay');
  // A late no-show (no time on the clock) leaves the board and its rank goes.
  const ns = rosterAction(moved, 'noshow', moved.entries[1].id, 5).room;
  const opened = openBoard(ns, 6).room;
  assert.equal(opened.entries[1].rank, '');
  assert.deepEqual(boardCtx(opened).ids.length, 3);
  assert.match(problemsHtml(opened), /C33 has rank 4, but ranks run 1 to 3\./, 'the gap is named for the judge to close');
  assert.doesNotMatch(problemsHtml(opened), /Ready/);
});

// Why: "Tap in order" left early must leave a full board in speaking order for the rest; a half-ranked board would
// block every later move (rank.js refuses moves on a board that is not full).
test('leaving tap mode early gives the rest the free ranks in speaking order', () => {
  const r = mk(profile('nsda-district'));
  const ctx = boardCtx(r);
  const [a, b, c, d] = ctx.ids;
  assert.deepEqual(fillRest({ [c]: '1', [a]: '2' }, ctx), { [c]: '1', [a]: '2', [b]: '3', [d]: '4' });
  assert.deepEqual(fillRest({}, ctx), { [a]: '1', [b]: '2', [c]: '3', [d]: '4' });
  const tie = { [a]: '1', [b]: '1' };
  assert.deepEqual(fillRest(tie, ctx), tie, 'a tie is left for checkBoard to name');
});

// Why: the rating stepper must move in the profile's own step and stay in range (DESIGN.md §4.6); a 0.1 step on a
// whole-number scale would write ratings the tournament site refuses.
test('ratings: the stepper keeps to the scale; words toggle; a rating is saved on the entry', () => {
  const scale = ratingScale(profile('nsda-invitational'));
  assert.equal(stepRating('', 1, scale), 88, 'an empty box starts 60% up 70–100');
  assert.equal(stepRating('', 1, scale), stepPoints('', 1, scale), 'the same start as core/points.js stepPoints');
  assert.equal(stepRating('88', 1, scale), 89);
  assert.equal(stepRating('100', 1, scale), 100);
  assert.equal(stepRating('70', -1, scale), 70);
  assert.equal(stepRating('88.4', 1, scale), 88, 'an off-scale number snaps back onto the scale first');
  const half = { kind: 'points', min: 1, max: 5, step: 0.5 };
  assert.equal(stepRating('2.5', 1, half), 3);
  const r2 = mk(profile('nsda-invitational'));
  assert.equal(withRating(r2, r2.entries[0].id, '91', 2).entries[0].rating, '91');
  assert.equal(withRating(r2, r2.entries[0].id, '', 2).entries[0].rating, null);
  const words = { kind: 'words', words: ['Superior', 'Excellent', 'Good'] };
  const html = ratingHtml(r2.entries[0], 'Excellent', words, '');
  assert.match(html, /aria-pressed="true">Excellent</);
  assert.equal((html.match(/data-ract="word"/g) || []).length, 3);
  assert.equal(ratingHtml(r2.entries[0], '', { kind: 'none' }, ''), '', 'no rating column when the profile has none');
  assert.match(ratingHtml(r2.entries[0], '100', scale, ''), /aria-label="Raise the rating for A12" disabled/);
});

// Why: with the rank-rating rule on, the row must say what is wrong and offer the Fix value (DESIGN.md §4.6); a judge
// who never saw the conflict would submit a ballot the tab room rejects.
test('rank-rating conflicts show on the row with a Fix button; the checklist names every gap', () => {
  const prof = profile('nsda-invitational', { rankRatingRule: true });
  let r = openBoard(mk(prof), 2).room;
  const [a, b] = r.entries.map((e) => e.id);
  r = withRating(withRating(r, a, '85', 3), b, '90', 3);
  const html = boardHtml(r, view);
  assert.match(html, /Rating is higher than a better-ranked speaker/);
  assert.match(html, /data-ract="fix" data-id="[^"]+" data-value="85">Fix: 85</);
  const problems = problemsHtml(r);
  assert.match(problems, /Before you review/);
  assert.match(problems, /Give C33 a rating\./);
  assert.match(problems, /B07 ranks below A12 but has a higher rating/);
  const done = ['85', '84', '83', '82'].reduce((x, v, i) => withRating(x, x.entries[i].id, v, 4), r);
  assert.match(problemsHtml(done), /Ready<\/span> Every speaker has a rank and a rating\./);
  assert.match(boardHtml(r, Object.assign({}, view, { tapMode: true })), /Rank 1 · tap to clear/);
});

// Why: a reload in the middle of "Tap in order" must not leave a half-ranked board that refuses every move; and Undo
// of "Start again" must bring back only the ranks, or it would throw away ratings the judge typed after.
test('a half-tapped board is filled on open, and Undo brings back only the ranks', () => {
  const r = openBoard(mk(profile('nsda-invitational')), 2).room;
  const [a, b, c, d] = r.entries.map((e) => e.id);
  const half = withRanks(r, { [c]: '1', [a]: '2' }, 3);
  const opened = openBoard(half, 4);
  assert.equal(opened.started, false);
  assert.equal(order(opened.room), 'C33,A12,B07,D41');
  const before = withRanks(r, moveTo(ranksOf(r), d, 1, boardCtx(r)).ranks, 5);
  const restarted = withRating(openBoard(withRanks(before, {}, 6), 6).room, b, '93', 7);
  const undone = restoreRanks(restarted, before, 8);
  assert.equal(order(undone), 'D41,A12,B07,C33');
  assert.equal(undone.entries[1].rating, '93', 'the rating typed after Start again stays');
});

// Why: the drop place decides where a dragged speaker lands; an off-by-one would move them one place past where the
// judge let go.
test('drag: the drop place counts the other rows and goes before the first middle below the pointer', () => {
  const mids = [100, 160, 220]; // the three other rows
  assert.equal(dropPlace(90, mids), 1);
  assert.equal(dropPlace(150, mids), 2);
  assert.equal(dropPlace(219, mids), 3);
  assert.equal(dropPlace(400, mids), 4, 'below every row: last');
});
