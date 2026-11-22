// Tests for the shared store and backup files, core/store.js (docs/events/LANDING.md §3, step C2). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, buildBackup, parseBackup } from './store.js';

// A stand-in for localStorage. full: every write throws a quota error.
function fakeStorage(seed = {}, { full = false } = {}) {
  const m = new Map(Object.keys(seed).map((k) => [k, seed[k]]));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (full) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}
const DEBATE = { 'policyJudge.round.v1': '{"roundName":"R4"}', 'policyJudge.log.v1': '[1]', 'tabula.caps.v2': '{"a":1}' };

// Why: both apps run on one browser. If the second app's store could read or write debate keys, a judge's saved
// round or ballots could be read by the wrong app, or wiped by its restore.
test('a store with a second prefix never reads, writes, lists or replaces debate keys', () => {
  const box = fakeStorage(DEBATE);
  const other = createStore({ prefixes: ['tabulaEvents.'], storage: box });
  assert.throws(() => other.get('policyJudge.round.v1'), /may not use the key/);
  assert.throws(() => other.set('policyJudge.round.v1', {}), /may not use the key/);
  assert.throws(() => other.del('tabula.caps.v2'), /may not use the key/);
  assert.throws(() => other.snapshot('policyJudge.'), /does not own the prefix/);
  assert.throws(() => other.replaceAll('tabulaEvents.', { 'policyJudge.round.v1': 'x' }), /not under/);
  assert.ok(other.set('tabulaEvents.a.v1', { n: 1 }));
  other.replaceAll('tabulaEvents.', { 'tabulaEvents.b.v1': '2' });
  assert.deepEqual(other.snapshot('tabulaEvents.'), { 'tabulaEvents.b.v1': '2' });
  for (const k of Object.keys(DEBATE)) assert.equal(box.dump()[k], DEBATE[k], k + ' changed');
});

// Why: "tabula." must not match "tabulaEvents.": a prefix without its dot would let debate's account keys reach into
// the other app's names.
test('the debate store owns policyJudge.* and tabula.* and nothing that only starts with the same letters', () => {
  const box = fakeStorage(DEBATE);
  const debate = createStore({ prefixes: ['policyJudge.', 'tabula.'], storage: box });
  assert.deepEqual(debate.get('policyJudge.round.v1'), { roundName: 'R4' });
  assert.deepEqual(debate.get('tabula.caps.v2'), { a: 1 });
  assert.throws(() => debate.get('tabulaEvents.a.v1'), /may not use the key/);
  assert.throws(() => createStore({ prefixes: ['tabula'] }), /end with a dot/);
  assert.throws(() => createStore({ prefixes: [] }), /end with a dot/);
});

// Why: a judge mid-round must never lose the round to a broken value or a full browser; the clock keeps running in
// memory and the app shows one warning instead of failing.
test('a broken value gives the default and is kept aside; a failed save calls onFail; a good save calls onSaved', () => {
  const box = fakeStorage({ 'policyJudge.round.v1': '{not json' });
  const calls = [];
  const s = createStore({ prefixes: ['policyJudge.'], storage: box, onSaved: () => calls.push('saved'), onFail: (e) => calls.push(e.name) });
  assert.deepEqual(s.get('policyJudge.round.v1', { empty: true }), { empty: true });
  assert.equal(box.dump()['policyJudge.round.v1.corrupt-backup'], '{not json');
  assert.equal(s.get('policyJudge.none', 7), 7);
  assert.equal(s.set('policyJudge.x', 1), true);
  const fullStore = createStore({ prefixes: ['policyJudge.'], storage: fakeStorage({}, { full: true }), onFail: (e) => calls.push(e.name) });
  assert.equal(fullStore.set('policyJudge.x', 1), false);
  assert.deepEqual(calls, ['saved', 'QuotaExceededError']);
  const blocked = createStore({ prefixes: ['policyJudge.'], storage: { getItem() { throw new Error('blocked'); }, get length() { throw new Error('blocked'); } } });
  assert.equal(blocked.get('policyJudge.x', 'd'), 'd');
  assert.deepEqual(blocked.snapshot('policyJudge.'), {});
});

// Why: restore removes data before writing; a bad name found halfway would leave the judge with half a restore.
test('replaceAll checks every name before it removes anything, and throws on a failed write', () => {
  const box = fakeStorage(DEBATE);
  const s = createStore({ prefixes: ['policyJudge.', 'tabula.'], storage: box });
  assert.throws(() => s.replaceAll('policyJudge.', { 'policyJudge.a': '1', 'tabula.caps.v2': '2' }), /not under/);
  assert.deepEqual(box.dump(), DEBATE);
  s.replaceAll('policyJudge.', { 'policyJudge.a': '1' });
  assert.deepEqual(box.dump(), { 'tabula.caps.v2': '{"a":1}', 'policyJudge.a': '1' }, 'tabula.* is not under policyJudge. and stays');
  const full = createStore({ prefixes: ['policyJudge.'], storage: fakeStorage({}, { full: true }) });
  assert.throws(() => full.replaceAll('policyJudge.', { 'policyJudge.a': '1' }));
});

// Why: a backup is easy to share by mistake, so secrets stay out unless asked for; and a file from the other app must
// be refused, or a restore would load data the app cannot read.
test('a backup keeps only its prefix, leaves secrets out unless asked, and is refused by another app', () => {
  const saved = Object.assign({ 'policyJudge.keys.v1': 'SECRET', 'other.x': 'no' }, DEBATE);
  const b = buildBackup(saved, { prefix: 'policyJudge.', secretKeys: ['policyJudge.keys.v1'], now: 'T', extra: { docs: [1] } });
  assert.deepEqual(b, { app: 'tabula', kind: 'backup', version: 1, exportedAt: 'T', includesKeys: false, storage: { 'policyJudge.round.v1': '{"roundName":"R4"}', 'policyJudge.log.v1': '[1]' }, docs: [1] });
  assert.equal(buildBackup(saved, { prefix: 'policyJudge.', secretKeys: ['policyJudge.keys.v1'], includeSecrets: true }).storage['policyJudge.keys.v1'], 'SECRET');
  const back = parseBackup(JSON.stringify(Object.assign({}, b, { storage: Object.assign({ 'evil.key': 'x', 'policyJudge.n': 5 }, b.storage) })), { prefix: 'policyJudge.' });
  assert.deepEqual(back.storage, b.storage, 'names outside the prefix and values that are not text are dropped');
  assert.deepEqual(back.file.docs, [1]);
  assert.throws(() => parseBackup(JSON.stringify(b), { prefix: 'policyJudge.', app: 'tabula-events' }), /not a Tabula backup/);
  const other = buildBackup({ 'tabulaEvents.a': '1' }, { prefix: 'tabulaEvents.', app: 'tabula-events' });
  assert.throws(() => parseBackup(JSON.stringify(other), { prefix: 'policyJudge.' }), /not a Tabula backup/);
});
