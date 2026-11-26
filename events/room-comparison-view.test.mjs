import test from 'node:test';
import assert from 'node:assert/strict';
import '../core/policy.js';
import { createRoomComparison, comparisonButtonHtml, comparisonPanelHtml } from './js/room-comparison-view.js';

const P = globalThis.TabulaCore.policy, NOW = 1800000000000;
const SOLO = P.gateFor({ now: NOW }), OFF = P.gateFor({ now: NOW, off: true });
const managed = (features) => P.gateFor({ record: { v: 2, product: 'events', edition: '', subject: { role: 'coach', programId: 'p1', managed: false }, features, aiSetup: true, account: { plan: '', hosted: false }, issuedAt: NOW - 1, expiresAt: NOW + 60000 }, programId: 'p1', now: NOW, profile: { programs: [] } });
const room = () => ({ id: 'r1', profile: {}, ranksCopiedAt: 7, reasonCopiedAt: 8, reasonForRank: 'My reason', entries: [
  { id: 'e1', code: 'A12', status: 'done', rank: '2', order: 1, notes: 'Clear reasoning. Rushed ending.', comment: 'An AI rewrite', commentSource: 'judgeEditedAi', privateNote: 'Private jacket', commentCopiedAt: 9 },
  { id: 'e2', code: 'B7', status: 'done', rank: '1', order: 2, notes: 'Steady pace. Thin evidence.' },
] });
const result = () => ({ comparisons: [{ text: 'Reasoning differs from pace.', evidence: [{ id: 'e1', quote: 'Clear reasoning' }, { id: 'e2', quote: 'Steady pace' }] }], gaps: ['Delivery coverage differs.'], order: [] });
function setup({ gate = SOLO, hasKey = true, connection = true } = {}) {
  let r = room(), s = {}, resolve, reject;
  const log = { calls: [], draw: [], asks: 0, saves: 0 };
  const env = { ai: { gate, own: { hasKey: () => hasKey, providerName: () => 'Local test', async connect() { hasKey = true; }, compareRoom(g, msg, opts) { log.calls.push({ g, msg, signal: opts.signal }); return new Promise((yes, no) => { resolve = yes; reject = no; }); } } },
    rooms: () => [r], settings: () => s, saveRoom() { log.saves++; throw new Error('No ballot writes permitted'); },
    ui: { announce() {}, toast() {}, async ask(o) { log.asks++; return connection ? o.input ? 'sk-fake-test' : 'tab' : null; } },
  };
  const c = createRoomComparison(env, { roomId: () => r?.id, event: () => ({ name: 'Original Oratory', prompts: ['Reasoning', 'Delivery'] }), draw: (key) => log.draw.push(key) });
  return { c, env, log, room: () => r, settings: (value) => { s = value; }, answer: (value = result()) => resolve?.(value), fail: (err) => reject?.(err), click: (act) => c.click('room-' + act, {}), tick: () => new Promise((yes) => setTimeout(yes, 0)), remove: () => { r = null; } };
}

// Why: the quiet entry point must not expose a row of ranking options before the judge asks for a review.
test('one compact action starts comparison directly and keeps the order action inside the result', async () => {
  const p = setup();
  assert.equal(p.c.panel(), ''); assert.match(p.c.button(), /Compare the room/);
  assert.match(p.c.button(), /aria-expanded="false"/); assert.doesNotMatch(p.c.button(), /Suggest an order/);
  const pending = p.click('compare'); assert.equal(p.log.calls.length, 1);
  assert.match(p.c.panel(), /Comparing the recorded notes/); assert.match(p.c.button(), /aria-expanded="true"/);
  p.answer(); await pending;
  const html = p.c.panel(); assert.match(html, /Suggest an order/); assert.match(html, /Notes behind this/);
  assert.match(html, /Read full public notes/); assert.match(html, /Clear reasoning\. Rushed ending\./);
  assert.doesNotMatch(html, /Private jacket|An AI rewrite|Use this|Apply ranks|Accept/);
});

// Why: comparing or suggesting an order must never change the ballot, its copy marks or final ranks.
test('comparison and optional ordering are read-only across success and close', async () => {
  const p = setup(), before = structuredClone(p.room());
  let pending = p.click('compare'); p.answer(); await pending;
  pending = p.click('order'); assert.equal(p.log.calls[1].msg.mode, 'order');
  p.answer({ ...result(), order: [{ id: 'e1', text: 'Clear reasoning.', evidence: [{ id: 'e1', quote: 'Clear reasoning' }] }, { id: 'e2', text: 'Steady pace.', evidence: [{ id: 'e2', quote: 'Steady pace' }] }] }); await pending;
  assert.match(p.c.panel(), /Suggested order/); assert.match(p.c.panel(), /Change any final ranks yourself/);
  p.click('close'); assert.equal(p.c.panel(), '');
  assert.deepEqual(p.room(), before); assert.equal(p.log.saves, 0);
});

// Why: source changes must discard both waiting and displayed reasoning instead of presenting a stale review.
test('editing evidence or saved priorities invalidates results and discards late replies', async () => {
  for (const change of [(p) => p.room().entries[0].notes = 'Changed', (p) => p.settings({ roomJudging: { priorities: 'Prioritize clarity' } })]) {
    const p = setup(); const pending = p.click('compare'); change(p); p.c.invalidate();
    assert.equal(p.log.calls[0].signal.aborted, true); assert.match(p.c.panel(), /changed/);
    p.answer(); await pending; assert.doesNotMatch(p.c.panel(), /Reasoning differs/);
  }
  const p = setup(); const pending = p.click('compare'); p.answer(); await pending;
  p.room().entries[0].notes = 'New notes'; assert.match(p.c.panel(), /changed/); assert.doesNotMatch(p.c.panel(), /Reasoning differs/);
});

// Why: final rank edits must stay independent from the aid and not trigger another paid review.
test('changing final ranks or private notes does not invalidate an evidence review', async () => {
  const p = setup(), pending = p.click('compare'); p.answer(); await pending;
  p.room().entries[0].rank = '1'; p.room().entries[0].privateNote = 'Other private note'; p.c.invalidate();
  assert.match(p.c.panel(), /Reasoning differs/); assert.equal(p.log.calls.length, 1);
});

// Why: cancellation and navigation must prevent a slow provider from reopening a closed panel.
test('Escape, close and screen reset abort work and ignore late success or failure', async () => {
  for (const action of [(p) => p.click('close'), (p) => p.c.reset(), (p) => p.c.key({ key: 'Escape', preventDefault() {} })]) {
    const p = setup(), pending = p.click('compare'); action(p);
    assert.equal(p.log.calls[0].signal.aborted, true); p.answer(); await pending;
    assert.equal(p.c.panel(), '');
  }
  const p = setup(), pending = p.click('compare'); p.c.reset(); p.fail(new Error('Late failure')); await pending; assert.equal(p.c.panel(), '');
});

// Why: the new judging task must use its own policy gate rather than borrow permission to edit wording.
test('AI-off and managed analysis denial remove the control and block even indirect calls', async () => {
  for (const gate of [OFF, managed({}), managed({ ballotDraft: { payer: 'self' } })]) {
    const p = setup({ gate }); assert.equal(p.c.button(), ''); assert.equal(p.c.panel(), '');
    await p.click('compare'); await p.click('order'); assert.equal(p.log.calls.length, 0); assert.equal(p.log.asks, 0);
  }
  const p = setup({ gate: managed({ analysis: { payer: 'self' } }) });
  const pending = p.click('compare'); assert.equal(p.log.calls.length, 1); p.answer(); await pending;
});

// Why: a missing connection is handled once on demand, and cancellation must not send student notes.
test('connection is requested only on action and canceled setup sends nothing', async () => {
  const p = setup({ hasKey: false, connection: false }); assert.equal(p.log.asks, 0);
  await p.click('compare'); assert.equal(p.log.asks, 1); assert.equal(p.log.calls.length, 0); assert.match(p.c.panel(), /Connect an AI key/);
  const q = setup({ hasKey: false }); const pending = q.click('compare'); await q.tick(); assert.equal(q.log.calls.length, 1); q.answer(); await pending;
});

// Why: a sparse room may be compared, but it must not receive a complete order based on missing evidence.
test('missing notes are visible and order requests are blocked before connection or transport', async () => {
  const p = setup(); p.room().entries.push({ id: 'e3', code: 'C3', status: 'waiting', order: 3, notes: '' });
  const pending = p.click('compare'); p.answer(); await pending;
  assert.match(p.c.panel(), /C3: speech not finished/); assert.doesNotMatch(p.c.panel(), /data-vact="room-order"/);
  await p.click('order'); assert.equal(p.log.calls.length, 1); assert.match(p.c.panel(), /every speech/);
});

// Why: failures and a refused ordering must leave a clear recovery path without changing the ballot.
test('errors and declined orders stay review-only with a retry action', async () => {
  const p = setup(), before = structuredClone(p.room()); let pending = p.click('compare');
  p.fail(Object.assign(new Error('Cleanup failed'), { kind: 'offline' })); await pending;
  assert.match(p.c.panel(), /offline/); assert.doesNotMatch(p.c.panel(), /Cleanup failed/);
  pending = p.click('order'); p.answer(); await pending;
  assert.match(p.c.panel(), /No complete order suggested/); assert.deepEqual(p.room(), before);
});

// Why: provider text and student notes are untrusted HTML even when references are valid.
test('rendering escapes model output and note text and keeps full-note details closed', () => {
  const r = room(); r.entries[0].notes = '<img src=x onerror=alert(1)>';
  const data = result(); data.comparisons[0].text = '<script>bad</script>'; data.comparisons[0].evidence[0].quote = r.entries[0].notes;
  const html = comparisonPanelHtml({ status: 'ready', mode: 'compare', result: data }, r);
  assert.doesNotMatch(html, /<script>|<img/); assert.match(html, /&lt;img/); assert.match(html, /&lt;script/);
  assert.match(html, /<details class="fold room-evidence">/); assert.equal(comparisonButtonHtml(false), '');
});
