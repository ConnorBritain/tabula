// The AI gate (platform phase 1B; tabula-cloud docs/platform/CONTRACTS.md §2 and §5, docs/design/AI-POLICY.md §3):
// what this person may use in this round. The server answers one question, "what may this user do here?", with one
// record. The app shows what the record allows and removes the rest. With no record, the app is today's solo app.
// A policy only ever removes, so a missing or old record never blocks the clock, flow or ballot.
// One part of logic.js (pure logic, no DOM). It loads first, in <head>, because assets/caps-boot.js uses it to hide
// AI parts before the first paint. logic.js joins the parts into one API.
(function (root) {
  'use strict';

  // Every feature key of the contract (AI-POLICY §2a). A key the record does not send is hidden.
  const FEATURE_KEYS = ['transcription', 'aiFlow', 'liveEval', 'analysis', 'ballotDraft', 'evidenceHelp', 'practiceAI', 'libraryAI'];
  // The keys this app has controls for. data-ai in index.html takes one of these, or 'any' (shown while any is allowed).
  const APP_FEATURES = ['transcription', 'aiFlow', 'liveEval', 'analysis', 'ballotDraft'];
  // The browser storage the gate reads, also before the first paint (assets/caps-boot.js).
  const STORE_KEYS = { caps: 'tabula.caps.v2', profile: 'tabula.profile.v1', round: 'policyJudge.round.v1' };

  // GET /api/v1/me/capabilities?v=2&product=debate[&programId=...]. programId: the "Judging for" choice; null = own round.
  function capsRequest(programId) {
    const q = '?v=2&product=debate' + (programId ? '&programId=' + encodeURIComponent(programId) : '');
    return { url: '/api/v1/me/capabilities' + q, init: { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } } };
  }

  // A clean v2 record for this product, or null. Unknown fields are kept out; features keep only known keys.
  function parseCaps(j) {
    if (!j || typeof j !== 'object' || j.v !== 2 || j.product !== 'debate' || !j.features || typeof j.features !== 'object') return null;
    const features = {};
    for (const k of FEATURE_KEYS) {
      const f = j.features[k];
      if (f && typeof f === 'object' && (f.payer === 'program' || f.payer === 'self')) features[k] = { payer: f.payer };
    }
    const s = j.subject && typeof j.subject === 'object' ? j.subject : {};
    const a = j.account && typeof j.account === 'object' ? j.account : {};
    return {
      v: 2, product: 'debate', edition: typeof j.edition === 'string' ? j.edition : '',
      subject: { role: typeof s.role === 'string' ? s.role : null, programId: typeof s.programId === 'string' ? s.programId : null, managed: s.managed === true },
      features, aiSetup: j.aiSetup === true,
      account: { plan: typeof a.plan === 'string' ? a.plan : '', hosted: a.hosted === true },
      issuedAt: Number(j.issuedAt) || 0, expiresAt: Number(j.expiresAt) || 0,
    };
  }

  // What a capabilities answer means. 200 with a record: 'in'. 401: 'out' (clear the cache). 403 not_member: the
  // "Judging for" school is not the person's (drop the choice). Anything else or offline: 'unknown' (keep the cache).
  function capsOutcome(status, body) {
    if (status === 401) return { state: 'out' };
    if (status === 403 && body && body.error === 'not_member') return { state: 'notMember' };
    const record = status === 200 ? parseCaps(body) : null;
    return record ? { state: 'in', record } : { state: 'unknown' };
  }

  const sameProgram = (a, b) => (a || null) === (b || null);

  // The gate for this round (CONTRACTS §5 rule 6). st: { record (cached, may be old), profile (cached /me/profile),
  // programId (the round's "Judging for"), now, off (the ?ai=off dev switch) }. Checked only at app start and at
  // round start, never mid-round. Returns { mode, features }:
  //   'record': the record for this round, not expired, is the answer.
  //   'solo':   today's app (no record for a "Just me" round, or a judge: a judge's own AI is never removed).
  //   'none':   all AI hidden and no setup (a coach, admin or student round with no usable record; a managed account).
  function gateFor(st) {
    const s = st || {};
    if (s.off) return { mode: 'none', features: {} };
    const rec = s.record || null;
    if (rec && rec.expiresAt > s.now && sameProgram(rec.subject.programId, s.programId)) return { mode: 'record', features: rec.features, aiSetup: rec.aiSetup, hosted: rec.account.hosted };
    if (s.programId) {
      const p = s.profile && s.profile.programs.find((x) => x.id === s.programId);
      return p && p.role === 'judge' ? { mode: 'solo', features: null } : { mode: 'none', features: {} };
    }
    if (rec && rec.subject.managed) return { mode: 'none', features: {} };
    return { mode: 'solo', features: null };
  }

  // can(f): may this person use feature f? With no record (solo), yes.
  function canUse(gate, f) { return gate.mode === 'solo' ? true : Boolean(gate.features && gate.features[f]); }
  // payer(f): 'program' (the school pays), 'self' (own plan or key), or null (hidden). Solo pays for itself.
  function payerOf(gate, f) { return gate.mode === 'solo' ? 'self' : (gate.features && gate.features[f] ? gate.features[f].payer : null); }
  // The key settings (key paste, provider list, subscription buttons) may show: own AI is allowed and no hosted plan.
  // A judge who already has a key still sees them, to test, change or remove it.
  function setupAllowed(gate) { return gate.mode === 'solo' || (gate.mode === 'record' && gate.aiSetup && !gate.hosted); }
  // showSetup(): the "Connect AI" invites may show (CONTRACTS §5): setup is allowed and the device is not ready yet.
  // ready: the device has a key or a subscription helper connected (aiReady), or the record says a hosted plan.
  function showSetupFor(gate, ready) { return setupAllowed(gate) && !ready && !(gate.mode === 'record' && gate.hosted); }

  // The words for <html data-ai-off>: each app feature that is off, 'any' when none is allowed, 'setup' when the key
  // settings must hide, 'invite' when the Connect AI invites must hide. CSS hides [data-ai], [data-ai-setup] by them.
  function offTokens(gate, ready) {
    const off = APP_FEATURES.filter((f) => !canUse(gate, f));
    if (off.length === APP_FEATURES.length) off.push('any');
    if (!setupAllowed(gate)) off.push('setup');
    if (!showSetupFor(gate, ready)) off.push('invite');
    return off;
  }

  // Tour steps and palette entries carry `feature` (dropped when off). A step whose words mention an AI part carries
  // `mentions` and `plainBody` (the words with no AI, used when that feature is off). AI-POLICY §3b R3.
  function visibleTourSteps(steps, can) {
    return (steps || []).filter((st) => !st.feature || can(st.feature))
      .map((st) => (st.mentions && !can(st.mentions) ? Object.assign({}, st, { body: st.plainBody }) : st));
  }
  function paletteCommands(cmds, can) { return (cmds || []).filter((c) => !c.feature || can(c.feature)); }

  // The one-time notice for a saved key in a program that hides all AI for this person (AI-POLICY §6c): at join,
  // once per program. Not when the school pays for AI: then the key is simply not needed.
  function keyNoticeDue(st) {
    const s = st || {};
    return Boolean(s.gate && s.gate.mode === 'record' && s.programId && s.hasSavedKey
      && !APP_FEATURES.some((f) => canUse(s.gate, f)) && !(s.shown || []).includes(s.programId));
  }
  const KEY_NOTICE = (programName) => 'Your saved key is paused in ' + programName + ' rounds. It stays on this device.';

  const api = {
    FEATURE_KEYS, APP_FEATURES, STORE_KEYS, capsRequest, parseCaps, capsOutcome, gateFor, canUse, payerOf, setupAllowed,
    showSetupFor, offTokens, visibleTourSteps, paletteCommands, keyNoticeDue, KEY_NOTICE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).caps = api;
})(typeof window !== 'undefined' ? window : globalThis);
