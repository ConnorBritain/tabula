// The Tabula account (roles plan step 3, tabula-cloud docs/ACCOUNTS-AND-ROLES.md §5a and §6): "School for this
// round" at round start, and the account paradigm as the one source while the judge is signed in.
// Signed out (or on a page with no account server, such as the local helper): nothing here shows, and the app works
// as before, with the paradigm kept on this device. Only the profile goes to the server, never round content.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// The last profile the server sent, so the picker and paradigm still work offline at a tournament. A 401 clears it.
const PROFILE_CACHE = 'tabula.profile.v1';
// The judge's last "School for this round" on this device (a program id, or null for "Just me").
const JUDGING_KEY = 'tabula.judgingFor.v1';
// Set once the "copy your paradigm to your account" offer was shown on this device.
const COPY_OFFERED = 'tabula.paradigmCopyOffered.v1';

let acctProfile = L.parseProfile(store.get(PROFILE_CACHE, null)); // null = signed out (or never signed in here)
let acctDirty = false; // the Settings paradigm box has changes not saved yet
let acctCheckedAt = 0;

// The paradigm the app judges by (the "My own paradigm" text): the account's when signed in, else this device's.
function myParadigm() { return L.activeParadigm(acctProfile, S.customParadigm); }

function applyProfile(next) {
  const was = acctProfile;
  acctProfile = next;
  if (next) store.set(PROFILE_CACHE, next); else store.del(PROFILE_CACHE);
  // Until the first speech, the round follows the device's last choice. After it, the round keeps its school,
  // unless the judge no longer belongs to it (left the school, or signed out).
  R.programId = L.judgingFor(L.judgingLocked(R) ? R.programId : store.get(JUDGING_KEY, null), next);
  // Signed out with no account before, the round keeps its own paradigm text, as it always did.
  if (next || was) R.ai.customParadigm = myParadigm();
  save();
  renderJudging(); renderAccount();
  if (R.tab === 'analysis') renderAnalysis();
}

async function refreshProfile() {
  acctCheckedAt = Date.now();
  const req = L.profileGet();
  let out;
  try {
    const res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(8000) });
    out = L.profileOutcome(res.status, res.status === 200 ? await res.json().catch(() => null) : null);
  } catch { out = { state: 'unknown' }; } // offline: keep the cached profile
  if (out.state === 'unknown') return;
  applyProfile(out.state === 'in' ? out.profile : null);
  if (out.state === 'in') maybeOfferParadigmCopy();
}

// Saves the paradigm to the account. Returns '' when saved, else what to tell the judge.
async function putParadigm(text) {
  const req = L.profilePut({ paradigm: L.cleanParadigm(text) });
  let res;
  try { res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(15000) }); }
  catch { return 'Not saved. Check your internet connection and try again. Your text stays here.'; }
  if (res.status === 401) { applyProfile(null); return 'Not saved: you are signed out. Sign in again at tabulaspeech.com.'; }
  const out = L.profileOutcome(res.status, res.ok ? await res.json().catch(() => null) : null);
  if (out.state !== 'in') return res.status === 400 ? 'Not saved: the server did not accept this text.' : 'Not saved. The account server did not answer. Try again in a minute.';
  applyProfile(out.profile);
  return '';
}

// On the first sign-in on this device: if the account has no paradigm and this device has one, offer once to copy it.
// Never while a speech clock runs or another dialog is open; the offer then waits for the next check.
async function maybeOfferParadigmCopy() {
  if (R.run || modalOpen()) return;
  if (!L.shouldOfferParadigmCopy({ profile: acctProfile, localText: S.customParadigm, offered: store.get(COPY_OFFERED, false) })) return;
  store.set(COPY_OFFERED, true);
  const ok = await ask({
    title: 'Copy your paradigm to your account?',
    body: 'Your Tabula account has no paradigm yet. This device has one. Copy it to your account, so every device you sign in on uses it. You can change it later in Settings.',
    buttons: [{ label: 'Not now', value: false, kind: 'plain' }, { label: 'Copy it', value: true, kind: 'primary' }], cancelValue: false,
  });
  if (!ok) return;
  if (L.paradigmError(S.customParadigm)) {
    $('#acct-paradigm').value = S.customParadigm; acctDirty = true; renderAcctCount(); // waits in Settings, not saved
    return toast(L.paradigmError(S.customParadigm) + ' It is in Settings now. Shorten it there, then save.', { kind: 'error' });
  }
  const err = await putParadigm(S.customParadigm);
  toast(err || 'Your paradigm is now in your account.', err ? { kind: 'error' } : undefined);
}

// ---------- "School for this round" ----------
function renderJudging() {
  const opts = L.judgingOptions(acctProfile);
  const locked = L.judgingLocked(R);
  document.querySelectorAll('[data-judging-row]').forEach((row) => { row.hidden = !opts.length; });
  if (!opts.length) return;
  const name = (acctProfile.programs.find((p) => p.id === R.programId) || {}).name;
  const help = locked
    ? 'Set for this round. Start a new round to change it.'
    : (name ? name + "'s AI rules and credits apply to this round." : 'Your own AI rules and credits apply to this round.') + ' Pick before the first speech.';
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
});

// ---------- the account paradigm in Settings ----------
function renderAccount() {
  const on = Boolean(acctProfile);
  $('#account-card').hidden = !on;
  // The "My own paradigm" box in Decide → Analysis edits this device's copy; signed in, it shows the account's.
  $('#lens-custom').readOnly = on;
  $('#lens-custom-note').hidden = !on;
  if (document.activeElement !== $('#lens-custom')) $('#lens-custom').value = myParadigm();
  const custom = $('#paradigm-pick option[value="custom"]');
  if (custom) custom.textContent = on ? 'My own paradigm (from my Tabula account)' : 'My own paradigm (paste it in Decide → Analysis)';
  if (!on) return;
  const who = acctProfile.displayName ? 'Signed in as ' + acctProfile.displayName + '. ' : 'Signed in. ';
  $('#acct-who').textContent = who + 'Your paradigm is saved in your Tabula account, so every device you sign in on uses it. Tabula uses it for "My own paradigm".';
  const box = $('#acct-paradigm');
  if (!acctDirty && document.activeElement !== box) box.value = acctProfile.paradigm;
  renderAcctCount();
}
function renderAcctCount() {
  const err = L.paradigmError($('#acct-paradigm').value);
  const n = L.cleanParadigm($('#acct-paradigm').value).length;
  const count = $('#acct-count');
  count.textContent = err || n.toLocaleString('en-US') + ' of 5,000 characters';
  tone(count, err ? 'error' : 'quiet');
}
$('#acct-paradigm').addEventListener('input', () => { acctDirty = true; tone($('#acct-status'), 'quiet'); $('#acct-status').textContent = ''; renderAcctCount(); });
$('#acct-save').addEventListener('click', async () => {
  const text = $('#acct-paradigm').value, status = $('#acct-status');
  const tooLong = L.paradigmError(text);
  if (tooLong) { tone(status, 'error'); status.textContent = tooLong; return; }
  $('#acct-save').disabled = true;
  tone(status, 'quiet'); status.textContent = 'Saving…';
  const err = await putParadigm(text);
  $('#acct-save').disabled = false;
  if (!err) { acctDirty = false; renderAccount(); }
  tone(status, err ? 'error' : 'ok');
  status.textContent = err || 'Saved to your account.';
});

// Check the account at start, and again when the judge comes back to this tab (they may have signed in elsewhere).
applyProfile(acctProfile); // the cached profile at once (it may be offline), then what the server says now
refreshProfile();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - acctCheckedAt > 60000) refreshProfile();
});
