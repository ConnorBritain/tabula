// Hosted AI (tabula-cloud docs/APP-CLIENT-PROPOSAL.md §3 and §3a): when the account has hosted access, the AI
// features call POST /api/v1/ai/<task> on the app's own origin instead of a provider with the judge's own key.
// The server owns the prompts, the models and the prices. The app sends round state only, and only the parts a task
// needs. Names never go: the page swaps them for roles (1A, 2A, 1N, 2N) before the call, as it does for own keys.
// One part of logic.js (pure logic, no DOM, no network). logic.js joins the parts into one API.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const { paradigmText, ptsRange } = part('round');
  const { transcriptLines, judgeFlowLines, aiFlowSheets, flowSoFarLines, ballotRequestLines } = part('prompts');
  const { APP_FEATURES, canUse, payerOf } = part('caps');
  const { hostedAiBody } = part('account');
  const { parseRound } = part('limits');

  // Where a judge buys rounds (the buy page lives on the account site). The staging app (debate.tabulaspeech.dev)
  // links to the staging account site, so a test purchase never opens the live one.
  // Staging hosts: tabula-cloud docs/DEPLOY.md "Staging site" (the one list).
  const ACCOUNT_SITES = ['tabulaspeech.com', 'tabulaspeech.dev'];
  const BUY_URL = 'https://' + ACCOUNT_SITES[0] + '/account/';
  function accountUrl(host) {
    const h = String(host || '').toLowerCase();
    const site = ACCOUNT_SITES.find((d) => h === d || h.endsWith('.' + d));
    return site ? 'https://' + site + '/account/' : BUY_URL;
  }
  // The Pricing page (prices and packs) on the same account site, for links that must not buy yet (the demo's nudge).
  // The page moved from /plans/ to /pricing/ (the old URL redirects). The function keeps its old name.
  function plansUrl(host) { return accountUrl(host).replace(/\/account\/$/, '/pricing/'); }
  // The sign-in page on the same account site. An app host the server lets sign-in return to (tabula-cloud
  // RETURN_ORIGINS: debate. and my.) asks to come back to itself (?return=). Any other host (localhost, a preview, an app
  // not on that list yet, such as events.) gets the plain sign-in page and lands on the account site's own home.
  const RETURN_APPS = ['debate', 'my'];
  function signinUrl(host) {
    const h = String(host || '').toLowerCase();
    const page = accountUrl(h).replace(/\/account\/$/, '/signin/');
    const back = ACCOUNT_SITES.some((d) => RETURN_APPS.some((a) => h === a + '.' + d));
    return back ? page + '?return=' + encodeURIComponent('https://' + h + '/') : page;
  }
  // The round format the server knows (tabula-cloud src/ai/tasks.ts KNOWN_FORMATS). A new version needs the server first.
  const FORMAT = 'policy-hs', FORMAT_VERSION = 1;

  // Each app job and the server task it calls.
  const HOSTED_TASKS = {
    flow: { task: 'flow.update' }, eval: { task: 'eval.live' }, lens: { task: 'analysis.lens' },
    impacts: { task: 'analysis.impact' }, map: { task: 'analysis.map' }, ballot: { task: 'ballot.fill' },
  };

  // Hosted AI can run feature f in this round: the round's record allows f, and the account has hosted access
  // (its own credits) or the school pays for f. No record ("Just me" signed out, or old caches): never hosted.
  function hostedOn(gate, f) {
    return Boolean(gate && gate.mode === 'record' && canUse(gate, f) && (gate.hosted === true || payerOf(gate, f) === 'program'));
  }
  // Hosted AI does run f: hostedOn, and the judge has not chosen an own key for a feature they pay for themselves.
  // keyReady: an own key or subscription helper is connected. A school that pays always wins (it pays, not the judge).
  function useHosted(gate, f, keyReady) {
    return hostedOn(gate, f) && !(keyReady && payerOf(gate, f) !== 'program');
  }
  // Some app feature runs hosted: the device is ready for AI without a key.
  function hostedAny(gate) { return APP_FEATURES.some((f) => hostedOn(gate, f)); }
  // Feature f runs hosted and is paid from the judge's own rounds (not a school): the round question applies to it.
  function selfPays(gate, f) { return hostedOn(gate, f) && payerOf(gate, f) !== 'program'; }
  // Some feature is: rounds left show (the top bar pill and the Settings card).
  function selfPaidHosted(gate) { return APP_FEATURES.some((f) => selfPays(gate, f)); }
  // The judge has a hosted plan for this round: the record says hosted access, or the school pays for some feature.
  // Such a judge needs no key, so the first-time key welcome never shows (spec 2.1, Q11). No gate: no plan.
  function hasHostedPlan(gate) { return Boolean(gate && gate.mode === 'record' && (gate.hosted === true || hostedAny(gate))); }

  const text = (v) => String(v == null ? '' : v).trim();
  const block = (lines) => lines.join('\n');

  // The judge's own words the round-wide jobs need: the resolution, the paradigm and extra notes.
  // The ballot adds its request (hand-set fields, the judge's input, a redo, Live Eval feedback) in hostedState. Tournament, school and student names are not needed and are not sent.
  function judgeNotes(round, extra) {
    const ai = round.ai || {};
    const e = extra || {};
    const lines = ['Resolution: ' + (text(round.topic) || '-')];
    const paradigm = text(e.paradigm) || text(paradigmText(ai.paradigm, ai.customParadigm));
    if (paradigm) lines.push('Judge paradigm: ' + paradigm);
    if (text(ai.notes)) lines.push('Extra judge notes: ' + text(ai.notes));
    return block(lines);
  }

  // The round state for one hosted job (APP-CLIENT-PROPOSAL §3, §3a). job: a HOSTED_TASKS key. Docs are added by the
  // page (the same text, in the same order, on every call of a round, so the provider can cache them).
  //  flow: the speech id and that whole speech so far (the server bills only new words), and the AI flow of the
  //        earlier speeches. No paradigm, notes or other transcripts: the flow does not need them.
  //  other jobs judge the whole round: every transcript, the judge's flow and the AI flow, and the judge's notes.
  function hostedState(job, round, docs, extra) {
    const r = round || {};
    if (job === 'flow') {
      const speech = text(extra && extra.speech);
      return { speech, transcript: text((r.transcripts || {})[speech]), flow: block(flowSoFarLines(r, speech)) };
    }
    const e = extra || {};
    const flow = judgeFlowLines(r);
    const ai = aiFlowSheets(r);
    const flowText = [flow.length ? "JUDGE'S FLOW\n" + block(flow) : '', ai.length ? 'AI FLOW\n' + ai.join('\n') : ''].filter(Boolean).join('\n\n');
    let notes = judgeNotes(r, e);
    if (job === 'ballot') notes = [notes, ...ballotRequestLines(r, e.judgeInput, e)].join('\n').trim();
    const state = { transcript: block(transcriptLines(r, docs)), flow: flowText, notes };
    // The server owns the guide text for each reading level and the points scale (tabula-cloud contracts/ai-replies-v1).
    // The round map gets no level (callAI passes reading: null for it, as on the own-key path): its text is short labels.
    if (e.reading === 'expert' || e.reading === 'plain') state.reading = e.reading;
    if (job === 'ballot' || job === 'eval') state.pointsRange = ptsRange(e.range || r.ptsRange);
    return state;
  }

  // The fetch for one hosted call. The body is built by hostedAiBody, so the round id and the round's school always
  // come from the round (account.test.js checks this). callId: a new random id for each call.
  // resume: the judge tapped "Turn AI back on" after an idle pause; the server lifts the pause on this call.
  function hostedRequest(round, job, state, callId, resume) {
    const t = HOSTED_TASKS[job];
    if (!t) throw new Error('unknown hosted job: ' + job);
    const body = hostedAiBody(round, Object.assign({ callId, format: FORMAT, formatVersion: FORMAT_VERSION, state }, resume ? { resume: true } : {}));
    return {
      url: '/api/v1/ai/' + t.task,
      init: {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-tabula': '1', accept: 'text/event-stream' },
        body: JSON.stringify(body),
      },
    };
  }

  // The server answers with server-sent events (readSse and sseStep are shared code in core/ai.js). Debate keeps the
  // round's AI limits from the done frame as acc.round (logic/limits.js parseRound).
  const AI = typeof module !== 'undefined' && module.exports ? require('../core/ai.js') : root.TabulaCore.ai;
  const readSse = AI.readSse;
  // Adds one event to the answer so far: { text, done, error, round }. The answer is finished when done or error is set.
  function sseStep(acc, ev) {
    const a = Object.assign({ text: '', done: false, error: '', round: null }, acc);
    const c = AI.sseStep({ text: a.text, done: a.done, error: a.error, info: a.round }, ev, (e) => parseRound(e.round));
    return { text: c.text, done: c.done, error: c.error, round: c.info };
  }

  // The words for each hosted problem. Plain words; no error codes.
  const HOSTED_TEXT = {
    quiet: '', // policyOff or a duplicate call: nothing is shown
    signedOut: 'You are signed out of Tabula, so your rounds cannot be used. Sign in again to use them.',
    noCredits: 'You are out of rounds. Buy more to use AI again. The clock, flow and ballot still work.',
    planRequired: 'This account has no rounds yet. Buy rounds to use AI. The clock, flow and ballot still work.',
    dayCap: 'You reached the daily AI limit. The round goes on without AI.',
    roundCap: 'This round reached its AI limit. The round goes on without AI.',
    ageRequired: 'Add your date of birth on your Tabula account page to use AI. The clock, flow and ballot still work.',
    parentConsent: 'Where you live, a parent or guardian must agree before you use Tabula AI. The clock, flow and ballot still work.',
    billingHold: 'Billing is on hold for this account, so Tabula AI is paused. Your own key still works.',
    notAllowed: 'AI is not allowed for this round.',
    slowDown: 'Too many AI requests at once. Wait a moment and try again.',
    tooManyRounds: 'Too many rounds today. The round goes on without AI.',
    tooLarge: 'This round is too big to send to the AI. Remove a document and try again.',
    busy: 'AI busy, catching up. Try again in a moment.',
    reload: 'Tabula was updated. Reload the page after this round.',
    roundIdle: 'AI is paused: no new speech for a while. Turn it back on in the bar at the bottom.',
    freeMode: 'This round reached its AI limit. The clock, flow and ballot keep working. You are not charged.',
    roundClosed: 'AI has ended for this round. The clock, flow and ballot keep working.',
    extrasSpent: 'The extra AI tools have used this round. The clock, flow, ballot and live flow keep working.',
    noAnswer: 'The AI did not answer. Try again.',
    badReply: 'The AI answer was not in a form Tabula can read. Try again.',
  };

  // What the app does with a hosted answer that is not a stream (APP-CLIENT-PROPOSAL §3, error table).
  // status: the HTTP status (0: the stream itself failed). code: the server's error code.
  // Returns { kind, text, retryable, fallback (use the judge's own key if there is one), quiet (stop and show
  // nothing), signOut (forget the capability record), link: { label, url } or null }.
  // account: the account page for this app (accountUrl); the production one by default.
  // signin: the sign-in page for this app (signinUrl); the production one by default.
  function hostedError(status, code, account, signin) {
    const out = (kind, more) => Object.assign({ kind, text: HOSTED_TEXT[kind], retryable: false, fallback: false, quiet: false, signOut: false, link: null }, more);
    const page = account || BUY_URL;
    const buy = { label: 'Buy rounds', url: page };
    const s = Number(status) || 0;
    const c = String(code || '');
    if (c === 'policyOff' || c === 'duplicate_call') return out('quiet', { quiet: true }); // policy off: stop quietly; duplicate: the first answer stands
    if (s === 401) return out('signedOut', { signOut: true, fallback: true, link: { label: 'Sign in', url: signin || signinUrl('') } });
    // Round limits (Terms §6.4): the round goes on with the free tools; an own key still works.
    if (c === 'round_idle') return out('roundIdle', { fallback: true, roundState: 'idle' });
    if (c === 'free_mode') return out('freeMode', { fallback: true, roundState: 'free' });
    if (c === 'round_closed') return out('roundClosed', { fallback: true, roundState: 'closed' });
    if (c === 'extras_spent') return out('extrasSpent', { fallback: true });
    if (s === 402) {
      if (c === 'round_cap') return out('roundCap');
      if (c === 'day_cap') return out('dayCap');
      if (c === 'plan_required') return out('planRequired', { fallback: true, link: buy });
      // Age rules (tabula-cloud src/age.ts, Terms §3): age_required = no date of birth yet.
      if (c === 'age_required') return out('ageRequired', { fallback: true, link: { label: 'Open account', url: page } });
      if (c === 'parent_consent_required') return out('parentConsent', { fallback: true });
      return out('noCredits', { link: buy });
    }
    if (s === 403) return c === 'billing_hold' ? out('billingHold', { fallback: true }) : out('notAllowed');
    if (s === 404 || c === 'reload_app') return out('reload');
    if (s === 413) return out('tooLarge');
    if (s === 429) return c === 'too_many_rounds' ? out('tooManyRounds') : out('slowDown', { retryable: true });
    if (s >= 500) return out('busy', { retryable: true, fallback: true });
    return out('noAnswer', { retryable: true });
  }

  const api = { BUY_URL, accountUrl, plansUrl, signinUrl, HOSTED_TASKS, HOSTED_TEXT, hostedOn, useHosted, hostedAny, selfPays, selfPaidHosted, hasHostedPlan, hostedState, hostedRequest, readSse, sseStep, hostedError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).hosted = api;
})(typeof window !== 'undefined' ? window : globalThis);
