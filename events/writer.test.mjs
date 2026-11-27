// Only a page that holds the browser's Events writer lease may read, recover or change saved device data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventsWriter, WRITER_LOCK } from './js/writer.js';
import { createDataJournal, JOURNAL_PREFIX } from './js/data-journal.js';
import { createEventsStore, PREFIX, ROOMS_KEY } from './js/store.js';
import { createPageAI } from './js/page-ai.js';
import { settingsHtml } from './js/settings-screen.js';

function manager() {
  let owner = null;
  const requests = [];
  return { requests, request(name, options, callback) {
    requests.push({ name, options });
    if (owner) return Promise.resolve().then(() => callback(null));
    const token = {}; owner = token;
    return Promise.resolve().then(() => callback({ name, mode: 'exclusive' })).finally(() => { if (owner === token) owner = null; });
  } };
}
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { get length() { return values.size; }, key: (i) => [...values.keys()][i] ?? null, getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k), dump: () => Object.fromEntries(values) };
}
const ui = () => ({ toast() {}, dismissToast() {} });
const flush = () => new Promise((resolve) => setImmediate(resolve));

// Why: if a waiting page can acquire or steal while another page works, its writes can erase a judge's saved round.
test('one native exclusive lease stays held until release and another page must explicitly retry', async () => {
  const locks = manager(), a = createEventsWriter({ locks: () => locks }), b = createEventsWriter({ locks: () => locks });
  assert.equal((await a.acquire()).held, true);
  assert.equal((await b.acquire()).held, false);
  assert.equal(a.isHeld(), true);
  assert.equal(b.state().status, 'waiting');
  for (const request of locks.requests) assert.deepEqual(request, { name: WRITER_LOCK, options: { mode: 'exclusive', ifAvailable: true } });
  a.release();
  assert.equal(a.isHeld(), false, 'revocation is synchronous before the browser releases the lock');
  await flush();
  assert.equal(b.isHeld(), false, 'release does not silently give ownership to a waiting page');
  assert.equal((await b.acquire()).held, true);
  b.release();
});

// Why: unsupported or refused coordination must not silently enable unsafe storage, key reads or provider setup.
for (const failure of ['missing', 'getter', 'method-getter', 'throws', 'rejects']) test(`a ${failure} native lock interface fails closed before any data or AI initialization`, async () => {
  const writer = createEventsWriter({ locks: () => {
    if (failure === 'getter') throw new Error('disabled');
    if (failure === 'missing') return undefined;
    if (failure === 'method-getter') return Object.defineProperty({}, 'request', { get() { throw new Error('method disabled'); } });
    return { request() { if (failure === 'throws') throw new Error('denied'); return Promise.reject(new Error('denied')); } };
  } });
  assert.equal((await writer.acquire()).held, false);
  assert.equal(writer.state().status, 'unavailable');
  let touched = 0;
  const local = { get length() { touched++; throw new Error('must not read'); }, getItem() { touched++; }, setItem() { touched++; }, removeItem() { touched++; } };
  const store = createEventsStore(ui(), local, { writer, nav: null });
  assert.equal(store.set(ROOMS_KEY, []), false);
  assert.equal(store.del(ROOMS_KEY), false);
  assert.throws(() => store.get(ROOMS_KEY, []), { code: 'writer_required' });
  assert.throws(() => store.snapshot(PREFIX), { code: 'writer_required' });
  assert.throws(() => store.replaceAll(PREFIX, {}), { code: 'writer_required' });
  assert.equal(store.journal.recover().ok, false);
  assert.equal(store.journal.recoveryCopy(), null);
  assert.throws(() => createPageAI(store), { code: 'writer_required' });
  assert.equal(touched, 0);
});

// Why: a stale page must not regain its old permission through an asynchronous callback that finishes after pagehide.
test('release revokes a lock request whose callback has not yet run', async () => {
  let callback, resolveRequest;
  const manager = { request(name, options, fn) { callback = fn; return new Promise((resolve) => { resolveRequest = resolve; }); } };
  const writer = createEventsWriter({ locks: () => manager }), acquiring = writer.acquire();
  writer.release();
  assert.equal(callback({ name: WRITER_LOCK, mode: 'exclusive' }), undefined);
  resolveRequest();
  assert.equal((await acquiring).held, false);
  assert.equal(writer.isHeld(), false);
  assert.throws(() => writer.assertHeld(), { code: 'writer_required' });
});

// Why: retained callbacks from an old page must be harmless after that page gives up its writable lease.
test('a revoked store and journal refuse old save, Clear and recovery callbacks without touching storage', async () => {
  const locks = manager(), writer = createEventsWriter({ locks: () => locks }); await writer.acquire();
  const local = memory({ [ROOMS_KEY]: '[{"id":"original"}]' }), store = createEventsStore(ui(), local, { writer, nav: null });
  assert.equal(store.set(ROOMS_KEY, [{ id: 'saved-while-owned' }]), true);
  writer.release();
  const before = local.dump();
  assert.equal(store.set(ROOMS_KEY, [{ id: 'stale-save' }]), false);
  assert.equal(store.del(ROOMS_KEY), false);
  assert.throws(() => store.journal.write({}), { code: 'writer_required' });
  assert.equal(store.journal.recover().ok, false);
  assert.deepEqual(local.dump(), before);
});

// Why: startup recovery in page B must not remove page A's active pending journal and let B write inside A's Clear.
test('shared exclusive ownership closes the reported pending-marker recovery and normal-save race', async () => {
  const locks = manager(), a = createEventsWriter({ locks: () => locks }), b = createEventsWriter({ locks: () => locks });
  await a.acquire(); await b.acquire();
  const values = new Map([[ROOMS_KEY, '[{"id":"original"}]']]);
  let arm = false, interleaved = false, recoveryB, saveB;
  let journalB, storeB;
  const local = { get length() {
    if (arm) { arm = false; interleaved = true; recoveryB = journalB.recover(); saveB = storeB.set(ROOMS_KEY, [{ id: 'new-save-from-B' }]); }
    return values.size;
  }, key: (i) => [...values.keys()][i] ?? null, getItem: (key) => values.get(key) ?? null,
    setItem(key, raw) { values.set(key, String(raw)); if (key.startsWith(JOURNAL_PREFIX) && JSON.parse(raw).phase === 'pending') arm = true; }, removeItem: (key) => values.delete(key) };
  const journalA = createDataJournal(() => local, () => null, a);
  journalB = createDataJournal(() => local, () => null, b); storeB = createEventsStore(ui(), local, { writer: b, nav: null });
  journalA.write({});
  assert.equal(interleaved, true);
  assert.equal(recoveryB.ok, false);
  assert.equal(recoveryB.error, 'writer_required');
  assert.equal(saveB, false);
  assert.deepEqual(Object.fromEntries(values), {}, 'only the intended owned Clear ran');
  assert.equal(journalA.state().blocked, false);
  a.release();
});

// Why: even an unexpected native revocation must stop retained store callbacks before another page can write.
test('a rejected held request revokes ownership and notifies the page before a later reacquisition', async () => {
  let reject;
  const locks = { request(name, options, callback) { callback({ name, mode: 'exclusive' }); return new Promise((resolve, no) => { reject = no; }); } };
  const writer = createEventsWriter({ locks: () => locks });
  let lost = 0; writer.onLost(() => { lost++; assert.equal(writer.isHeld(), false); });
  await writer.acquire();
  const local = memory({ [ROOMS_KEY]: '[{"id":"original"}]' }), store = createEventsStore(ui(), local, { writer, nav: null });
  reject(new Error('native ownership revoked')); await flush();
  assert.equal(lost, 1);
  assert.equal(writer.isHeld(), false);
  assert.equal(store.set(ROOMS_KEY, []), false);
  assert.equal(store.journal.recover().ok, false);
  assert.deepEqual(local.dump(), { [ROOMS_KEY]: '[{"id":"original"}]' });
});

// Why: old Events pages cannot be forced to follow new coordination code, so users need the update precondition before Data changes.
test('Data help tells users to close or reload older Events tabs after an update', () => {
  const html = settingsHtml({ settings: { theme: 'system', drawGapMin: 7 }, ai: null, keys: '', offline: null, kept: null });
  assert.match(html, /id="set-other-tabs"/);
  assert.match(html, /After an update, close or reload every other Events tab before you use these data controls/);
  assert.match(html, /keeps an older tab from changing the same saved data/);
});
