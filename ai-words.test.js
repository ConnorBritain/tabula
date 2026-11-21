// Plain AI words (owner note of 2026-11-20: "people won't know what a "Call" is, nor that it's AI driven").
// Spec: docs/design/SPEC.md §4.5. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { readSource } = require('./test-sources.js');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const APP = readSource('app.js');
const LOGIC = readSource('logic.js');
// Visible text only: drop whole-line and trailing code comments, keep strings.
const noComments = (t) => t.split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');

// Why: a judge does not know what an "AI call" is, so a hint that counts calls neither warns about cost nor says AI is used.
test('no user-facing copy talks about "AI calls"', () => {
  assert.doesNotMatch(HTML, /AI call/i);
  assert.doesNotMatch(noComments(APP).replace(/console\.warn\([^)]*\)/g, ''), /AI call/i);
  assert.doesNotMatch(noComments(LOGIC), /'[^']*AI call[^']*'/i);
  for (const kind of Object.keys(L.AI_ERROR_TEXT)) assert.doesNotMatch(L.aiErrorText(kind), /\bcalls?\b/i, kind);
});

// Why: a judge who cannot tell that a control uses AI turns it on blind and may spend the round's AI budget unaware.
test('every AI control and hint says it uses AI, in plain words', () => {
  assert.match(HTML, /id="auto-eval"> Update after each speech <span class="muted">\(uses AI\)<\/span>/);
  assert.match(HTML, /id="eval-cost">Uses AI</);
  assert.match(HTML, /id="live-flow"> Live AI flow during speeches <span class="muted">\(uses AI while a speech runs\)<\/span>/);
  assert.match(HTML, /id="dp-cost">Uses AI</);
  assert.match(HTML, /id="auto-ballot"> Refill after each speech <span class="muted">\(uses AI\)<\/span>/);
  assert.match(APP, /id="rv-cost">Redo uses AI\.</);
  assert.match(APP, />Update with AI<\/button>/);
});
