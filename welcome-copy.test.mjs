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

// Runs the welcome once. answer: what the stub ask() resolves with ('start', 'setup', or the cancel value).
// runTimers: run the setTimeout callbacks at once (but not the 400 ms tour offer), so the focus and scroll can be seen.
// dom: every element call, as "selector.method", for example "#key-paste.focus".
async function runWelcome({ local, answer, runTimers = false }) {
  const calls = [], tabs = [], S = {}, dom = [];
  const ask = async (o) => { calls.push(o); return typeof answer === 'function' ? answer(o) : answer; };
  const $ = (sel) => ({ focus() { dom.push(sel + '.focus'); }, scrollIntoView() { dom.push(sel + '.scrollIntoView'); } });
  const timer = (fn, ms) => { if (runTimers && !ms) fn(); };
  const run = new AsyncFunction('ask', 'showSetup', 'LOCAL_ORIGIN', 'window', 'S', 'saveSettings', 'showTab', 'setTimeout', '$', 'offerTour',
    SRC + '\nreturn openWelcome();');
  await run(ask, () => true, local, { TabulaBrand: { NAME: 'Tabula Debate' } }, S, () => {}, (t) => tabs.push(t), timer, $, () => {});
  return { calls, tabs, S, dom };
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
// The approved copy only names the draft ballot, so the "suggests" pin is a guard for future wording (WELCOME-COPY.md
// §5); the ban on "decides / picks the winner" runs on every host today.
const DESCRIBES_BALLOT = /draft ballot (that|which|to)\b/i;
test('if the welcome describes the draft ballot, it says it suggests a winner and points', async () => {
  // The guard must fire on a sentence that describes the ballot (the WELCOME-COPY.md option B intro), or it checks nothing.
  assert.ok(DESCRIBES_BALLOT.test('a draft ballot that suggests a winner and points'), 'the guard regex no longer matches a description');
  for (const local of [true, false]) {
    const { calls } = await runWelcome({ local, answer: 'start' });
    const text = textOf(calls[0]);
    assert.ok(!/\b(decides?|picks?|chooses?|declares?)\b[^.\n]{0,30}\bwinner\b/i.test(text), `claims the app picks the winner:\n${text}`);
    if (DESCRIBES_BALLOT.test(text)) assert.match(text, /suggests a winner and points/);
  }
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
// CHANGED 2026-11-21 (revision 2, WELCOME-COPY.md §7): the welcome has no host-only row now. One 'setup' link shows on
// every host, and Settings (not the welcome) shows the subscription box only on localhost. So a hosted judge still meets
// no dead end. Old name: "the subscription row shows only when LOCAL_ORIGIN is true"; old values: ['start', 'key', 'sub']
// on localhost and ['start', 'key'] elsewhere.
test('the welcome shows the same one setup link on every host', async () => {
  const on = (await runWelcome({ local: true, answer: 'start' })).calls[0].buttons.map((b) => b.value);
  const off = (await runWelcome({ local: false, answer: 'start' })).calls[0].buttons.map((b) => b.value);
  assert.deepEqual(on, ['start', 'setup']);
  assert.deepEqual(off, ['start', 'setup']);
});

// Why: a judge who closed the welcome looks in Settings for a way back; a button still named "first-time setup" promises
// a setup wizard that is gone, so the judge does not find the welcome again.
test('the Settings button says "Show the welcome again"', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /<button class="b" id="show-welcome">Show the welcome again<\/button>/);
});

// Why: a judge with round credits pays nothing more and needs no key; a welcome that talks about paying, keys,
// subscriptions or the Terminal tells that judge the wrong story and makes the free app look like a sales page.
test('the welcome says no "AI", "pay", "key", "subscription", "Terminal" or "$" on any host', async () => {
  for (const local of [true, false]) {
    const text = textOf((await runWelcome({ local, answer: 'start' })).calls[0]);
    assert.equal((text.match(/\bAI\b/g) || []).length, 0, `says "AI" (local=${local}):\n${text}`);
    for (const [word, re] of [['pay', /\bpa(y|ys|id|ying)\b/i], ['key', /\bkeys?\b/i], ['subscription', /subscri/i], ['Terminal', /terminal/i]]) {
      assert.ok(!re.test(text), `says "${word}" (local=${local}):\n${text}`);
    }
    assert.ok(!text.includes('$'), 'names a price');
    assert.match(text, /Want help with your flow and ballot\?/);
  }
});

// Why: "Set it up" is the welcome's only door to help; if it lands on the wrong tab or off screen, the judge who asked
// for help sees nothing to do and gives up on the flow and ballot help.
test('"Set it up" opens Settings at the setup area with the cursor in the key field', async () => {
  for (const local of [true, false]) {
    const { calls, tabs, S, dom } = await runWelcome({ local, answer: 'setup', runTimers: true });
    assert.equal(calls.length, 1, 'the link opened a second dialog');
    assert.deepEqual(tabs, ['ai'], 'the link did not open Settings');
    assert.equal(S.setupDone, true, 'the welcome would show again after a reload');
    assert.deepEqual(dom, ['#key-paste.focus']);
  }
  // The key field must sit in #conn-card, the first card on the AI tab, which holds every way to set up help: the key
  // field and the subscription box. So focus on the key field lands the judge at the top of the setup area.
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const tab = html.indexOf('<section class="tab" id="tab-ai">');
  const start = html.indexOf('<div class="card" id="conn-card"'), end = html.indexOf('<div class="card" id="audio-card"');
  assert.ok(tab > 0 && start > tab && end > start, 'the setup card or the card after it is gone');
  assert.ok(!html.slice(tab, start).includes('class="card'), 'the setup card is not the first card on the AI tab');
  const card = html.slice(start, end);
  assert.match(card, /id="key-paste"/, 'the key field is not in the setup area');
  assert.match(card, /id="sub-box"/, 'the subscription box is not in the setup area');
});
