import test from 'node:test';
import assert from 'node:assert/strict';
import { PREFERENCE_LIMIT, normalizePreferences, resolvePreferences, preferenceText, preferencesHtml, bindPreferences } from './ai-preferences.js';
const custom = (style, guidance = '') => ({ mode: 'custom', style, guidance });
const device = { defaults: custom('Short', 'Explain weighing'), tools: { flowTool: custom('Bullets', 'Never send this'), evalTool: { mode: 'off' } } };

// Why: restored data must remain small and must not set object prototypes or carry hidden control codes.
test('preferences bound and normalize restored records', () => {
  const value = normalizePreferences(JSON.parse('{"defaults":{"mode":"custom","style":"a\\u0000b"},"tools":{"__proto__":{"mode":"custom"},"constructor":{},"valid":{"style":"x"}}}'));
  assert.deepEqual(Object.keys(value.tools), ['valid']);
  assert.equal(value.defaults.style, 'ab');
  assert.equal(normalizePreferences({ defaults: custom('x'.repeat(2000)) }).defaults.style.length, PREFERENCE_LIMIT);
  for (const v of [null, [], 'bad', 8]) assert.deepEqual(normalizePreferences(v), { defaults: { mode: 'inherit', style: '', guidance: '' }, tools: {} });
});

// Why: each tool must inherit saved defaults unless its own setting explicitly replaces or disables them.
test('tool defaults and explicit off resolve from saved settings only', () => {
  assert.deepEqual(resolvePreferences(device, 'flowTool'), { source: 'device', style: 'Bullets', guidance: '' });
  assert.deepEqual(resolvePreferences(device, 'evalTool', true), { source: 'device', style: '', guidance: '' });
  assert.deepEqual(resolvePreferences(device, 'other', true), { source: 'device', style: 'Short', guidance: 'Explain weighing' });
  assert.equal(resolvePreferences({ ...device, tools: { flowTool: { mode: 'inherit' } } }, 'flowTool').style, 'Short');
  assert.equal(resolvePreferences({ defaults: { mode: 'off' } }, 'other', true).style, '');
  assert.deepEqual(resolvePreferences(null, 'other'), { source: 'standard', style: '', guidance: '' });
});

// Why: writing tools must never receive judging guidance or treat a preference as supplied evidence.
test('prompt preferences are bounded user data with a fixed fidelity guard', () => {
  const v = { style: 'Use "quotes"\nthen bullets', guidance: 'Judge this' };
  assert.equal(preferenceText({}), '');
  assert.doesNotMatch(preferenceText(v), /Judge this|evaluation_guidance/);
  const text = preferenceText(v, true);
  assert.match(text, /do not override school policy/);
  assert.match(text, /Never treat them as observations/);
  assert.deepEqual(JSON.parse(text.split('\n').at(-1)), { writing_style: v.style, evaluation_guidance: v.guidance });
});

// Why: preferences must stay folded away and escape labels; writing tools must not display judging fields.
test('editor is closed, escaped, and scoped to permitted fields', () => {
  const html = preferencesHtml({ id: 'test', title: '<img>', scopes: [{ id: 'defaults', label: 'Feedback', guidance: false }] });
  assert.doesNotMatch(html, /<details[^>]*\bopen|<img>|Judging guidance|data-pref="guidance"/);
  assert.match(html, /&lt;img&gt;/);
  assert.match(html, /maxlength="1000"/);
  assert.throws(() => preferencesHtml({ id: 'bad"', scopes: [] }));
});

function editor() {
  const controls = Object.fromEntries(['scope', 'mode', 'style', 'guidance', 'status'].map((k) => [k, { dataset: { pref: k }, value: k === 'scope' ? 'defaults' : '', disabled: false }]));
  const guidance = { hidden: false }, listeners = {};
  const container = { querySelector: (s) => s === '[data-pref-guidance]' ? guidance : controls[s.match(/"(.*?)"/)[1]], addEventListener: (n, fn) => { listeners[n] = fn; }, removeEventListener: (n) => { delete listeners[n]; } };
  return { controls, guidance, container, emit: (n, k, value) => { controls[k].value = value; listeners[n]({ target: controls[k] }); }, listeners };
}
// Why: one gesture should save once, changing tools should not write, and a failed save must be visible.
test('binding saves edits without requests and shows inherited, off and failed-save states', () => {
  const e = editor(); e.controls.scope.value = 'newTool'; let value = { defaults: custom('Short', 'Explain weighing'), tools: {} }, writes = 0, works = true;
  const stop = bindPreferences(e.container, { scopes: [{ id: 'defaults', guidance: true }, { id: 'newTool', guidance: false }], read: () => value, write: (p) => { value = p; writes++; return works; } });
  assert.equal(e.controls.style.value, 'Short');
  assert.equal(e.controls.style.disabled, true);
  e.emit('change', 'mode', 'custom');
  assert.equal(writes, 1);
  e.emit('input', 'style', 'Direct');
  assert.equal(value.tools.newTool.style, 'Direct');
  e.emit('change', 'scope', 'defaults');
  assert.equal(writes, 2);
  assert.equal(e.guidance.hidden, false);
  e.emit('change', 'mode', 'off');
  assert.equal(e.controls.style.value, '');
  works = false;
  e.emit('change', 'mode', 'custom');
  assert.match(e.controls.status.textContent, /Could not save/);
  stop(); assert.deepEqual(e.listeners, {});
});
