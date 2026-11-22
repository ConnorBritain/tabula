// The welcome dialog (spec 2.1, docs/design/WELCOME-COPY.md §1). Run with: node --test
// These tests pull openWelcome() and startJudging() out of js/help.js and run them with stubs, so they check the real
// strings and the real flow without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { fnSource } = require('./test-fn-source.js');
const help = readFileSync(new URL('./js/help.js', import.meta.url), 'utf8');
const AsyncFunction = (async () => {}).constructor;
// fnSource starts at the word "function", so the "async" in front is added back here.
const SRC = 'async ' + fnSource(help, 'openWelcome') + '\n' + fnSource(help, 'startJudging');

// Runs the welcome once. answer: what the stub ask() resolves with ('start', 'key', 'sub', or the cancel value).
async function runWelcome({ local, answer }) {
  const calls = [], tabs = [], S = {};
  const ask = async (o) => { calls.push(o); return typeof answer === 'function' ? answer(o) : answer; };
  const el = { focus() {}, scrollIntoView() {} };
  const run = new AsyncFunction('ask', 'showSetup', 'LOCAL_ORIGIN', 'window', 'S', 'saveSettings', 'showTab', 'setTimeout', '$', 'offerTour',
    SRC + '\nreturn openWelcome();');
  await run(ask, () => true, local, { TabulaBrand: { NAME: 'Tabula Debate' } }, S, () => {}, (t) => tabs.push(t), () => {}, () => el, () => {});
  return { calls, tabs, S };
}
const textOf = (o) => [o.title, ...[].concat(o.body || []), ...o.buttons.flatMap((b) => [b.label, b.desc || ''])].join('\n');

// Why: if the welcome fills up with "AI" again, a first-time judge reads the app as an AI product and the free path
// (clock, flow, ballot) as the lesser choice; a "$" or "free trial" line would also be false before launch.
test('the welcome stays inside its word budget on every host', async () => {
  for (const local of [true, false]) {
    const { calls } = await runWelcome({ local, answer: 'start' });
    const text = textOf(calls[0]);
    assert.ok((text.match(/\bAI\b/g) || []).length <= 1, `more than one "AI" (local=${local}):\n${text}`);
    for (const banned of ['without AI', 'feedback', 'AI key', 'can only']) assert.ok(!text.toLowerCase().includes(banned.toLowerCase()), `says "${banned}"`);
    for (const word of ['never', 'only']) assert.ok(!new RegExp(`\\b${word}\\b`, 'i').test(text), `says "${word}"`);
    assert.ok(!text.includes('$'), 'names a price');
    assert.ok(!/free trial/i.test(text), 'says "free trial"');
  }
});

// Why: the draft ballot only suggests; a welcome that says it decides the winner would mislead judges and parents (E7).
test('if the welcome describes the draft ballot, it says it suggests a winner and points', async () => {
  const { calls } = await runWelcome({ local: true, answer: 'start' });
  const text = textOf(calls[0]);
  if (/draft ballot (that|which|to)\b/i.test(text)) assert.match(text, /suggests a winner and points/);
});

// Why: a second "are you sure" page made the free path take two clicks and read as a loss; judges want the flow at once.
test('"Start judging", × and Esc each reach Flow in one click, with no skip page', async () => {
  for (const answer of ['start', (o) => o.cancelValue]) {
    const { calls, tabs, S } = await runWelcome({ local: true, answer });
    assert.equal(calls.length, 1, 'the welcome opened a second dialog');
    assert.deepEqual(tabs, ['flow']);
    assert.equal(S.setupDone, true, 'the welcome would show again after a reload');
  }
  const { calls } = await runWelcome({ local: false, answer: 'start' });
  const first = calls[0].buttons[0];
  assert.equal(first.label, 'Start judging');
  assert.equal(first.kind, 'primary');
  assert.equal(calls[0].cancelValue, first.value, '× and Esc do not do what "Start judging" does');
  assert.equal(calls[0].buttons.filter((b) => b.kind === 'primary').length, 1, 'more than one primary button');
});

// Why: the subscription row needs a helper app on this computer; on a hosted site it would be a dead end for the judge.
test('the subscription row shows only when LOCAL_ORIGIN is true', async () => {
  const on = (await runWelcome({ local: true, answer: 'start' })).calls[0].buttons.map((b) => b.value);
  const off = (await runWelcome({ local: false, answer: 'start' })).calls[0].buttons.map((b) => b.value);
  assert.deepEqual(on, ['start', 'key', 'sub']);
  assert.deepEqual(off, ['start', 'key']);
});

// Why: the Settings button must name the dialog it opens; the old "first-time setup" name no longer matches it.
test('the Settings button says "Show the welcome again"', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /<button class="b" id="show-welcome">Show the welcome again<\/button>/);
});
