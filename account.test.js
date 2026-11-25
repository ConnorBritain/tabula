// Tests for the Tabula account in the app (roles plan step 3): "Judging for" and the account paradigm.
// Spec: the server's accounts and roles plan (step 3) and the server API's app client contract.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const { APP_FILES, readSource } = require('./test-sources.js');

const ID_A = 'prog_lincoln01', ID_B = 'prog_central02';
const PROFILE = { displayName: 'Sam', paradigm: 'Tech over truth.', photo: null, programs: [{ id: ID_A, name: 'Lincoln High', role: 'judge' }, { id: ID_B, name: 'Central', role: 'coach' }] };

// Why: a malformed or hostile profile answer must not put a broken school in the picker or crash the page at start.
test('parseProfile: keeps name, paradigm and valid schools; drops bad rows; refuses a non-profile', () => {
  const p = L.parseProfile({ ...PROFILE, programs: [...PROFILE.programs, { id: 'x', name: 'Too short id' }, { id: 'prog_noname1', name: '  ' }, null] });
  assert.deepEqual(p, { displayName: 'Sam', paradigm: 'Tech over truth.', programs: [{ id: ID_A, name: 'Lincoln High', role: 'judge' }, { id: ID_B, name: 'Central', role: 'coach' }] });
  assert.deepEqual(L.parseProfile({ paradigm: null, programs: 'no' }), { displayName: '', paradigm: '', programs: [] });
  assert.equal(L.parseProfile(null), null);
  assert.equal(L.parseProfile([]), null);
  assert.equal(L.parseProfile('<html>'), null);
});

// Why: only a 401 means signed out. If a network failure or a 500 signed the judge out, the picker and the account
// paradigm would vanish mid-tournament whenever the Wi-Fi drops.
test('profileOutcome: 200 is signed in, 401 is signed out, anything else is unknown', () => {
  assert.equal(L.profileOutcome(200, PROFILE).state, 'in');
  assert.equal(L.profileOutcome(200, PROFILE).profile.programs.length, 2);
  assert.deepEqual(L.profileOutcome(401, null), { state: 'out' });
  assert.deepEqual(L.profileOutcome(404, null), { state: 'unknown' }, 'the local helper has no account server');
  assert.deepEqual(L.profileOutcome(503, null), { state: 'unknown' });
  assert.deepEqual(L.profileOutcome(200, null), { state: 'unknown' }, 'a 200 that is not a profile (an HTML page)');
});

// Why: the server refuses a profile write without X-Tabula: 1 and the page's own Origin. The page's no-referrer policy
// would make the browser send "Origin: null", so without referrerPolicy the judge's paradigm would never save.
test('profilePut: same-origin PUT with X-Tabula: 1, a real Origin, and only the given fields', () => {
  const r = L.profilePut({ paradigm: 'Weigh impacts.' });
  assert.equal(r.url, '/api/v1/me/profile');
  assert.equal(r.init.method, 'PUT');
  assert.equal(r.init.credentials, 'same-origin');
  assert.equal(r.init.headers['X-Tabula'], '1');
  assert.equal(r.init.headers['content-type'], 'application/json');
  assert.equal(r.init.referrerPolicy, 'strict-origin');
  assert.deepEqual(JSON.parse(r.init.body), { paradigm: 'Weigh impacts.' });
  const g = L.profileGet();
  assert.equal(g.url, '/api/v1/me/profile');
  assert.equal(g.init.credentials, 'same-origin');
});

// Why: the server refuses tabs and other control characters. A paradigm pasted from a judging site often has tabs, and
// without cleaning the save would fail with no way for the judge to see why.
test('cleanParadigm and paradigmError: tabs become spaces, control characters go, 5,000 is the limit', () => {
  assert.equal(L.cleanParadigm('  Line 1\r\n\tLine 2\u0007\r'), 'Line 1\n    Line 2');
  assert.equal(L.cleanParadigm(null), '');
  assert.equal(L.paradigmError('a'.repeat(5000)), '');
  assert.equal(L.paradigmError('a'.repeat(5001)), 'Your paradigm is 5,001 characters. The limit is 5,000.');
  assert.equal(L.MAX_PARADIGM, 5000);
});

// Why: the account copy is the one source when signed in (§6), so the judge writes it once; signed out, the app must
// keep using the paradigm on this device exactly as before.
test('activeParadigm: the account paradigm when signed in (even empty), the device one when signed out', () => {
  const p = L.parseProfile(PROFILE);
  assert.equal(L.activeParadigm(p, 'Device text'), 'Tech over truth.');
  assert.equal(L.activeParadigm({ ...p, paradigm: '' }, 'Device text'), '');
  assert.equal(L.activeParadigm(null, 'Device text'), 'Device text');
  assert.equal(L.activeParadigm(null, undefined), '');
});

// Why: the copy offer must come once, and only when it helps. Asking again, or offering to overwrite an account
// paradigm, would nag the judge or destroy the paradigm they wrote on another device.
test('shouldOfferParadigmCopy: only an empty account, a non-empty device paradigm, and not offered before', () => {
  const empty = L.parseProfile({ ...PROFILE, paradigm: '' });
  assert.equal(L.shouldOfferParadigmCopy({ profile: empty, localText: 'Mine', offered: false }), true);
  assert.equal(L.shouldOfferParadigmCopy({ profile: empty, localText: 'Mine', offered: true }), false, 'offered once already');
  assert.equal(L.shouldOfferParadigmCopy({ profile: L.parseProfile(PROFILE), localText: 'Mine', offered: false }), false, 'the account has one');
  assert.equal(L.shouldOfferParadigmCopy({ profile: empty, localText: ' \t ', offered: false }), false, 'nothing on the device');
  assert.equal(L.shouldOfferParadigmCopy({ profile: null, localText: 'Mine', offered: false }), false, 'signed out');
});

// Why: the picker decides whose policy and credits pay for the round. Signed out or with no school it must not show
// (today's app), and "Just me" must always be there so a school judge can judge on their own account.
test('judgingOptions: one "Judging for" per school plus "Just me"; none without schools', () => {
  assert.deepEqual(L.judgingOptions(L.parseProfile(PROFILE)), [
    { value: ID_A, label: 'Judging for: Lincoln High' }, { value: ID_B, label: 'Judging for: Central' }, { value: '', label: 'Just me' },
  ]);
  assert.deepEqual(L.judgingOptions(L.parseProfile({ ...PROFILE, programs: [] })), []);
  assert.deepEqual(L.judgingOptions(null), []);
});

// Why: a remembered school the judge has left (or any id after sign-out) must fall back to "Just me"; sending it would
// make every hosted call fail the school's membership check.
test('judgingFor: the remembered school while the judge belongs to it, else null ("Just me")', () => {
  const p = L.parseProfile(PROFILE);
  assert.equal(L.judgingFor(ID_B, p), ID_B);
  assert.equal(L.judgingFor('prog_leftschool', p), null);
  assert.equal(L.judgingFor(null, p), null);
  assert.equal(L.judgingFor(ID_A, null), null, 'signed out');
});

// Why: the choice is made at round start. If it could change after a speech ran, one round could mix two schools'
// policies and pools.
test('judgingLocked: open before the first speech clock runs, locked after', () => {
  assert.equal(L.judgingLocked({ run: null, timeLeft: {} }), false);
  assert.equal(L.judgingLocked({ run: { id: '1AC' }, timeLeft: {} }), true);
  assert.equal(L.judgingLocked({ run: null, timeLeft: { '1AC': 312 } }), true);
  assert.equal(L.judgingLocked(null), false);
});

// Why: the server picks the school's policy and pool from programId on each hosted call (APP-CLIENT-PROPOSAL §3). It must
// come from the round's choice, with null for "Just me", and a call must never be able to send another school.
test('hostedAiBody: roundId and programId always come from the round', () => {
  const call = { callId: 'c1', format: 'policy-hs', programId: ID_B, roundId: 'other', state: { speech: '1AC' } };
  assert.deepEqual(L.hostedAiBody({ id: 'r1', programId: ID_A }, call), { callId: 'c1', format: 'policy-hs', formatVersion: 1, programId: ID_A, roundId: 'r1', state: { speech: '1AC' } });
  assert.equal(L.hostedAiBody({ id: 'r1', programId: null }, call).programId, null, 'Just me');
  assert.equal(L.hostedAiBody({ id: 'r1' }, call).programId, null, 'a round from before this change');
  assert.equal(L.hostedAiBody({ id: 'r1', programId: 'bad id!' }, call).programId, null);
});

// Why: a guard only. Any page code that calls the hosted AI routes must build its body with hostedAiBody, or a call
// could go out without the round's school and be charged to the wrong account.
// No page code calls the hosted AI routes yet (2026-11-20), so today this checks that no file does so without it.
test('page code calls the hosted AI routes only through hostedAiBody', () => {
  for (const f of APP_FILES) {
    const src = readSource(f);
    const calls = (src.match(/\/api\/v1\/ai\//g) || []).length;
    const bodies = (src.match(/L\.hostedAiBody\(/g) || []).length;
    assert.ok(bodies >= calls, f + ' calls /api/v1/ai/ ' + calls + ' time(s) but builds the body with hostedAiBody only ' + bodies + ' time(s)');
  }
});

// Why: round content stays on the device (the roles plan rule). The account code may send only the profile fields.
test('the account code sends only the paradigm, never round content', () => {
  const src = readSource('js/account.js');
  const puts = [...src.matchAll(/L\.profilePut\(([^)]*)\)/g)];
  assert.ok(puts.length > 0);
  for (const m of puts) assert.match(m[1], /^\{ paradigm: L\.cleanParadigm\([^)]*$/, m[0]);
  assert.doesNotMatch(src, /R\.(transcripts|flows|aiFlows|ballot|analysis|docs)\b|docStore|clipStore/, 'js/account.js reads round content');
});

// Why: signed out, the page must look exactly as before; the picker and the account card show only after a profile loads.
test('the picker rows and the account card start hidden', () => {
  const html = readSource('index.html');
  const rows = [...html.matchAll(/<div class="[^"]*judging-row[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(rows.length, 2, 'one in Round setup, one on the start screen');
  for (const r of rows) assert.match(r, /\bhidden\b/);
  assert.match(html, /<div class="card" id="account-card" hidden>/);
});
