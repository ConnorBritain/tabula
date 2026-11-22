// Tests for the shared toast, dialog and Esc code, core/ui.js (docs/events/LANDING.md §3, step C3). Run with: node --test
// The rules themselves (toastPlan, askFirstFocus, escTop and the rest) keep their unit tests in logic.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as core from './ui.js';

const require = createRequire(import.meta.url);
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

// Why: the dialogs lock the page behind them. A debate layout name inside core/ would lock the wrong parts (or none)
// on the Speech Events page, so a keyboard judge could Tab out of a dialog there.
test('core/ui.js names no part of the debate page; debate passes its own list in', () => {
  const UI = read('../ui.js');
  const list = /const BEHIND = '([^']+)'/.exec(UI)[1].split(',').map((s) => s.trim());
  const CORE = read('ui.js');
  for (const sel of [...list.filter((s) => /^[#.]/.test(s)), '#flow-tabs']) assert.ok(!CORE.includes(sel), 'core/ui.js names ' + sel);
  assert.throws(() => core.createUI({}), /behind selector/);
});

// Why: a second createUI on one page adds a second Esc listener, so one Esc press would close two layers at once.
test('createUI runs once per page; a second call throws', () => {
  const had = 'document' in globalThis;
  const old = globalThis.document;
  globalThis.document = { addEventListener() {}, querySelector: () => null };
  try {
    core.createUI({ behind: 'main' });
    assert.throws(() => core.createUI({ behind: 'main' }), /already called/);
  } finally {
    if (had) globalThis.document = old; else delete globalThis.document;
  }
});

// Why: debate's tests check the rules through PolicyLogic. If PolicyLogic kept its own copy, those tests would pass
// on code the shared dialogs do not run.
test('PolicyLogic gives the very same rule functions as core/ui.js', () => {
  const L = require('../logic.js');
  for (const k of ['escTop', 'toastPlan', 'askFirstFocus', 'trapNext', 'toastMs', 'askInputState']) assert.equal(L[k], core[k], k);
  assert.equal(L.TOAST_MAX, core.TOAST_MAX);
});

// Why: ask() hides its text box with the hidden attribute; if a display rule beats it, a plain dialog shown after a
// text dialog (the events "Keep the key?" question) still shows the last typed text, an API key included.
test('ui.css: the ask() text box stays hidden when ask() has no input', () => {
  const css = readFileSync(new URL('ui.css', import.meta.url), 'utf8');
  assert.match(css, /\.ask-field \{ display: grid;/);
  assert.match(css, /\.ask-field\[hidden\] \{ display: none; \}/);
});
