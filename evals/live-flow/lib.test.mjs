// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFlow, quality, inCrossSample, meanCI, paretoFrontier, judgeAgreement } from './lib.mjs';

const sheet = { sheet: 'Case', brief: 'b', standard: 's', detailed: 'd' };

// Why: a reply the app cannot apply leaves the judge's AI flow blank; a model must score 0 for it, however good the text.
test('the gate accepts only replies the app can apply', () => {
  assert.equal(validateFlow({ sheets: [sheet] }).ok, true);
  assert.equal(validateFlow({ sheets: [] }).ok, false);
  assert.equal(validateFlow({ sheets: [{ ...sheet, standard: 3 }] }).ok, false);
  assert.equal(validateFlow({ sheets: [{ ...sheet, sheet: ' ' }] }).ok, false);
  assert.equal(validateFlow({ sheets: [sheet], note: 'x' }).ok, false);
  assert.equal(validateFlow(null).ok, false);
});

// Why: an invented card misleads a judge more than a missing one, so faithfulness must weigh double, and a failed gate must zero the score.
test('quality weighs faithfulness double and is 0 when the gate fails', () => {
  assert.equal(quality({ coverage: 3, faithful: 3, placement: 3, judge_ready: 3 }, true), 100);
  assert.equal(quality({ coverage: 3, faithful: 0, placement: 3, judge_ready: 3 }, true), 60);
  assert.equal(quality({ coverage: 0, faithful: 3, placement: 3, judge_ready: 3 }, true), 80);
  assert.equal(quality({ coverage: 3, faithful: 3, placement: 3, judge_ready: 3 }, false), 0);
  assert.equal(quality({ coverage: 9, faithful: 3, placement: 3, judge_ready: 3 }, true), 100, 'out-of-range scores are clamped');
});

// Why: the second judge must re-grade the same outputs on every run, or a resumed run checks a different sample than it reports.
test('the cross-judge sample is repeatable and close to 1 in 5', () => {
  const keys = Array.from({ length: 2000 }, (_, i) => 'case' + i);
  const picked = keys.filter((k) => inCrossSample(k));
  assert.deepEqual(picked, keys.filter((k) => inCrossSample(k)));
  assert.ok(picked.length > 340 && picked.length < 460, String(picked.length));
});

// Why: the frontier decides which models the app may use; a dominated model on it would cost judges money for nothing.
test('the Pareto frontier keeps only models nothing beats on both cost and quality', () => {
  const pts = [
    { id: 'cheap-bad', cost: 0.01, quality: 50 },
    { id: 'cheap-good', cost: 0.02, quality: 80 },
    { id: 'pricey-same', cost: 0.5, quality: 80 },
    { id: 'pricey-best', cost: 1.0, quality: 92 },
    { id: 'broken', cost: NaN, quality: 99 },
  ];
  assert.deepEqual(paretoFrontier(pts), ['cheap-bad', 'cheap-good', 'pricey-best']);
});

// Why: the report states each model's quality with an interval; a wrong interval makes a tie look like a win.
test('mean and interval', () => {
  const r = meanCI([60, 80, 100]);
  assert.equal(r.mean, 80);
  assert.ok(Math.abs(r.hi - r.lo - 2 * 1.96 * 20 / Math.sqrt(3)) < 1e-9);
  assert.equal(meanCI([]).n, 0);
});

// Why: if the two judges disagree often, the main judge's scores cannot be trusted to pick a model.
test('judge agreement counts items within 1 point and the quality gap', () => {
  const a = { coverage: 3, faithful: 3, placement: 2, judge_ready: 2 };
  const b = { coverage: 1, faithful: 3, placement: 2, judge_ready: 3 };
  const r = judgeAgreement([{ a, b }]);
  assert.equal(r.within1, 0.75);
  assert.ok(Math.abs(r.qualityGap - (quality(a, true) - quality(b, true))) < 1e-9);
});
