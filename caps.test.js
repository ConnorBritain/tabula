// Tests for the AI gate's pure rules (platform phase 1B). Spec: tabula-cloud docs/platform/CONTRACTS.md §2 and §5,
// docs/platform/BUILD-PLAN.md §3 1B, and docs/design/AI-POLICY.md §3 and §6. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const K = require('./keys.js');

// tabula-cloud's contract file (made by the real resolver): fixtures.<name> = { note, record }.
const FIX = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/platform-v2.json'), 'utf8')).fixtures).map(([k, v]) => [k, v.record]));
const rec = (name) => L.parseCaps(FIX[name]);
const NOW = 1795300000000;
const P = FIX['judge-self'].subject.programId;
const profileAs = (role) => ({ displayName: '', paradigm: '', programs: [{ id: P, name: 'Lincoln HS Debate', role }] });
const gateOf = (name, over) => L.gateFor(Object.assign({ record: rec(name), programId: name === 'solo' ? null : P, now: NOW, profile: null }, over));

// Why: the app must ask the v2 contract for its own product and school, or the server answers for the wrong one.
test('capsRequest: v=2, product=debate, and programId only for a school round', () => {
  assert.equal(L.capsRequest(null).url, '/api/v1/me/capabilities?v=2&product=debate');
  assert.equal(L.capsRequest(P).url, '/api/v1/me/capabilities?v=2&product=debate&programId=' + P);
  assert.equal(L.capsRequest(P).init.credentials, 'same-origin');
});

// Why: an absent key means hidden (no false, no reason field); a parser that kept unknown or bad keys could show a removed tool.
test('parseCaps: keeps only known keys with a real payer; refuses another version or product', () => {
  const r = L.parseCaps({ ...FIX['judge-self'], features: { liveEval: { payer: 'self' }, madeUp: { payer: 'self' }, aiFlow: { payer: 'nobody' }, analysis: false } });
  assert.deepEqual(r.features, { liveEval: { payer: 'self' } });
  assert.equal(L.parseCaps({ ...FIX['judge-self'], v: 1 }), null);
  assert.equal(L.parseCaps({ ...FIX['judge-self'], product: 'events' }), null);
  assert.equal(L.parseCaps(null), null);
});

// Why: only a 401 signs out and only not_member drops the school; any other error must keep the cached record (offline rounds).
test('capsOutcome: 200 in, 401 out, 403 not_member, anything else unknown', () => {
  assert.equal(L.capsOutcome(200, FIX.solo).state, 'in');
  assert.deepEqual(L.capsOutcome(401, null), { state: 'out' });
  assert.deepEqual(L.capsOutcome(403, { error: 'not_member' }), { state: 'notMember' });
  assert.deepEqual(L.capsOutcome(403, { error: 'bad_origin' }), { state: 'unknown' });
  assert.deepEqual(L.capsOutcome(500, null), { state: 'unknown' });
  assert.deepEqual(L.capsOutcome(200, { v: 1 }), { state: 'unknown' });
});

// Why: with no record at all the app must be today's solo app; a gate that hid AI here would break every solo judge.
test('gateFor: no record and a "Just me" round is solo, and solo allows everything', () => {
  const g = L.gateFor({ record: null, programId: null, now: NOW, profile: null });
  assert.equal(g.mode, 'solo');
  for (const f of L.APP_FEATURES) assert.equal(L.canUse(g, f), true);
  assert.equal(L.payerOf(g, 'liveEval'), 'self');
});

// Why: a record for this round is the whole answer; an absent key must hide the tool and the payer must match the record.
test('gateFor: a fresh record for this round is the answer', () => {
  const pool = gateOf('judge-pool');
  assert.equal(pool.mode, 'record');
  assert.equal(L.canUse(pool, 'ballotDraft'), true);
  assert.equal(L.payerOf(pool, 'ballotDraft'), 'program');
  const hidden = gateOf('coach-hidden');
  for (const f of L.APP_FEATURES) assert.equal(L.canUse(hidden, f), false, f);
  assert.equal(L.payerOf(hidden, 'liveEval'), null);
});

// Why: CONTRACTS §5 rule 6. With no usable record, a coach, admin or student round must hide all AI (fail closed for
// students), while a judge keeps their own AI (a judge's own AI is never removed).
test('gateFor: no usable record in a school round hides all AI unless the role there is judge', () => {
  for (const role of ['coach', 'admin', 'student']) assert.equal(L.gateFor({ record: null, programId: P, now: NOW, profile: profileAs(role) }).mode, 'none', role);
  assert.equal(L.gateFor({ record: null, programId: P, now: NOW, profile: profileAs('judge') }).mode, 'solo');
  assert.equal(L.gateFor({ record: null, programId: P, now: NOW, profile: null }).mode, 'none', 'role unknown: removes only');
  // A record for another round (the other school, or the own round) is not this round's answer.
  assert.equal(L.gateFor({ record: rec('judge-self'), programId: 'prog_other0001', now: NOW, profile: profileAs('coach') }).mode, 'none');
});

// Why: the managed-expired fixture is a managed student with an expired record and no network; showing AI there
// would let a student use tools the school removed.
test('gateFor: an expired record on a managed account hides all AI, in any round', () => {
  assert.equal(gateOf('managed-expired').mode, 'none');
  assert.equal(L.gateFor({ record: rec('managed-expired'), programId: null, now: NOW, profile: null }).mode, 'none');
  // An expired record that is not managed falls back to the solo app in a "Just me" round.
  assert.equal(L.gateFor({ record: { ...rec('solo'), expiresAt: NOW - 1 }, programId: null, now: NOW, profile: null }).mode, 'solo');
});

// Why: a managed student has no picker, so its own round must use its school's fresh record; ignoring it would hide
// AI the school allows, and an expired one must still fail closed.
test('gateFor: a managed account\'s fresh record covers its own round', () => {
  const g = L.gateFor({ record: rec('managed-allowed'), programId: null, now: NOW, profile: null });
  assert.equal(g.mode, 'record');
  assert.equal(L.canUse(g, 'aiFlow'), true);
  // A managed record that allows only some tools shows only those.
  const some = L.gateFor({ record: L.parseCaps({ ...FIX['managed-allowed'], features: { aiFlow: { payer: 'self' } } }), programId: null, now: NOW, profile: null });
  assert.equal(L.canUse(some, 'aiFlow'), true);
  assert.equal(L.canUse(some, 'liveEval'), false);
  assert.equal(L.gateFor({ record: rec('managed-expired'), programId: null, now: NOW, profile: null }).mode, 'none');
});

// Why: ?ai=off is the dev switch that proves the Flow-only look; it must hide everything whatever the record says.
test('gateFor: off hides all AI', () => {
  assert.equal(L.gateFor({ record: rec('judge-pool'), programId: P, now: NOW, off: true }).mode, 'none');
});

// Why: the key card must show to a judge who pays with their own key (also once a key is in, to manage it) and never
// when the school pays or hides AI; the Connect AI invite shows only while the device is not ready.
test('setupAllowed and showSetupFor: own AI only, and the invite only before a key', () => {
  assert.equal(L.setupAllowed(gateOf('judge-self')), true);
  assert.equal(L.showSetupFor(gateOf('judge-self'), false), true);
  assert.equal(L.showSetupFor(gateOf('judge-self'), true), false, 'a key is connected');
  assert.equal(L.setupAllowed(gateOf('judge-pool')), false, 'the school pays');
  assert.equal(L.setupAllowed(gateOf('coach-hidden')), false);
  assert.equal(L.showSetupFor(gateOf('coach-hidden'), false), false);
  assert.equal(L.setupAllowed(L.gateFor({ record: null, programId: null, now: NOW })), true, 'solo');
  assert.equal(L.setupAllowed({ ...gateOf('judge-self'), hosted: true }), false, 'a hosted plan never sees key setup');
});

// Why: these words drive the CSS that removes parts; a wrong word leaves a removed tool on screen or hides an allowed one.
test('offTokens: the features that are off, plus any, setup and invite', () => {
  assert.deepEqual(L.offTokens(gateOf('coach-hidden'), false), [...L.APP_FEATURES, 'any', 'setup', 'invite']);
  assert.deepEqual(L.offTokens(gateOf('judge-pool'), false), ['setup', 'invite']);
  assert.deepEqual(L.offTokens(gateOf('judge-self'), false), []);
  assert.deepEqual(L.offTokens(gateOf('judge-self'), true), ['invite']);
  assert.deepEqual(L.offTokens({ mode: 'record', features: { ballotDraft: { payer: 'self' } }, aiSetup: true, hosted: false }, true),
    ['transcription', 'aiFlow', 'liveEval', 'analysis', 'invite']);
});

// Why: with Live Eval removed, Insights must leave no pane and no edge (R2); a Connect AI edge there is a taunt.
test('insightsMode: none when Live Eval is removed or no invite may show; old callers unchanged', () => {
  assert.equal(L.insightsMode({ allowed: false, aiReady: true, hideRight: false }), 'none');
  assert.equal(L.insightsMode({ allowed: true, setup: false, aiReady: false }), 'none');
  assert.equal(L.insightsMode({ allowed: true, setup: true, aiReady: false }), 'edge-connect');
  assert.equal(L.insightsMode({ aiReady: false }), 'edge-connect');
  assert.equal(L.insightsMode({ aiReady: true, hideRight: true }), 'edge-show');
});

// Why: a tour step on a removed tool names it (R3); a step that only mentions one must lose those words, not the step.
test('visibleTourSteps: drops steps on removed parts and rewords steps that mention them', () => {
  const steps = [{ title: 'A', body: 'x' }, { title: 'B', feature: 'liveEval', body: 'y' }, { title: 'C', mentions: 'aiFlow', body: 'AI words', plainBody: 'plain' }];
  const none = () => false, all = () => true;
  assert.deepEqual(L.visibleTourSteps(steps, none).map((s) => [s.title, s.body]), [['A', 'x'], ['C', 'plain']]);
  assert.deepEqual(L.visibleTourSteps(steps, all).map((s) => [s.title, s.body]), [['A', 'x'], ['B', 'y'], ['C', 'AI words']]);
});

// Why: with every tour filtered by an empty gate, no step may still be on or about an AI part.
test('the real tours under an all-off gate keep no AI step or AI words', () => {
  const T = require('./tour.js');
  for (const [name, tour] of Object.entries(T.TOURS)) {
    for (const st of L.visibleTourSteps(tour.steps, () => false)) assert.doesNotMatch(st.body, /\bAI\b|transcri|Live Eval|Connect/i, name + ': ' + st.title);
  }
});

// Why: the palette and the shortcut sheet must not offer a removed tool (R3); the rest must stay.
test('buildCommands and shortcutRows: rows with a feature that is off are left out', () => {
  const ctx = { place: 'flow', cur: 0, sheets: ['Case'], sheetIdx: 0, speeches: [], insights: 'none', flowView: 'mine', online: true };
  const ids = (can) => K.buildCommands(Object.assign({}, ctx, { can })).map((r) => r.id);
  const off = ids(() => false), on = ids(() => true);
  for (const id of ['go.eval', 'transcript', 'flow.view', 'pane.insights', 'ballot.draft']) { assert.ok(on.includes(id), id); assert.ok(!off.includes(id), id); }
  assert.ok(off.includes('go.ballot') && off.includes('clock.toggle'));
  const keys = (can) => K.shortcutRows(true, true, '', can).flatMap((g) => g.rows.map((r) => r.id));
  assert.ok(keys(() => true).includes('pane.insights'));
  assert.ok(!keys(() => false).includes('pane.insights'));
});

// Why: if this fails, the app nags people about their own key or names a removed tool. The notice shows once, at join,
// only for a role whose AI is all hidden and who has a saved key, and its words name no feature.
test('keyNoticeDue and KEY_NOTICE: once per program, hidden roles with a saved key only, no feature named', () => {
  const st = { gate: gateOf('coach-hidden'), programId: P, hasSavedKey: true, shown: [] };
  assert.equal(L.keyNoticeDue(st), true);
  assert.equal(L.keyNoticeDue({ ...st, shown: [P] }), false, 'never again');
  assert.equal(L.keyNoticeDue({ ...st, hasSavedKey: false }), false);
  assert.equal(L.keyNoticeDue({ ...st, gate: gateOf('judge-pool') }), false, 'the school pays: AI is not hidden');
  assert.equal(L.keyNoticeDue({ ...st, gate: L.gateFor({ record: null, programId: null, now: NOW }) }), false, 'solo');
  const text = L.KEY_NOTICE('Lincoln HS Debate');
  assert.equal(text, 'Your saved key is paused in Lincoln HS Debate rounds. It stays on this device.');
  assert.doesNotMatch(text, /transcri|flow|eval|analysis|ballot|draft|\bAI\b/i);
});
