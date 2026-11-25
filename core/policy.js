// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C11): the AI gate. The server
// answers "what may this user do here?" with one record per product (the server's API contract;
// docs/design/AI-POLICY.md §3). The app shows what the record allows and removes the rest. With no record, the app is
// the solo app. A policy only ever removes, so a missing or old record never blocks the core of an app.
// Generic words only (core-words.test.mjs). No DOM.
//
// A head file: this is the one core/ file that is a plain script, not an ES module. The gate must run in <head>, before
// the first paint, so a removed AI tool never flashes on screen, and a module always runs after the page is read. So
// index.html loads it with a plain <script> in <head>, and it sets globalThis.TabulaCore.policy at once. It has no
// import or export, so Node can still load it (require or import); callers read the global. core-words.test.mjs checks
// this exception.
(function (root) {
  'use strict';

  // GET /api/v1/me/capabilities?v=2&product=<product>[&programId=...]. programId: the "Judging for" choice; null = own.
  function capsRequest(product, programId) {
    const q = '?v=2&product=' + encodeURIComponent(product) + (programId ? '&programId=' + encodeURIComponent(programId) : '');
    return { url: '/api/v1/me/capabilities' + q, init: { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } } };
  }

  // A clean v2 record for this product, or null. Unknown fields are kept out; features keep only known keys.
  // opts: { product, featureKeys (the feature keys of the app's contract) }, both required.
  function parseCaps(j, opts) {
    if (!opts || typeof opts.product !== 'string' || !Array.isArray(opts.featureKeys)) throw new Error('parseCaps needs { product, featureKeys }');
    const product = opts.product;
    const keys = opts.featureKeys;
    if (!j || typeof j !== 'object' || j.v !== 2 || j.product !== product || !j.features || typeof j.features !== 'object') return null;
    const features = {};
    for (const k of keys) {
      const f = j.features[k];
      if (f && typeof f === 'object' && (f.payer === 'program' || f.payer === 'self')) features[k] = { payer: f.payer };
    }
    const s = j.subject && typeof j.subject === 'object' ? j.subject : {};
    const a = j.account && typeof j.account === 'object' ? j.account : {};
    return {
      v: 2, product, edition: typeof j.edition === 'string' ? j.edition : '',
      subject: { role: typeof s.role === 'string' ? s.role : null, programId: typeof s.programId === 'string' ? s.programId : null, managed: s.managed === true },
      features, aiSetup: j.aiSetup === true,
      account: { plan: typeof a.plan === 'string' ? a.plan : '', hosted: a.hosted === true },
      issuedAt: Number(j.issuedAt) || 0, expiresAt: Number(j.expiresAt) || 0,
    };
  }

  // What a capabilities answer means. 200 with a record: 'in'. 401: 'out' (clear the cache). 403 not_member: the
  // "Judging for" school is not the person's (drop the choice). Anything else or offline: 'unknown' (keep the cache).
  function capsOutcome(status, body, opts) {
    if (status === 401) return { state: 'out' };
    if (status === 403 && body && body.error === 'not_member') return { state: 'notMember' };
    const record = status === 200 ? parseCaps(body, opts) : null;
    return record ? { state: 'in', record } : { state: 'unknown' };
  }

  const sameProgram = (a, b) => (a || null) === (b || null);

  // The gate for this round or session (CONTRACTS §5 rule 6). st: { record (cached, may be old), profile (cached
  // /me/profile), programId (the "Judging for" choice), now, off (a dev switch) }. Checked only at app start and when a
  // round or session starts, never in the middle. Returns { mode, features }:
  //   'record': the record for this round, not expired, is the answer.
  //   'solo':   the solo app (no record for a "Just me" round, or a judge: a judge's own AI is never removed).
  //   'none':   all AI hidden and no setup (a coach, admin or student round with no usable record; a managed account).
  function gateFor(st) {
    const s = st || {};
    if (s.off) return { mode: 'none', features: {} };
    const rec = s.record || null;
    // A managed account has no picker: its own round is covered by its managed school's record (CONTRACTS §3 step 1).
    const forRound = rec && (sameProgram(rec.subject.programId, s.programId) || (rec.subject.managed && !s.programId));
    if (forRound && rec.expiresAt > s.now) return { mode: 'record', features: rec.features, aiSetup: rec.aiSetup, hosted: rec.account.hosted };
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
  function setupAllowed(gate) { return gate.mode === 'solo' || (gate.mode === 'record' && gate.aiSetup && !gate.hosted); }
  // The "Connect AI" invites may show (CONTRACTS §5): setup is allowed and the device is not ready yet.
  // ready: the device has a key or a subscription helper connected, or the record says a hosted plan.
  function showSetupFor(gate, ready) { return setupAllowed(gate) && !ready && !(gate.mode === 'record' && gate.hosted); }

  // The words for <html data-ai-off>: each of the app's features that is off, 'any' when none is allowed, 'setup' when
  // the key settings must hide, 'invite' when the Connect AI invites must hide. appFeatures: the keys the app has
  // controls for.
  function offTokens(gate, ready, appFeatures) {
    if (!Array.isArray(appFeatures)) throw new Error('offTokens needs the app\'s features');
    const off = appFeatures.filter((f) => !canUse(gate, f));
    if (off.length === appFeatures.length) off.push('any');
    if (!setupAllowed(gate)) off.push('setup');
    if (!showSetupFor(gate, ready)) off.push('invite');
    return off;
  }

  // Tour steps carry `feature` (dropped when off). A step whose words mention an AI part carries `mentions` and
  // `plainBody` (the words with no AI, used when that feature is off). AI-POLICY §3b R3.
  function visibleTourSteps(steps, can) {
    return (steps || []).filter((st) => !st.feature || can(st.feature))
      .map((st) => (st.mentions && !can(st.mentions) ? Object.assign({}, st, { body: st.plainBody }) : st));
  }

  // The one-time notice for a saved key in a program that hides all of the app's AI for this person (AI-POLICY §6c):
  // at join, once per program. Not when the school pays for AI: then the key is simply not needed.
  function keyNoticeDue(st, appFeatures) {
    if (!Array.isArray(appFeatures)) throw new Error('keyNoticeDue needs the app\'s features');
    const s = st || {};
    return Boolean(s.gate && s.gate.mode === 'record' && s.programId && s.hasSavedKey
      && !appFeatures.some((f) => canUse(s.gate, f)) && !(s.shown || []).includes(s.programId));
  }

  (root.TabulaCore = root.TabulaCore || {}).policy = Object.freeze({ capsRequest, parseCaps, capsOutcome, gateFor, canUse,
    payerOf, setupAllowed, showSetupFor, offTokens, visibleTourSteps, keyNoticeDue });
})(globalThis);
