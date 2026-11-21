// Round limits for hosted AI (Terms §6.4: "The app shows the current limits"): the Round card shows the limits and the
// bottom bar shows the round's AI state. The words and rules are pure (logic/limits.js); js/ai.js feeds the state
// from each hosted answer.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// The server sends the limits and the round's AI state (L.parseLimits); nothing here is a fixed number. The Round card
// shows the limits; the bottom bar shows the round's state (time left, paused with a tap to resume, limit reached).
let hostedLimits = null; // { limits, round, skew } from the server, or null
let hostedResume = false; // the judge tapped "Turn AI back on": the next hosted call lifts the idle pause
const hostedNow = () => Date.now() + (hostedLimits ? hostedLimits.skew : 0);
function setHostedRound(round) {
  if (!round) return;
  hostedLimits = Object.assign({ limits: {}, skew: 0 }, hostedLimits, { round });
  renderHostedRound();
}
// At a round boundary (js/caps.js applyCapabilities): read the limits for this round. No hosted access: show nothing.
async function refreshLimits() {
  if (!L.hostedAny(capsGate)) { hostedLimits = null; renderHostedRound(); return; }
  const req = L.limitsRequest(R.id);
  try {
    const res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(8000) });
    const got = res.ok ? L.parseLimits(await res.json().catch(() => null), Date.now()) : null;
    if (got) hostedLimits = got;
  } catch {} // offline or no route yet: keep what we have
  renderHostedRound();
}
function renderHostedRound() {
  const on = Boolean(hostedLimits) && L.hostedAny(capsGate);
  const lines = on ? L.limitsLines(hostedLimits.limits) : [];
  const box = document.getElementById('ai-limits');
  if (box) { box.hidden = !lines.length; box.textContent = lines.join(' '); }
  const line = on ? L.roundLine(hostedLimits.round, hostedNow()) : null;
  const bar = document.getElementById('ai-round');
  if (bar) { bar.hidden = !line; document.getElementById('ai-round-text').textContent = line ? line.text : ''; }
  const btn = document.getElementById('ai-resume');
  if (btn) btn.hidden = !(line && line.resume);
}
document.addEventListener('click', (e) => {
  if (!e.target.closest || !e.target.closest('#ai-resume') || !hostedLimits || !hostedLimits.round) return;
  hostedResume = true; // the next hosted call asks the server to lift the pause
  setHostedRound(L.resumedRound(hostedLimits.round));
  toast('Turning AI back on. It starts with the next update.');
});
setInterval(() => { if (hostedLimits) renderHostedRound(); }, 30000); // time left counts down; a pause shows when it starts
