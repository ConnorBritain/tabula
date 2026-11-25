// Tests for events/js/rank.js: the rank board, overtime and rating rules (docs/events/LANDING.md §4.1, step E7).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stickyOver } from '../core/clock.js';
import {
  overtimeEffect, overtimeRow, noFirstMessage, startRanks, orderOf, moveTo, moveUp, moveDown, tapRank, nextRank,
  ratingScale, customRangeError, ratingValue, ratingError, ratingTies, rankRatingConflicts, ratingFix, checkBoard,
  FLAG_ONLY_NOTE, OVER_GRACE_PILL, POINTS_FALLBACK,
} from './js/rank.js';

const profile = (name) => JSON.parse(readFileSync(new URL('profiles/' + name + '.v1.json', import.meta.url), 'utf8'));
const DISTRICT = profile('nsda-district');
const INVITATIONAL = profile('nsda-invitational');
const withRules = (base, extra) => Object.assign({}, base, extra);
const FLAG_ONLY = withRules(DISTRICT, { overtime: { grace: 30, effect: 'flagOnly' } });
const IDS = ['a', 'b', 'c', 'd'];
const LABELS = { a: 'A12', b: 'B3', c: 'C7', d: 'D1' };
const ctxFor = (p, extra) => Object.assign({ ids: IDS, labels: LABELS, profile: p, overGrace: {} }, extra);
const WORDS = withRules(DISTRICT, { rating: { words: ['Superior', 'Excellent', 'Good', 'Fair'] } });

// ---------- the rank board ----------

// Why: the board starts in speaking order (DESIGN.md §4.5); a wrong start order would hide an entry or start with a tie.
test('the start ranks are the speaking order, 1 to N', () => {
  assert.deepEqual(startRanks(ctxFor(DISTRICT)), { a: '1', b: '2', c: '3', d: '4' });
});

// Why: a drag must shift the others so a tie can never happen; a swap-only or gap-leaving move breaks "1 to N, no ties".
test('a drag puts the entry at the new rank and shifts the ones between', () => {
  const ctx = ctxFor(DISTRICT);
  const res = moveTo(startRanks(ctx), 'd', 2, ctx);
  assert.deepEqual(res.ranks, { a: '1', d: '2', b: '3', c: '4' });
  assert.deepEqual(res.moved, { id: 'd', from: '4', to: '2' });
  assert.deepEqual(orderOf(res.ranks, ctx), ['a', 'd', 'b', 'c']);
});

// Why: the up and down buttons are the keyboard and access path (DESIGN.md §4.5); if they misbehave, some judges cannot rank.
test('up and down move by one place and stop at the ends', () => {
  const ctx = ctxFor(DISTRICT);
  const start = startRanks(ctx);
  assert.deepEqual(moveUp(start, 'c', ctx).ranks, { a: '1', c: '2', b: '3', d: '4' });
  assert.deepEqual(moveDown(start, 'a', ctx).ranks, { b: '1', a: '2', c: '3', d: '4' });
  assert.equal(moveUp(start, 'a', ctx).refused, 'out-of-range');
  assert.deepEqual(moveUp(start, 'a', ctx).ranks, start);
  assert.equal(moveDown(start, 'd', ctx).refused, 'out-of-range');
});

// Why: a rank outside 1 to N would make a ballot the tab room cannot enter.
test('a move to a rank outside 1 to N is refused and says the range', () => {
  const ctx = ctxFor(DISTRICT);
  const res = moveTo(startRanks(ctx), 'a', 5, ctx);
  assert.equal(res.refused, 'out-of-range');
  assert.equal(res.message, 'Ranks run 1 to 4.');
  assert.deepEqual(res.ranks, startRanks(ctx));
});

// Why: tap mode gives each tap the next number (DESIGN.md §4.5); a wrong next number or a kept tie corrupts the ranking.
test('tap in order gives the next rank, and a taken rank moves to the new entry', () => {
  const ctx = ctxFor(DISTRICT);
  let r = {};
  assert.equal(nextRank(r, ctx), '1');
  r = tapRank(r, 'c', nextRank(r, ctx), ctx).ranks;
  r = tapRank(r, 'a', nextRank(r, ctx), ctx).ranks;
  assert.deepEqual(r, { c: '1', a: '2' });
  assert.equal(nextRank(r, ctx), '3');
  const res = tapRank(r, 'b', '1', ctx);
  assert.deepEqual(res.ranks, { c: '', a: '2', b: '1' });
  assert.deepEqual(res.moved, { rank: '1', from: 'c', to: 'b' });
  assert.equal(tapRank(r, 'b', '9', ctx).message, 'Ranks run 1 to 4.');
});

// Why: "nothing moves silently" (DESIGN.md §4.5): a drag in the middle of tap mode must not hand ranks to entries the judge never placed.
test('a drag on a partly ranked board is refused and leaves it unchanged', () => {
  const ctx = ctxFor(DISTRICT);
  const res = moveTo({ c: '1', a: '2' }, 'a', 1, ctx);
  assert.equal(res.refused, 'not-full');
  assert.deepEqual(res.ranks, { c: '1', a: '2' });
  assert.equal(moveDown({ c: '1' }, 'c', ctx).refused, 'not-full');
});

// ---------- overtime ----------

// Why: the profile picks the overtime rule; reading it wrong either blocks a legal rank 1 or lets an illegal one through.
test('the overtime effect comes from the profile, with noFirst as the default', () => {
  assert.equal(overtimeEffect(DISTRICT), 'noFirst');
  assert.equal(overtimeEffect(FLAG_ONLY), 'flagOnly');
  assert.equal(overtimeEffect({}), 'noFirst');
  assert.equal(overtimeEffect({ overtime: { effect: 'none' } }), 'none');
  assert.equal(overtimeEffect({ overtime: { effect: 'dropRanks' } }), 'none');
});

// Why: LANDING E7: under noFirst (NSDA) an over-grace entry must not sit at rank 1; a judge who places one there submits an illegal ballot.
test('noFirst: an over-grace entry cannot be dragged or tapped to rank 1, and the board does not change', () => {
  const over = stickyOver(false, -41, DISTRICT.overtime.grace); // 0:41 past the limit, 30 s grace
  assert.equal(over, true);
  const ctx = ctxFor(DISTRICT, { overGrace: { c: over } });
  const start = startRanks(ctx);
  for (const res of [moveTo(start, 'c', 1, ctx), tapRank(start, 'c', '1', ctx), moveUp(moveUp(start, 'c', ctx).ranks, 'c', ctx)]) {
    assert.equal(res.refused, 'over-grace-first');
    assert.equal(res.message, "C7 went over grace, so it can't be ranked 1st. Clear the over-grace flag on the timer if the time was wrong.");
    assert.equal(res.moved, null);
  }
  assert.deepEqual(moveTo(start, 'c', 1, ctx).ranks, start);
  assert.deepEqual(moveTo(start, 'c', 2, ctx).ranks, { a: '1', c: '2', b: '3', d: '4' });
});

// Why: "nothing moves silently" (DESIGN.md §4.5): moving rank 1 down must not slide an over-grace entry up into rank 1 unseen.
test('noFirst: a move that would shift an over-grace entry up into rank 1 is refused', () => {
  const ctx = ctxFor(DISTRICT, { overGrace: { b: true } });
  const start = startRanks(ctx);
  const res = moveTo(start, 'a', 4, ctx);
  assert.equal(res.refused, 'over-grace-first');
  assert.equal(res.message, noFirstMessage('B3'));
  assert.equal(moveDown(start, 'a', ctx).refused, 'over-grace-first');
});

// Why: the first speaker can go over grace and starts at rank 1; if that froze the board, the judge could not fix it.
test('noFirst: an over-grace entry already at rank 1 can move down, other moves still work, and the review lists it', () => {
  const ctx = ctxFor(DISTRICT, { overGrace: { a: true } });
  const start = startRanks(ctx);
  assert.deepEqual(moveTo(start, 'c', 2, ctx).ranks, { a: '1', c: '2', b: '3', d: '4' });
  assert.ok(checkBoard({ ranks: start }, ctx).includes(noFirstMessage('A12')));
  const fixed = moveDown(start, 'a', ctx).ranks;
  assert.deepEqual(checkBoard({ ranks: fixed }, ctx), []);
});

// Why: LANDING E7: under flagOnly the tab room applies the penalty, so the rank must be allowed and the note must show.
test('flagOnly: an over-grace entry may take rank 1, and the row shows the pill and the tab-room note', () => {
  const ctx = ctxFor(FLAG_ONLY, { overGrace: { c: true } });
  const res = moveTo(startRanks(ctx), 'c', 1, ctx);
  assert.equal(res.refused, undefined);
  assert.equal(res.ranks.c, '1');
  assert.deepEqual(overtimeRow('c', ctx), { pill: OVER_GRACE_PILL, note: FLAG_ONLY_NOTE });
  assert.equal(FLAG_ONLY_NOTE, 'Your tab room applies the time penalty. Rank on performance.');
  assert.deepEqual(checkBoard({ ranks: res.ranks }, ctx), []);
  assert.deepEqual(overtimeRow('a', ctx), { pill: '', note: '' });
});

// Why: the app always shows the over-grace flag (EVENTS.md §5.1); with no rule, the rank is allowed but the flag must not vanish.
test('none: the rank is allowed and the row shows the pill with no note', () => {
  const ctx = ctxFor(withRules(DISTRICT, { overtime: { grace: 30, effect: 'none' } }), { overGrace: { c: true } });
  assert.equal(moveTo(startRanks(ctx), 'c', 1, ctx).ranks.c, '1');
  assert.deepEqual(overtimeRow('c', ctx), { pill: OVER_GRACE_PILL, note: '' });
  assert.deepEqual(overtimeRow('c', ctxFor(DISTRICT, { overGrace: { c: true } })), { pill: OVER_GRACE_PILL, note: "Can't be ranked 1st." });
});

// Why: if every speaker went over grace, no legal board exists under noFirst; the judge needs one clear message, not N wrong ones.
test('noFirst: when every speaker went over grace, the review says so once', () => {
  const ctx = ctxFor(DISTRICT, { overGrace: { a: true, b: true, c: true, d: true } });
  const out = checkBoard({ ranks: startRanks(ctx) }, ctx);
  assert.equal(out.length, 1);
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E29). Old line:
  //   assert.match(out[0], /Every speaker went over grace/);
  assert.match(out[0], /Everyone went over grace/);
});

// ---------- ratings ----------

// Why: the rating kind decides what the screen draws and checks; a misread profile shows the wrong input or none.
test('the rating scale comes from the profile: none, points, or words best first', () => {
  assert.deepEqual(ratingScale(DISTRICT), { kind: 'none' });
  assert.deepEqual(ratingScale(INVITATIONAL), { kind: 'points', min: 70, max: 100, step: 1, fellBack: false });
  assert.deepEqual(ratingScale(WORDS), { kind: 'words', words: ['Superior', 'Excellent', 'Good', 'Fair'] });
});

// Why: a bad range in a profile must not reach the judge as a broken input; it falls back and the review says so.
test('a points range that is not valid falls back to the default and the review says so', () => {
  const bad = withRules(INVITATIONAL, { rating: { min: 100, max: 70, step: 1 } });
  const s = ratingScale(bad);
  assert.deepEqual(s, { kind: 'points', min: POINTS_FALLBACK.min, max: POINTS_FALLBACK.max, step: 1, fellBack: true });
  const ctx = ctxFor(bad);
  assert.ok(checkBoard({ ranks: startRanks(ctx), ratings: { a: 90, b: 89, c: 88, d: 87 } }, ctx).some((m) => /points range is not valid/.test(m)));
  assert.equal(customRangeError('100', '70'), 'The lowest score must be less than the highest.');
  assert.equal(customRangeError('70', '100'), '');
});

// Why: the fallback copies the invitational range by hand; if the profile changes and the fallback does not, a broken profile shows a stale range.
test('the points fallback equals the NSDA-style invitational range', () => {
  assert.deepEqual({ ...POINTS_FALLBACK }, INVITATIONAL.rating);
});

// Why: a points value outside the range or off the step is a rating the tab room rejects; the judge must see it inline.
test('points: a value outside the range or off the step has an inline error', () => {
  const s = ratingScale(INVITATIONAL);
  assert.equal(ratingError('95', s), '');
  assert.equal(ratingError('', s), '');
  assert.equal(ratingError('69', s), 'Use a number from 70 to 100.');
  assert.equal(ratingError('abc', s), 'Type a number from 70 to 100.');
  assert.equal(ratingError('95.5', s), 'Use steps of 1 from 70.');
  assert.equal(ratingError('95.1', s), 'Use steps of 1 from 70.'); // what core stepPoints (0.1 steps) gives from 95
  assert.equal(ratingValue('95', s), 95);
});

// Why: word scales differ by state (Utah puts Superior on top, Missouri Excellent); using our own order would invert ratings.
test("word scale: the tournament's order decides which word is better", () => {
  const s = ratingScale(WORDS);
  assert.ok(ratingValue('Superior', s) > ratingValue('Excellent', s));
  const missouri = ratingScale(withRules(DISTRICT, { rating: { words: ['Excellent', 'Superior', 'Good'] } }));
  assert.ok(ratingValue('Excellent', missouri) > ratingValue('Superior', missouri));
  assert.equal(ratingError('Great', s), 'Pick one of: Superior, Excellent, Good, Fair.');
});

// Why: with ratingNoTies on, two equal ratings break the invitational's rule; the review must name both speakers.
test('no-ties: equal ratings are listed only when the profile asks for it', () => {
  const ranks = { a: '1', b: '2', c: '3', d: '4' };
  const ratings = { a: 95, b: 95, c: 90, d: 88 };
  assert.deepEqual(ratingTies(ratings, ctxFor(INVITATIONAL)), []);
  const strict = ctxFor(withRules(INVITATIONAL, { ratingNoTies: true }));
  assert.deepEqual(ratingTies(ratings, strict), [{ rating: '95', ids: ['a', 'b'] }]);
  assert.ok(checkBoard({ ranks, ratings }, strict).includes('A12, B3 have the same rating (95). Each speaker needs a different rating.'));
  assert.deepEqual(checkBoard({ ranks, ratings }, ctxFor(INVITATIONAL)), []);
});

// Why: ratingNoTies applies to any rating (ARCHITECTURE.md §6.2); on a word scale two equal words must be named, or the rule is skipped.
test('no-ties on a word scale lists entries that share a word', () => {
  const strict = ctxFor(withRules(WORDS, { ratingNoTies: true }));
  assert.deepEqual(ratingTies({ a: 'Superior', b: 'Good', c: 'Good', d: 'Fair' }, strict), [{ rating: 'Good', ids: ['b', 'c'] }]);
  assert.deepEqual(ratingTies({ a: 'Superior', b: 'Excellent', c: 'Good', d: 'Fair' }, strict), []);
});

// Why: with the rank-rating rule on, a better rank with fewer points is a ballot the tab room sends back; the row and review must say which.
test('rank-rating rule: a worse rank with a higher rating is reported on the worse row and in the review', () => {
  const ranks = { a: '1', b: '2', c: '3', d: '4' };
  const ratings = { a: 90, b: 94, c: 88, d: 88 };
  assert.deepEqual(rankRatingConflicts(ranks, ratings, ctxFor(INVITATIONAL)), []);
  const ruled = ctxFor(withRules(INVITATIONAL, { rankRatingRule: true }));
  assert.deepEqual(rankRatingConflicts(ranks, ratings, ruled), [{ id: 'b', above: 'a' }]);
  assert.ok(checkBoard({ ranks, ratings }, ruled).includes('B3 ranks below A12 but has a higher rating. A better rank needs an equal or higher rating.'));
  // Equal ratings are allowed when no-ties is off.
  assert.deepEqual(rankRatingConflicts(ranks, { a: 90, b: 90, c: 88, d: 88 }, ruled), []);
});

// Why: the word scale must obey the rank-rating rule in the tournament's order, or a "Superior" can sit under an "Excellent".
test('rank-rating rule on a word scale uses the word order', () => {
  const ruled = ctxFor(withRules(WORDS, { rankRatingRule: true }));
  const ranks = { a: '1', b: '2', c: '3', d: '4' };
  assert.deepEqual(rankRatingConflicts(ranks, { a: 'Excellent', b: 'Superior', c: 'Good', d: 'Fair' }, ruled), [{ id: 'b', above: 'a' }]);
  assert.deepEqual(rankRatingConflicts(ranks, { a: 'Superior', b: 'Excellent', c: 'Good', d: 'Good' }, ruled), []);
});

// Why: the row's "Fix" button (DESIGN.md §4.6) must give a rating that clears the conflict without making a new tie.
test('the Fix value is the highest rating that does not beat a better-ranked entry', () => {
  const ranks = { a: '1', b: '2', c: '3', d: '4' };
  const ratings = { a: 90, b: 94, c: 88, d: 87 };
  const ruled = ctxFor(withRules(INVITATIONAL, { rankRatingRule: true }));
  assert.equal(ratingFix('b', ranks, ratings, ruled), 90);
  const strict = ctxFor(withRules(INVITATIONAL, { rankRatingRule: true, ratingNoTies: true }));
  assert.equal(ratingFix('b', ranks, ratings, strict), 89);
  assert.deepEqual(rankRatingConflicts(ranks, Object.assign({}, ratings, { b: 89 }), strict), []);
  assert.equal(ratingFix('b', ranks, { a: 70, b: 94 }, strict), null);
  const words = ctxFor(withRules(WORDS, { rankRatingRule: true }));
  assert.equal(ratingFix('b', ranks, { a: 'Excellent', b: 'Superior' }, words), 'Excellent');
  const wordsStrict = ctxFor(withRules(WORDS, { rankRatingRule: true, ratingNoTies: true }));
  assert.equal(ratingFix('b', ranks, { a: 'Excellent', b: 'Superior' }, wordsStrict), 'Good');
  assert.equal(ratingFix('b', ranks, { a: 'Fair', b: 'Superior' }, wordsStrict), null);
});

// ---------- the review list ----------

// Why: the review step must list every gap in plain words, or a judge copies a ballot with a missing rank or rating.
test('the review lists missing ranks, missing ratings and bad ratings, and is empty for a good board', () => {
  const ctx = ctxFor(INVITATIONAL);
  const out = checkBoard({ ranks: { a: '1', b: '2', c: '3' }, ratings: { a: 95, b: 120, c: 90 } }, ctx);
  assert.deepEqual(out, [
    'Give D1 a rank.',
    'B3: Use a number from 70 to 100.',
    'Give D1 a rating.',
  ]);
  assert.deepEqual(checkBoard({ ranks: startRanks(ctx), ratings: { a: 95, b: 94, c: 90, d: 90 } }, ctx), []);
});

// Why: saved data can hold a tie or a rank past N (an old copy, a hand edit); the review must catch what the board API prevents.
test('the review catches ties and ranks outside 1 to N in saved data', () => {
  const ctx = ctxFor(DISTRICT);
  const out = checkBoard({ ranks: { a: '1', b: '1', c: '3', d: '7' } }, ctx);
  assert.ok(out.includes('D1 has rank 7, but ranks run 1 to 4.'));
  assert.ok(out.includes('More than one speaker has rank 1. Each rank 1 to 4 is used once.'));
});

// Why: classic scripts on the events page call the rank rules through this global; without it the rank screen has no rules and lets any board through.
test('the functions are also on globalThis.TabulaEvents.rank', () => {
  assert.equal(globalThis.TabulaEvents.rank.checkBoard, checkBoard);
  assert.ok(Object.isFrozen(globalThis.TabulaEvents.rank));
});
