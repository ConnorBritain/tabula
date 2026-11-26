import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as preferences from './core/ai-preferences.js';
const source = readFileSync(new URL('./js/preferences.js', import.meta.url), 'utf8');

function mount() {
  const controls = Object.fromEntries(['scope', 'mode', 'style', 'guidance', 'status'].map((k) => [k, { dataset: { pref: k }, value: k === 'scope' ? 'defaults' : '' }]));
  const listeners = { change: new Set(), input: new Set() };
  return { controls, listeners, innerHTML: '', querySelector: (s) => s === '[data-pref-guidance]' ? {} : controls[s.match(/"(.*?)"/)[1]], addEventListener: (n, f) => listeners[n].add(f), removeEventListener: (n, f) => listeners[n].delete(f) };
}

// Why: revisiting Settings must not multiply save handlers or turn an edit into repeated writes.
test('repeated rendering keeps exactly one handler per preference editor', () => {
  const device = mount(), round = mount(), S = {}, R = {};
  let saves = 0;
  const make = new Function('TabulaCore', '$', 'can', 'S', 'R', 'save', 'saveSettings', source + '\nreturn {renderAIPreferences, requestPreferences};');
  const api = make({ 'ai-preferences': preferences }, (s) => s.includes('device') ? device : round, () => true, S, R, () => { saves++; return true; }, () => { saves++; return true; });
  for (let n = 0; n < 4; n++) api.renderAIPreferences();
  assert.equal(device.listeners.change.size, 1);
  assert.equal(device.listeners.input.size, 1);
  assert.equal(round.listeners.change.size, 0);
  assert.equal(round.innerHTML, '');
  device.controls.mode.value = 'custom';
  for (const fn of device.listeners.change) fn({ target: device.controls.mode });
  device.controls.style.value = 'Brief';
  device.controls.guidance.value = 'Explain weighing';
  for (const fn of device.listeners.input) fn({ target: device.controls.style });
  assert.equal(saves, 2);
  R.aiPreferences = { defaults: { mode: 'off' } };
  assert.equal(api.requestPreferences('liveEval').guidance, 'Explain weighing', 'old round overrides cannot change general settings');
  assert.equal(api.requestPreferences('aiFlow').guidance, '');
  assert.equal(api.requestPreferences('notAllowed').style, '');
});

// Why: removed AI tools must not be advertised through a settings panel.
test('preferences expose only tools permitted by the current policy', () => {
  const device = mount(), round = mount();
  const make = new Function('TabulaCore', '$', 'can', 'S', 'R', 'save', 'saveSettings', source + '\nreturn renderAIPreferences;');
  const render = make({ 'ai-preferences': preferences }, (s) => s.includes('device') ? device : round, () => false, {}, {}, () => true, () => true);
  render();
  assert.equal(device.innerHTML, '');
  assert.equal(round.innerHTML, '');
  assert.equal(device.listeners.change.size, 0);
});

// Why: saved feedback preferences must survive a backup without adding AI keys to that file.
test('feedback preferences survive the existing settings backup and restore path', async () => {
  const { withSetting, makeBackup, readBackup } = await import('./events/js/settings.js');
  const { SETTINGS_KEY } = await import('./events/js/store.js');
  const { KEYS_KEY } = await import('./events/js/ai-key.js');
  const styled = withSetting({}, 'aiPreferences', { defaults: { mode: 'custom', style: 'Direct' } });
  const value = withSetting(styled, 'feedbackEdit', { mode: 'custom', request: 'Use short sentences.' });
  const file = makeBackup({ [SETTINGS_KEY]: JSON.stringify(value), [KEYS_KEY]: '{"openai":"test-only"}' }, { now: '2026-11-25T22:00:00Z' });
  const restored = readBackup(JSON.stringify(file));
  assert.equal(preferences.resolvePreferences(JSON.parse(restored.storage[SETTINGS_KEY]).aiPreferences, 'feedback').style, 'Direct');
  assert.deepEqual(JSON.parse(restored.storage[SETTINGS_KEY]).feedbackEdit, { mode: 'custom', request: 'Use short sentences.' });
  assert.equal(restored.includesKeys, false);
  assert.equal(KEYS_KEY in restored.storage, false);
});

// Why: a school that allows key setup can still remove feedback editing and its saved preferences.
test('feedback preferences disappear when that tool is removed by policy', async () => {
  const { aiPartHtml } = await import('./events/js/settings-screen.js');
  const html = aiPartHtml({ allowed: true, feedbackAllowed: false, connected: false });
  assert.match(html, /Connect AI/);
  assert.doesNotMatch(html, /Response style|Feedback preferences|data-pref=/);
});

// Why: general AI configuration must have one home, so users do not have competing round and device defaults.
test('Round has no AI preference or writing-level controls', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="ai-round-preferences"|id="writing-card"|data-read-scope="round"/);
  assert.match(html, /id="ai-device-preferences"/);
  const client = readFileSync(new URL('./js/ai.js', import.meta.url), 'utf8');
  assert.match(client, /const lvl = \(\) => L\.readingFor\(null, S\.readLevel\)/);
});
