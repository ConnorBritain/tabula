// Shared code for Tabula Debate and Tabula Speech Events: browser storage and
// backup files, kept apart by name prefix. Generic words only (core-words.test.mjs). Loaded as described in core/defs.js.

// A store for one app. prefixes: the key name starts this app may use, for example ['policyJudge.', 'tabula.'].
// A key outside them throws: that is a bug in the app, and it must never touch the other app's saved data. The throw
// is on purpose even in the page: every key an app uses is a fixed name, so a wrong one shows up in its tests first.
// storage: localStorage in the page (read when first used, so a blocked browser does not stop the page loading),
// or a stand-in in tests. onFail(err) runs when a save fails (storage full or blocked); onSaved() after a good save.
// Storage is never trusted to exist: a read that fails gives the default, and a value that is not JSON is copied to
// '<key>.corrupt-backup' before the default is returned.
export function createStore({ prefixes, storage, onFail = () => {}, onSaved = () => {} }) {
  if (!Array.isArray(prefixes) || !prefixes.length || !prefixes.every((p) => typeof p === 'string' && p.endsWith('.'))) {
    throw new Error('createStore needs prefixes that end with a dot');
  }
  const box = () => storage || globalThis.localStorage;
  const mine = (k) => typeof k === 'string' && prefixes.some((p) => k.startsWith(p));
  const check = (k) => { if (!mine(k)) throw new Error('this store may not use the key ' + JSON.stringify(k)); };
  const checkPrefix = (p) => { if (!prefixes.includes(p)) throw new Error('this store does not own the prefix ' + JSON.stringify(p)); };
  // Every key name in storage that starts with prefix.
  function keysUnder(prefix) {
    const out = [];
    try { const b = box(); for (let i = 0; i < b.length; i++) { const k = b.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch {}
    return out;
  }

  return Object.freeze({
    get(k, d) {
      check(k);
      let raw = null;
      try { raw = box().getItem(k); return raw ? JSON.parse(raw) : d; }
      catch { try { if (raw) box().setItem(k + '.corrupt-backup', raw); } catch {} return d; }
    },
    set(k, v) {
      check(k);
      try { box().setItem(k, JSON.stringify(v)); onSaved(); return true; }
      catch (err) { onFail(err); return false; }
    },
    del(k) { check(k); try { box().removeItem(k); } catch {} },
    // { name: rawString } for every saved value under one of this store's prefixes (for a backup).
    snapshot(prefix) {
      checkPrefix(prefix);
      const out = {};
      try { for (const k of keysUnder(prefix)) out[k] = box().getItem(k); } catch {}
      return out;
    },
    // Remove every value under prefix, then write the raw strings given. Throws when a write fails, so the caller
    // can put the old snapshot back.
    replaceAll(prefix, items) {
      checkPrefix(prefix);
      for (const k of Object.keys(items)) if (!k.startsWith(prefix)) throw new Error('replaceAll: ' + k + ' is not under ' + prefix);
      for (const k of keysUnder(prefix)) box().removeItem(k);
      for (const k of Object.keys(items)) box().setItem(k, items[k]);
    },
  });
}

// ---------- backup files ----------
// One file holds every saved value under one prefix, so it can be kept or moved to another computer.
// secretKeys (API keys and the like) stay out unless includeSecrets: a backup file is easy to share by mistake.
// extra: the app's own fields (for example its documents). app: which app made the file; a file from another app
// is refused, so one app never restores the other's data.
export function buildBackup(saved, { prefix, app = 'tabula', secretKeys = [], includeSecrets = false, now, extra = {} }) {
  const storage = {};
  for (const k of Object.keys(saved || {})) {
    if (!k.startsWith(prefix)) continue;
    if (!includeSecrets && secretKeys.includes(k)) continue;
    storage[k] = saved[k];
  }
  return Object.assign({ app, kind: 'backup', version: 1, exportedAt: now || new Date().toISOString(), includesKeys: Boolean(includeSecrets), storage }, extra);
}

// Reads a backup file and says plainly what is wrong with it, if anything. Only string values under prefix are kept.
// file is the whole parsed file, for the app's own fields.
export function parseBackup(text, { prefix, app = 'tabula' }) {
  let j;
  try { j = JSON.parse(text); } catch { throw new Error('This file is not a Tabula backup (it is not JSON).'); }
  if (!j || j.app !== app || j.kind !== 'backup') throw new Error('This file is not a Tabula backup.');
  if (j.version !== 1) throw new Error('This backup is from a newer version of Tabula. Update the app first.');
  if (!j.storage || typeof j.storage !== 'object') throw new Error('This backup has no saved data in it.');
  const storage = {};
  for (const k of Object.keys(j.storage)) if (k.startsWith(prefix) && typeof j.storage[k] === 'string') storage[k] = j.storage[k];
  return { storage, exportedAt: j.exportedAt || '', includesKeys: Boolean(j.includesKeys), file: j };
}

// Save text as a file in Downloads (page only: it needs document, so the Node tests do not run it). It could move
// to core/ui.js with the other page helpers.
export function downloadFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).store = Object.freeze({ createStore, buildBackup, parseBackup, downloadFile });
