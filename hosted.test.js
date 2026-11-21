// Tests for the hosted AI caller: AI features call the Tabula server (POST /api/v1/ai/<task>) when the account has
// hosted access. Spec: tabula-cloud docs/APP-CLIENT-PROPOSAL.md §2, §3 and §3a. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const P = require('./providers.js');

const AI_SRC = ['js/ai.js', 'js/limits.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
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
const ALL_SCHOOL = { aiFlow: { payer: 'program' }, liveEval: { payer: 'program' }, analysis: { payer: 'program' }, ballotDraft: { payer: 'program' } };

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
  assert.deepEqual(acc, { text: 'Hello', done: true, error: '', round: null });
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
const PAGE = 'let hostedLimits = null, hostedResume = false, rendered = 0;\nfunction renderHostedRound() { rendered++; }\n'
  + ['STOPPED', 'anonDocs', 'providerName', 'useHosted', 'newCallId', 'hostedNow'].map(constLine).join('\n') + '\n'
  + ['withStop', 'aiError', 'asAIError', 'hostedFail', 'setHostedRound', 'callHosted', 'hostedResult', 'callAI'].map(pageFn).join('\n');

const sse = (frames) => {
  const bytes = new TextEncoder().encode(frames.map((f) => 'data: ' + JSON.stringify(f) + '\n\n').join(''));
  return { ok: true, status: 200, body: { getReader: () => { let sent = false; return { read: async () => (sent ? { done: true } : (sent = true, { value: bytes, done: false })), cancel: async () => {} }; } } };
};
const refusal = (status, error) => ({ ok: false, status, json: async () => ({ error }), body: null });

// A page world: the gate, an optional own key (the subscription helper path), a fetch stub, and the toasts shown.
function world({ g, ownKey = false, answers, host }) {
  const calls = [], toasts = [], opened = [];
  let cleared = 0;
  const S = { aiEngine: ownKey ? 'claude-cli' : '', helper: { 'claude-cli': ownKey } };
  const R = round();
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === '/api/ai') return { ok: true, status: 200, json: async () => ({ text: 'own key answer' }) };
    return answers.shift();
  };
  const make = new Function('L', 'P', 'S', 'R', 'DOCS', 'capsGate', 'can', 'aiReady', 'noAiText', 'fetch', 'toast', 'clearCaps', 'navigator', 'window', 'console', 'location',
    PAGE + '\nreturn [callAI, () => hostedLimits, (v) => { hostedLimits = v; }];');
  const [callAI, limits, setLimits] = make(L, P, S, R, [], g, (f) => L.canUse(g, f), () => ownKey, () => L.NO_AI, fetch,
    (msg, o) => toasts.push({ msg, o }), () => { cleared++; }, { onLine: true }, { open: (u) => opened.push(u) }, { warn() {} }, { host: host || 'debate.tabulaspeech.com' });
  return { callAI, calls, toasts, opened, R, cleared: () => cleared, limits, setLimits };
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
  const w = world({ g: gate(record(ALL_SCHOOL, true)), ownKey: true, answers: [refusal(402, 'no_credits')] });
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
  const w = world({ g: gate(record(ALL_SCHOOL, false)), ownKey: true, answers: [refusal(401, 'signed_out')] });
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
  const hold = world({ g: gate(record(ALL_SCHOOL, false)), ownKey: true, answers: [refusal(403, 'billing_hold')] });
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

// Why: "own key stays as it is when chosen" (task brief). A judge who connected their own key and pays for AI
// themselves must not have credits spent behind their back; a school that pays still runs hosted, since it pays.
test('callAI: an own key the judge connected wins over their own credits, not over a school that pays', async () => {
  const mine = world({ g: gate(record(ALL_SELF, true)), ownKey: true, answers: [] });
  assert.equal(await mine.callAI({ ...EVAL_CALL, schema: null }), 'own key answer');
  assert.deepEqual(mine.calls.map((c) => c.url), ['/api/ai'], 'no credits spent');
  assert.equal(L.useHosted(gate(record(ALL_SELF, true)), 'liveEval', false), true, 'no key: own credits are used');
  const school = world({ g: gate(record(ALL_SCHOOL, false)), ownKey: true, answers: [sse([{ t: 'school answer' }, { done: true }])] });
  assert.equal(await school.callAI({ ...EVAL_CALL, schema: null }), 'school answer');
  assert.deepEqual(school.calls.map((c) => c.url), ['/api/v1/ai/eval.live']);
});

// Why: every AI feature must say which hosted job it is. A caller with no hosted job would ignore the judge's credits
// and say "No AI is connected" to a judge who paid.
test('every AI feature passes its hosted job to callAI', () => {
  const src = ['js/flow.js', 'js/insights.js', 'js/decide.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const calls = [...src.matchAll(/callAI\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(calls.length >= 4);
  for (const c of calls) assert.match(c, /hosted: \{ job: /, c.slice(0, 80));
});

// ---------- round limits (Terms §6.4: "The app shows the current limits") ----------
const ROUND = (o) => L.parseRound(Object.assign({ state: 'active', firstSpeechAt: 1, endsAt: null, idleAt: null, freeReason: null, draftsLeft: { ballot: true, decision: true } }, o));

// Why: the Terms promise the app shows the current limits, and the limits may change. Numbers baked into the app would
// show old limits after a change; a missing route must show nothing rather than made-up limits.
test('limitsLines shows exactly the limits the server sent, and nothing without an answer', () => {
  const a = L.parseLimits({ v: 1, now: 1000, limits: { timeLimitMin: 90, idleMin: 10, coverRounds: 2 }, round: null }, 400);
  assert.equal(a.skew, 600);
  const text = L.limitsLines(a.limits).join(' ');
  assert.match(text, /up to 1 hour 30 minutes from the first recorded speech/);
  assert.match(text, /after 10 minutes with no new speech/);
  assert.match(text, /up to 2 more rounds/);
  assert.match(text, /clock, flow and ballot keep working/);
  assert.equal(L.parseLimits({ error: 'not_found' }, 1), null);
  assert.equal(L.parseLimits({ v: 1, limits: {} }, 1), null);
  assert.deepEqual(L.limitsLines(null), []);
});

// Why: a guard. The limits live in server config (round budget spec). A stopgap number written into the app would be
// shown as "the current limit" even after the owner changes it.
test('the app source has no limit values of its own', () => {
  const src = ['js/ai.js', 'js/limits.js', 'logic/hosted.js', 'logic/limits.js', 'index.html'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  for (const re of [/3 hours/, /20 minutes/, /\b180\b/, /ROUND_IDLE|ROUND_TIME_LIMIT|ABSORB_CAP/]) assert.doesNotMatch(src, re);
});

// Why: the judge must see where the round stands (Terms §6.4): time left, a pause they can lift with one tap, or a
// reached limit with the free tools named. A wrong state hides the resume tap or claims AI is on when it is not.
test('roundLine: time left, paused with a tap, limit reached, ended', () => {
  const now = 1_000_000;
  assert.deepEqual(L.roundLine(ROUND({ endsAt: now + 125 * 60000 }), now), { text: 'AI: 2 hours 5 minutes left this round', resume: false });
  assert.equal(L.roundLine(ROUND({ state: 'open' }), now), null, 'before the first speech: nothing');
  assert.deepEqual(L.roundLine(ROUND({ endsAt: now + 3600e3, idleAt: now - 1 }), now), { text: 'AI paused: no new speech for a while', resume: true }, 'a pause shows when it starts');
  assert.match(L.roundLine(ROUND({ endsAt: now - 1 }), now).text, /AI time is up for this round/, 'the time limit shows when it passes');
  assert.match(L.roundLine(ROUND({ state: 'free' }), now).text, /Clock, flow and ballot keep working\. The ballot draft still runs once\./);
  assert.doesNotMatch(L.roundLine(ROUND({ state: 'free', draftsLeft: { ballot: false, decision: false } }), now).text, /still runs once/);
  assert.match(L.roundLine(ROUND({ state: 'closed' }), now).text, /AI has ended for this round/);
});

// Why: after a limit only the ballot draft may run, once (Terms §6.4). Sending other calls wastes requests the server
// refuses; blocking the ballot draft breaks a promise in the Terms.
test('roundBlocks: a pause blocks all AI; after a limit only the ballot draft runs, once', () => {
  const now = 5;
  assert.equal(L.roundBlocks('flow', ROUND({}), now), '');
  assert.equal(L.roundBlocks('flow', null, now), '', 'no limits answer: the server decides');
  assert.equal(L.roundBlocks('ballot', ROUND({ state: 'idle' }), now), 'round_idle');
  assert.equal(L.roundBlocks('eval', ROUND({ state: 'free' }), now), 'free_mode');
  assert.equal(L.roundBlocks('ballot', ROUND({ state: 'free' }), now), '');
  assert.equal(L.roundBlocks('ballot', ROUND({ state: 'free', draftsLeft: { ballot: false, decision: false } }), now), 'free_mode');
  assert.equal(L.roundBlocks('ballot', ROUND({ state: 'closed' }), now), '');
  const e = L.hostedError(409, 'round_idle');
  assert.deepEqual([e.kind, e.roundState, e.fallback], ['roundIdle', 'idle', true]);
  assert.deepEqual([L.hostedError(409, 'free_mode').roundState, L.hostedError(409, 'round_closed').roundState], ['free', 'closed']);
  assert.equal(L.hostedError(402, 'extras_spent').kind, 'extrasSpent', 'not "out of rounds"');
  assert.equal(L.hostedError(402, 'extras_spent').link, null);
});

// Why: the server lifts an idle pause only when the call says the judge tapped. Without the flag the tap does nothing;
// with it on every call, the idle limit never pauses anything.
test('hostedRequest sends resume only when the judge tapped', () => {
  const r = round();
  assert.equal(JSON.parse(L.hostedRequest(r, 'flow', {}, 'call-0005eeee').init.body).resume, undefined);
  assert.equal(JSON.parse(L.hostedRequest(r, 'flow', {}, 'call-0006ffff', true).init.body).resume, true);
});

// Why: the bar must follow the server: the round state on the last frame updates it, an idle refusal shows the pause,
// and while paused the app sends nothing more until the tap.
test('callAI keeps the round state from the server and stops asking while paused', async () => {
  const g = gate(record(ALL_SCHOOL, false));
  const w = world({ g, answers: [sse([{ t: 'ok' }, { done: true, round: { state: 'active', endsAt: Date.now() + 3600e3, draftsLeft: {} } }]), refusal(409, 'round_idle')] });
  await w.callAI({ ...EVAL_CALL, schema: null });
  assert.equal(w.limits().round.state, 'active');
  await assert.rejects(w.callAI({ ...EVAL_CALL, schema: null }), (err) => err.message === L.HOSTED_TEXT.roundIdle);
  assert.equal(w.limits().round.state, 'idle');
  await assert.rejects(w.callAI({ ...EVAL_CALL, schema: null }), (err) => err.message === L.HOSTED_TEXT.roundIdle);
  assert.equal(w.calls.length, 2, 'no request while paused');
  const free = world({ g, answers: [sse([{ t: 'draft' }, { done: true }])] });
  free.setLimits({ limits: {}, skew: 0, round: ROUND({ state: 'free' }) });
  await assert.rejects(free.callAI({ ...EVAL_CALL, schema: null }), (err) => err.message === L.HOSTED_TEXT.freeMode);
  assert.equal(await free.callAI({ feature: 'ballotDraft', system: 's', prompt: 'p', schema: null, hosted: { job: 'ballot', extra: {} } }), 'draft', 'the ballot draft still runs once');
});

// Why: the resume tap must lift only the pause. If it hid a reached limit, the judge would be told AI is back when the
// server will refuse; if it kept a predicted pause, the tap would do nothing on screen.
test('resumedRound clears only a pause; roundAfterRefusal follows the server', () => {
  const now = 10;
  const paused = L.resumedRound(ROUND({ endsAt: now + 3600e3, idleAt: now - 1 }));
  assert.match(L.roundLine(paused, now).text, /left this round/, 'a pause shown from idleAt is lifted');
  assert.equal(L.resumedRound(ROUND({ state: 'idle' })).state, 'active');
  assert.equal(L.resumedRound(ROUND({ state: 'free' })).state, 'free', 'a reached limit stays');
  assert.equal(L.roundBlocks('flow', ROUND({ endsAt: now + 3600e3, idleAt: now - 1 })), '', 'a predicted pause still asks the server');
  assert.equal(L.roundAfterRefusal(ROUND({ endsAt: 99 }), 'free', { round: { state: 'closed', draftsLeft: { ballot: true } } }).state, 'closed', 'the server round wins');
  assert.deepEqual([L.roundAfterRefusal(ROUND({ endsAt: 99 }), 'idle', {}).state, L.roundAfterRefusal(ROUND({ endsAt: 99 }), 'idle', {}).endsAt], ['idle', 99]);
  assert.equal(L.roundAfterRefusal(null, '', {}), null);
  assert.match(L.roundLine(ROUND({ state: 'free', freeReason: 'cover' }), now).text, /used all the AI we cover\. The live AI flow, Live Eval and Analysis are off\./);
});

// Why: a test purchase on the staging site must open the staging account page (Stripe test mode). A link to the live
// page from staging would take a tester's real card; a staging link in production would send real buyers to a test page.
test('the Buy rounds link follows the site the app runs on', async () => {
  assert.equal(L.accountUrl('debate.tabulaspeech.com'), 'https://tabulaspeech.com/account/');
  assert.equal(L.accountUrl('debate.tabulaspeech.dev'), 'https://tabulaspeech.dev/account/');
  assert.equal(L.accountUrl('localhost:8765'), 'https://tabulaspeech.com/account/', 'anything else: production');
  assert.equal(L.accountUrl('evil-tabulaspeech.dev'), 'https://tabulaspeech.com/account/', 'only the real domain or its subdomains');
  const w = world({ g: gate(record(ALL_SCHOOL, true)), answers: [refusal(402, 'no_credits')], host: 'debate.tabulaspeech.dev' });
  await assert.rejects(w.callAI(EVAL_CALL));
  w.toasts[0].o.action.run();
  assert.deepEqual(w.opened, ['https://tabulaspeech.dev/account/']);
  assert.equal(L.hostedError(402, 'age_required', L.accountUrl('debate.tabulaspeech.dev')).link.url, 'https://tabulaspeech.dev/account/', 'Open account too');
});
