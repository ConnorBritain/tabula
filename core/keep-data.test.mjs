// Tests for core/keep-data.js: asking the browser to keep a judge's saved data, and when to remind about a backup.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { storageKept, askToKeepOnce, backupDue } from './keep-data.js';

// A stand-in for navigator.storage. persisted: what the browser says now; grant: its answer to persist().
function fakeNav({ persisted = false, grant = true, throws = false, missing = false } = {}) {
  const calls = { persist: 0 };
  if (missing) return { calls, storage: {} };
  return { calls, storage: {
    persisted: async () => { if (throws) throw new Error('no'); return persisted; },
    persist: async () => { calls.persist++; if (throws) throw new Error('no'); return grant; },
  } };
}
const memStore = () => { const m = new Map(); return { get: (k, d) => (m.has(k) ? m.get(k) : d), set: (k, v) => { m.set(k, v); return true; }, m }; };

// Why: if the answer is read wrong, Settings and My day tell a judge their ballots are safe when the browser may clear them, and the judge loses a tournament's comments without a backup.
test('storageKept reads the browser answer and never throws', async () => {
  assert.equal(await storageKept(fakeNav({ persisted: true })), 'kept');
  assert.equal(await storageKept(fakeNav({ persisted: false })), 'may-clear');
  assert.equal(await storageKept(fakeNav({ throws: true })), 'unknown');
  assert.equal(await storageKept(fakeNav({ missing: true })), 'unknown');
  assert.equal(await storageKept(null), 'unknown');
  assert.equal(await storageKept({}), 'unknown');
});

// Why: asking on every save would show a browser prompt between rounds; never asking leaves the data clearable.
test('askToKeepOnce asks once per key, saves the ask first, and reports the answer', async () => {
  const s = memStore();
  const nav = fakeNav({ grant: true });
  assert.equal(await askToKeepOnce(s, 'app.asked.v1', () => 111, nav), 'kept');
  assert.equal(s.m.get('app.asked.v1'), 111, 'the time of the ask is saved under the given key');
  assert.equal(await askToKeepOnce(s, 'app.asked.v1', () => 222, nav), 'asked-before');
  assert.equal(nav.calls.persist, 1);
  assert.equal(await askToKeepOnce(s, 'other.asked.v1', 5, fakeNav({ grant: false })), 'may-clear', 'another key asks on its own; now may be a number');
  assert.equal(s.m.get('other.asked.v1'), 5);
  const already = fakeNav({ persisted: true });
  assert.equal(await askToKeepOnce(memStore(), 'k', () => 1, already), 'kept');
  assert.equal(already.calls.persist, 0, 'a browser that already keeps the data is not asked again');
});

// Why: a browser without the API, or one that throws, must not break the save that triggered the ask.
test('askToKeepOnce reads unknown when the browser cannot answer', async () => {
  const s = memStore();
  assert.equal(await askToKeepOnce(s, 'k', () => 1, fakeNav({ missing: true })), 'unknown');
  assert.equal(s.m.has('k'), false, 'nothing was asked, so a later browser update can still ask');
  assert.equal(await askToKeepOnce(s, 'k', () => 1, null), 'unknown');
  assert.equal(await askToKeepOnce(memStore(), 'k', () => 1, fakeNav({ throws: true })), 'unknown');
});

// Why: the reminder is the last chance to save a day of ballots off the device; it must show when the day is over and nothing is backed up, and must not nag a judge who already has a backup or said "Not now".
test('backupDue: only when the day is over and something changed since the last backup', () => {
  const base = { dayOver: true, lastChange: 1000, lastBackupAt: null, dismissedAt: null };
  assert.equal(backupDue(base), true);
  assert.equal(backupDue({ ...base, dayOver: false }), false, 'the day is not over');
  assert.equal(backupDue({ ...base, lastChange: 0 }), false, 'nothing to back up');
  assert.equal(backupDue({ ...base, lastChange: undefined }), false);
  assert.equal(backupDue({ ...base, lastBackupAt: 999 }), true, 'a backup older than the last change does not count');
  assert.equal(backupDue({ ...base, lastBackupAt: 1000 }), false);
  assert.equal(backupDue({ ...base, lastBackupAt: 2000 }), false);
  assert.equal(backupDue({ ...base, dismissedAt: 1000 }), false, '"Not now" to this change');
  assert.equal(backupDue({ ...base, dismissedAt: 900 }), true, 'a newer change brings it back');
  assert.equal(backupDue(null), false);
  assert.equal(backupDue(), false);
});
