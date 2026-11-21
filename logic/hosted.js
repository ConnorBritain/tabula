// Hosted AI (tabula-cloud docs/APP-CLIENT-PROPOSAL.md §3 and §3a): when the account has hosted access, the AI
// features call POST /api/v1/ai/<task> on the app's own origin instead of a provider with the judge's own key.
// The server owns the prompts, the models and the prices. The app sends round state only, and only the parts a task
// needs. Names never go: the page swaps them for roles (1A, 2A, 1N, 2N) before the call, as it does for own keys.
// One part of logic.js (pure logic, no DOM, no network). logic.js joins the parts into one API.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const { paradigmText } = part('round');
  const { transcriptLines, judgeFlowLines, aiFlowSheets, flowSoFarLines } = part('prompts');
  const { APP_FEATURES, canUse, payerOf } = part('caps');
  const { hostedAiBody } = part('account');

  // Where a judge buys rounds (the buy page lives on the account site).
  const BUY_URL = 'https://tabulaspeech.com/account/';
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

  const text = (v) => String(v == null ? '' : v).trim();
  const block = (lines) => lines.join('\n');

  // The judge's own words the round-wide jobs need: the resolution, the paradigm, extra notes and (ballot only) the
  // judge's input for the draft. Tournament, school and student names are not needed and are not sent.
  function judgeNotes(round, extra) {
    const ai = round.ai || {};
    const e = extra || {};
    const lines = ['Resolution: ' + (text(round.topic) || '-')];
    const paradigm = text(e.paradigm) || text(paradigmText(ai.paradigm, ai.customParadigm));
    if (paradigm) lines.push('Judge paradigm: ' + paradigm);
    if (text(ai.notes)) lines.push('Extra judge notes: ' + text(ai.notes));
    if (text(e.judgeInput)) lines.push("The judge's own input (follow it where it conflicts): " + text(e.judgeInput));
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
    const flow = judgeFlowLines(r);
    const ai = aiFlowSheets(r);
    const flowText = [flow.length ? "JUDGE'S FLOW\n" + block(flow) : '', ai.length ? 'AI FLOW\n' + ai.join('\n') : ''].filter(Boolean).join('\n\n');
    return { transcript: block(transcriptLines(r, docs)), flow: flowText, notes: judgeNotes(r, extra) };
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

  // The server answers with server-sent events: `data: {"t":"..."}` chunks, then `data: {"done":true,"charged":n}`
  // or `data: {"error":"provider_error"}`. readSse takes the text read so far and returns the whole events in it and
  // the rest (a part event that waits for more bytes). A line that is not JSON is skipped.
  function readSse(buffer) {
    const parts = String(buffer || '').replace(/\r\n/g, '\n').split('\n\n');
    const rest = parts.pop();
    const events = [];
    for (const p of parts) {
      const data = p.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
      if (!data) continue;
      try { const ev = JSON.parse(data); if (ev && typeof ev === 'object') events.push(ev); } catch {}
    }
    return { events, rest };
  }
  // Adds one event to the answer so far. The answer is finished when done or error is set.
  function sseStep(acc, ev) {
    // The `charged` field of the done frame is not used: the balance shows at the next capability check (§3a).
    // `round` (the round's AI limits state, parseRound) may come on the done frame.
    const a = Object.assign({ text: '', done: false, error: '', round: null }, acc);
    if (a.done || a.error) return a;
    if (typeof ev.t === 'string') a.text += ev.t;
    if (ev.error) a.error = String(ev.error);
    else if (ev.done === true) { a.done = true; a.round = parseRound(ev.round); }
    return a;
  }

  // The words for each hosted problem. Plain words; no error codes.
  const HOSTED_TEXT = {
    quiet: '', // policyOff or a duplicate call: nothing is shown
    signedOut: 'You are signed out of Tabula, so your rounds cannot be used. Sign in again in Settings.',
    noCredits: 'You are out of rounds. Buy more to use AI again. The clock, flow and ballot still work.',
    planRequired: 'This account has no rounds yet. Buy rounds to use AI. The clock, flow and ballot still work.',
    dayCap: 'You reached the daily AI limit. The round goes on without AI.',
    roundCap: 'This round reached its AI limit. The round goes on without AI.',
    ageRequired: 'Confirm your age on your Tabula account page to use AI.',
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
  function hostedError(status, code) {
    const out = (kind, more) => Object.assign({ kind, text: HOSTED_TEXT[kind], retryable: false, fallback: false, quiet: false, signOut: false, link: null }, more);
    const buy = { label: 'Buy rounds', url: BUY_URL };
    const s = Number(status) || 0;
    const c = String(code || '');
    if (c === 'policyOff' || c === 'duplicate_call') return out('quiet', { quiet: true }); // policy off: stop quietly; duplicate: the first answer stands
    if (s === 401) return out('signedOut', { signOut: true, fallback: true });
    // Round limits (Terms §6.4): the round goes on with the free tools; an own key still works.
    if (c === 'round_idle') return out('roundIdle', { fallback: true, roundState: 'idle' });
    if (c === 'free_mode') return out('freeMode', { fallback: true, roundState: 'free' });
    if (c === 'round_closed') return out('roundClosed', { fallback: true, roundState: 'closed' });
    if (c === 'extras_spent') return out('extrasSpent', { fallback: true });
    if (s === 402) {
      if (c === 'round_cap') return out('roundCap');
      if (c === 'day_cap') return out('dayCap');
      if (c === 'plan_required') return out('planRequired', { fallback: true, link: buy });
      if (c === 'age_required') return out('ageRequired', { fallback: true, link: { label: 'Open account', url: BUY_URL } });
      return out('noCredits', { link: buy });
    }
    if (s === 403) return c === 'billing_hold' ? out('billingHold', { fallback: true }) : out('notAllowed');
    if (s === 404 || c === 'reload_app') return out('reload');
    if (s === 413) return out('tooLarge');
    if (s === 429) return c === 'too_many_rounds' ? out('tooManyRounds') : out('slowDown', { retryable: true });
    if (s >= 500) return out('busy', { retryable: true, fallback: true });
    return out('noAnswer', { retryable: true });
  }

  // ---------- round limits (Terms §6.4: "The app shows the current limits") ----------
  // The server owns the values (config, not code). GET /api/v1/ai/round/limits answers
  // { v: 1, now, limits: { timeLimitMin, idleMin, coverRounds }, round: null | round state }.
  function limitsRequest(roundId) {
    const q = typeof roundId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(roundId) ? '?roundId=' + encodeURIComponent(roundId) : '';
    return { url: '/api/v1/ai/round/limits' + q, init: { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } } };
  }
  const posNum = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const ROUND_STATES = ['open', 'active', 'idle', 'free', 'closed'];
  // A round's AI state, or null. Times are the server's clock (ms).
  function parseRound(r) {
    if (!r || typeof r !== 'object' || !ROUND_STATES.includes(r.state)) return null;
    const d = r.draftsLeft && typeof r.draftsLeft === 'object' ? r.draftsLeft : {};
    return {
      state: r.state, firstSpeechAt: posNum(r.firstSpeechAt), endsAt: posNum(r.endsAt), idleAt: posNum(r.idleAt),
      freeReason: r.freeReason === 'time' || r.freeReason === 'cover' ? r.freeReason : null,
      draftsLeft: { ballot: d.ballot === true, decision: d.decision === true },
    };
  }
  // The limits answer, or null. skew: server clock minus this device's clock, so times left are right on a wrong clock.
  function parseLimits(j, deviceNow) {
    if (!j || typeof j !== 'object' || j.v !== 1 || !j.limits || typeof j.limits !== 'object') return null;
    const l = j.limits;
    const limits = { timeLimitMin: posNum(l.timeLimitMin), idleMin: posNum(l.idleMin), coverRounds: posNum(l.coverRounds) };
    if (!limits.timeLimitMin && !limits.idleMin && !limits.coverRounds) return null;
    return { limits, round: parseRound(j.round), skew: posNum(j.now) && posNum(deviceNow) ? j.now - deviceNow : 0 };
  }

  const plural = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');
  // Minutes in short words: "2 hours", "1 hour 30 minutes", "45 minutes".
  function minutesText(min) {
    const m = Math.max(0, Math.round(min));
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return plural(r, 'minute');
    return plural(h, 'hour') + (r ? ' ' + plural(r, 'minute') : '');
  }
  // The current limits as plain lines, for the Round card. Only the limits the server sent.
  function limitsLines(limits) {
    const l = limits || {};
    const lines = [];
    if (l.timeLimitMin) lines.push('Tabula AI runs for up to ' + minutesText(l.timeLimitMin) + ' from the first recorded speech.');
    if (l.idleMin) lines.push('It pauses after ' + minutesText(l.idleMin) + ' with no new speech and nothing from you. One tap turns it back on.');
    if (l.coverRounds) lines.push('If a long round needs more AI than one round holds, we cover up to ' + plural(l.coverRounds, 'more round') + ' of it.');
    if (lines.length) lines.push('After a limit, the clock, flow and ballot keep working, and the ballot draft still runs once. A limit never charges you.');
    return lines;
  }

  // The round's AI state as this device sees it now (now = device time + skew). A pause or the time limit that has
  // passed since the server last spoke shows at once; the server makes the same call on the next request.
  function roundNow(round, now) {
    if (!round) return null;
    if (round.state === 'active' && round.endsAt && now >= round.endsAt) return Object.assign({}, round, { state: 'free', freeReason: 'time' });
    if (round.state === 'active' && round.idleAt && now >= round.idleAt) return Object.assign({}, round, { state: 'idle' });
    return round;
  }
  // The line in the bottom bar. { text, resume (show "Turn AI back on") } or null (nothing to show).
  function roundLine(round, now) {
    const r = roundNow(round, now);
    if (!r || r.state === 'open') return null;
    if (r.state === 'active') return r.endsAt ? { text: 'AI: ' + minutesText((r.endsAt - now) / 60000) + ' left this round', resume: false } : null;
    if (r.state === 'idle') return { text: 'AI paused: no new speech for a while', resume: true };
    const drafts = r.draftsLeft.ballot || r.draftsLeft.decision ? ' The ballot draft still runs once.' : '';
    if (r.state === 'free') return { text: 'AI limit reached for this round. Clock, flow and ballot keep working.' + drafts, resume: false };
    return { text: 'AI has ended for this round. Clock, flow and ballot keep working.', resume: false };
  }
  // May this job call hosted AI in the round's state? An idle pause blocks all (until the tap); after a limit only the
  // ballot draft runs, once. Returns the hostedError kind code that blocks it, or '' (go ahead).
  function roundBlocks(job, round, now) {
    const r = roundNow(round, now);
    if (!r) return '';
    if (r.state === 'idle') return 'round_idle';
    if (r.state === 'free' || r.state === 'closed') return job === 'ballot' && r.draftsLeft.ballot ? '' : (r.state === 'free' ? 'free_mode' : 'round_closed');
    return '';
  }

  const api = { BUY_URL, limitsRequest, parseRound, parseLimits, minutesText, limitsLines, roundNow, roundLine, roundBlocks, HOSTED_TASKS, HOSTED_TEXT, hostedOn, useHosted, hostedAny, hostedState, hostedRequest, readSse, sseStep, hostedError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).hosted = api;
})(typeof window !== 'undefined' ? window : globalThis);
