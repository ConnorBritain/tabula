import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const logic = require('./logic.js');
const source = readFileSync(new URL('./js/flow.js', import.meta.url), 'utf8');

function loadFlow({ format = 'policy-hs', hostname = 'debate.tabulaspeech.com', link } = {}) {
  const context = {
    L: { ...logic, learningCutover: true, ...(link ? { learningLink: () => link } : {}) },
    R: { format }, location: { hostname },
    $: () => ({ addEventListener() {} }), setInterval() {}, escLayer() {},
    ResizeObserver: class { observe() {} },
    document: { querySelector: () => ({}) },
  };
  runInNewContext(source, context, { filename: 'js/flow.js' });
  return context.sheetLearnLink;
}

// Why: a broken learning link stops the flow and welcome screen from opening after the library cutover.
test('the flow renders public learning links with the page helpers for each debate format', () => {
  for (const [format, path] of [['policy-hs', 'policy/disadvantages/'], ['ld', 'lincoln-douglas/'], ['pf', 'public-forum/']]) {
    const html = loadFlow({ format })('DA');
    assert.ok(html.includes(`href="https://tabulaspeech.com/learn/debate/${path}"`));
    assert.ok(html.includes('target="_blank" rel="noopener"'));
    assert.equal(loadFlow({ format })('Notes'), '');
  }
  assert.ok(loadFlow({ hostname: 'debate.tabulaspeech.dev' })('DA').includes('href="https://tabulaspeech.dev/learn/debate/policy/disadvantages/"'));
});

// Why: public library titles must remain text when they contain quotes or markup in link attributes.
test('the flow escapes public learning link attributes', () => {
  const html = loadFlow({ link: { href: 'https://tabulaspeech.com/learn/?a=1&b="2"', title: 'Cases & "turns" <test>' } })('DA');
  assert.ok(html.includes('href="https://tabulaspeech.com/learn/?a=1&amp;b=&quot;2&quot;"'));
  assert.ok(html.includes('aria-label="Learn about Cases &amp; &quot;turns&quot; &lt;test&gt; (opens a new tab)"'));
  assert.ok(html.includes('data-tip="Learn about Cases &amp; &quot;turns&quot; &lt;test&gt;"'));
});
