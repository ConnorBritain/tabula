import test from 'node:test';
import assert from 'node:assert/strict';
import '../core/policy.js';
import { createStore } from '../core/store.js';
import { createOwnKey } from './js/ai-key.js';
import { comparisonMessages } from './js/room-comparison.js';

const P = globalThis.TabulaCore.policy, NOW = 1800000000000;
const SOLO = P.gateFor({ now: NOW }), OFF = P.gateFor({ now: NOW, off: true });
const store = () => { const m = new Map(); return createStore({ prefixes: ['tabulaEvents.'], storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) } }); };
const json = (body, status = 200) => ({ ok: status === 200, status, json: async () => body, text: async () => JSON.stringify(body) });
const room = { id: 'PRIVATE-ROOM', profile: {}, entries: [
  { id: 'e1', code: 'A12', name: 'Ana Diaz', status: 'done', order: 1, rank: '2', notes: 'Ana has clear reasoning.', privateNote: 'Private secret' },
  { id: 'e2', code: 'B7', name: 'Ben Lee', status: 'done', order: 2, rank: '1', notes: 'Ben has a steady pace.' },
] };
const data = () => ({ comparisons: [{ text: 'The notes emphasize reasoning and pace differently.', evidence: [{ speaker: '[Speaker 1]', quote: 'clear reasoning' }, { speaker: '[Speaker 2]', quote: 'steady pace' }] }], gaps: ['Limited evidence.'], order: [] });
function setup({ malformed = false, retired = false, offline = false } = {}) {
  const calls = []; let chatCalls = 0;
  const own = createOwnKey({ local: store(), session: store(), policy: P, online: () => !offline, fetch: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/models')) return json({ data: [{ id: 'gpt-6-mini' }] });
    if (retired && ++chatCalls === 1) return json({}, 404);
    return json({ output_text: malformed ? '{"comparisons":[]}' : JSON.stringify(data()) });
  } });
  return { own, calls };
}

// Why: the bytes sent to the provider, not just the prompt builder, must honor privacy and cost limits.
test('room review uses the existing provider route with scrubbed evidence, a strict schema and an output cap', async () => {
  const p = setup(); await p.own.connect('sk-fake-test', false);
  const result = await p.own.compareRoom(SOLO, comparisonMessages(room, { name: 'Original Oratory' }));
  assert.equal(result.comparisons[0].evidence[0].id, 'e1');
  const call = p.calls.at(-1), body = JSON.parse(call.init.body);
  assert.equal(new URL(call.url).hostname, 'api.openai.com'); assert.equal(body.model, 'gpt-6-mini'); assert.equal(body.max_output_tokens, 4000);
  assert.equal(body.text.format.strict, true); assert.ok(body.text.format.schema.properties.order);
  assert.doesNotMatch(call.init.body, /Ana|Diaz|Ben|Lee|A12|B7|PRIVATE-ROOM|Private secret/);
});

// Why: an old connected key must not bypass policy or permit a canceled request to reach the network.
test('denied policy and an already-aborted request make no provider calls', async () => {
  const p = setup(); await p.own.connect('sk-fake-test', false); const before = p.calls.length;
  const msg = comparisonMessages(room, { name: 'Speech' });
  await assert.rejects(p.own.compareRoom(OFF, msg)); assert.equal(p.calls.length, before);
  const c = new AbortController(); c.abort();
  await assert.rejects(p.own.compareRoom(SOLO, msg, { signal: c.signal }), { name: 'AbortError' }); assert.equal(p.calls.length, before);
});

// Why: a malformed review must fail closed rather than display unsupported reasoning, while a retired model gets only one retry.
test('transport rejects malformed evidence and retries a retired model once using the same bounded task', async () => {
  const p = setup({ malformed: true }); await p.own.connect('sk-fake-test', false);
  await assert.rejects(p.own.compareRoom(SOLO, comparisonMessages(room, { name: 'Speech' })), (e) => e.kind === 'reply');
  const q = setup({ retired: true }); await q.own.connect('sk-fake-test', false);
  await q.own.compareRoom(SOLO, comparisonMessages(room, { name: 'Speech' }));
  assert.equal(q.calls.filter((c) => !c.url.endsWith('/models')).length, 2);
});
