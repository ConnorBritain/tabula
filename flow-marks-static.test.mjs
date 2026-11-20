// Static checks for the Option B flow mark layer (owner's Q-8 choice, part of Slice 4). Run with: node --test
// These read the source files as text. Alignment, themes and speed are checked in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// CHANGED 2026-11-20 because the owner approved the module split: the page code is now js/*.js plus app.js, and the
// logic is logic/*.js plus logic.js. readSource('app.js') / readSource('logic.js') read every file of the group, so the
// checks below cover the same code as before. Old line:
//   const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const { readSource: read } = createRequire(import.meta.url)('./test-sources.js');
const HTML = read('index.html');
const STYLE = /<style>([\s\S]*?)<\/style>/.exec(HTML)[1];
const APP = read('app.js');

// Why: if the mirror is not hidden from screen readers, every flow column is read out twice.
test('both flow views put an aria-hidden mirror right before each textarea', () => {
  const m = APP.match(/<div class="flow-hl" aria-hidden="true"><\/div><textarea data-(ai)?col=/g) || [];
  assert.equal(m.length, 2, 'My flow and AI flow both have the layer');
});

// Why: any difference in font, line height or padding between mirror and textarea slides the shades off their words.
test('the mirror uses the same font, line height and padding as the flow textarea', () => {
  const ta = /\.flow textarea \{([^}]*)\}/.exec(STYLE)[1];
  const hl = /\.flow-hl \{([^}]*)\}/.exec(STYLE)[1];
  for (const prop of ['font', 'padding']) {
    const v = new RegExp(prop + ':\\s*([^;]+);').exec(ta)[1];
    assert.ok(hl.includes(prop + ': ' + v), `.flow-hl ${prop} matches .flow textarea (${v})`);
  }
  assert.match(hl, /white-space: pre-wrap/);
  assert.match(hl, /pointer-events: none/);
  assert.match(hl, /color: transparent/, 'the mirror text is see-through; only the textarea text shows');
});

// Why: in Windows high contrast the shades would be forced to system colours and could hide text, so the flow falls back to plain.
test('forced-colours mode hides the mark layer', () => {
  const fc = /@media \(forced-colors: active\) \{([\s\S]*?)\n  \}/.exec(STYLE)[1];
  assert.match(fc, /\.flow-hl \{ display: none; \}/);
});

// Why: a raw colour in a mark shade skips the dark theme and the print reset; the shades must come from tokens.css.
test('mark shades use tokens only', () => {
  const rules = STYLE.match(/\.flow-hl[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 5);
  for (const r of rules) assert.equal(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(r), false, r);
});
