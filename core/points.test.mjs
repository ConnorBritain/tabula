// Tests for shared points, core/points.js. Run with: node --test
// Debate's points rules keep their tests in logic.test.js and logic-slice4.test.js; they run through this file now.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as P from './points.js';

const require = createRequire(import.meta.url);

// Why: each app has its own usual range (debate 25–30, a speech rating scale such as 70–100); if a bad saved range
// fell back to the wrong app's default, the judge would see points outside their tournament's scale.
test('pointsRange keeps a good range and falls back to the app\'s own default', () => {
  const speech = { min: 70, max: 100 };
  assert.deepEqual(P.pointsRange({ min: 80, max: 100 }, speech), { min: 80, max: 100 });
  assert.deepEqual(P.pointsRange({ min: 100, max: 90 }, speech), speech);
  assert.deepEqual(P.pointsRange(null, speech), speech);
  assert.deepEqual(P.pointsRange({ min: 0, max: 101 }, speech), speech, 'above 100 is out of bounds');
  const got = P.pointsRange(undefined, speech);
  got.min = 1;
  assert.equal(speech.min, 70, 'the fallback is copied, so a caller cannot change the default');
});

// Why: the judge types the range; an error that does not name what is wrong leaves them unable to fix it.
test('rangeError names a bad number or a reversed range, and is empty when fine', () => {
  assert.equal(P.rangeError('', 30), 'Use a number from 0 to 100.');
  assert.equal(P.rangeError(25.5, 30), 'Use a number from 0 to 100.');
  assert.equal(P.rangeError(30, 25), 'The lowest score must be less than the highest.');
  assert.equal(P.rangeError(70, 100), '');
});

// Why: the − and + buttons must stay inside any range an app uses and never leave float noise in a score.
test('stepPoints works on any range: steps of 0.1, clamped, and an empty box starts 60% up', () => {
  const r = { min: 70, max: 100 };
  assert.equal(P.stepPoints('', 1, r), 88);
  assert.equal(P.stepPoints('99.95', 1, r), 100);
  assert.equal(P.stepPoints('70', -1, r), 70);
  assert.equal(P.stepPoints('85.2', 1, r), 85.3);
});

// Why: debate's tests check these through PolicyLogic; a second copy there would let them pass on code the shared
// module does not run.
test('PolicyLogic uses the shared points code with its 25–30 default', () => {
  const L = require('../logic.js');
  assert.equal(L.rangeError, P.rangeError);
  assert.deepEqual(L.ptsRange(null), { min: 25, max: 30 });
  assert.equal(L.stepPoints('', 1), P.stepPoints('', 1, { min: 25, max: 30 }));
});
