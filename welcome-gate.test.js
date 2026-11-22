// The first-time welcome and hosted plans (staging QA 2026-11-22, finding 3): a signed-in paid judge got the "Connect
// an AI key" welcome, because the welcome read a stub (hasHostedPlan() was always false) and opened before the
// capabilities answer came back. Spec: docs/design/SPEC.md 2.1 (Q11). Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { fnSource } = require('./test-fn-source.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
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

// ---------- the pure rule ----------

// Why: a paid judge who is shown the key welcome thinks they bought nothing and may paste a key they do not need.
test('hasHostedPlan: true for a paid account and for a school that pays; false with no record or a free account', () => {
  assert.equal(L.hasHostedPlan(gate(record(ALL_SELF, true))), true, 'own credits (plan paid, hosted true)');
  assert.equal(L.hasHostedPlan(gate(record(ALL_SCHOOL, false))), true, 'the school pays');
  assert.equal(L.hasHostedPlan(gate(record(ALL_SELF, false))), false, 'a free account still sets up its own AI');
  assert.equal(L.hasHostedPlan(gate(null, null)), false, 'no record: the solo app');
  assert.equal(L.hasHostedPlan(null), false);
});

// Why: the paid judge from the QA report (capabilities 200, plan paid, hosted true) must start with no welcome at all.
test('shouldShowWelcome with the real gate: a paid judge on a new device gets no welcome; a free judge still does', () => {
  assert.equal(L.shouldShowWelcome({ setupDone: false, hostedPlan: L.hasHostedPlan(gate(record(ALL_SELF, true))) }), false);
  assert.equal(L.shouldShowWelcome({ setupDone: false, hostedPlan: L.hasHostedPlan(gate(record(ALL_SELF, false))) }), true);
  assert.equal(L.shouldShowWelcome({ setupDone: false, hostedPlan: L.hasHostedPlan(gate(null, null)) }), true);
});

// ---------- the start-up timing (js/help.js welcomeWhenKnown), run with stubs ----------
// A page world: capsGate starts as the first paint saw it (no cache: solo), the account check may change it.
function world(first) {
  const out = { opened: 0, noted: 0, timers: [] };
  const env = {
    L, S: { setupDone: false }, capsGate: first,
    openWelcome: () => { out.opened++; }, maybeD2Note: () => { out.noted++; },
    setTimeout: (fn, ms) => { out.timers.push({ fn, ms }); return out.timers.length; },
  };
  const src = 'async ' + fnSource(read('js/help.js'), 'welcomeWhenKnown');
  const run = new Function(...Object.keys(env), 'setGate', 'return [' + src + ', (g) => { capsGate = g; }];');
  const [welcomeWhenKnown, setGate] = run(...Object.values(env));
  return { out, welcomeWhenKnown, setGate };
}
const flush = () => new Promise((r) => setImmediate(r));

// Why: capabilities arrive after the first paint; opening at once flashed the key welcome at a paid judge.
test('welcomeWhenKnown waits for the account check, and a paid answer means no welcome', async () => {
  const w = world(gate(null, null));
  let answer;
  const settled = new Promise((r) => { answer = r; });
  const done = w.welcomeWhenKnown(settled);
  await flush();
  assert.equal(w.out.opened, 0, 'nothing opens before the account check answers');
  w.setGate(gate(record(ALL_SELF, true)));
  answer();
  await done;
  assert.equal(w.out.opened, 0, 'a paid judge never sees the key welcome');
  assert.equal(w.out.noted, 1, 'the one-time AI note path runs instead');
});

// Why: a free or signed-out judge must still get the welcome, or they never learn AI is optional (spec 2.1).
test('welcomeWhenKnown opens the welcome for a free judge once the check answers', async () => {
  const w = world(gate(null, null));
  await w.welcomeWhenKnown(Promise.resolve());
  assert.equal(w.out.opened, 1);
});

// Why: offline at a tournament, or on the local helper, the account check may never answer; the welcome must not
// wait forever, but only up to the set limit.
test('welcomeWhenKnown gives up waiting after L.WELCOME_WAIT_MS and then opens for a free judge', async () => {
  const w = world(gate(null, null));
  const done = w.welcomeWhenKnown(new Promise(() => {}));
  await flush();
  assert.equal(w.out.opened, 0);
  assert.equal(w.out.timers.length, 1);
  assert.equal(w.out.timers[0].ms, L.WELCOME_WAIT_MS);
  assert.ok(L.WELCOME_WAIT_MS > 0 && L.WELCOME_WAIT_MS <= 8000, 'never longer than the account fetch timeout');
  w.out.timers[0].fn();
  await done;
  assert.equal(w.out.opened, 1);
});

// ---------- the wiring ----------

// Why: if the start-up check resolved before the capabilities answer, the welcome would still read the old gate.
test('the start-up account check resolves only after the capabilities answer, and app.js waits on it', () => {
  const acct = read('js/account.js');
  assert.match(fnSource(acct, 'refreshProfile'), /await refreshCaps\(/);
  assert.match(acct, /^const acctBoot = refreshProfile\(\);$/m);
  const app = read('app.js');
  assert.match(app, /welcomeWhenKnown\(acctBoot\)/);
  assert.doesNotMatch(app, /openWelcome\(\)/, 'app.js no longer opens the welcome before the answer');
});
