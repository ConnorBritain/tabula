import { eventsWriter } from './writer.js';
// Events-only recovery for multi-key device changes. User data stays under tabulaEvents.; recovery metadata has a
// separate prefix so a normal backup cannot accidentally include a remembered key from a journal.
export const JOURNAL_PREFIX = 'tabulaEventsRecovery.journal.';
export const RESULT_PREFIX = 'tabulaEventsRecovery.result.';
export const TAB_ID_KEY = 'tabulaEventsRecovery.tab';
const DATA_PREFIX = 'tabulaEvents.';
const PHASES = ['prepared', 'pending', 'retry', 'before', 'after'];
const record = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const validId = (x) => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
const copy = (x) => Object.assign({}, x);
const same = (a, b) => { const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]); };
const data = (x) => record(x) && Object.keys(x).every((k) => k.startsWith(DATA_PREFIX) && typeof x[k] === 'string');
const id = () => globalThis.crypto.randomUUID();

export class DataRecoveryError extends Error {
  constructor(code, { unchanged = false, blocked = true, committed = false } = {}) {
    super(code === 'journal_refused' ? 'A safe recovery copy could not be saved. Nothing changed.' : 'Device data needs recovery before another change.');
    this.name = 'DataRecoveryError'; this.code = code; this.unchanged = unchanged; this.blocked = blocked; this.committed = committed;
  }
}
const fail = (code) => { throw new DataRecoveryError(code); };
const value = (storage, key) => storage.getItem(key);
function keys(storage, prefix) {
  const out = [];
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (typeof k === 'string' && k.startsWith(prefix)) out.push(k); }
  return out;
}
function snapshot(storage) {
  const out = {};
  for (const k of keys(storage, DATA_PREFIX)) { const raw = value(storage, k); if (typeof raw !== 'string') fail('storage_changed'); out[k] = raw; }
  return out;
}
function verifiedPut(storage, key, raw) {
  storage.setItem(key, raw);
  if (value(storage, key) !== raw) fail('journal_not_verified');
}
function verifiedRemove(storage, key) {
  storage.removeItem(key);
  if (value(storage, key) !== null) fail('journal_not_removed');
}
function parse(storage, key, scope) {
  const raw = value(storage, key);
  let item;
  try { item = JSON.parse(raw); } catch { fail('journal_unreadable'); }
  if (!record(item) || item.v !== 1 || !validId(item.id) || key !== JOURNAL_PREFIX + item.id || item.scope !== scope
    || !PHASES.includes(item.phase) || !data(item.before) || !data(item.after)
    || !['replace', 'patch'].includes(item.mode) || (item.tabId !== null && !validId(item.tabId))) fail('journal_invalid');
  if (scope === 'local' && (typeof item.session !== 'boolean' || Object.keys(item).some((k) => !['v', 'id', 'scope', 'phase', 'before', 'after', 'mode', 'session', 'tabId', 'intent', 'sessionDone'].includes(k)))) fail('journal_invalid');
  if (scope === 'local' && (!['change', 'undo'].includes(item.intent) || typeof item.sessionDone !== 'boolean' || (item.session && !validId(item.tabId)) || (!item.session && item.tabId !== null))) fail('journal_invalid');
  if (scope === 'session' && !validId(item.tabId)) fail('journal_invalid');
  if (scope === 'session' && Object.keys(item).some((k) => !['v', 'id', 'scope', 'phase', 'before', 'after', 'mode', 'tabId'].includes(k))) fail('journal_invalid');
  return item;
}
function applyData(storage, target, mode, assertHeld) {
  assertHeld();
  const before = snapshot(storage);
  if (same(before, target)) return;
  if (mode === 'replace') for (const key of Object.keys(before)) { assertHeld(); storage.removeItem(key); }
  for (const key of Object.keys(target)) if (mode === 'replace' || value(storage, key) !== target[key]) { assertHeld(); storage.setItem(key, target[key]); }
  if (mode === 'patch') for (const key of Object.keys(before)) if (!(key in target)) { assertHeld(); storage.removeItem(key); }
  if (!same(snapshot(storage), target)) fail('data_not_verified');
}

/** localStorage is supplied lazily because a blocked browser may refuse its getter. No session payload is stored
 * in a local journal. A unique journal key prevents later attempts from overwriting an earlier recovery copy. */
export function createDataJournal(localStorage, sessionStorage = () => globalThis.sessionStorage, writer = eventsWriter) {
  const put = (storage, key, raw) => { writer.assertHeld(); verifiedPut(storage, key, raw); };
  const remove = (storage, key) => { writer.assertHeld(); verifiedRemove(storage, key); };
  const apply = (storage, target, mode) => applyData(storage, target, mode, () => writer.assertHeld());
  let boundSession;
  let sessionBound = false;
  const local = () => { const s = localStorage(); if (!s) fail('storage_unavailable'); return s; };
  const session = () => sessionBound ? boundSession : sessionStorage();
  function inspect() {
    writer.assertHeld();
    const l = local(), s = session();
    const tabId = s ? value(s, TAB_ID_KEY) : null;
    if (tabId !== null && !validId(tabId)) fail('session_identity_unreadable');
    const locals = keys(l, JOURNAL_PREFIX).map((k) => parse(l, k, 'local'));
    const sessions = s ? keys(s, JOURNAL_PREFIX).map((k) => parse(s, k, 'session')) : [];
    const results = keys(l, RESULT_PREFIX).map((k) => {
      let r; try { r = JSON.parse(value(l, k)); } catch { fail('journal_unreadable'); }
      if (!record(r) || r.v !== 1 || !validId(r.id) || !validId(r.tabId) || r.phase !== 'after' || k !== RESULT_PREFIX + r.id || Object.keys(r).some((key) => !['v', 'id', 'tabId', 'phase'].includes(key))) fail('journal_invalid');
      return r;
    });
    const ownResults = results.filter((r) => r.tabId === tabId);
    return { l, s, tabId, locals, sessions, results, ownResults,
      blocked: Boolean(locals.length || sessions.length || tabId || ownResults.length) };
  }
  function state() {
    try {
      const x = inspect(), first = x.locals[0] || x.sessions[0];
      return { blocked: x.blocked, phase: first?.phase || 'cleanup', intent: first?.intent || 'change', id: first?.id || null, error: null };
    } catch (error) { return { blocked: true, phase: 'unknown', error: error.code || 'storage_unavailable' }; }
  }
  function assertReady() { writer.assertHeld(); const x = state(); if (x.blocked) throw new DataRecoveryError(x.error || 'recovery_pending'); }
  function phase(storage, item, next) {
    const changed = Object.assign({}, item, { phase: next });
    put(storage, JOURNAL_PREFIX + item.id, JSON.stringify(changed));
    return changed;
  }
  function finishSession(x, item, beforeIdentityRemoval = () => {}) {
    if (item) remove(x.s, JOURNAL_PREFIX + item.id);
    for (const r of x.ownResults) remove(x.l, RESULT_PREFIX + r.id);
    beforeIdentityRemoval();
    if (x.s && value(x.s, TAB_ID_KEY) !== null && !keys(x.s, JOURNAL_PREFIX).length) remove(x.s, TAB_ID_KEY);
  }
  function recover({ retryUndo = false } = {}) {
    try {
      const x = inspect();
      if (!x.blocked) return { ok: true, recovered: false, phase: null };
      if (x.locals.length > 1 || x.sessions.length > 1) fail('journal_collision');
      const item = x.locals[0];
      if (item) {
        const own = item.session && item.tabId === x.tabId;
        const tab = x.sessions.find((r) => r.id === item.id);
        if (x.sessions.some((r) => r.id !== item.id || r.tabId !== x.tabId)) fail('journal_collision');
        if (item.phase === 'prepared' && item.intent !== 'undo') {
          // Local writes start only after the local pending marker. A prepared record can be discarded unchanged.
          if (own && tab) finishSession(x, tab);
          remove(x.l, JOURNAL_PREFIX + item.id);
          return { ok: true, recovered: true, phase: 'before' };
        }
        const undoRetry = item.intent === 'undo' && ['prepared', 'pending', 'retry'].includes(item.phase);
        const target = item.phase === 'after' || (undoRetry && retryUndo) ? 'after' : 'before';
        if (own && !tab && (['pending', 'retry'].includes(item.phase) || undoRetry)) fail('session_journal_missing');
        if (own && tab && tab.tabId !== item.tabId) fail('session_journal_invalid');
        if (item.phase === 'prepared' && (!same(snapshot(x.l), item.before) || (own && tab && !same(snapshot(x.s), tab.before)))) fail('journal_collision');
        // A new tab cannot recover a closed tab's key. Restore local data only and leave the closed key forgotten.
        try {
          apply(x.l, item[target], item.mode);
          if (own && tab) apply(x.s, tab[target], 'replace');
        } catch (error) {
          // A requested Undo target remains durable even if an explicit retry also fails.
          return { ok: false, recovered: false, phase: undoRetry ? 'retry' : null, error: error.code || 'storage_unavailable' };
        }
        const nextPhase = undoRetry && !retryUndo ? 'retry' : target;
        if (own && tab) phase(x.s, tab, nextPhase);
        const finished = phase(x.l, item, nextPhase);
        if (nextPhase === 'retry') return { ok: false, recovered: true, phase: 'retry', error: 'undo_retry_pending' };
        if (!own && item.session && !item.sessionDone && target === 'after') {
          // This receipt contains no data/key. An original tab still alive can finish its session commit correctly.
          put(x.l, RESULT_PREFIX + item.id, JSON.stringify({ v: 1, id: item.id, tabId: item.tabId, phase: 'after' }));
        }
        if (own) finishSession(x, tab, () => { put(x.l, JOURNAL_PREFIX + item.id, JSON.stringify(Object.assign({}, finished, { sessionDone: true }))); });
        remove(x.l, JOURNAL_PREFIX + item.id);
        return { ok: true, recovered: true, phase: target };
      }
      const tab = x.sessions[0];
      let recoveredTarget = 'before';
      if (tab) {
        if (!x.s || !x.tabId || tab.tabId !== x.tabId) fail('session_journal_invalid');
        const receipt = x.results.find((r) => r.id === tab.id && r.tabId === tab.tabId);
        const target = receipt ? 'after' : 'before';
        recoveredTarget = target;
        // A foreign recovery of a pending local write rolled local data back. It leaves no after receipt.
        apply(x.s, tab[target], 'replace');
        phase(x.s, tab, target);
        finishSession(x, tab);
      } else finishSession(x, null);
      return { ok: true, recovered: true, phase: recoveredTarget };
    } catch (error) { return { ok: false, recovered: false, phase: null, error: error.code || 'storage_unavailable' }; }
  }
  function write(after, { sessionItems, mode = 'replace', intent = 'change' } = {}) {
    assertReady();
    if (!data(after) || !['replace', 'patch'].includes(mode) || !['change', 'undo'].includes(intent) || (sessionItems !== undefined && !data(sessionItems))) throw new TypeError('Invalid Events transaction');
    const l = local(), hasSession = sessionItems !== undefined, s = hasSession ? session() : null;
    if (hasSession && !s) throw new DataRecoveryError('journal_refused', { unchanged: true, blocked: false });
    const before = snapshot(l), beforeSession = s ? snapshot(s) : null;
    if (same(before, after) && (!hasSession || same(beforeSession, sessionItems))) return { ok: true, unchanged: true };
    const tx = id();
    let tabId = null;
    let item;
    let started = false;
    try {
      if (s) {
        tabId = id(); put(s, TAB_ID_KEY, tabId);
        put(s, JOURNAL_PREFIX + tx, JSON.stringify({ v: 1, id: tx, scope: 'session', phase: 'prepared', before: beforeSession, after: copy(sessionItems), mode: 'replace', tabId }));
      }
      item = { v: 1, id: tx, scope: 'local', phase: 'prepared', before, after: copy(after), mode, session: hasSession, tabId, intent, sessionDone: !hasSession };
      put(l, JOURNAL_PREFIX + tx, JSON.stringify(item));
      const prepared = inspect();
      if (prepared.locals.length !== 1 || prepared.locals[0].id !== tx || prepared.sessions.some((r) => r.id !== tx)
        || !same(snapshot(l), before) || (s && !same(snapshot(s), beforeSession))) fail('journal_collision');
      if (s) phase(s, prepared.sessions[0], 'pending');
      item = phase(l, item, 'pending');
      started = true;
      apply(l, item.after, mode);
      if (s) apply(s, sessionItems, 'replace');
      if (!same(snapshot(l), item.after) || (s && !same(snapshot(s), sessionItems))) fail('data_not_verified');
      if (s) phase(s, Object.assign({}, prepared.sessions[0], { phase: 'pending' }), 'after');
      item = phase(l, item, 'after');
      const complete = inspect();
      if (complete.locals.length !== 1 || complete.locals[0].id !== tx) fail('journal_collision');
      if (s) finishSession(complete, complete.sessions[0], () => { item = Object.assign({}, item, { sessionDone: true }); put(l, JOURNAL_PREFIX + tx, JSON.stringify(item)); });
      remove(l, JOURNAL_PREFIX + tx);
      return { ok: true, unchanged: false };
    } catch (error) {
      // A committed marker is authoritative even if cleanup failed. Never roll a verified commit back.
      const observed = state();
      const committed = item?.phase === 'after' || (observed.phase === 'after' && observed.id === tx);
      const currentMatches = (saved, savedSession) => {
        try { return same(snapshot(l), saved) && (!s || same(snapshot(s), savedSession)); } catch { return false; }
      };
      let owned = false;
      try { const x = inspect(); owned = x.locals.some((r) => r.id === tx) || x.sessions.some((r) => r.id === tx) || Boolean(tabId && x.tabId === tabId); } catch { owned = true; }
      if (!owned) {
        // Removal may have succeeded before its verification read failed. The proved commit and exact target still win.
        if (committed && !observed.blocked && currentMatches(after, sessionItems)) return { ok: true, unchanged: false };
        throw new DataRecoveryError(committed ? 'cleanup_failed' : 'journal_refused', { unchanged: !committed && currentMatches(before, beforeSession), blocked: observed.blocked, committed });
      }
      const result = recover();
      if (committed && result.ok && currentMatches(after, sessionItems)) return { ok: true, unchanged: false };
      throw new DataRecoveryError(started ? 'data_change_failed' : 'journal_refused', {
        unchanged: result.ok && result.phase !== 'after', blocked: !result.ok || state().blocked, committed,
      });
    }
  }
  return Object.freeze({
    useSessionStorage(storage) { boundSession = storage; sessionBound = true; },
    state, assertReady, write, recover,
    snapshot() { assertReady(); return snapshot(local()); },
    sessionSnapshot() { assertReady(); const s = session(); if (!s) fail('storage_unavailable'); return snapshot(s); },
    matches(saved, savedSession) {
      try { return !state().blocked && same(snapshot(local()), saved) && (savedSession === undefined || same(snapshot(session()), savedSession)); } catch { return false; }
    },
    recoveryCopy() {
      try { writer.assertHeld(); const l = local(), found = keys(l, JOURNAL_PREFIX); if (found.length !== 1) return null; const r = parse(l, found[0], 'local'); return copy(r.intent === 'undo' ? r.after : r.before); } catch { return null; }
    },
  });
}
