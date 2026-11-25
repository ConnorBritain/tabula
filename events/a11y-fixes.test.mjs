// Tests for the fixes from the accessibility and keyboard pass (docs/events/A11Y.md). Node has no layout engine, so
// the layout fixes are checked in the CSS text; the browser proof is the a11y runner at 360 and 390 px.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foldSummaryHtml, foldValueHtml } from './js/fold.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const CSS = read('./app.css').replace(/\/\*[\s\S]*?\*\//g, ''); // comments out, so a rule's selector is clean
const HTML = read('./index.html');

// The body of each @media (max-width: 560px) block, in order.
function phoneBlocks(css) {
  const out = [];
  const re = /@media \(max-width: 560px\) \{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex;
    for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out;
}
// The declarations of every rule for one selector (exact match) in a CSS text.
const rulesFor = (css, sel) => [...css.matchAll(/(^|[\s}])([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[2].trim().split(/\s*,\s*/).includes(sel)).map((m) => m[3]);

// Why: offline, the chip made the header about 120 px wider than a phone, so every screen scrolled sideways while a
// judge timed a speaker. On a phone the nav must wrap and the chip must go to its own line, never widen the header.
test('layout: on a phone the offline chip wraps under the links instead of widening the header', () => {
  const blocks = phoneBlocks(CSS);
  const last = blocks[blocks.length - 1];
  assert.ok(last, 'a phone block exists');
  const nav = rulesFor(last, '.bar-nav').join(';');
  assert.match(nav, /flex-wrap:\s*wrap/);
  assert.match(nav, /min-width:\s*0/);
  const chip = rulesFor(last, '#offline-chip').join(';');
  assert.match(chip, /order:\s*1/, 'the chip goes after the links');
  assert.match(chip, /max-width:\s*100%/);
  assert.match(rulesFor(last, '.bar-nav a.b').join(';'), /white-space:\s*nowrap/, 'the links stay one line each');
  assert.match(rulesFor(last, '.bar').join(';'), /flex-wrap:\s*nowrap/, 'the brand and nav stay one row');
  // The chip is still in the nav, and its words are still there for everyone.
  assert.match(HTML, /<nav class="bar-nav"[^>]*>\s*<span class="pill outline" id="offline-chip" hidden>[\s\S]*?Offline\. Saved on this device\.<\/span>/);
});

// Why: on the Type page at phone width a long rule-set summary squeezed the title to 0 px, so the title's words drew
// over the summary and a judge could not read which rules they were opening.
test('layout: a fold row keeps room for its label; a long value wraps inside its share', () => {
  const label = rulesFor(CSS, '.fold-label').join(';');
  assert.match(label, /min-width:\s*6rem/);
  assert.doesNotMatch(rulesFor(CSS, '.fold-label').pop(), /min-width:\s*0/, 'the last .fold-label rule keeps the floor');
  const value = rulesFor(CSS, '.fold-value').pop();
  assert.match(value, /max-width:\s*60%/);
  assert.match(value, /min-width:\s*0/);
  assert.match(value, /overflow-wrap:\s*anywhere/);
  // The row is label, then value, then the chevron, so the value sits between the label and the chevron.
  const row = foldSummaryHtml('Rate only (no ranks)', foldValueHtml('No ranks. You give each speaker points from 1 to 10.'));
  assert.match(row, /^<summary class="fold-row"><span class="fold-label">Rate only \(no ranks\)<\/span><span class="fold-value muted">No ranks\.[^<]*<\/span><svg/);
});

// Why: a form may not take role="dialog"; some screen readers then announce a form, not a dialog, when the confirm
// sheet opens, and the judge does not know the rest of the page is behind it.
test('a11y: the confirm sheet is a dialog div with the form inside it', () => {
  const src = read('./js/picker-screen.js');
  assert.doesNotMatch(src, /<form[^>]*role="dialog"/);
  assert.match(src, /<div class="overlay-card cf-card" id="cf-card" role="dialog" aria-modal="true" aria-labelledby="cf-title"><form id="cf-form" novalidate>/);
});

// Why: a toast with Undo outside every landmark is skipped by a screen-reader user moving by landmark, so they never
// find the Undo after a delete.
test('a11y: the toasts live in a labeled region', () => {
  assert.match(HTML, /<div class="toasts" id="toasts" role="region" aria-label="Messages"><\/div>/);
});
