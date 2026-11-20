// Run with: node --test
// Layout rules for the Slice 4 ballot that a unit test cannot see (spec 4.1, 4.2). The browser checks measure them;
// these lines keep a later CSS edit from bringing the bugs back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const rule = (sel) => {
  const i = html.indexOf('  ' + sel + ' {');
  assert.ok(i > 0, sel + ' rule exists');
  return html.slice(i, html.indexOf('}', i));
};

// Why: the global "td input { min-width: 80px }" made each rank radio cell 96 px, so the table ran past the card and under the draft panel.
test('rank radios opt out of the 80 px number-input minimum', () => {
  assert.match(html, /td input \{ min-width: 80px;/, 'the global rule this guards against');
  assert.match(rule('.rank-cell input'), /min-width: 0;/);
});

// Why: a long speaker name that cannot wrap pushes the rank and Yours columns under the docked panel, where they cannot be clicked.
test('speaker names wrap; only the speaker code stays on one line', () => {
  assert.doesNotMatch(rule('.pts-table .sp-cell'), /nowrap/);
  assert.match(rule('.pts-table .sp-cell'), /overflow-wrap: anywhere;/);
  assert.match(rule('.pts-table .sp-cell strong'), /white-space: nowrap;/);
});

// Why: speech control says the words it sees; a button whose visible words are not in its name cannot be clicked by voice (WCAG 2.5.3).
test('the copy button takes its name from the visible words', () => {
  const btn = html.match(/<button[^>]*id="copy-btn"[^>]*>.*?<\/button>/)[0];
  assert.doesNotMatch(btn, /aria-label=|aria-hidden=/);
});
