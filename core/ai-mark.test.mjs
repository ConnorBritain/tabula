import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { aiMark, lockMark } from './ai-mark.js';
import { cleanupButtonHtml, cleanupPanelHtml } from '../events/js/cleanup-view.js';

const { parseHtml, walk } = createRequire(import.meta.url)('../test-html.js');
const nodes = (html) => [...walk(parseHtml(html))];

// Why: app identity must not change a control's spoken name or create another keyboard stop.
test('AI and protection marks are decorative and cannot receive focus', () => {
  for (const mark of [aiMark(), aiMark('events', 'sample'), lockMark()]) {
    const svg = nodes(mark)[0];
    assert.equal(svg.tag, 'svg');
    assert.equal(svg.attrs['aria-hidden'], 'true');
    assert.equal(svg.attrs.focusable, 'false');
    assert.ok(!nodes(mark).some((n) => ['button', 'input', 'a'].includes(n.tag)));
  }
});

// Why: repeated performer cards need separate gradients, and a code must never become SVG markup.
test('green mark references stay local, distinct and safe for unusual card ids', () => {
  const keys = ['a.b', 'a-2e-b', 'a b', '\"/><script>', 'é'];
  const ids = new Set();
  for (const key of keys) {
    const html = aiMark('events', key);
    const all = nodes(html);
    const gradient = all.find((n) => n.tag === 'lineargradient');
    assert.ok(gradient);
    assert.ok(!ids.has(gradient.attrs.id));
    ids.add(gradient.attrs.id);
    assert.equal(all.filter((n) => n.attrs.fill === `url(#${gradient.attrs.id})`).length, 2);
    assert.ok(all.filter((n) => n.tag === 'stop').every((n) => /--ai-green-/.test(n.attrs['stop-color'])));
    assert.doesNotMatch(html, /<script|https?:|--aff|--neg/);
  }
  assert.throws(() => aiMark('events'), /unique key/);
});

// Why: hiding AI by policy must also hide its mark; identity must never imply an unavailable feature is enabled.
test('Speech Events shows the green mark only on an available clean-up action', () => {
  const card = { id: 'one', code: '101', comment: 'A comment.' };
  assert.equal(cleanupButtonHtml(card, 'none'), '');
  assert.equal(cleanupButtonHtml({ ...card, comment: '' }, 'own'), '');
  const html = cleanupButtonHtml(card, 'own');
  const button = nodes(html).find((n) => n.tag === 'button' && n.attrs['data-vact'] === 'clean');
  assert.equal(button.attrs['aria-label'], 'Clarify feedback with AI');
  assert.equal(button.attrs['aria-haspopup'], 'dialog');
  assert.equal(button.attrs['data-vact'], 'clean');
  assert.ok(nodes(html).some((n) => n.tag === 'lineargradient'));
  assert.doesNotMatch(html, /--ai-blue|--ai-red|data-protect|data-unlock/);
});

// Why: the AI mark identifies suggestions, while the judge must still explicitly choose whether to use the result.
test('a Speech Events suggestion still offers Use this and Keep mine without a permission toggle', () => {
  const card = { fields: ['comment.one'], base: { 'comment.one': 'My words' }, after: { 'comment.one': 'Clean words' }, empty: false, diff: [] };
  const html = cleanupPanelHtml({ id: 'one', status: 'ready', mode: 'full', target: { text: 'My words', selected: false }, empty: false, same: false, diff: card.diff });
  const actions = nodes(html).filter((n) => n.tag === 'button').map((n) => n.attrs['data-vact']);
  assert.ok(actions.includes('clean-use'));
  assert.ok(actions.includes('clean-keep'));
  assert.doesNotMatch(html, /data-protect|data-unlock/);
});
