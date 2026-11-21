// Tests for the hosted AI caller: AI features call the Tabula server (POST /api/v1/ai/<task>) when the account has
// hosted access. Spec: tabula-cloud docs/APP-CLIENT-PROPOSAL.md §2, §3 and §3a. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const P = require('./providers.js');

const AI_SRC = fs.readFileSync(path.join(__dirname, 'js/ai.js'), 'utf8');
const PROG = 'prog_lincoln01';

// A capability record (CONTRACTS §2, v2) for a round judged for PROG. hosted: the account's own credits.
function record(features, hosted) {
  return L.parseCaps({
    v: 2, product: 'debate', edition: 'judge', aiSetup: true,
    subject: { role: 'judge', programId: PROG, managed: false },
    features, account: { plan: hosted ? 'paid' : 'free', hosted: Boolean(hosted) },
    issuedAt: 1, expiresAt: Date.now() + 3600e3,
  });
}
const gate = (rec, programId = PROG) => L.gateFor({ record: rec, now: Date.now(), programId, profile: null });
const ALL_SELF = { aiFlow: { payer: 'self' }, liveEval: { payer: 'self' }, analysis: { payer: 'self' }, ballotDraft: { payer: 'self' } };

// A round with real student, team and tournament names. None of them may reach the server.
function round() {
  return {
    id: 'round-7f3a9c21', programId: PROG, tournament: 'Lincoln State Finals', roundName: 'Octos', judge: 'Pat Judge',
    topic: 'Resolved: the federal government should expand fusion research.',
    aff: { team: 'Lincoln AB', d1: 'Alice', d2: 'Bobby' }, neg: { team: 'Central CD', d1: 'Carol', d2: 'Dmitri' },
    transcripts: { '1AC': 'Alice reads the plan. Fusion solves warming.', '1NC': 'Carol runs a DA.' },
    flows: [{ name: 'Case', cells: { 0: 'Plan: fund fusion' } }], aiFlows: [], ai: { paradigm: 'tab' },
  };
}

// Why: hosted calls spend the judge's credits or the school's pool. If the rule is wrong, a "Just me" judge with no
// plan gets server errors instead of their own key, or a school-paid judge never gets the AI the school bought.
test('hostedOn: only a round record with hosted credits, or a school that pays for the feature, runs hosted', () => {
  assert.equal(L.hostedOn(gate(null, null), 'aiFlow'), false, 'no record (solo app): own key only');
  assert.equal(L.hostedOn(gate(record(ALL_SELF, false)), 'aiFlow'), false, 'record, own payer, no credits: own key');
  assert.equal(L.hostedOn(gate(record(ALL_SELF, true)), 'aiFlow'), true, 'own credits');
  assert.equal(L.hostedOn(gate(record({ aiFlow: { payer: 'program' } }, false)), 'aiFlow'), true, 'the school pays');
  assert.equal(L.hostedOn(gate(record({ aiFlow: { payer: 'program' } }, false)), 'liveEval'), false, 'a feature the record removes');
  assert.equal(L.hostedOn(gate(record(ALL_SELF, true)), 'aiFlow') && L.hostedAny(gate(null, null)), false);
  assert.equal(L.hostedAny(gate(record({ analysis: { payer: 'program' } }, false))), true, 'the device is ready without a key');
});

// Why: the server refuses a call without X-Tabula (CSRF) or the session cookie, and keys the round budget on roundId and
// the school's pool on programId. A wrong header or id means every call fails or is charged to the wrong account.
test('hostedRequest: the task route, the CSRF header, the cookie, and the round id and school from the round', () => {
  const r = round();
  const req = L.hostedRequest(r, 'flow', { speech: '1AC' }, 'call-0001aaaa');
  assert.equal(req.url, '/api/v1/ai/flow.update');
  assert.equal(req.init.method, 'POST');
  assert.equal(req.init.credentials, 'same-origin');
  assert.equal(req.init.headers['x-tabula'], '1');
  assert.equal(req.init.headers['content-type'], 'application/json');
  const body = JSON.parse(req.init.body);
  assert.deepEqual(body, { callId: 'call-0001aaaa', format: 'policy-hs', formatVersion: 1, state: { speech: '1AC' }, roundId: r.id, programId: PROG });
  assert.equal(JSON.parse(L.hostedRequest({ ...r, programId: null }, 'eval', {}, 'call-0002bbbb').init.body).programId, null, 'Just me');
  const tasks = Object.fromEntries(Object.keys(L.HOSTED_TASKS).map((j) => [j, L.hostedRequest(r, j, {}, 'call-0003cccc').url]));
  assert.deepEqual(tasks, { flow: '/api/v1/ai/flow.update', eval: '/api/v1/ai/eval.live', lens: '/api/v1/ai/analysis.lens', impacts: '/api/v1/ai/analysis.impact', map: '/api/v1/ai/analysis.map', ballot: '/api/v1/ai/ballot.fill' });
  assert.throws(() => L.hostedRequest(r, 'deep.ballot', {}, 'call-0004dddd'), /unknown hosted job/);
});

// Why: round content stays on the device except what a task needs (roles plan rule), and the server bills the live flow
// only for new words of the speech id it gets (§3a). Sending other speeches costs the judge; dropping the speech id
// or part of the speech makes the server bill the whole speech again or flow the wrong column.
test('hostedState: the live flow sends its speech id, that whole speech and the earlier flow; nothing else', () => {
  const r = round();
  const st = L.hostedState('flow', r, [], { speech: '1AC' });
  assert.deepEqual(Object.keys(st).sort(), ['flow', 'speech', 'transcript']);
  assert.equal(st.speech, '1AC');
  assert.equal(st.transcript, 'Alice reads the plan. Fusion solves warming.');
  r.transcripts['1AC'] += ' Second advantage: jobs.';
  assert.equal(L.hostedState('flow', r, [], { speech: '1AC' }).transcript, 'Alice reads the plan. Fusion solves warming. Second advantage: jobs.', 'the whole speech so far on each pass');
  assert.ok(!JSON.stringify(st).includes('Carol runs'), 'another speech is not sent');
});

// Why: the round-wide jobs need the transcripts, flow and paradigm, but never the tournament, the judge's name or team
// names (the page swaps student names for roles before the call; these fields are simply not needed).
test('hostedState: round-wide jobs send transcripts, flow and the judge notes, never tournament, judge or team names', () => {
  const r = round();
  for (const job of ['eval', 'lens', 'impacts', 'map', 'ballot']) {
    const st = L.hostedState(job, r, [], job === 'ballot' ? { judgeInput: 'Aff on the DA.' } : job === 'lens' ? { paradigm: 'Policymaker.' } : {});
    const all = JSON.stringify(st);
    for (const name of ['Lincoln State Finals', 'Pat Judge', 'Lincoln AB', 'Central CD', 'Octos']) assert.ok(!all.includes(name), job + ' sends ' + name);
    assert.match(st.transcript, /Carol runs a DA/);
    assert.match(st.flow, /Plan: fund fusion/);
    assert.match(st.notes, /Resolved: the federal government/);
  }
  assert.match(L.hostedState('ballot', r, [], { judgeInput: 'Aff on the DA.' }).notes, /Aff on the DA\./);
  assert.match(L.hostedState('lens', r, [], { paradigm: 'Policymaker.' }).notes, /Judge paradigm: Policymaker\./);
});

// Why: the answer arrives in network chunks that can split an event anywhere. A parser that drops a split event loses
// words of the ballot; one that misses the error frame shows a half answer as if it were whole.
test('readSse and sseStep: events split across chunks, the done frame, and the error frame', () => {
  const wire = 'data: {"t":"Hel"}\n\ndata: {"t":"lo"}\n\ndata: {"done":true,"charged":3000}\n\n';
  let acc = L.sseStep({}, {}), buf = '';
  for (let i = 0; i < wire.length; i += 7) {
    const got = L.readSse(buf + wire.slice(i, i + 7));
    buf = got.rest;
    for (const ev of got.events) acc = L.sseStep(acc, ev);
  }
  assert.deepEqual(acc, { text: 'Hello', done: true, charged: 3000, error: '' });
  let bad = L.sseStep({}, { t: 'part' });
  bad = L.sseStep(bad, { error: 'provider_error' });
  assert.equal(bad.done, false);
  assert.equal(bad.error, 'provider_error');
  assert.equal(L.sseStep(bad, { t: 'more' }).text, 'part', 'nothing is added after the end');
  assert.deepEqual(L.readSse('data: not json\n\n: comment\n\ndata: {"t":"x"}').events, [], 'bad lines are skipped; a part event waits');
});

// Why: each server refusal needs a different reaction (APP-CLIENT-PROPOSAL §3 error table). A wrong mapping shows an
// error for a policy change that must be quiet, blocks a judge whose own key would work, or hides the Buy rounds link.
test('hostedError: what the app does with each server refusal', () => {
  const e = (s, c) => L.hostedError(s, c);
  assert.deepEqual([e(401, 'signed_out').signOut, e(401, 'signed_out').fallback], [true, true]);
  assert.equal(e(402, 'no_credits').link.url, 'https://tabulaspeech.com/account/');
  assert.equal(e(402, 'no_credits').link.label, 'Buy rounds');
  assert.equal(e(402, 'no_credits').fallback, false, 'out of rounds: no silent switch to a paid key');
  assert.equal(e(402, 'plan_required').link.label, 'Buy rounds');
  assert.equal(e(402, 'round_cap').kind, 'roundCap');
  assert.equal(e(402, 'day_cap').kind, 'dayCap');
  assert.deepEqual([e(403, 'billing_hold').kind, e(403, 'billing_hold').fallback], ['billingHold', true]);
  assert.equal(e(403, 'policyOff').quiet, true);
  assert.equal(e(409, 'duplicate_call').quiet, true);
  assert.equal(e(403, 'bad_origin').kind, 'notAllowed');
  assert.deepEqual([e(429, 'slow_down').kind, e(429, 'slow_down').retryable], ['slowDown', true]);
  assert.equal(e(429, 'too_many_rounds').kind, 'tooManyRounds');
  assert.equal(e(413, 'prompt_too_large').kind, 'tooLarge');
  assert.deepEqual([e(503, 'busy').kind, e(503, 'busy').fallback], ['busy', true]);
  assert.equal(e(409, 'reload_app').kind, 'reload');
  assert.equal(e(0, 'provider_error').kind, 'noAnswer');
  for (const k of Object.keys(L.HOSTED_TEXT)) assert.doesNotMatch(L.HOSTED_TEXT[k], /\b(40\d|50\d|error code|_)\b/, k + ' shows a code');
});

// ---------- the page caller (js/ai.js), run with stubs ----------
const constLine = (name) => {
  const m = AI_SRC.match(new RegExp('^const ' + name + ' = .*$', 'm'));
  if (!m) throw new Error('no const ' + name);
  return m[0];
};
// fnSource matches braces from the first "{", which is the parameter list for a function that takes { ... }. This one
// starts after ") {", and keeps an "async" in front.
function pageFn(name) {
  const at = AI_SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no function ' + name);
  let i = AI_SRC.indexOf(') {', at) + 2, depth = 0;
  for (; i < AI_SRC.length; i++) {
    if (AI_SRC[i] === '{') depth++;
    else if (AI_SRC[i] === '}' && --depth === 0) break;
  }
  return (AI_SRC.slice(at - 6, at) === 'async ' ? 'async ' : '') + AI_SRC.slice(at, i + 1);
}
const PAGE = ['STOPPED', 'anonDocs', 'providerName', 'hostedOn', 'newCallId'].map(constLine).join('\n') + '\n'
  + ['withStop', 'aiError', 'asAIError', 'hostedFail', 'callHosted', 'hostedResult', 'callAI'].map(pageFn).join('\n');

const sse = (frames) => {
  const bytes = new TextEncoder().encode(frames.map((f) => 'data: ' + JSON.stringify(f) + '\n\n').join(''));
  return { ok: true, status: 200, body: { getReader: () => { let sent = false; return { read: async () => (sent ? { done: true } : (sent = true, { value: bytes, done: false })), cancel: async () => {} }; } } };
};
const refusal = (status, error) => ({ ok: false, status, json: async () => ({ error }), body: null });

// A page world: the gate, an optional own key (the subscription helper path), a fetch stub, and the toasts shown.
function world({ g, ownKey = false, answers }) {
  const calls = [], toasts = [], opened = [];
  let cleared = 0;
  const S = { aiEngine: ownKey ? 'claude-cli' : '', helper: { 'claude-cli': ownKey } };
  const R = round();
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === '/api/ai') return { ok: true, status: 200, json: async () => ({ text: 'own key answer' }) };
    return answers.shift();
  };
  const make = new Function('L', 'P', 'S', 'R', 'DOCS', 'capsGate', 'can', 'aiReady', 'noAiText', 'fetch', 'toast', 'clearCaps', 'navigator', 'window', 'console',
    PAGE + '\nreturn callAI;');
  const callAI = make(L, P, S, R, [], g, (f) => L.canUse(g, f), () => ownKey, () => L.NO_AI, fetch,
    (msg, o) => toasts.push({ msg, o }), () => { cleared++; }, { onLine: true }, { open: (u) => opened.push(u) }, { warn() {} });
  return { callAI, calls, toasts, opened, R, cleared: () => cleared };
}
const EVAL_CALL = { feature: 'liveEval', system: 'sys', prompt: 'p', schema: L.EVAL_SCHEMA, hosted: { job: 'eval' } };

// Why: the core promise of hosted AI. Names must not leave the device, the server's answer must come back as the JSON
// the feature draws (with names put back), and every call of a round must carry the same round id (the server's round
// budget keys on it) but a new call id (the server refuses a repeated one as a duplicate).
test('callAI with hosted access calls the server, sends no names, and returns the parsed answer', async () => {
  const answer = { leaning: '1A is ahead', summary: 's', key_issues: [], watch_for: [], aff_needs: '', neg_needs: '', feedback: [] };
  const w = world({ g: gate(record(ALL_SELF, true)), answers: [sse([{ t: JSON.stringify(answer).slice(0, 20) }, { t: JSON.stringify(answer).slice(20) }, { done: true, charged: 3000 }]), sse([{ t: '{}' }, { done: true, charged: 1 }])] });
  const out = await w.callAI(EVAL_CALL);
  assert.equal(out.leaning, 'Alice is ahead', 'roles go back to names on the device');
  await w.callAI(EVAL_CALL);
  assert.equal(w.calls.length, 2);
  assert.ok(w.calls.every((c) => c.url === '/api/v1/ai/eval.live'), 'never a provider');
  const [a, b] = w.calls.map((c) => JSON.parse(c.init.body));
  for (const name of ['Alice', 'Bobby', 'Carol', 'Dmitri', 'Lincoln AB', 'Central CD', 'Lincoln State Finals', 'Pat Judge']) {
    assert.ok(!w.calls[0].init.body.includes(name), 'the server got ' + name);
  }
  assert.match(a.state.transcript, /1A reads the plan/);
  assert.equal(a.roundId, w.R.id);
  assert.equal(b.roundId, a.roundId, 'one round id per round');
  assert.notEqual(b.callId, a.callId, 'a new call id per call');
  assert.equal(a.programId, PROG, 'the "Judging for" school');
});

// Why: a judge out of rounds must see plain words and a way to buy more, and must not be switched to a paid key in
// silence. Without the link, a judge who bought nothing yet has no path to the buy page from the round.
test('callAI out of credits: a plain error and a Buy rounds link to the account page', async () => {
  const w = world({ g: gate(record(ALL_SELF, true)), ownKey: true, answers: [refusal(402, 'no_credits')] });
  await assert.rejects(w.callAI(EVAL_CALL), (err) => err.message === L.HOSTED_TEXT.noCredits && err.hosted === 'noCredits');
  assert.equal(w.calls.length, 1, 'no fallback call to the own key');
  assert.equal(w.toasts.length, 1);
  assert.equal(w.toasts[0].o.action.label, 'Buy rounds');
  w.toasts[0].o.action.run();
  assert.deepEqual(w.opened, ['https://tabulaspeech.com/account/']);
});

// Why: when the session ends, the app must act signed out (AI-POLICY §6d): forget the record, and keep working with the
// judge's own key if there is one, instead of failing every AI call for the rest of the round.
test('callAI signed out: forgets the record and uses the own key when there is one', async () => {
  const w = world({ g: gate(record(ALL_SELF, true)), ownKey: true, answers: [refusal(401, 'signed_out')] });
  const out = await w.callAI({ ...EVAL_CALL, schema: null });
  assert.equal(out, 'own key answer');
  assert.equal(w.cleared(), 1);
  assert.deepEqual(w.calls.map((c) => c.url), ['/api/v1/ai/eval.live', '/api/ai']);
  const n = world({ g: gate(record(ALL_SELF, true)), answers: [refusal(401, 'signed_out')] });
  await assert.rejects(n.callAI(EVAL_CALL), (err) => err.message === L.HOSTED_TEXT.signedOut);
});

// Why: a school that turns a feature off mid-round must not put an error in front of the judge (AI-POLICY §6a); the
// callers treat "stopped" as quiet. A billing hold must not block a judge whose own key works (§3 error table).
test('callAI: policyOff stops quietly; billing_hold, slow_down and stream errors give plain words', async () => {
  const g = gate(record(ALL_SELF, true));
  await assert.rejects(world({ g, answers: [refusal(403, 'policyOff')] }).callAI(EVAL_CALL), (err) => err.kind === 'stopped');
  const hold = world({ g, ownKey: true, answers: [refusal(403, 'billing_hold')] });
  assert.equal(await hold.callAI({ ...EVAL_CALL, schema: null }), 'own key answer');
  await assert.rejects(world({ g, answers: [refusal(403, 'billing_hold')] }).callAI(EVAL_CALL), (err) => err.message === L.HOSTED_TEXT.billingHold);
  await assert.rejects(world({ g, answers: [refusal(429, 'slow_down')] }).callAI(EVAL_CALL), (err) => err.message === L.HOSTED_TEXT.slowDown && err.retryable);
  await assert.rejects(world({ g, answers: [sse([{ t: '{"lea' }, { error: 'provider_error' }])] }).callAI(EVAL_CALL), (err) => err.message === L.HOSTED_TEXT.noAnswer && err.retryable);
  await assert.rejects(world({ g, answers: [sse([{ t: 'not json' }, { done: true, charged: 1 }])] }).callAI(EVAL_CALL), (err) => err.message === L.HOSTED_TEXT.badReply);
  const big = world({ g, answers: [refusal(413, 'prompt_too_large')] });
  await assert.rejects(big.callAI(EVAL_CALL), (err) => err.status === 413, 'the live flow turns itself off on a 413');
});

// Why: own-key judges must keep today's app (the task brief). With no hosted access, nothing may go to the Tabula
// server; a call there would fail and could look like Tabula reads their rounds.
test('callAI without hosted access uses the own key and never calls the server', async () => {
  for (const g of [gate(null, null), gate(record(ALL_SELF, false))]) {
    const w = world({ g, ownKey: true, answers: [] });
    assert.equal(await w.callAI({ ...EVAL_CALL, schema: null }), 'own key answer');
    assert.deepEqual(w.calls.map((c) => c.url), ['/api/ai']);
  }
});

// Why: every AI feature must say which hosted job it is. A caller with no hosted job would ignore the judge's credits
// and say "No AI is connected" to a judge who paid.
test('every AI feature passes its hosted job to callAI', () => {
  const src = ['js/flow.js', 'js/insights.js', 'js/decide.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const calls = [...src.matchAll(/callAI\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(calls.length >= 4);
  for (const c of calls) assert.match(c, /hosted: \{ job: /, c.slice(0, 80));
});
