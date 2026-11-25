// Tests for the shared AI review, core/review.js. Run with: node --test
// Debate's ballot-draft review keeps its tests in logic-slice4.test.js; it runs through this file now.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as Rv from './review.js';

const require = createRequire(import.meta.url);

// A speech judge's comment sheet: one "comment" group per performer code, each one long-text field.
const codes = ['101', '102', '103'];
const groups = codes.map((c) => ({ id: 'c' + c, label: 'Comments for ' + c, fields: ['comments.' + c] }));
const isText = () => true;
const draft = { '101': 'Strong open.', '102': 'Slow down in the middle.', '103': '' };
const draftValue = (f) => draft[f.split('.')[1]] || undefined;

// Why: a speech judge reviews AI clean-up one performer at a time; if the review were tied to debate's ballot groups,
// Speech Events could not offer it at all, or would mix two performers' comments.
test('one comment group per item: one card each, the judge\'s own text kept, empty drafts not ticked', () => {
  const record = Rv.markFields({ comments: { '102': 'Good pacing overall' } }, ['comments.102'], 'yours');
  const cards = groups.map((g) => Rv.reviewCard(record, g, { draftValue, isText }));
  assert.deepEqual(cards.map((c) => [c.id, c.state, c.choice, c.empty]), [['c101', 'empty', 'insert', false], ['c102', 'yours', 'keep', false], ['c103', 'empty', 'keep', true]]);
  assert.ok(cards[1].diff.some((d) => d.op === 'ins'), 'the judge sees what the AI would change in their own text');
  const out = Rv.applyReview(record, { cards }, false);
  assert.deepEqual(out.record.comments, { '101': 'Strong open.', '102': 'Good pacing overall' });
  assert.deepEqual([out.fields, out.count], [['comments.101'], 1]);
  assert.equal(out.record.touched['comments.101'], true, 'inserted text becomes the judge\'s');
});

// Why: a judge may keep typing while the review waits; the AI must never overwrite text written after the draft.
test('a comment changed while the review waits goes back to Keep mine and is never overwritten', () => {
  const record = {};
  const review = { cards: groups.map((g) => Rv.reviewCard(record, g, { draftValue, isText })) };
  const typed = Rv.markFields({ comments: { '101': 'My own words' } }, ['comments.101'], 'yours');
  const stale = Rv.staleCards(review, typed, isText);
  assert.deepEqual([stale.cards[0].changed, stale.cards[0].choice], [true, 'keep']);
  const forced = Rv.applyReview(typed, review, true);
  assert.equal(forced.record.comments['101'], 'My own words', 'even Accept all skips a field changed since the card');
  assert.deepEqual(Rv.insertFields(review, true), ['comments.101', 'comments.102']);
  const refused = Rv.applyReview({}, review, true, () => ['comments.102']);
  assert.deepEqual([refused.fields, refused.count], [['comments.101'], 1], 'a field the app refuses is never written or counted');
});

// Why: debate's tests check the review through PolicyLogic; a second copy there would let them pass on code the shared
// review does not run.
test('PolicyLogic uses the shared review functions', () => {
  const L = require('../logic.js');
  for (const k of ['fieldValue', 'fieldState', 'markFields', 'wordDiff']) assert.equal(L[k], Rv[k], k);
  assert.equal(L.ballotSnapshot, Rv.snapshot);
  assert.equal(L.reviewInsertFields, Rv.insertFields);
  const res = L.applyReview({}, { cards: [] }, true);
  assert.deepEqual([Object.keys(res).sort(), res.ballot.pts, res.ballot.ranks], [['ballot', 'count', 'fields'], {}, {}], 'debate keeps its { ballot } shape with pts and ranks');
});
