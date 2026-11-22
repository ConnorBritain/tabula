// Tests for the judge's own AI key in Speech Events, events/js/ai-key.js (docs/events/LANDING.md §4.1 step E13).
// Run with: node --test. No real AI call: a fake fetch answers in the providers' reply shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../core/policy.js';
import { createStore } from '../core/store.js';
import { createOwnKey, KEYS_KEY, MODELS_KEY, CAPS, statusKind } from './js/ai-key.js';
import { cleanupMessages } from './js/cleanup.js';

const P = globalThis.TabulaCore.policy;
const NOW = 1_800_000_000_000;
const SOLO = P.gateFor({ now: NOW });
const OFF = P.gateFor({ now: NOW, off: true });
const box = () => { const m = new Map(); return { m, get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

// A fake provider: answers the model list and the clean-up call, and keeps every request.
function setup({ models = ['gpt-6', 'gpt-6-mini'], reply, status = 200, online = true } = {}) {
  const local = box(), tab = box();
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/models')) return json({ data: models.map((id) => ({ id })) });
    if (status !== 200) return json({ error: {} }, status);
    const sent = JSON.parse(init.body);
    const text = sent.input[0].content[0].text;
    const speaker = text.match(/\[Speaker \d+\]/)[0];
    return json({ output_text: JSON.stringify({ comments: [{ speaker, text: reply || '[Name 1.1], your ending felt rushed.' }] }) });
  };
  const own = createOwnKey({ local: createStore({ prefixes: ['tabulaEvents.'], storage: local }), session: createStore({ prefixes: ['tabulaEvents.'], storage: tab }), fetch, online: () => online, policy: P });
  return { own, calls, local, tab };
}
const ROOM = { id: 'r1', entries: [{ id: 'e1', code: 'A12', name: 'Maria Lopez', order: 1, status: 'done', notes: '', comment: 'maria rushed the end, A12' }] };
const EVENT = { name: 'Original Oratory' };

// Why: ARCHITECTURE §11 says keys are not remembered by default; a key saved to the device without the judge's choice
// stays on a shared school laptop for the next person to use and bill.
test('a key is kept for this tab only unless the judge chooses Remember', async () => {
  const a = setup();
  assert.equal(await a.own.connect('  sk-fake-test  ', false), 'openai');
  assert.equal(a.own.hasKey(), true);
  assert.equal(a.local.m.has(KEYS_KEY), false, 'not on the device');
  assert.deepEqual(JSON.parse(a.tab.m.get(KEYS_KEY)), { openai: 'sk-fake-test' });
  const b = setup();
  await b.own.connect('sk-fake-test', true);
  assert.deepEqual(JSON.parse(b.local.m.get(KEYS_KEY)), { openai: 'sk-fake-test' });
  assert.equal(b.tab.m.has(KEYS_KEY), false);
  b.own.forget();
  assert.equal(b.own.hasKey(), false);
  assert.equal(b.local.m.has(KEYS_KEY), false, 'Forget removes it from the device');
  assert.equal(b.local.m.has(MODELS_KEY), false);
});

// Why: a pasted key is checked before it is kept; keeping a wrong or rejected key would make every later clean-up fail
// with no clear reason, and checking with no network would look like a bad key.
test('connect refuses a text that is not a key, a rejected key, and an offline check', async () => {
  const a = setup();
  await assert.rejects(a.own.connect('hello', false), (e) => e.kind === 'format');
  assert.equal(a.calls.length, 0, 'no call for a text that is not a key');
  const off = setup({ online: false });
  await assert.rejects(off.own.connect('sk-fake-test', false), (e) => e.kind === 'offline');
  const own = createOwnKey({ local: createStore({ prefixes: ['tabulaEvents.'], storage: box() }), session: createStore({ prefixes: ['tabulaEvents.'], storage: box() }), fetch: async () => json({}, 401), online: () => true, policy: P });
  await assert.rejects(own.connect('sk-fake-test', false), (e) => e.kind === 'rejected');
  assert.equal(own.hasKey(), false, 'a rejected key is not kept');
});

// Why: the judge pays per call; an automatic pick of a premium model, or a reply with no output cap, could cost many
// times the few cents a clean-up should cost.
test('the call uses the cheap routine model and the clean-up output cap', async () => {
  const a = setup();
  await a.own.connect('sk-fake-test', false);
  const drafts = await a.own.cleanup(SOLO, cleanupMessages(ROOM, EVENT, ['e1']));
  assert.deepEqual(drafts, { e1: 'Maria, your ending felt rushed.' }, 'names come back in');
  const body = JSON.parse(a.calls.at(-1).init.body);
  assert.equal(body.model, 'gpt-6-mini');
  assert.equal(body.max_output_tokens, CAPS.routine);
});

// Why: privacy promise (ARCHITECTURE §6.4): codes and names typed in setup never leave the device; this checks the
// bytes the fake provider got, not only the prompt builder.
test('the request that leaves the device holds no code or name', async () => {
  const a = setup();
  await a.own.connect('sk-fake-test', false);
  await a.own.cleanup(SOLO, cleanupMessages(ROOM, EVENT, ['e1']));
  assert.doesNotMatch(a.calls.at(-1).init.body, /maria|lopez|A12/i);
  assert.match(a.calls.at(-1).init.body, /\[Name 1\.1\] rushed the end, \[Speaker 1\]/);
});

// Why: AI-POLICY §3b R4: with the feature off, no code path may start a network call, even one with a saved key.
test('with the feature off, the call makes no network request', async () => {
  const a = setup();
  await a.own.connect('sk-fake-test', false);
  const n = a.calls.length;
  await assert.rejects(a.own.cleanup(OFF, cleanupMessages(ROOM, EVENT, ['e1'])));
  await assert.rejects(a.own.cleanup(undefined, cleanupMessages(ROOM, EVENT, ['e1'])));
  assert.equal(a.calls.length, n);
});

// Why: a failed call must say what happened in plain words and leave the comment alone; a raw provider error or an
// empty draft would confuse a lay judge in the middle of a tournament.
test('provider errors and offline become plain errors', async () => {
  for (const [status, kind] of [[401, 'rejected'], [429, 'busy'], [503, 'busy'], [400, 'failed']]) {
    const a = setup({ status });
    await a.own.connect('sk-fake-test', false);
    await assert.rejects(a.own.cleanup(SOLO, cleanupMessages(ROOM, EVENT, ['e1'])), (e) => e.kind === kind && !/\{/.test(e.message));
  }
  assert.equal(statusKind(403), 'rejected');
  const off = setup();
  await off.own.connect('sk-fake-test', false);
  const own2 = createOwnKey({ local: createStore({ prefixes: ['tabulaEvents.'], storage: off.local }), session: createStore({ prefixes: ['tabulaEvents.'], storage: off.tab }), fetch: async () => { throw new Error('no net'); }, online: () => false, policy: P });
  await assert.rejects(own2.cleanup(SOLO, cleanupMessages(ROOM, EVENT, ['e1'])), (e) => e.kind === 'offline');
});

// Why: providers retire models often; a saved model that now answers 404 must be picked again once, or the judge's key
// would stop working for clean-up until they clear the browser.
test('a retired model (404) is forgotten and picked again once', async () => {
  const a = setup();
  await a.own.connect('sk-fake-test', false);
  let first = true;
  const own = createOwnKey({
    local: createStore({ prefixes: ['tabulaEvents.'], storage: a.local }), session: createStore({ prefixes: ['tabulaEvents.'], storage: a.tab }), online: () => true, policy: P,
    fetch: async (url, init) => {
      if (url.endsWith('/models')) return json({ data: [{ id: 'gpt-7-mini' }] });
      if (first) { first = false; return json({ error: {} }, 404); }
      return json({ output_text: JSON.stringify({ comments: [{ speaker: '[Speaker 1]', text: 'ok ' + JSON.parse(init.body).model }] }) });
    },
  });
  assert.deepEqual(await own.cleanup(SOLO, cleanupMessages(ROOM, EVENT, ['e1'])), { e1: 'ok gpt-7-mini' });
  assert.equal(JSON.parse(a.local.m.get(MODELS_KEY)).openai, 'gpt-7-mini');
});

// Why: the events page must not load debate files (LANDING E13 row); a debate import would break the page offline and
// tie the two apps together.
test('the events AI files import only core/ and events/ code', () => {
  for (const f of ['js/ai-key.js', 'js/cleanup-view.js', 'js/cleanup.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) assert.match(m[1], /^\.\/|^\.\.\/prompts\/|^\.\.\/\.\.\/core\//, f + ' imports ' + m[1]);
  }
});
