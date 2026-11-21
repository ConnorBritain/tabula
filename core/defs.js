// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, steps C0 and C1).
// Generic words only: core-words.test.mjs fails if a word from its product list appears here.
//
// How a classic script reaches this ES module (the C0 bridge, LANDING.md §2, option a):
// - In the page, index.html loads this file with type="module" before the classic scripts that use it. Those
//   classic scripts load with defer, so the browser runs them after this module, in page order. The last line
//   below puts the same functions on globalThis.TabulaCore.defs for them. Every core/ file ends this way, and the
//   global name must equal the file name (core-words.test.mjs checks both).
// - In Node, a classic file reads it with require('../core/defs.js'). core/package.json marks core/ as ES modules.

// Freeze an object and every object inside it, so shared data cannot be changed by mistake.
export function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
}

// The key of one version of a definition: 'ld@1'.
export const defKey = (id, version) => id + '@' + version;

// A registry of versioned definition files (data files with an id and a version).
// - Every version stays findable: a saved record opens with the version it was made under.
// - prepare(file) is the app's own hook. It returns the ready-to-use object (derived lists and so on). The registry
//   then freezes that object, so prepare itself does not need to freeze. Nested data that prepare does not copy is
//   shared with the file and is frozen in place: definition files are data that must never change anyway.
// - fallback { id, version } is the app's own choice for a record that names no known version. resolve() uses it.
// The registry keeps every version it is given. That no published version is ever left out is each app's own
// "ever published" test (formats.test.js, events/events-data.test.mjs).
// A file with a bad id or version, or two files with the same id and version, throw at once: a quiet skip would
// open old records with the wrong rules.
export function createRegistry(files, { prepare = (f) => Object.assign({}, f), fallback = null } = {}) {
  // No prototype, so an id such as 'constructor' from a file or the address finds nothing.
  const byKey = Object.create(null);
  const latest = Object.create(null);
  for (const file of files) {
    if (!file || typeof file.id !== 'string' || !file.id) throw new Error('definition has no id');
    if (!Number.isInteger(file.version) || file.version < 1) throw new Error(file.id + ': version must be a whole number from 1');
    const key = defKey(file.id, file.version);
    if (byKey[key]) throw new Error(key + ' is listed twice');
    const ready = deepFreeze(prepare(file));
    byKey[key] = ready;
    if (!latest[file.id] || latest[file.id].version < file.version) latest[file.id] = ready;
  }
  if (fallback && !byKey[defKey(fallback.id, fallback.version)]) throw new Error('fallback ' + defKey(fallback.id, fallback.version) + ' is not loaded');

  // get('ld') -> the newest version; get('ld', 1) -> version 1; null when unknown.
  function get(id, version) {
    if (version == null) return latest[id] || null;
    return byKey[defKey(id, Number(version))] || null;
  }
  // Like get, but an unknown id or version gives the fallback (null when there is no fallback).
  function resolve(id, version) {
    return get(id, version) || (fallback ? byKey[defKey(fallback.id, fallback.version)] : null);
  }
  // The key of every loaded version, in the order the files were given.
  const keys = () => Object.keys(byKey);
  return Object.freeze({ get, resolve, keys });
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).defs = Object.freeze({ deepFreeze, defKey, createRegistry });
