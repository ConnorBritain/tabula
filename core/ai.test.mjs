// Tests for the shared AI layer, core/ai.js. Run with: node --test
// Debate's provider, hosted and key tests (providers.test.js, hosted.test.js, cost.test.js) run through this file now.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as AI from './ai.js';

const require = createRequire(import.meta.url);
const memStore = (seed = {}, { failSet = false } = {}) => {
  const m = new Map(Object.keys(seed).map((k) => [k, seed[k]]));
  return { m, get: (k, d) => (m.has(k) ? m.get(k) : d), set: (k, v) => { if (failSet) return false; m.set(k, v); return true; }, del: (k) => { m.delete(k); } };
};
const OPTS = { name: 'app.keys.v1', oldNames: { 'app.key': 'anthropic' } };

// Why: with Remember off a key must live in this tab only; if it also stayed in the browser, a shared school laptop
// would keep a judge's paid key for the next person.
test('key store: Remember off keeps keys in the tab only and clears the browser copy; on does the opposite', () => {
  const local = memStore({ 'app.keys.v1': { openai: 'sk-old' }, 'app.key': 'sk-ant-1' }), session = memStore();
  const ks = AI.createKeyStore(Object.assign({ local, session }, OPTS));
  assert.deepEqual(ks.load(), { openai: 'sk-old', anthropic: 'sk-ant-1' }, 'an old single key moves in');
  assert.equal(ks.hasSaved(), true);
  ks.save({ openai: 'sk-new' }, false);
  assert.deepEqual([local.m.has('app.keys.v1'), local.m.has('app.key'), session.m.get('app.keys.v1')], [false, false, { openai: 'sk-new' }]);
  ks.save({ openai: 'sk-new' }, true);
  assert.deepEqual([local.m.get('app.keys.v1'), session.m.has('app.keys.v1')], [{ openai: 'sk-new' }, false]);
});

// Why: if saving to the browser fails (storage full), the old copies are the judge's only keys; deleting them first
// would lose the keys.
test('key store: a failed save keeps every old copy', () => {
  const local = memStore({ 'app.key': 'sk-ant-1' }, { failSet: true }), session = memStore({ 'app.keys.v1': { openai: 'x' } });
  const ks = AI.createKeyStore(Object.assign({ local, session }, OPTS));
  assert.equal(ks.save({ openai: 'x' }, true), false);
  assert.deepEqual([local.m.get('app.key'), session.m.get('app.keys.v1')], ['sk-ant-1', { openai: 'x' }]);
});

// Why: a hosted answer arrives in pieces; losing a piece or reading past the end would show a judge a broken or
// doubled answer.
test('hosted stream: pieces join, a part event waits, and the done frame gives the app its own info', () => {
  const a = AI.readSse('data: {"t":"Hel"}\n\ndata: {"t":"lo"}\n\ndata: {"do');
  assert.deepEqual([a.events.length, a.rest], [2, 'data: {"do']);
  let acc = {};
  for (const ev of a.events) acc = AI.sseStep(acc, ev);
  const b = AI.readSse(a.rest + 'ne":true,"left":3}\n\n');
  acc = AI.sseStep(acc, b.events[0], (ev) => ({ left: ev.left }));
  assert.deepEqual(acc, { text: 'Hello', done: true, error: '', info: { left: 3 } });
  assert.deepEqual(AI.sseStep(acc, { t: 'more' }), acc, 'nothing is added after done');
});

// Why: the output cap stops one runaway reply from billing a judge tens of thousands of tokens; each app names its own
// kinds of call, and an unknown kind must still get a cap.
test('outputCap: the app\'s caps by kind, the routine cap for an unknown kind, and a default with none', () => {
  const caps = { routine: 8000, short: 2000 };
  assert.equal(AI.outputCap('short', caps), 2000);
  assert.equal(AI.outputCap('other', caps), 8000);
  assert.equal(AI.outputCap('x'), AI.DEFAULT_OUTPUT_CAP);
});

// Why: the shared AI layer must work in Node tests and in any page; a DOM or network call inside it would make the
// second app's AI depend on the first app's page, and would hide a request from the app's own checks.
test('core/ai.js uses no DOM, no browser storage and no network', () => {
  const src = readFileSync(new URL('ai.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\bwindow\b|\bdocument\.|\bfetch\(|localStorage|sessionStorage|XMLHttpRequest/);
});

// Why: core/ai.js sends no app data by itself; a round or a name inside it would mean a second app could leak the
// first app's data, or skip the app's own anonymizer.
test('core/ai.js has no round shape and no anonymizer, and debate gets the same shared functions', () => {
  const src = readFileSync(new URL('ai.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /anonymi[sz]e\(|\bR\.[a-zA-Z]|speakerIds|\.ballot\b/);
  const P = require('../providers.js');
  for (const k of ['detectProvider', 'pickModel', 'buildAIRequest', 'parseAIResponse', 'extractJson', 'engineOptions']) assert.equal(P[k], AI[k], k);
  assert.equal(P.outputCap('flow'), 6000, 'debate keeps its own caps');
  const L = require('../logic.js');
  assert.equal(L.readSse, AI.readSse);
});

// Why: the events page has no Anthropic SDK (it may not load debate's vendor bundle), so a Claude key works there only
// through this plain request; a wrong header or body would fail every clean-up with a Claude key.
test('Anthropic: a plain-fetch request with the browser header, the schema in the words, and the reply text read back', () => {
  const req = AI.buildAIRequest('anthropic', { key: 'sk-ant-k', model: 'claude-haiku-5-5', system: 'S', prompt: 'P', docs: [], schema: { type: 'object' }, maxTokens: 900 });
  assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(req.init.headers['x-api-key'], 'sk-ant-k');
  assert.equal(req.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const body = JSON.parse(req.init.body);
  assert.deepEqual([body.model, body.max_tokens, body.system], ['claude-haiku-5-5', 900, 'S']);
  assert.match(body.messages[0].content, /^P\n\nReply with only a JSON object that matches this JSON Schema:\n\{"type":"object"\}$/);
  assert.equal(AI.parseAIResponse('anthropic', { content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: '{"a"' }, { type: 'text', text: ':1}' }], stop_reason: 'end_turn' }), '{"a":1}');
  assert.throws(() => AI.parseAIResponse('anthropic', { content: [{ type: 'text', text: '{"a' }], stop_reason: 'max_tokens' }), /cut off/);
  assert.throws(() => AI.parseAIResponse('anthropic', { content: [], stop_reason: 'refusal' }), /declined/);
});
