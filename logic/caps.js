// The AI gate (platform phase 1B; the server API contracts §2 and §5, docs/design/AI-POLICY.md §3):
// what this person may use in this round. The server answers one question, "what may this user do here?", with one
// record. The app shows what the record allows and removes the rest. With no record, the app is today's solo app.
// A policy only ever removes, so a missing or old record never blocks the clock, flow or ballot.
// One part of logic.js (pure logic, no DOM). It loads first, in <head>, because assets/caps-boot.js uses it to hide
// AI parts before the first paint. logic.js joins the parts into one API.
(function (root) {
  'use strict';
  // The gate rules are shared code in core/policy.js, a head file (a plain script that index.html loads just before this
  // one). In Node, requiring it sets the same global. This file adds debate's product name, its controls and its keys.
  if (typeof module !== 'undefined' && module.exports) require('../core/policy.js');
  const P = root.TabulaCore.policy;
  const PRODUCT = 'debate';

  // Every feature key of the contract (AI-POLICY §2a). A key the record does not send is hidden.
  const FEATURE_KEYS = ['transcription', 'aiFlow', 'liveEval', 'analysis', 'ballotDraft', 'evidenceHelp', 'practiceAI', 'libraryAI'];
  // The keys this app has controls for. data-ai in index.html takes one of these, or 'any' (shown while any is allowed).
  const APP_FEATURES = ['transcription', 'aiFlow', 'liveEval', 'analysis', 'ballotDraft'];
  // The browser storage the gate reads, also before the first paint (assets/caps-boot.js).
  const STORE_KEYS = { caps: 'tabula.caps.v2', profile: 'tabula.profile.v1', round: 'policyJudge.round.v1', keys: 'policyJudge.keys.v1', settings: 'policyJudge.settings.v1' };

  // GET /api/v1/me/capabilities?v=2&product=debate[&programId=...].
  const capsRequest = (programId) => P.capsRequest(PRODUCT, programId);
  // A clean v2 record for debate, or null.
  const parseCaps = (j) => P.parseCaps(j, { product: PRODUCT, featureKeys: FEATURE_KEYS });
  // What a capabilities answer means (core/policy.js capsOutcome).
  const capsOutcome = (status, body) => P.capsOutcome(status, body, { product: PRODUCT, featureKeys: FEATURE_KEYS });
  // The gate and its questions (core/policy.js).
  const { gateFor, canUse, payerOf, setupAllowed, showSetupFor, visibleTourSteps } = P;
  // The words for <html data-ai-off>, over debate's controls.
  const offTokens = (gate, ready) => P.offTokens(gate, ready, APP_FEATURES);
  // The one-time notice for a saved key in a program that hides all AI for this person (AI-POLICY §6c).
  const keyNoticeDue = (st) => P.keyNoticeDue(st, APP_FEATURES);
  const KEY_NOTICE = (programName) => 'Your saved key is paused in ' + programName + ' rounds. It stays on this device.';

  const api = {
    FEATURE_KEYS, APP_FEATURES, STORE_KEYS, capsRequest, parseCaps, capsOutcome, gateFor, canUse, payerOf, setupAllowed,
    showSetupFor, offTokens, visibleTourSteps, keyNoticeDue, KEY_NOTICE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).caps = api;
})(typeof window !== 'undefined' ? window : globalThis);
