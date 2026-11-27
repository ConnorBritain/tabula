// Durable Events recovery must protect device data across failed writes, reloads and tab closure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataJournal as makeDataJournal, JOURNAL_PREFIX, RESULT_PREFIX, TAB_ID_KEY } from './js/data-journal.js';
import { createEventsStore as makeEventsStore, ROOMS_KEY, SETTINGS_KEY, PREFIX } from './js/store.js';
import { KEYS_KEY } from './js/ai-key.js';
import { makeBackup } from './js/settings.js';

import { heldWriter } from './fixtures/held-writer.mjs';
const createEventsStore = (ui, storage, opts = {}) => makeEventsStore(ui, storage, { ...opts, writer: heldWriter });
const createDataJournal = (local, session) => makeDataJournal(local, session, heldWriter);

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { get length() { return values.size; }, key: (n) => [...values.keys()][n] ?? null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values) };
}
const ordinary = (storage) => Object.fromEntries(Object.entries(storage.dump()).filter(([key]) => key.startsWith(PREFIX)));
const journalKeys = (storage) => Object.keys(storage.dump()).filter((key) => key.startsWith(JOURNAL_PREFIX));
const BEFORE = { [ROOMS_KEY]: '[{"id":"original"}]', [SETTINGS_KEY]: '{"theme":"dark","timerBig":true}', [KEYS_KEY]: '{"anthropic":"synthetic-remembered-key"}' };
const AFTER = { [ROOMS_KEY]: '[{"id":"replacement"}]', [SETTINGS_KEY]: '{"theme":"light","timerBig":false}' };
const SESSION = { [KEYS_KEY]: '{"openai":"synthetic-tab-only-key"}' };
function rig() {
  const local = memory({ ...BEFORE, 'policyJudge.foreign': 'untouched' }), session = memory({ ...SESSION, 'foreign-tab': 'untouched' });
  const journal = createDataJournal(() => local, () => session);
  return { local, session, journal };
}
function failSetting(local) {
  const set = local.setItem;
  local.setItem = (key, value) => { if (key === SETTINGS_KEY) throw new Error('blocked setting'); set(key, value); };
  return () => { local.setItem = set; };
}

// Why: a complete operation must leave exactly its target and no recovery payload in either store.
test('verified Clear and Undo restore both stores without retaining journal metadata', () => {
  const r = rig();
  r.journal.write({}, { sessionItems: {} });
  assert.deepEqual(r.local.dump(), { 'policyJudge.foreign': 'untouched' });
  assert.deepEqual(r.session.dump(), { 'foreign-tab': 'untouched' });
  r.journal.write(BEFORE, { sessionItems: SESSION, intent: 'undo' });
  assert.deepEqual(ordinary(r.local), BEFORE);
  assert.deepEqual(r.session.dump(), { ...SESSION, 'foreign-tab': 'untouched' });
  assert.equal(r.journal.state().blocked, false);
});

// Why: without a verified recovery copy, no destructive write may begin.
test('refusing every journal write leaves all existing data and foreign keys unchanged', () => {
  const r = rig(), before = r.local.dump(), tabBefore = r.session.dump();
  let destructive = 0;
  const remove = r.local.removeItem;
  r.local.removeItem = (key) => { if (key.startsWith(PREFIX)) destructive++; remove(key); };
  r.local.setItem = () => { throw new Error('all local writes refused'); };
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }), (error) => error.unchanged === true);
  assert.deepEqual(r.local.dump(), before);
  assert.deepEqual(r.session.dump(), tabBefore);
  assert.equal(destructive, 0);
  assert.equal(r.journal.state().blocked, false);
});

// Why: a rollback failure must not make the original data depend on the current JavaScript page staying alive.
test('a fresh controller recovers exact originals after midway write and rollback failures', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }), (error) => error.blocked);
  assert.equal(journalKeys(r.local).length, 1);
  const saved = JSON.parse(r.local.getItem(journalKeys(r.local)[0]));
  assert.deepEqual(saved.before, BEFORE);
  assert.deepEqual(saved.after, AFTER);
  assert.equal(JSON.stringify(r.local.dump()).includes('synthetic-tab-only-key'), false);
  assert.equal(r.journal.state().blocked, true);
  unblock();
  const fresh = createDataJournal(() => r.local, () => r.session);
  assert.equal(fresh.recover().ok, true);
  assert.deepEqual(ordinary(r.local), BEFORE);
  assert.deepEqual(r.session.dump(), { ...SESSION, 'foreign-tab': 'untouched' });
  assert.equal(journalKeys(r.local).length, 0);
  assert.equal(fresh.state().blocked, false);
});

// Why: another ordinary save during recovery would destroy evidence or replace a partial store with new work.
test('Events store refuses ordinary reads and writes until its durable recovery finishes', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  const ui = { toast() {}, dismissToast() {} }, store = createEventsStore(ui, r.local, { nav: null });
  store.journal.useSessionStorage(r.session);
  const before = r.local.dump();
  assert.equal(store.set(ROOMS_KEY, [{ id: 'must-not-save' }]), false);
  assert.throws(() => store.get(ROOMS_KEY, []));
  assert.deepEqual(r.local.dump(), before);
  unblock();
  assert.equal(store.journal.recover().ok, true);
  assert.deepEqual(store.get(ROOMS_KEY, []), [{ id: 'original' }]);
});

// Why: closing the original tab must not trap local recovery or persist its tab-only AI key.
test('a genuinely new tab recovers local originals and keeps the closed tab key forgotten', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  unblock();
  const newTab = memory();
  const fresh = createDataJournal(() => r.local, () => newTab);
  assert.equal(fresh.recover().ok, true);
  assert.deepEqual(ordinary(r.local), BEFORE);
  assert.deepEqual(newTab.dump(), {});
  assert.equal(JSON.stringify(r.local.dump()).includes('synthetic-tab-only-key'), false);
  assert.equal(fresh.state().blocked, false);
});

// Why: missing or corrupt recovery within the same tab is different from intentional tab closure and must fail closed.
test('a same-tab missing session journal quarantines without rewriting local data', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  r.session.removeItem(journalKeys(r.session)[0]);
  assert.ok(r.session.getItem(TAB_ID_KEY));
  unblock();
  const before = r.local.dump(), fresh = createDataJournal(() => r.local, () => r.session);
  assert.equal(fresh.recover().ok, false);
  assert.equal(fresh.state().blocked, true);
  assert.deepEqual(r.local.dump(), before);
});

// Why: cleanup trouble after a verified commit must not undo the user's successful operation on the next visit.
test('a committed marker survives removal failure and recovers the committed target', () => {
  const r = rig(), remove = r.local.removeItem;
  r.local.removeItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('journal remove blocked'); remove(key); };
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }), (error) => error.committed);
  assert.deepEqual(ordinary(r.local), AFTER);
  assert.equal(r.journal.state().phase, 'after');
  r.local.removeItem = remove;
  const fresh = createDataJournal(() => r.local, () => r.session);
  assert.equal(fresh.recover().phase, 'after');
  assert.deepEqual(ordinary(r.local), AFTER);
  assert.deepEqual(ordinary(r.session), {});
  assert.equal(fresh.state().blocked, false);
});

// Why: failed Undo must preserve both the old committed state and the complete older copy the judge requested.
test('failed Undo keeps its requested target durable until an explicit retry completes', () => {
  const r = rig();
  r.journal.write(AFTER, { sessionItems: {} });
  const unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(BEFORE, { sessionItems: SESSION, intent: 'undo' }));
  unblock();
  const fresh = createDataJournal(() => r.local, () => r.session);
  const bootRecovery = fresh.recover();
  assert.equal(bootRecovery.ok, false);
  assert.equal(bootRecovery.error, 'undo_retry_pending');
  assert.deepEqual(ordinary(r.local), AFTER, 'startup first restores the known committed state');
  assert.deepEqual(fresh.recoveryCopy(), BEFORE, 'the requested older data remains durable');
  assert.equal(fresh.recover({ retryUndo: true }).ok, true);
  assert.deepEqual(ordinary(r.local), BEFORE);
  assert.deepEqual(ordinary(r.session), SESSION);
});

// Why: default backups must not embed journal strings or either form of AI key through recovery metadata.
test('ordinary and recovery exports exclude journal metadata and keys unless explicitly included', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  const ordinaryBackup = makeBackup(r.local.dump());
  const recoveryBackup = makeBackup(r.journal.recoveryCopy());
  for (const file of [ordinaryBackup, recoveryBackup]) {
    const text = JSON.stringify(file);
    assert.equal(text.includes('synthetic-remembered-key'), false);
    assert.equal(text.includes('synthetic-tab-only-key'), false);
    assert.equal(Object.keys(file.storage).some((key) => key.startsWith(JOURNAL_PREFIX) || key.startsWith(RESULT_PREFIX)), false);
  }
  const explicit = makeBackup(r.journal.recoveryCopy(), { includeKeys: true });
  assert.equal(JSON.stringify(explicit).includes('synthetic-remembered-key'), true);
  assert.equal(JSON.stringify(explicit).includes('synthetic-tab-only-key'), false);
  unblock();
});

// Why: an unreadable journal must block app work until the original evidence can be read again.
test('journal read failure and malformed contents remain quarantined without data writes', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  unblock();
  const get = r.local.getItem, before = r.local.dump();
  r.local.getItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('journal read blocked'); return get(key); };
  const fresh = createDataJournal(() => r.local, () => r.session);
  assert.equal(fresh.recover().ok, false);
  assert.equal(fresh.state().blocked, true);
  assert.deepEqual(r.local.dump(), before);
  r.local.getItem = get;
  assert.equal(fresh.recover().ok, true);
});

// Why: a browser that silently drops a recovery write must not be treated as having a safe original copy.
test('journal writes are read back before any ordinary key is removed', () => {
  const r = rig(), before = r.local.dump(), oldSet = r.local.setItem, oldRemove = r.local.removeItem;
  let removed = 0;
  r.local.setItem = (key, raw) => { if (!key.startsWith(JOURNAL_PREFIX)) oldSet(key, raw); };
  r.local.removeItem = (key) => { if (key.startsWith(PREFIX)) removed++; oldRemove(key); };
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  assert.deepEqual(r.local.dump(), before);
  assert.equal(removed, 0);
  assert.deepEqual(r.session.dump(), { ...SESSION, 'foreign-tab': 'untouched' });
});

// Why: damaged recovery metadata must not trigger a guessed repair that destroys its only remaining copy.
test('malformed local and same-tab session records block all recovery writes', () => {
  for (const scope of ['local', 'session']) {
    const r = rig(), unblock = failSetting(r.local);
    assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
    unblock();
    const storage = r[scope], key = journalKeys(storage)[0], original = storage.getItem(key);
    storage.setItem(key, '{bad-json');
    const localBefore = r.local.dump(), sessionBefore = r.session.dump();
    assert.equal(r.journal.recover().ok, false);
    assert.equal(r.journal.state().blocked, true);
    assert.deepEqual(r.local.dump(), localBefore);
    assert.deepEqual(r.session.dump(), sessionBefore);
    storage.setItem(key, original);
    assert.equal(r.journal.recover().ok, true);
    assert.deepEqual(ordinary(r.local), BEFORE);
    assert.deepEqual(ordinary(r.session), SESSION);
  }
});

// Why: a second unresolved transaction must never overwrite or choose between two different original snapshots.
test('conflicting durable journals quarantine without choosing a winner or changing data', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  unblock();
  const first = JSON.parse(r.local.getItem(journalKeys(r.local)[0]));
  const other = { ...first, id: 'different-transaction', before: AFTER, after: BEFORE };
  r.local.setItem(JOURNAL_PREFIX + other.id, JSON.stringify(other));
  const before = r.local.dump();
  assert.equal(r.journal.recover().error, 'journal_collision');
  assert.equal(r.journal.state().blocked, true);
  assert.throws(() => r.journal.write({}));
  assert.deepEqual(r.local.dump(), before);
  assert.equal(journalKeys(r.local).length, 2);
});

// Why: a failed metadata cleanup after success must not resurrect a key or generate stale cross-tab receipts.
test('completed session cleanup stays committed when the local journal cannot yet be removed', () => {
  const r = rig(), remove = r.local.removeItem;
  r.local.removeItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('remove refused'); remove(key); };
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  const record = JSON.parse(r.local.getItem(journalKeys(r.local)[0]));
  assert.equal(record.phase, 'after');
  assert.equal(record.sessionDone, true);
  assert.deepEqual(r.session.dump(), { 'foreign-tab': 'untouched' });
  r.local.removeItem = remove;
  const newTab = memory(), fresh = createDataJournal(() => r.local, () => newTab);
  assert.equal(fresh.recover().phase, 'after');
  assert.deepEqual(ordinary(r.local), AFTER);
  assert.deepEqual(newTab.dump(), {});
  assert.equal(Object.keys(r.local.dump()).some((key) => key.startsWith(RESULT_PREFIX)), false);
});

// Why: a live original tab must keep the committed session target after another tab finishes local cleanup.
test('a foreign committed recovery leaves only a nonsecret receipt until the original tab returns', () => {
  const r = rig(), remove = r.session.removeItem;
  r.session.removeItem = (key) => { if (key.startsWith(JOURNAL_PREFIX)) throw new Error('session cleanup refused'); remove(key); };
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  assert.equal(r.journal.state().phase, 'after');
  const newTab = memory(), foreign = createDataJournal(() => r.local, () => newTab);
  assert.equal(foreign.recover().phase, 'after');
  const receipts = Object.keys(r.local.dump()).filter((key) => key.startsWith(RESULT_PREFIX));
  assert.equal(receipts.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(r.local.getItem(receipts[0]))).sort(), ['id', 'phase', 'tabId', 'v']);
  assert.equal(JSON.stringify(r.local.dump()).includes('synthetic-tab-only-key'), false);
  r.session.removeItem = remove;
  const original = createDataJournal(() => r.local, () => r.session);
  assert.equal(original.recover().phase, 'after');
  assert.deepEqual(ordinary(r.local), AFTER);
  assert.deepEqual(ordinary(r.session), {});
  assert.equal(original.state().blocked, false);
  assert.equal(Object.keys(r.local.dump()).some((key) => key.startsWith(RESULT_PREFIX)), false);
});

// Why: after a foreign rollback, an orphan session commit marker must not restore a key from an abandoned change.
test('an orphan session follows the foreign rollback rather than its stale after marker', () => {
  const r = rig(), unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(AFTER, { sessionItems: {} }));
  unblock();
  const sessionKey = journalKeys(r.session)[0], sessionRecord = JSON.parse(r.session.getItem(sessionKey));
  r.session.setItem(sessionKey, JSON.stringify({ ...sessionRecord, phase: 'after' }));
  const foreign = createDataJournal(() => r.local, () => memory());
  assert.equal(foreign.recover().phase, 'before');
  const original = createDataJournal(() => r.local, () => r.session);
  assert.equal(original.recover().phase, 'before');
  assert.deepEqual(ordinary(r.local), BEFORE);
  assert.deepEqual(ordinary(r.session), SESSION);
  assert.equal(original.state().blocked, false);
});

// Why: repeated failed retries must keep both the committed data and the full requested older copy recoverable.
test('failed Put original data back retries preserve their first durable Undo intent', () => {
  const r = rig();
  r.journal.write(AFTER, { sessionItems: {} });
  const unblock = failSetting(r.local);
  assert.throws(() => r.journal.write(BEFORE, { sessionItems: SESSION, intent: 'undo' }));
  const key = journalKeys(r.local)[0], original = JSON.parse(r.local.getItem(key));
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal(r.journal.recover({ retryUndo: true }).ok, false);
    const saved = JSON.parse(r.local.getItem(key));
    assert.deepEqual(saved.before, AFTER);
    assert.deepEqual(saved.after, BEFORE);
    assert.equal(saved.id, original.id);
    assert.deepEqual(r.journal.recoveryCopy(), BEFORE);
    assert.throws(() => r.journal.write({}));
  }
  unblock();
  const fresh = createDataJournal(() => r.local, () => r.session);
  assert.equal(fresh.recover().error, 'undo_retry_pending');
  assert.deepEqual(ordinary(r.local), AFTER);
  assert.equal(fresh.recover({ retryUndo: true }).ok, true);
  assert.deepEqual(ordinary(r.local), BEFORE);
  assert.deepEqual(ordinary(r.session), SESSION);
});

// Why: an unreadable ordinary value must never become an incomplete backup or a replacement target.
test('Events snapshots fail closed instead of returning a partial ordinary store', () => {
  const r = rig(), store = createEventsStore({ toast() {}, dismissToast() {} }, r.local, { nav: null });
  store.journal.useSessionStorage(r.session);
  const get = r.local.getItem, original = r.local.dump();
  r.local.getItem = (key) => { if (key === SETTINGS_KEY) throw new Error('data read refused'); return get(key); };
  assert.throws(() => store.snapshot(PREFIX));
  assert.throws(() => store.journal.write(AFTER, { sessionItems: {} }));
  assert.deepEqual(r.local.dump(), original);
});

// Why: a failed read after successful cleanup must not falsely report that a verified committed change never started.
test('a transient read failure after journal removal still reports the exact committed target as saved', () => {
  const r = rig(), get = r.local.getItem, remove = r.local.removeItem;
  let removedKey = null, rejectedRead = false;
  r.local.removeItem = (key) => { remove(key); if (key.startsWith(JOURNAL_PREFIX)) removedKey = key; };
  r.local.getItem = (key) => {
    if (key === removedKey && !rejectedRead) { rejectedRead = true; throw new Error('cleanup verification read failed once'); }
    return get(key);
  };
  assert.deepEqual(r.journal.write(AFTER, { sessionItems: {} }), { ok: true, unchanged: false });
  assert.equal(rejectedRead, true);
  assert.deepEqual(ordinary(r.local), AFTER);
  assert.deepEqual(ordinary(r.session), {});
  assert.equal(r.journal.state().blocked, false);
  assert.equal(journalKeys(r.local).length, 0);
});
