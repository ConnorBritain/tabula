// Using a round: "Ask me first" or automatic, and rounds left (docs/design/AI-ROUND-CONSENT.md). The rules and words
// are pure (logic/limits.js); the round's server state and rounds left come from js/limits.js (thisRound, hostedLimits).
// js/ai.js callHosted calls roundConsent before every hosted request.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// Rounds left: the top bar pill and the Settings "AI rounds" card. Only for a judge whose own rounds pay.
function renderRoundsLeft() {
  const self = L.selfPaidHosted(capsGate);
  const left = hostedLimits ? hostedLimits.roundsLeft : null;
  const text = self ? L.roundsLeftText(left) : '';
  const pill = document.getElementById('rounds-pill');
  if (pill) { pill.hidden = !text; pill.textContent = text; }
  const card = document.getElementById('ai-rounds-card');
  if (!card) return;
  card.hidden = !self;
  document.getElementById('rounds-left-num').textContent = text || 'Rounds left: unknown right now.';
  document.getElementById('rounds-buy').href = L.accountUrl(location.host);
  const mode = L.roundMode(S.aiRoundMode);
  document.querySelectorAll('input[name="round-mode"]').forEach((r) => { r.checked = r.value === mode; });
}

// Before a hosted call: true to send it. Asks at most once per round; calls made while the question is open wait for
// the same answer. An answer counts only for the round it was asked in.
let consentWait = null; // { roundId, answer: Promise<boolean> }
async function roundConsent(feature) {
  const step = L.consentStep({
    mode: S.aiRoundMode, selfPaid: L.selfPays(capsGate, feature), round: thisRound(), consent: R.aiConsent,
    roundsLeft: hostedLimits ? hostedLimits.roundsLeft : null,
  });
  if (step !== 'ask') return step === 'go';
  if (!consentWait || consentWait.roundId !== R.id) {
    const roundId = R.id;
    consentWait = { roundId, answer: askRoundConsent(roundId).finally(() => { if (consentWait && consentWait.roundId === roundId) consentWait = null; }) };
  }
  return consentWait.answer;
}
async function askRoundConsent(roundId) {
  const q = L.consentAsk(hostedLimits ? hostedLimits.roundsLeft : null);
  const v = await ask({ title: q.title, body: q.body, cancelValue: 'no', buttons: [{ label: 'Not this round', value: 'no', kind: 'plain' }, { label: 'Use a round', value: 'yes', kind: 'primary' }] });
  if (R.id !== roundId) return false; // the round changed while the question was open: the answer was for the old one
  R.aiConsent = v === 'yes' ? 'yes' : 'no'; save(); renderHostedRound();
  if (R.aiConsent === 'yes') offerAutomatic();
  return R.aiConsent === 'yes';
}
// After the first "Use a round" on this device: one toast offers to stop asking.
function offerAutomatic() {
  if (S.autoOfferShown) return;
  S.autoOfferShown = true; saveSettings();
  toast('AI is on for this round.', { action: { label: 'Always use AI automatically', run: setAutomatic } });
}
function setAutomatic() {
  S.aiRoundMode = 'auto'; saveSettings(); renderRoundsLeft();
  toast('Rounds now start with AI. You can change this in Settings.');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest) return;
  if (e.target.closest('#ai-consent-on')) {
    R.aiConsent = 'yes'; save(); renderHostedRound();
    return toast('AI is on for this round. Use an AI tool, or live AI starts with the next update.');
  }
  if (e.target.closest('#rounds-pill')) {
    if (hostedLimits && hostedLimits.roundsLeft === 0) window.open(L.accountUrl(location.host), '_blank', 'noopener');
    else showTab('ai');
  }
});
