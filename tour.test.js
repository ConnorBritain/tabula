// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./tour.js');

const PLACES = ['setup', 'flow', 'eval', 'analysis', 'ballot', 'draft', 'log', 'ai'];

// Why: a tour step that points at a missing place or has no text leaves a new judge stuck on a blank card.
test('every tour step names a real place, a target and short, filled-in text', () => {
  for (const [name, tour] of Object.entries(T.TOURS)) {
    assert.ok(tour.title && tour.steps.length >= 2, name + ' has a title and at least 2 steps');
    for (const st of tour.steps) {
      assert.ok(st.place === null || PLACES.includes(st.place), name + ': unknown place ' + st.place);
      assert.ok(typeof st.target === 'string' && st.target.length > 1, name + ': step needs a target');
      assert.ok(st.title && st.body, name + ': step needs a title and a body');
      assert.ok(st.body.split(/\s+/).length <= 45, name + ': "' + st.title + '" is too long for a tour card');
    }
  }
});

// Why: the main tour is the first thing new judges see; it must cover the whole round, from setup to the ballot.
test('main tour walks from setup to the ballot and ends on the help button', () => {
  const places = T.TOURS.main.steps.map((s) => s.place);
  assert.equal(places[0], 'setup');
  assert.ok(places.includes('flow') && places.includes('ballot'));
  assert.equal(T.TOURS.main.steps.at(-1).target, '#help-btn');
});

// Why: "Tour this page" must have a tour for every place in the top bar and Settings.
test('every place has its own short tour', () => {
  for (const place of ['setup', 'flow', 'decide', 'log', 'ai']) assert.ok(T.TOURS[T.PLACE_TOUR[place]], place);
});

// Why: a tour card off screen or on top of the part it explains is useless.
test('tour card goes below, above or beside the target, and always stays on screen', () => {
  const view = { w: 1000, h: 800 }, card = { w: 320, h: 160 };
  assert.deepEqual(T.placeCard({ top: 100, left: 50, width: 200, height: 40 }, card, view), { top: 152, left: 50, side: 'below' });
  assert.equal(T.placeCard({ top: 700, left: 50, width: 200, height: 60 }, card, view).side, 'above');
  assert.equal(T.placeCard({ top: 0, left: 10, width: 300, height: 790 }, card, view).side, 'right');
  const big = T.placeCard({ top: 0, left: 0, width: 1000, height: 800 }, card, view);
  assert.equal(big.side, 'over');
  const edge = T.placeCard({ top: 100, left: 900, width: 80, height: 40 }, card, view);
  assert.ok(edge.left + card.w <= view.w - 12, 'clamped inside the right edge');
});

// Why: a first-run tour longer than 8 steps gets skipped; shorter than 6 misses the round's main moments.
test('main tour has 6 to 8 steps', () => {
  const n = T.TOURS.main.steps.length;
  assert.ok(n >= 6 && n <= 8, 'main tour has ' + n + ' steps');
});
