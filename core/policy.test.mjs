// Tests for the shared AI gate, core/policy.js (docs/events/LANDING.md §3, step C11). Run with: node --test
// Debate's gate rules keep their tests (ai-gate.test.mjs, ai-gate-dom.test.mjs, caps.test.js); they run through this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('./policy.js'); // a head file: it sets the global
const P = globalThis.TabulaCore.policy;
const EVENTS = { product: 'events', featureKeys: ['cleanup', 'coachSummary'] };
const NOW = 1_800_000_000_000;
const record = (product, features, extra) => Object.assign({ v: 2, product, features, subject: { role: 'judge', programId: 'p1' }, aiSetup: true, account: { hosted: false }, expiresAt: NOW + 60_000 }, extra);

// Why: Speech Events asks the same server for its own record; if the request said product=debate, it would get the
// debate answer and show or hide the wrong tools.
test('product=events: the request names events and a program when given', () => {
  assert.equal(P.capsRequest('events', null).url, '/api/v1/me/capabilities?v=2&product=events');
  assert.equal(P.capsRequest('events', 'p 1').url, '/api/v1/me/capabilities?v=2&product=events&programId=p%201');
});

// Why: a record is for one product only; reading a debate record as an events record would turn on tools the school
// never allowed for speech.
test('product=events: an events record is read with its own keys, and a debate record is refused', () => {
  const rec = P.parseCaps(record('events', { cleanup: { payer: 'program' }, aiFlow: { payer: 'self' } }), EVENTS);
  assert.deepEqual(rec.features, { cleanup: { payer: 'program' } }, 'a key outside the events contract is dropped');
  assert.equal(rec.product, 'events');
  assert.equal(P.parseCaps(record('debate', { cleanup: { payer: 'program' } }), EVENTS), null);
  assert.deepEqual(P.capsOutcome(200, record('debate', {}), EVENTS), { state: 'unknown' });
  assert.equal(P.capsOutcome(200, record('events', {}), EVENTS).state, 'in');
  assert.throws(() => P.parseCaps(record('events', {}), { product: 'events' }), /needs \{ product, featureKeys \}/, 'a missing argument names itself, not a TypeError deep inside');
  assert.throws(() => P.offTokens(P.gateFor({}), false), /needs the app/);
});

// Why: the gate decides what a speech judge sees; it must give the same answers for events as it does for debate.
test('product=events: the gate, setup and the data-ai-off words work over the events features', () => {
  const rec = P.parseCaps(record('events', { cleanup: { payer: 'program' } }), EVENTS);
  const gate = P.gateFor({ record: rec, programId: 'p1', now: NOW });
  assert.equal(gate.mode, 'record');
  assert.equal(P.canUse(gate, 'cleanup'), true);
  assert.equal(P.canUse(gate, 'coachSummary'), false);
  assert.equal(P.payerOf(gate, 'cleanup'), 'program');
  assert.deepEqual(P.offTokens(gate, false, EVENTS.featureKeys), ['coachSummary']);
  assert.deepEqual(P.offTokens(P.gateFor({ off: true }), false, EVENTS.featureKeys), ['cleanup', 'coachSummary', 'any', 'setup', 'invite']);
  assert.equal(P.keyNoticeDue({ gate: P.gateFor({ record: P.parseCaps(record('events', {}), EVENTS), programId: 'p1', now: NOW }), programId: 'p1', hasSavedKey: true }, EVENTS.featureKeys), true);
});

// Why: debate's tests check the gate through PolicyLogic; a second copy there would let them pass on code the shared
// gate does not run.
test('PolicyLogic uses the shared gate functions', () => {
  const L = require('../logic.js');
  for (const k of ['gateFor', 'canUse', 'payerOf', 'setupAllowed', 'showSetupFor', 'visibleTourSteps']) assert.equal(L[k], P[k], k);
  assert.equal(L.capsRequest(null).url, '/api/v1/me/capabilities?v=2&product=debate');
});
