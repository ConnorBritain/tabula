// Tests for the Slice 3 logic (visual system and Flow look). Spec: docs/design/SPEC.md §3.3 and §4.4. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// Why: with no AI the Insights pane can only say "connect AI"; if hideRight won, the judge would get an "Insights" button that opens an empty pane (Q8).
test('insightsMode: no AI folds to the Connect AI edge, even when the judge hid the pane', () => {
  assert.equal(L.insightsMode({ aiReady: false, hideRight: false }), 'edge-connect');
  assert.equal(L.insightsMode({ aiReady: false, hideRight: true }), 'edge-connect');
});

// Why: a judge with AI who hid Insights must get it back with one click; a judge who did not hide it must see it open.
test('insightsMode: with AI, the hide choice picks the edge or the open pane', () => {
  assert.equal(L.insightsMode({ aiReady: true, hideRight: true }), 'edge-show');
  assert.equal(L.insightsMode({ aiReady: true, hideRight: false }), 'open');
  assert.equal(L.insightsMode(), 'edge-connect', 'no input is the safe no-AI case');
});

// Why: Q3 says System is the default and follows the device; a wrong rule leaves a judge in a white app at night, or ignores the choice they made.
test('resolveTheme: the six setting and device cases', () => {
  assert.equal(L.resolveTheme('system', false), 'light');
  assert.equal(L.resolveTheme('system', true), 'dark');
  assert.equal(L.resolveTheme('light', false), 'light');
  assert.equal(L.resolveTheme('light', true), 'light');
  assert.equal(L.resolveTheme('dark', false), 'dark');
  assert.equal(L.resolveTheme('dark', true), 'dark');
});

// Why: an old or broken saved value must act like System, not draw an unknown theme with no colours.
test('resolveTheme: unknown or missing settings act like System', () => {
  assert.equal(L.resolveTheme(undefined, true), 'dark');
  assert.equal(L.resolveTheme('sepia', false), 'light');
});

// Why: sheet tabs are passed over all the time while flowing; a 0.5 s tip there would cover the grid again and again (spec 4.4).
test('tipDelay: 1000 ms on sheet tabs, 500 ms for every other tip', () => {
  assert.equal(L.tipDelay('sheet'), 1000);
  assert.equal(L.tipDelay('label'), 500);
  assert.equal(L.tipDelay('help'), 500);
  assert.equal(L.tipDelay(), 500);
});

// Why: a tip that hides under the round bar or runs off the screen cannot be read (spec 4.4 position rule).
test('tipPlace: below the target, flipped above near the round bar, 8 px inside the viewport', () => {
  const view = { w: 1000, h: 800, bottomInset: 70 };
  const below = L.tipPlace({ top: 100, left: 400, width: 100, height: 30 }, { w: 200, h: 40 }, view);
  assert.deepEqual(below, { top: 136, left: 350, side: 'below' });
  const nearBar = L.tipPlace({ top: 680, left: 400, width: 100, height: 30 }, { w: 200, h: 40 }, view);
  assert.equal(nearBar.side, 'above');
  assert.equal(nearBar.top, 680 - 6 - 40);
  const leftEdge = L.tipPlace({ top: 100, left: 0, width: 20, height: 20 }, { w: 200, h: 40 }, view);
  assert.equal(leftEdge.left, 8);
  const rightEdge = L.tipPlace({ top: 100, left: 990, width: 10, height: 20 }, { w: 200, h: 40 }, view);
  assert.equal(rightEdge.left, 1000 - 200 - 8);
});

// Why: "Now" must sit only on the column the clock is timing, and "Viewing" on the one the judge looks back at (V7, spec 1.2); a wrong mark makes a judge flow into the wrong speech.
test('flowMarks: Now on the running column, Viewing on a different viewed column', () => {
  assert.deepEqual(L.flowMarks('2AC', '2AC'), { current: 2, now: 2, viewing: null });
  assert.deepEqual(L.flowMarks('2AC', '1NC'), { current: 2, now: 2, viewing: 1 });
  assert.deepEqual(L.flowMarks('1NR', '2NC'), { current: 3, now: 3, viewing: null }, 'the block shares one column');
});

// Why: with no clock running there is nothing "Now"; the column on screen still gets the bar so the judge knows where to type.
test('flowMarks: no clock and CX speeches', () => {
  assert.deepEqual(L.flowMarks(null, '1AR'), { current: 4, now: null, viewing: null });
  assert.deepEqual(L.flowMarks('CX-1A', 'CX-1A'), { current: null, now: null, viewing: null }, 'CX has no column');
  assert.deepEqual(L.flowMarks('CX-1A', '1AC'), { current: null, now: null, viewing: 0 });
});

// Why: a tip that only repeats the name makes a screen reader say it twice; a tip with new words must be read (spec 4.4).
test('tipAddsWords: only a tip with words beyond the name counts', () => {
  assert.equal(L.tipAddsWords('Settings: AI, keys, audio and theme', 'Settings: AI, keys, audio and theme'), false);
  assert.equal(L.tipAddsWords('Show the transcript', 'show the transcript.'), false, 'case and end punctuation do not count');
  assert.equal(L.tipAddsWords('Speeches', 'Show speeches ([ or ⌘\\)'), true);
  assert.equal(L.tipAddsWords('Edited', 'You set this. The AI ballot filler will not change it.'), true);
  assert.equal(L.tipAddsWords('Anything', ''), false);
  assert.equal(L.tipAddsWords(null, 'Help'), true);
});

// Why: on Android a long press gives no click; if the "eat the next click" flag stayed on, the next tap on Start would do nothing mid-round.
test('pressStep: only the click that ends a long press is eaten, and a new touch always starts clean', () => {
  let s = L.pressStep(null, 'down');
  s = L.pressStep(s, 'fire'); s = L.pressStep(s, 'up');
  assert.equal(L.pressStep(s, 'click').eatNow, true, 'the click after a long press is eaten');
  assert.equal(L.pressStep(L.pressStep(s, 'click'), 'click').eatNow, false, 'only one click is eaten');
  // Long press, then no click (contextmenu), then a real tap.
  s = L.pressStep(L.pressStep(L.pressStep(null, 'down'), 'fire'), 'cancel');
  s = L.pressStep(L.pressStep(s, 'down'), 'up');
  assert.equal(L.pressStep(s, 'click').eatNow, false, 'the next tap goes through');
  // Even with no cancel, a new pointerdown clears the flag.
  s = L.pressStep(L.pressStep(L.pressStep(null, 'down'), 'fire'), 'up');
  s = L.pressStep(L.pressStep(s, 'down'), 'up');
  assert.equal(L.pressStep(s, 'click').eatNow, false);
  // A short tap or a moved finger never eats.
  assert.equal(L.pressStep(L.pressStep(L.pressStep(null, 'down'), 'up'), 'click').eatNow, false);
  assert.equal(L.pressStep(L.pressStep(L.pressStep(L.pressStep(null, 'down'), 'move'), 'fire'), 'click').eatNow, false);
});

// Why: when Esc closes a pane, focus goes back to its button; a tip popping up there covers the column the judge just uncovered.
test('tipOnFocus: keyboard focus shows a tip at once, except right after Esc', () => {
  assert.equal(L.tipOnFocus(true, Infinity), true);
  assert.equal(L.tipOnFocus(true, 10), false);
  assert.equal(L.tipOnFocus(true, L.ESC_FOCUS_QUIET_MS), true);
  assert.equal(L.tipOnFocus(false, Infinity), false, 'mouse focus never shows a tip');
});
