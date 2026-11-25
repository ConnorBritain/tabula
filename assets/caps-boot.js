// Hides the AI parts the gate removes before the page paints (AI-POLICY §3d step 2), so a
// removed tool never flashes on screen. It reads the cached capabilities record, profile and round, asks the same
// rule the app uses (logic/caps.js, loaded just before this file), and writes <html data-ai-off="...">.
// CSS in index.html hides [data-ai] and [data-ai-setup] by those words. js/caps.js writes it again once the page runs.
// It must be a file, not an inline script: the security rule only runs scripts from this site (script-src 'self').
(function (root) {
  'use strict';
  var C = root.PolicyLogicParts && root.PolicyLogicParts.caps;
  if (!C) return;
  function read(key) { try { return JSON.parse(root.localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  var q = new URLSearchParams(root.location.search);
  var round = read(C.STORE_KEYS.round) || {};
  var profile = read(C.STORE_KEYS.profile);
  // Keys live in localStorage when remembered, else in this tab's sessionStorage (js/ai.js). A subscription helper is
  // not known yet here, so on the judge's own computer its invite may show for a moment until the page checks it.
  var keys = read(C.STORE_KEYS.keys);
  if (!keys) { try { keys = JSON.parse(root.sessionStorage.getItem(C.STORE_KEYS.keys) || 'null'); } catch (e) { keys = null; } }
  var gate = C.gateFor({
    record: C.parseCaps(read(C.STORE_KEYS.caps)),
    profile: profile && Array.isArray(profile.programs) ? profile : null,
    programId: typeof round.programId === 'string' ? round.programId : null,
    now: Date.now(),
    // ?ai=off is the dev switch for the Flow-only look. ?caps=<fixture> hides all AI until the fixture loads.
    off: q.get('ai') === 'off' || q.has('caps'),
  });
  root.document.documentElement.setAttribute('data-ai-off', C.offTokens(gate, Boolean(keys && Object.keys(keys).length)).join(' '));
})(typeof window !== 'undefined' ? window : globalThis);
