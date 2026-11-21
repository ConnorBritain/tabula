// "Judging for" at round start (roles plan step 3, tabula-cloud docs/ACCOUNTS-AND-ROLES.md §5a): a signed-in judge who
// belongs to a school picks whose AI policy and credits apply to the round, or "Just me". The choice is R.programId,
// sent as programId on hosted AI calls (L.hostedAiBody). The profile comes from js/account.js, which calls syncJudging.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// The judge's last choice on this device (a program id, or null for "Just me").
const JUDGING_KEY = 'tabula.judgingFor.v1';

// After the profile changes. Until the first speech, the round follows the device's last choice. After it, the round
// keeps its school, unless the judge no longer belongs to it (left the school, or signed out).
function syncJudging(profile) {
  R.programId = L.judgingFor(L.judgingLocked(R) ? R.programId : store.get(JUDGING_KEY, null), profile);
}

function renderJudging() {
  const opts = L.judgingOptions(acctProfile);
  const locked = L.judgingLocked(R);
  document.querySelectorAll('[data-judging-row]').forEach((row) => { row.hidden = !opts.length; });
  if (!opts.length) return;
  const name = (acctProfile.programs.find((p) => p.id === R.programId) || {}).name;
  const help = locked
    ? 'Set for this round. Start a new round to change it.'
    : (name ? name + "'s rules and credits apply to this round." : 'Your own rules and credits apply to this round.') + ' Pick before the first speech.';
  document.querySelectorAll('select[data-judging]').forEach((sel) => {
    sel.innerHTML = opts.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    sel.value = R.programId || '';
    sel.disabled = locked;
  });
  document.querySelectorAll('[data-judging-help]').forEach((p) => { p.textContent = help; });
}
document.addEventListener('change', (e) => {
  if (!e.target.matches || !e.target.matches('select[data-judging]')) return;
  if (L.judgingLocked(R)) { renderJudging(); return; } // a speech already ran; the round keeps its school
  R.programId = L.judgingFor(e.target.value, acctProfile);
  store.set(JUDGING_KEY, R.programId); save();
  renderJudging();
  refreshCaps(R.programId); // the school's AI policy for this round (js/caps.js)
});
// The server says the judge is not in that school (403 not_member): drop the choice and ask again.
function dropJudging() {
  R.programId = null; store.set(JUDGING_KEY, null); save();
  renderJudging(); refreshCaps(null);
}
