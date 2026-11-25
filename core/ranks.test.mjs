// Tests for shared ranks, core/ranks.js. Run with: node --test
// Debate's rank message keeps its test in logic-slice4.test.js; it runs through this file now.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveRank, rankState } from './ranks.js';

const ids = (n) => Array.from({ length: n }, (_, i) => 'c' + (i + 1));

// Why: a ranking of 8 has no ties; if a rank given twice were kept, the ballot would be sent back.
test('8 ids: a taken rank moves to the new id, and the ranking is complete only with 1 to 8 once each', () => {
  const list = ids(8);
  let ranks = {};
  list.forEach((id, i) => { ranks = moveRank(ranks, id, i + 1, list).ranks; });
  assert.equal(rankState(ranks, list).complete, true);
  const m = moveRank(ranks, 'c8', 1, list);
  assert.deepEqual(m.moved, { rank: '1', from: 'c1', to: 'c8' });
  assert.equal(m.ranks.c1, '');
  const st = rankState(m.ranks, list);
  assert.deepEqual([st.complete, st.missing, st.given], [false, [8], 7]);
});

// Why: a Congress scorer ranks only the top 8 of a chamber of 30; a rank 9 or a demand to rank all 30 would block a
// correct ballot.
test('top 8 of 30: ranks above 8 are refused, and 8 ranks with 22 blank is complete', () => {
  const list = ids(30);
  let ranks = {};
  for (let i = 0; i < 8; i++) ranks = moveRank(ranks, list[i * 3], i + 1, list, { cap: 8 }).ranks;
  const st = rankState(ranks, list, { cap: 8 });
  assert.deepEqual([st.complete, st.given, st.missing], [true, 8, []]);
  const refused = moveRank(ranks, 'c2', 9, list, { cap: 8 });
  assert.equal(refused.refused, 'out-of-range');
  assert.deepEqual(refused.ranks, ranks, 'nothing changes');
  assert.equal(moveRank(ranks, 'c2', '1.5', list, { cap: 8 }).refused, 'out-of-range');
  assert.deepEqual(rankState(Object.assign({}, ranks, { c2: '12' }), list, { cap: 8 }).outOfRange, ['c2']);
});

// Why: a parliamentarian ranks the whole chamber; a full ranking must count every rank 1 to 30 and name what is still
// missing or doubled.
test('full ranking of 30: complete only when all 30 ranks are given once, ties and gaps named', () => {
  const list = ids(30);
  const full = Object.fromEntries(list.map((id, i) => [id, String(30 - i)]));
  assert.equal(rankState(full, list).complete, true);
  const tied = Object.assign({}, full, { c1: '29' });
  const st = rankState(tied, list);
  assert.deepEqual([st.complete, st.ties, st.missing], [false, [29], [30]]);
  assert.equal(moveRank(full, 'c5', 31, list, { cap: 30 }).refused, 'out-of-range');
  assert.equal(moveRank(full, 'c5', '', list).ranks.c5, '', 'clearing a rank moves nothing');
  assert.equal(moveRank(full, 'c5', 31, list).ranks.c5, '31', 'with no cap, moveRank checks no range (the debate ballot passes none)');
  assert.equal(moveRank({}, 'c1', 8, ids(5), { cap: 8 }).refused, 'out-of-range', 'a cap above the number of ids counts as the number of ids');
});
