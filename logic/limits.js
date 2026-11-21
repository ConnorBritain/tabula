// Round limits for hosted AI (Terms §6.4: "The app shows the current limits"). The server owns the values; nothing
// here is a fixed number. GET /api/v1/ai/round/limits answers
//   { v: 1, now, limits: { timeLimitMin, idleMin, coverRounds }, round: null | round state }
// and the same round state comes on the stream's done frame and on the refusals round_idle, free_mode, round_closed
// and extras_spent (shape agreed with tabula-cloud's round budget, branch claude/round-budget-f09d94).
// One part of logic.js (pure logic, no DOM, no network). logic.js joins the parts into one API.
(function (root) {
  'use strict';

  function limitsRequest(roundId) {
    const q = typeof roundId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(roundId) ? '?roundId=' + encodeURIComponent(roundId) : '';
    return { url: '/api/v1/ai/round/limits' + q, init: { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } } };
  }
  const posNum = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const ROUND_STATES = ['open', 'active', 'idle', 'free', 'closed'];
  // A round's AI state, or null. Times are the server's clock (ms). draftsLeft.ballot: the ballot draft may still run
  // once (the app has no hosted decision draft, so the server's draftsLeft.decision is not read).
  function parseRound(r) {
    if (!r || typeof r !== 'object' || !ROUND_STATES.includes(r.state)) return null;
    const d = r.draftsLeft && typeof r.draftsLeft === 'object' ? r.draftsLeft : {};
    return {
      state: r.state, endsAt: posNum(r.endsAt), idleAt: posNum(r.idleAt),
      freeReason: r.freeReason === 'time' || r.freeReason === 'cover' ? r.freeReason : null,
      draftsLeft: { ballot: d.ballot === true },
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
  // The current limits as plain lines, for the Round card. Only the limits the server sent. Words follow Terms §6.4.
  function limitsLines(limits) {
    const l = limits || {};
    const lines = [];
    if (l.timeLimitMin) lines.push('Tabula AI runs for up to ' + minutesText(l.timeLimitMin) + ' from the first recorded speech.');
    if (l.idleMin) lines.push('It pauses after ' + minutesText(l.idleMin) + ' with no new speech and no action from you. One tap turns it back on.');
    if (l.coverRounds) lines.push('If a long round needs more AI than one round holds, we cover up to ' + plural(l.coverRounds, 'more round') + ' of it.');
    if (lines.length) lines.push('After a limit, the clock, flow and ballot keep working, and the ballot draft still runs once. A limit never charges you.');
    return lines;
  }

  // For the display only: a pause or the time limit that has passed since the server last spoke shows at once.
  // Calls still go to the server, which decides (the judge may have spoken since).
  function roundNow(round, now) {
    if (!round) return null;
    if (round.state === 'active' && round.endsAt && now >= round.endsAt) return Object.assign({}, round, { state: 'free', freeReason: 'time' });
    if (round.state === 'active' && round.idleAt && now >= round.idleAt) return Object.assign({}, round, { state: 'idle' });
    return round;
  }
  // The AI tools that stop after a limit, and the free tools that keep working (the task: "which tools are now free").
  const OFF_TOOLS = 'The live AI flow, Live Eval and Analysis are off.';
  const FREE_TOOLS = 'Clock, flow and ballot keep working.';
  // The line in the bottom bar. { text, resume (show "Turn AI back on") } or null (nothing to show).
  function roundLine(round, now) {
    const r = roundNow(round, now);
    if (!r || r.state === 'open') return null;
    if (r.state === 'active') return r.endsAt ? { text: 'AI: ' + minutesText((r.endsAt - now) / 60000) + ' left this round', resume: false } : null;
    if (r.state === 'idle') return { text: 'AI paused: no new speech for a while', resume: true };
    const draft = r.draftsLeft.ballot ? ' The ballot draft still runs once.' : '';
    if (r.state === 'free') {
      const why = r.freeReason === 'cover' ? 'This round used all the AI we cover.' : r.freeReason === 'time' ? 'AI time is up for this round.' : 'AI limit reached for this round.';
      return { text: why + ' ' + OFF_TOOLS + ' ' + FREE_TOOLS + draft, resume: false };
    }
    return { text: 'AI has ended for this round. ' + FREE_TOOLS + draft, resume: false };
  }
  // Does the round's state, as the server last sent it, block this job? A pause blocks all (until the tap); after a
  // limit or the end of the round only the ballot draft runs, once. Returns the refusal code, or '' (go ahead).
  // No local prediction here: an idle time that has passed on this device still goes to the server.
  function roundBlocks(job, round) {
    if (!round) return '';
    if (round.state === 'idle') return 'round_idle';
    if (round.state === 'free' || round.state === 'closed') return job === 'ballot' && round.draftsLeft.ballot ? '' : (round.state === 'free' ? 'free_mode' : 'round_closed');
    return '';
  }
  // The judge tapped "Turn AI back on": clear only the pause (the server's, or one this device shows from idleAt).
  // The next call carries resume; the server answers with the real state (or a refusal, if another limit applies).
  function resumedRound(round) {
    return round && (round.state === 'idle' || round.state === 'active') ? Object.assign({}, round, { state: 'active', idleAt: null }) : round;
  }
  // The round state after a refusal: the server's own round if the body has one, else the previous state moved to
  // the refusal's state (roundState from hostedError), else null (nothing known).
  function roundAfterRefusal(prev, roundState, body) {
    const sent = parseRound(body && body.round);
    if (sent) return sent;
    if (!roundState) return null;
    return Object.assign(prev ? Object.assign({}, prev) : { endsAt: null, idleAt: null, freeReason: null, draftsLeft: { ballot: false } }, { state: roundState });
  }

  const api = { limitsRequest, parseRound, parseLimits, limitsLines, roundLine, roundBlocks, resumedRound, roundAfterRefusal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).limits = api;
})(typeof window !== 'undefined' ? window : globalThis);
