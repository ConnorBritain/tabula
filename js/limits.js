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
  const was = hostedLimits && hostedLimits.round;
  hostedLimits = Object.assign({ limits: {}, skew: 0, roundsLeft: null }, hostedLimits, { round });
  renderHostedRound();
  // The round's AI just started (the server used the round): read the new rounds left.
  if (round.state === 'active' && (!was || was.state === 'open')) refreshLimits();
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
  renderRoundsLeft();
  const on = Boolean(hostedLimits) && L.hostedAny(capsGate);
  const lines = on ? L.limitsLines(hostedLimits.limits) : [];
  const box = document.getElementById('ai-limits');
  if (box) { box.hidden = !lines.length; box.textContent = lines.join(' '); }
  const round = hostedLimits && hostedLimits.round;
  const line = (on ? L.roundLine(round, hostedNow()) : null) || L.consentLine({ selfPaid: L.selfPaidHosted(capsGate), round, consent: R.aiConsent });
  const bar = document.getElementById('ai-round');
  if (bar) { bar.hidden = !line; document.getElementById('ai-round-text').textContent = line ? line.text : ''; }
  const btn = document.getElementById('ai-resume');
  if (btn) btn.hidden = !(line && line.resume);
  const turnOn = document.getElementById('ai-consent-on');
  if (turnOn) turnOn.hidden = !(line && line.turnOn);
}

// ---------- using a round: ask first or automatic (docs/design/AI-ROUND-CONSENT.md) ----------
// Rounds left: the top bar pill and the Settings "AI rounds" card. Only for a judge whose own rounds pay.
function renderRoundsLeft() {
  const self = L.selfPaidHosted(capsGate);
  const left = hostedLimits ? hostedLimits.roundsLeft : null;
  const text = self ? L.roundsLeftText(left) : '';
  const pill = document.getElementById('rounds-pill');
  if (pill) { pill.hidden = !text; pill.textContent = text; pill.dataset.empty = left === 0 ? '1' : ''; }
  const card = document.getElementById('ai-rounds-card');
  if (!card) return;
  card.hidden = !self;
  document.getElementById('rounds-left-num').textContent = text || 'Rounds left: unknown right now.';
  document.getElementById('rounds-buy').href = L.accountUrl(location.host);
  const mode = L.roundMode(S.aiRoundMode);
  document.querySelectorAll('input[name="round-mode"]').forEach((r) => { r.checked = r.value === mode; });
}
// Before a hosted call (js/ai.js callHosted): true to send it. Asks at most once per round; calls made while the
// question is open wait for the same answer.
let consentWait = null;
async function roundConsent(feature) {
  const step = L.consentStep({ mode: S.aiRoundMode, selfPaid: payer(feature) !== 'program', round: hostedLimits && hostedLimits.round, consent: R.aiConsent });
  if (step !== 'ask') return step === 'go';
  if (!consentWait) consentWait = askRoundConsent().finally(() => { consentWait = null; });
  return consentWait;
}
async function askRoundConsent() {
  const q = L.consentAsk(hostedLimits ? hostedLimits.roundsLeft : null);
  const v = await ask({ title: q.title, body: q.body, cancelValue: 'no', buttons: [{ label: 'Not this round', value: 'no', kind: 'plain' }, { label: 'Use a round', value: 'yes', kind: 'primary' }] });
  R.aiConsent = v === 'yes' ? 'yes' : 'no'; save(); renderHostedRound();
  if (R.aiConsent === 'yes' && !S.autoOfferShown) {
    S.autoOfferShown = true; saveSettings();
    toast('AI is on for this round.', { action: { label: 'Always use AI automatically', run: () => { S.aiRoundMode = 'auto'; saveSettings(); renderRoundsLeft(); toast('Rounds now start with AI. Change it in Settings.'); } } });
  }
  return R.aiConsent === 'yes';
}
document.addEventListener('click', (e) => {
  if (!e.target.closest) return;
  if (e.target.closest('#ai-consent-on')) { R.aiConsent = 'yes'; save(); renderHostedRound(); toast('AI is on for this round. It starts with the next update.'); return; }
  const pill = e.target.closest('#rounds-pill');
  if (pill) { if (pill.dataset.empty) window.open(L.accountUrl(location.host), '_blank', 'noopener'); else showTab('ai'); }
});
document.addEventListener('change', (e) => {
  if (e.target.name !== 'round-mode') return;
  S.aiRoundMode = L.roundMode(e.target.value); saveSettings();
}); 
document.addEventListener('click', (e) => {
  if (!e.target.closest || !e.target.closest('#ai-resume') || !hostedLimits || !hostedLimits.round) return;
  hostedResume = true; // the next hosted call asks the server to lift the pause
  setHostedRound(L.resumedRound(hostedLimits.round));
  toast('Turning AI back on. It starts with the next update.');
});
setInterval(() => { if (hostedLimits) renderHostedRound(); }, 30000); // time left counts down; a pause shows when it starts
