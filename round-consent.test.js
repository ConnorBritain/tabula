// Using a round: ask first or automatic, and rounds left (docs/design/AI-ROUND-CONSENT.md; owner, 2026-11-22).
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { fnSource } = require('./test-fn-source.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const PROG = 'prog_lincoln01';
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
const ROUND = (state) => L.parseRound({ state, draftsLeft: {} });

// ---------- the pure rules ----------

// Why: "Ask me first" must stop the first AI call of a round until the judge says yes, or a round is spent unasked;
// and it must never ask again once the server has used the round, or the judge is nagged mid-round.
test('consentStep: asks only before the round is used, only for the judge\'s own rounds, and honors the answer', () => {
  const ask = { mode: 'ask', selfPaid: true };
  assert.equal(L.consentStep(ask), 'ask', 'no round yet');
  assert.equal(L.consentStep({ ...ask, round: ROUND('open') }), 'ask', 'open: reserved, not used');
  for (const s of ['active', 'idle', 'free', 'closed']) assert.equal(L.consentStep({ ...ask, round: ROUND(s) }), 'go', s);
  assert.equal(L.consentStep({ ...ask, consent: 'yes' }), 'go');
  assert.equal(L.consentStep({ ...ask, consent: 'no' }), 'off');
  assert.equal(L.consentStep({ mode: 'auto', selfPaid: true }), 'go', 'automatic');
  assert.equal(L.consentStep({ mode: 'ask', selfPaid: false }), 'go', 'a school pays: its policy decides');
  assert.equal(L.consentStep({ selfPaid: true }), 'ask', 'no setting yet: Ask me first is the default');
  assert.equal(L.roundMode('weird'), 'ask');
});

// Why: the judge decides on the numbers in the question; a wrong "you will have" count misleads them about money.
test('consentAsk: says what the round uses and what is left after', () => {
  assert.deepEqual(L.consentAsk(5), { title: 'Use 1 round of AI?', body: ['This round uses 1 of your 5 rounds. You will have 4 left.', 'The clock, flow and ballot are free either way.'] });
  assert.equal(L.consentAsk(2).body[0], 'This round uses 1 of your 2 rounds. You will have 1 left.');
  assert.equal(L.consentAsk(1).body[0], 'This round uses your last round.');
  assert.equal(L.consentAsk(null).body[0], 'This round uses 1 of your rounds.', 'unknown balance: no number');
  assert.equal(L.consentStep({ mode: 'ask', selfPaid: true, roundsLeft: 0 }), 'go', 'no rounds left: no dead-end question');
});

// Why: the page holds the server state of the round it last read; if a new round (or a failed read) let an old
// round's "active" stand, an "Ask me first" judge would spend a round with no question.
test('roundConsent: another round\'s server state never skips the question', async () => {
  const w = world({ mode: 'ask', round: ROUND('active'), roundId: 'old-round' });
  assert.equal(await w.roundConsent('aiFlow'), true);
  assert.equal(w.asked.length, 1);
});

// Why: an answer given after the round changed must not land on the new round.
test('askRoundConsent drops an answer when the round changed while the question was open', async () => {
  const w = world({ mode: 'ask' });
  const p = w.roundConsent('aiFlow');
  w.env.R.id = 'r2';
  assert.equal(await p, false);
  assert.equal(w.env.R.aiConsent, undefined);
});

// Why: a pill that says 0 when the meter could not be read would send a paid judge to buy rounds they have.
test('roundsLeftText and parseLimits: unknown shows nothing, never 0', () => {
  assert.equal(L.roundsLeftText(5), '5 rounds left');
  assert.equal(L.roundsLeftText(1), '1 round left');
  assert.equal(L.roundsLeftText(0), 'No rounds left');
  assert.equal(L.roundsLeftText(null), '');
  const base = { v: 1, limits: { timeLimitMin: 180 }, round: null };
  assert.equal(L.parseLimits({ ...base, roundsLeft: 3 }, 1).roundsLeft, 3);
  for (const bad of [undefined, null, -1, 2.5, '3']) assert.equal(L.parseLimits({ ...base, roundsLeft: bad }, 1).roundsLeft, null, String(bad));
});

// Why: after "Not this round" the judge must see that AI is off and have one tap to turn it on, or AI seems broken.
test('consentLine: "AI is off for this round." with a Turn on AI button, only after a no and before the round is used', () => {
  assert.deepEqual(L.consentLine({ selfPaid: true, consent: 'no' }), { text: 'AI is off for this round.', turnOn: true });
  assert.equal(L.consentLine({ selfPaid: true, consent: 'yes' }), null);
  assert.equal(L.consentLine({ selfPaid: true, consent: 'no', round: ROUND('active') }), null);
  assert.equal(L.consentLine({ selfPaid: false, consent: 'no' }), null);
});

// Why: rounds left and the question are about the judge's own money; a school-paid judge must not see either.
test('selfPays and selfPaidHosted: true only when a hosted feature is paid from the judge\'s own rounds', () => {
  assert.equal(L.selfPays(gate(record(ALL_SELF, true)), 'aiFlow'), true);
  assert.equal(L.selfPays(gate(record({ ...ALL_SELF, aiFlow: { payer: 'program' } }, true)), 'aiFlow'), false, 'mixed: the school pays for this one');
  assert.equal(L.selfPays(gate(record(ALL_SELF, false)), 'aiFlow'), false, 'not hosted: own key');
  assert.equal(L.selfPaidHosted(gate(record(ALL_SELF, true))), true);
  assert.equal(L.selfPaidHosted(gate(record(ALL_SCHOOL, false))), false);
  assert.equal(L.selfPaidHosted(gate(record(ALL_SELF, false))), false, 'free account: own key, no rounds');
  assert.equal(L.selfPaidHosted(gate(null, null)), false);
});

// ---------- the page: roundConsent (js/limits.js), run with stubs ----------
// A page world for js/consent.js. roundId: the round the server state belongs to (default: this round).
function world({ mode, roundsLeft = 5, round = null, roundId = 'r1', answer = 'yes', features = ALL_SELF } = {}) {
  const out = { asked: [], toasts: [], saved: 0 };
  const R = { id: 'r1' };
  const hostedLimits = { limits: {}, skew: 0, round, roundId, roundsLeft };
  const env = {
    L, S: { aiRoundMode: mode }, R, hostedLimits, capsGate: gate(record(features, true)),
    thisRound: () => (hostedLimits.roundId === R.id ? hostedLimits.round : null),
    save: () => { out.saved++; }, saveSettings: () => {}, renderHostedRound: () => {}, renderRoundsLeft: () => {},
    toast: (m, o) => out.toasts.push({ m, o }),
    ask: (q) => { out.asked.push(q); return new Promise((done) => setImmediate(() => done(answer))); },
  };
  const src = read('js/consent.js');
  const code = 'let consentWait = null;\n' + ['roundConsent', 'askRoundConsent'].map((n) => 'async ' + fnSource(src, n)).join('\n')
    + '\n' + ['offerAutomatic', 'setAutomatic'].map((n) => fnSource(src, n)).join('\n') + '\nreturn roundConsent;';
  out.roundConsent = new Function(...Object.keys(env), code)(...Object.values(env));
  out.env = env;
  return out;
}

// Why: live flow and Live Eval can start together; two questions for one round would confuse the judge.
test('roundConsent: one question for calls made together; a yes is kept with the round', async () => {
  const w = world({ mode: 'ask' });
  const [a, b] = await Promise.all([w.roundConsent('aiFlow'), w.roundConsent('liveEval')]);
  assert.deepEqual([a, b], [true, true]);
  assert.equal(w.asked.length, 1);
  assert.equal(w.asked[0].title, 'Use 1 round of AI?');
  assert.match(w.asked[0].body[0], /1 of your 5 rounds\. You will have 4 left\./);
  assert.equal(w.asked[0].cancelValue, 'no', 'Esc or x means Not this round');
  assert.equal(w.env.R.aiConsent, 'yes');
  assert.equal(await w.roundConsent('analysis'), true);
  assert.equal(w.asked.length, 1, 'not asked again in this round');
  assert.equal(w.toasts.length, 1, 'the one-time offer to go automatic');
  assert.equal(w.toasts[0].o.action.label, 'Always use AI automatically');
  w.toasts[0].o.action.run();
  assert.equal(w.env.S.aiRoundMode, 'auto');
});

// Why: "Not this round" must send nothing for the rest of the round, or the round is spent after the judge said no.
test('roundConsent: Not this round blocks every call in the round without asking again', async () => {
  const w = world({ mode: 'ask', answer: 'no' });
  assert.equal(await w.roundConsent('aiFlow'), false);
  assert.equal(w.env.R.aiConsent, 'no');
  assert.equal(await w.roundConsent('liveEval'), false);
  assert.equal(w.asked.length, 1);
  assert.equal(w.toasts.length, 0);
});

// Why: judges who chose automatic, school-paid judges, rounds already in use, and judges with no rounds left (the
// server's Buy rounds refusal says it) must never see the question.
test('roundConsent: no question when automatic, when a school pays, or when the round is in use', async () => {
  for (const w of [world({ mode: 'auto' }), world({ mode: 'ask', features: ALL_SCHOOL }), world({ mode: 'ask', round: ROUND('active') }), world({ mode: 'ask', roundsLeft: 0 })]) {
    assert.equal(await w.roundConsent('aiFlow'), true);
    assert.equal(w.asked.length, 0);
  }
});

// ---------- the wiring ----------

// Why: the check must run before the request leaves, or "Not this round" would still reserve the round on the server.
test('callHosted asks before the fetch, and callAI passes the feature', () => {
  const ai = read('js/ai.js');
  const body = ai.slice(ai.indexOf('async function callHosted('), ai.indexOf('function hostedResult('));
  const check = body.indexOf('if (!(await roundConsent(feature))) throw STOPPED();');
  assert.ok(check > 0);
  assert.ok(check < body.indexOf('await fetch(req.url'));
  assert.ok(ai.includes('await callHosted({ job: hosted.job, extra: Object.assign({}, hosted.extra, { reading, aiPreferences: preferences }), signal, feature })'));
});

// Why: moving the round code once dropped the "Turn AI back on" handler; an idle-paused round could not be resumed.
test('the Turn AI back on button still has its handler, and it reads this round\'s state', () => {
  const src = read('js/limits.js');
  const at = src.indexOf("e.target.closest('#ai-resume')");
  assert.ok(at > 0);
  const block = src.slice(src.lastIndexOf("document.addEventListener('click'", at), src.indexOf('});', at));
  assert.match(block, /const r = thisRound\(\);/);
  assert.match(block, /hostedResume = true;/);
  assert.match(block, /setHostedRound\(L\.resumedRound\(r\)\);/);
});

// Why: a judge who never opened Settings must get "Ask me first", the safe default for their money.
test('the setting defaults to Ask me first, and Settings has both choices', () => {
  assert.match(read('js/settings.js'), /S\.aiRoundMode = L\.roundMode\(S\.aiRoundMode\);/);
  assert.match(read('js/core.js'), /aiConsent: null \}\); \/\/ a saved file never brings/, 'an opened file never brings a yes');
  const html = read('index.html');
  assert.match(html, /name="round-mode" value="ask"> <span><strong>Ask me first<\/strong>/);
  assert.match(html, /name="round-mode" value="auto"> <span><strong>Use AI automatically<\/strong>/);
  assert.match(html, /id="rounds-pill"/);
  assert.match(html, /id="ai-consent-on"/);
});
