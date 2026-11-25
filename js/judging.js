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
  renderPracticeSlot();
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

// ----- Practice slot: the send sheet on the Ballot -----
// The one switch. Off: nothing below shows and nothing is called.
const PRACTICE_SLOT_ON = false;
const SLOT_THEMES = [
  ['too_fast', 'Too fast'], ['no_signposting', 'No signposting'], ['time_use', 'Time use'], ['dropped_args', 'Dropped arguments'],
  ['no_warrants', 'No warrants'], ['new_in_rebuttals', 'New in rebuttals'], ['weak_weighing', 'Weak weighing'],
  ['no_ballot_story', 'No ballot story'], ['evidence_quality', 'Evidence quality'], ['evidence_comparison', 'Evidence comparison'],
  ['too_much_last_speech', 'Too much in the last speech'], ['theory_and_t', 'Theory and T'], ['kritik_debate', 'Kritik debate'],
  ['cp_and_perms', 'Counterplans and perms'], ['judge_adaptation', 'Judge adaptation'], ['cx_use', 'Use of cross-ex'],
  ['conduct', 'Conduct'], ['prep_and_docs', 'Prep and docs'], ['strong', 'Strong work'],
];
const SLOT_MAX_THEMES = 4;
const SLOT_RFD_MAX = 10000;
const freshSlot = () => ({ code: '', round: null, pts: {}, themes: {}, showName: false, msg: '', busy: false, sent: null });
let slot = freshSlot();
let slotDlg = null;

// Shown only while the switch is on and the judge is signed in and judging for a team.
function slotShown() { return PRACTICE_SLOT_ON && Boolean(acctProfile) && Boolean(R.programId); }

// The one adapter for the two network calls. -> { status, body } (status 0 when the server could not be reached).
async function slotCall(path, body) {
  try {
    const res = await fetch('/api/v1/practice/slots/' + path, {
      method: 'POST', credentials: 'same-origin', referrerPolicy: 'strict-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', 'X-Tabula': '1' }, body: JSON.stringify({ programId: R.programId, ...body }), signal: AbortSignal.timeout(15000),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch { return { status: 0, body: null }; }
}

function slotErrorText(status, body) {
  const code = body && body.error;
  if (status === 404) return 'No round has that code. Check the round code and try again.';
  if (status === 429) return 'Too many tries. Wait a few minutes, then try again.';
  if (status === 409) return 'This round already has a ballot. Nothing was sent.';
  if (status === 403 && code === 'not_your_round') return 'This round code is for a different judge.';
  if (status === 401) return 'You are signed out. Sign in, then try again.';
  if (status === 403) return 'Sending is not available right now.';
  if (status === 400) return 'The server did not accept this ballot. Check the points (0 to 30), up to 4 themes each, and the reason for decision.';
  if (status === 0) return 'Could not reach the server. Check your connection and try again. Nothing was sent.';
  return 'Something went wrong. Nothing was sent. Try again in a minute.';
}

const slotStudents = () => (slot.round ? [...slot.round.aff, ...slot.round.neg] : []);

// Picks or drops a theme for one student; at most 4.
function slotToggleTheme(userId, theme) {
  const cur = slot.themes[userId] || [];
  if (cur.includes(theme)) slot.themes[userId] = cur.filter((t) => t !== theme);
  else if (cur.length < SLOT_MAX_THEMES && SLOT_THEMES.some(([v]) => v === theme)) slot.themes[userId] = [...cur, theme];
}

// The ballot fields that leave the device, and nothing else. -> { body } or { err }.
function slotBallot() {
  const b = R.ballot || {};
  const winner = String(b.winner || '').toLowerCase();
  if (winner !== 'aff' && winner !== 'neg') return { err: 'Pick the winner on the ballot first.' };
  const rfd = String(b.rfd || '').trim();
  if (!rfd) return { err: 'Write a reason for decision on the ballot first.' };
  if (rfd.length > SLOT_RFD_MAX) return { err: 'The reason for decision is too long to send (10,000 characters at most).' };
  const ids = slotStudents().map((s) => s.id);
  const points = {}, themes = {};
  for (const id of ids) {
    const raw = slot.pts[id];
    if (raw !== undefined && raw !== '') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 30) return { err: 'Points must be from 0 to 30.' };
      points[id] = n;
    }
    if ((slot.themes[id] || []).length) themes[id] = slot.themes[id].slice(0, SLOT_MAX_THEMES);
  }
  return { body: { code: slot.code, winner, points, rfd, comments: { aff: String(b.affFb || ''), neg: String(b.negFb || '') }, themes, showName: slot.showName === true } };
}

function slotSheetHtml() {
  const team = ((acctProfile && acctProfile.programs.find((p) => p.id === R.programId)) || {}).name || '';
  const msg = slot.msg ? `<p class="warn" role="alert">${escapeHtml(slot.msg)}</p>` : '';
  const head = `<h2 id="slot-title">Send sheet</h2><button class="iconbtn ask-x" type="button" data-slot="no" aria-label="Close">×</button>
    <p class="muted">Judging for ${escapeHtml(team)}. Practice slot: nothing is sent unless you choose Send to both teams.</p>`;
  if (slot.sent) {
    const names = (ids) => slotStudents().filter((s) => ids.includes(s.id)).map((s) => escapeHtml(s.name)).join(', ');
    const out = slot.sent.leftOut.length ? `<p>Not sent to: ${names(slot.sent.leftOut)}. They do not get practice ballots.</p>` : '';
    return head + `<p role="status">Sent to: ${names(slot.sent.sentTo) || 'no one'}.</p>${out}<div class="ask-btns"><button class="b primary" type="button" data-slot="no">Done</button></div>`;
  }
  const code = `<label for="slot-code">Round code</label><div class="row"><input id="slot-code" data-slot-code maxlength="8" autocomplete="off" spellcheck="false" value="${escapeHtml(slot.code)}"${slot.round ? ' readonly' : ''}>
    <button class="b" type="button" data-slot="open"${slot.busy || slot.round ? ' disabled' : ''}>Open</button></div>`;
  if (!slot.round) return head + code + msg + `<div class="ask-btns"><button class="b" type="button" data-slot="no">Not now</button></div>`;
  const student = (s) => `<div class="mt-2" data-slot-student="${escapeHtml(s.id)}"><strong>${escapeHtml(s.name)}</strong>${s.getsBallot ? '' : ' <span class="muted">(no practice ballot)</span>'}
    <label class="row">Points <input type="number" min="0" max="30" step="0.1" class="w-auto" data-slot-pts="${escapeHtml(s.id)}" value="${escapeHtml(slot.pts[s.id] ?? '')}"></label>
    <div class="row">${SLOT_THEMES.map(([v, label]) => { const on = (slot.themes[s.id] || []).includes(v); return `<button class="b small" type="button" id="${slotChipId(s.id, v)}" aria-pressed="${on}" data-slot-theme="${v}" data-slot-for="${escapeHtml(s.id)}">${escapeHtml(label)}</button>`; }).join('')}</div></div>`;
  const side = (label, list) => `<fieldset class="dlg-set mt-3"><legend>${label}</legend>${list.map(student).join('')}</fieldset>`;
  return head + code + side('Aff', slot.round.aff) + side('Neg', slot.round.neg)
    + `<p class="muted">Pick 0 to 4 themes for each student.</p>`
    + `<label class="row check-row mt-3"><input type="checkbox" data-slot-name${slot.showName ? ' checked' : ''}> Show my name</label>` + msg
    + `<div class="ask-btns"><button class="b" type="button" data-slot="no">Not now</button><button class="b primary" type="button" data-slot="send"${slot.busy ? ' disabled' : ''}>Send to both teams</button></div>`;
}

const slotChipId = (userId, theme) => 'slot-th-' + slotStudents().findIndex((x) => x.id === userId) + '-' + theme;
// A chip press redraws the card; focus stays on the pressed chip.
function slotPickTheme(userId, theme) {
  slotToggleTheme(userId, theme); drawSlotSheet();
  const chip = document.getElementById(slotChipId(userId, theme));
  if (chip) chip.focus();
}

function drawSlotSheet() { const card = document.getElementById('slot-card'); if (card) card.innerHTML = slotSheetHtml(); }

async function slotOpenRound() {
  const code = String(slot.code || '').trim();
  if (!/^\S{8}$/.test(code)) { slot.msg = 'The round code has 8 characters.'; return drawSlotSheet(); }
  slot.busy = true; slot.msg = ''; drawSlotSheet();
  const r = await slotCall('open', { code });
  slot.busy = false;
  const ok = r.status === 200 && r.body && Array.isArray(r.body.aff) && Array.isArray(r.body.neg);
  if (ok) { slot.code = code; slot.round = r.body; } else slot.msg = slotErrorText(r.status, r.body);
  drawSlotSheet();
}

async function slotSend() {
  if (!slot.round || slot.busy || slot.sent) return;
  const b = slotBallot();
  if (b.err) { slot.msg = b.err; return drawSlotSheet(); }
  slot.busy = true; slot.msg = ''; drawSlotSheet();
  const r = await slotCall(encodeURIComponent(slot.round.id) + '/ballot', b.body);
  slot.busy = false;
  if (r.status === 200 && r.body && r.body.ok) slot.sent = { sentTo: r.body.sentTo || [], leftOut: r.body.leftOut || [] };
  else slot.msg = slotErrorText(r.status, r.body);
  drawSlotSheet();
}

// "Not now" (and × and Esc): close, send nothing.
function slotNotNow() { if (slotDlg) slotDlg.close(); }

function openSlotSheet() {
  if (!slotShown()) return;
  let wrap = document.getElementById('slot-sheet');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'slot-sheet'; wrap.className = 'overlay ask'; wrap.hidden = true;
    wrap.innerHTML = '<div class="overlay-card ask-card" id="slot-card" role="dialog" aria-modal="true" aria-labelledby="slot-title"></div>';
    document.body.append(wrap);
    slotDlg = modalDialog(wrap, document.getElementById('slot-card'), { name: 'slot', rank: 85 });
  }
  slot = freshSlot();
  drawSlotSheet();
  slotDlg.open(document.getElementById('slot-code'));
}

// The bar button sits after Save to History. It is only on the page while slotShown().
function renderPracticeSlot() {
  const btn = document.getElementById('slot-btn');
  if (!slotShown()) { if (btn) btn.remove(); return; }
  if (btn) return;
  const save = document.getElementById('b-save');
  if (!save) return;
  const b = document.createElement('button');
  b.className = 'b'; b.id = 'slot-btn'; b.type = 'button'; b.textContent = 'Practice slot';
  save.after(b);
}

document.addEventListener('click', (e) => {
  const t = e.target && e.target.closest ? e.target : null;
  if (!t) return;
  if (t.closest('#slot-btn')) return openSlotSheet();
  if (!t.closest('#slot-card')) return;
  const act = t.closest('[data-slot]'), theme = t.closest('[data-slot-theme]');
  if (theme) slotPickTheme(theme.dataset.slotFor, theme.dataset.slotTheme);
  else if (act && act.dataset.slot === 'open') slotOpenRound();
  else if (act && act.dataset.slot === 'send') slotSend();
  else if (act && act.dataset.slot === 'no') slotNotNow();
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t || !t.closest || !t.closest('#slot-card')) return;
  if (t.matches('[data-slot-code]')) { if (!slot.round) slot.code = t.value; }
  else if (t.matches('[data-slot-pts]')) slot.pts[t.dataset.slotPts] = t.value;
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t && t.matches && t.matches('[data-slot-name]')) slot.showName = t.checked;
});
