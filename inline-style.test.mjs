// Ratchet for inline style="" attributes (spec V12, §6.1). Run with: node --test
// Inline styles skip the tokens and the theme, and every one is a place the look can drift. The counts below are
// what is left after Slice 3 (the spec's older counts were 93 in index.html and 46 in app.js). The test fails if a
// count goes up. When a change removes some, lower the stored number to the new count in the same change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const MAX = { 'index.html': 6, 'app.js': 10 };
// CHANGED 2026-11-20 because the owner approved the module split: the page code is now js/*.js plus app.js, and the
// logic is logic/*.js plus logic.js. readSource('app.js') / readSource('logic.js') read every file of the group, so the
// checks below cover the same code as before. Old line:
//   const count = (f) => (readFileSync(new URL(f, import.meta.url), 'utf8').match(/style="/g) || []).length;
// MAX['app.js'] now counts all page code (js/*.js and app.js together), so the ratchet number is unchanged.
const { readSource } = createRequire(import.meta.url)('./test-sources.js');
const count = (f) => (readSource(f).match(/style="/g) || []).length;

// Why: each new inline style is a hard-coded look that ignores the tokens and the dark theme; the count may only go down.
test('inline style="" counts never go up', () => {
  for (const [f, max] of Object.entries(MAX)) assert.ok(count(f) <= max, `${f} has ${count(f)} inline styles; the most allowed is ${max}`);
});

// Why: a ratchet whose stored number is far above the real count stops catching new inline styles; keep it tight.
test('the stored counts are the real counts (lower them when styles go)', () => {
  for (const [f, max] of Object.entries(MAX)) assert.equal(count(f), max, `${f} now has ${count(f)}; set MAX['${f}'] to ${count(f)}`);
});
