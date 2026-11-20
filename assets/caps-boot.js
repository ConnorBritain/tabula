// Hides the AI parts the gate removes before the page paints (AI-POLICY §3d step 2, CONTRACTS §5 rule 3), so a
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
  var keys = read('policyJudge.keys.v1');
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
