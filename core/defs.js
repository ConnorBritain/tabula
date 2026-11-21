// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C0).
// Generic words only: core-words.test.mjs fails if a word from its product list appears here.
//
// How a classic script reaches this ES module (the C0 bridge, LANDING.md §2, option a):
// - In the page, index.html loads this file with type="module" before the classic scripts that use it. Those
//   classic scripts load with defer, so the browser runs them after this module, in page order. The last line
//   below puts the same functions on globalThis.TabulaCore.defs for them. Every core/ file ends this way, and the
//   global name must equal the file name (core-words.test.mjs checks both).
// - In Node, a classic file reads it with require('../core/defs.js'). core/package.json marks core/ as ES modules.
//
// C0 holds only deepFreeze. Step C1 adds the definition registry (find by id and version, newest version).

// Freeze an object and every object inside it, so shared data cannot be changed by mistake.
export function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).defs = Object.freeze({ deepFreeze });
