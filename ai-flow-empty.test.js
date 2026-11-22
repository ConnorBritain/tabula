// The AI flow before its first update (owner, 2026-11-22: "if there is nothing there, it actually doesn't show the
// flow sheet"). The AI names its own sheets, so none exists yet; the view now shows the format's columns, empty,
// with a note above. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { fnSource } = require('./test-fn-source.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

// Why: a blank screen under "AI flow" made judges think the flow was broken; it must still look like a flow.
test('emptyFlowHtml: one empty column per speech, in order, with the side colour', () => {
  for (const id of L.FORMAT_IDS) {
    const cols = L.getFormat(id).flowColumns;
    const html = L.emptyFlowHtml(cols);
    assert.equal((html.match(/<div class="col (aff|neg)">/g) || []).length, cols.length, id);
    let at = -1;
    for (const c of cols) {
      const i = html.indexOf('<span>' + c.label + '</span>');
      assert.ok(i > at, id + ': ' + c.label + ' in order');
      at = i;
      assert.match(html.slice(html.lastIndexOf('<div class="col', i), i), new RegExp('class="col ' + (c.side === 'neg' ? 'neg' : 'aff') + '"'));
    }
    assert.doesNotMatch(html, /<textarea/, id + ': no editable cell, since no sheet exists to keep the text');
  }
});

// Why: a column label goes into HTML; markup in it must show as text, never run.
test('emptyFlowHtml escapes the label', () => {
  assert.match(L.emptyFlowHtml([{ label: '<b>1AC</b>', side: 'aff' }]), /&lt;b&gt;1AC&lt;\/b&gt;/);
  assert.equal(L.emptyFlowHtml(null), '');
});

// Why: a paid judge needs no key; the old note told every judge to connect AI in Settings, a dead end for them.
// The status line above (noAiHtml) already shows those words only to judges who must set up AI.
test('the empty note says how the AI flow fills in, and never asks to connect AI or open Settings', () => {
  assert.match(L.AI_FLOW_EMPTY, /Transcribe/);
  assert.match(L.AI_FLOW_EMPTY, /Map docs to flow now/);
  assert.doesNotMatch(L.AI_FLOW_EMPTY, /connect|settings|key/i);
});

// Why: the note must leave once a sheet exists, and the grid must use the empty columns, or the fix does not show.
test('renderAIFlow shows the note only with no sheet, and draws the empty columns then', () => {
  const src = fnSource(read('js/flow.js'), 'renderAIFlow');
  assert.match(src, /sheets\.length \? '' : `<p class="muted ai-flow-empty">\$\{escapeHtml\(L\.AI_FLOW_EMPTY\)\}<\/p>`/);
  assert.match(src, /: L\.emptyFlowHtml\(FMT\(\)\.flowColumns\)/);
  assert.doesNotMatch(src, /Needs AI connected/);
});
