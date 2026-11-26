// Decide and ballot: the Draft with AI panel, the review, auto refill, backup and restore, the ballot,
// Save to History, copy, print, and the History log. The draft code and the ballot code load together (the draft code
// can save at load, and a save redraws the ballot status); backup and restore sat between them, so they stay here.
// Known debt (architecture review, Slice 5): at about 640 lines this part is too big. Split off backup and restore and
// the History log in a later pass, once their load-time links to the draft and ballot code are cut.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- Draft with AI: the panel, the review, Stop and Undo (spec 4.3–4.6, Q9) ----------
// The panel opens from its button (or the palette, Slice 5). A draft writes nothing at first: it becomes a review
// (R.ballotReview, kept across a reload), and only "Insert selected" or "Accept all" changes the ballot.
// The prompts, field groups and debaters come from the round's format (FMT, js/core.js).
const BALLOT_SYSTEM = () => { const P = L.promptsFor(FMT()); return P.judgeSystem.split('\n\nReply in this exact structure')[0] + '\n\n' + P.pointsGuide; };
const ptsRangeNow = () => L.ptsRange(R.ptsRange);
const draftGroupsNow = () => L.draftGroups(FMT());
const groupById = (id) => draftGroupsNow().find((g) => g.id === id);
const draftUi = { open: false, picks: null, feedback: false, busy: false, busyText: '', ctrl: null, err: '', stopped: false, idx: 0 };
let fillSoonTimer = null, fillWaitsOnline = false;
const wideBallot = matchMedia('(min-width: 1280px)'), narrowBallot = matchMedia('(max-width: 819.98px)');
const evalFeedback = () => (LV().liveEval && LV().liveEval.data && LV().liveEval.data.feedback) || [];
// ai.notes from the old Decision draft tab moves into the note box once (spec 4.3). ai.evidence stays in the prompt.
if (R.ai && (R.ai.notes || '').trim()) { R.ballotInput = ((R.ballotInput || '').trim() ? R.ballotInput.trim() + '\n' : '') + R.ai.notes.trim(); R.ai.notes = ''; save(); }

function defaultPicks() { return new Set(draftGroupsNow().filter((g) => L.fieldState(R.ballot, g.fields) !== 'yours').map((g) => g.id)); }
function openDraftPanel(opener) {
  if (!draftUi.open) draftUi.picks = defaultPicks();
  draftUi.open = true; draftUi.opener = opener || $('#draft-open');
  $('#draft-panel').hidden = false;
  $('#ballot-layout').classList.add('panel-open');
  $('#draft-open').setAttribute('aria-expanded', 'true');
  renderDraftPanel();
  const head = R.ballotReview ? $('#rv-title') : $('#draft-title');
  if (head) head.focus();
}
function closeDraftPanel(restoreFocus = true) {
  if (!draftUi.open) return;
  const inside = $('#draft-panel').contains(document.activeElement);
  draftUi.open = false;
  $('#draft-panel').hidden = true;
  $('#ballot-layout').classList.remove('panel-open');
  $('#draft-open').setAttribute('aria-expanded', 'false');
  if (restoreFocus && inside) $('#draft-open').focus();
}
// Esc closes the panel and does not stop a call (spec 4.3).
escLayer('draft-panel', 45, () => draftUi.open, () => closeDraftPanel());
$('#draft-open').addEventListener('click', (e) => (draftUi.open ? closeDraftPanel() : openDraftPanel(e.currentTarget)));
$('#draft-close').addEventListener('click', () => closeDraftPanel());
for (const q of [wideBallot, narrowBallot]) q.addEventListener('change', () => { if (R.tab === 'ballot') renderDraftPanel(); });

function renderDraftButton() {
  const b = $('#draft-open'); if (!b) return;
  b.innerHTML = TabulaCore['ai-mark'].aiMark() + (R.ballotReview ? 'Draft ready' : 'Draft with AI');
}
const STATE_TEXT = {
  empty: 'Nothing to draft from yet. The AI needs at least one speech, flow or doc.',
  nothing: 'Pick at least one thing to draft.',
  stopped: 'Stopped. Nothing on the ballot changed.',
};
function draftState() {
  return L.draftPanelState({ busy: draftUi.busy, aiReady: ready(), offline: navigator.onLine === false, hasContent: L.roundHasContent(R, DOCS), picked: (draftUi.picks || defaultPicks()).size, error: draftUi.err, stopped: draftUi.stopped });
}
function renderDraftPanel() {
  renderDraftButton();
  if (!draftUi.open) return;
  $('#draft-close').textContent = narrowBallot.matches ? 'Done' : 'Close';
  const review = R.ballotReview;
  $('#dp-compose').hidden = Boolean(review);
  $('#dp-review').hidden = !review;
  if (review) return renderReview();
  renderReadLevel();
  const picks = draftUi.picks || (draftUi.picks = defaultPicks());
  const box = $('#dp-picks');
  const keep = box.querySelector('legend').outerHTML;
  const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pick : null;
  box.innerHTML = keep + draftGroupsNow().map((g) => {
    const yours = L.fieldState(R.ballot, g.fields) === 'yours';
    return `<label class="row check-row"><input type="checkbox" data-pick="${g.id}"${picks.has(g.id) ? ' checked' : ''}> ${escapeHtml(g.label)}${yours ? ' <span class="muted">(locked)</span>' : ''}</label>`;
  }).join('');
  if (focusId) { const el = box.querySelector(`[data-pick="${focusId}"]`); if (el) el.focus(); }
  const fb = $('#dp-feedback');
  const hasFb = evalFeedback().length > 0;
  fb.disabled = !hasFb; fb.checked = hasFb && draftUi.feedback;
  fb.parentElement.lastChild.textContent = hasFb ? ' Use Live Eval feedback for the comments' : ' Use Live Eval feedback for the comments (run Live Eval first)';
  const st = draftState();
  const el = $('#dp-status');
  tone(el);
  if (st === 'loading') el.innerHTML = busyHtml(draftUi.busyText || 'Drafting… usually 20–60 seconds');
  else if (st === 'noAI') el.innerHTML = showSetup() ? '<span class="is-quiet">Drafting needs AI. <button class="linkish" type="button" data-tab-go="ai" data-ai-setup="invite">Connect AI</button></span>' : '<span class="is-quiet">The ballot works by hand.</span>';
  else if (st === 'offline') { tone(el, 'quiet'); el.textContent = L.AI_ERROR_PREFIX.ballot + ' ' + L.aiErrorText('offline'); }
  else if (st === 'error') { tone(el, errColor(draftUi.err)); el.innerHTML = escapeHtml(L.AI_ERROR_PREFIX.ballot + ' ' + draftUi.err) + ' <button class="b small" type="button" id="dp-retry">Try again</button>'; }
  else if (STATE_TEXT[st]) { tone(el, 'quiet'); el.textContent = STATE_TEXT[st]; }
  else el.textContent = '';
  const go = $('#dp-go');
  go.textContent = draftUi.busy ? 'Stop' : 'Draft';
  go.classList.toggle('primary', !draftUi.busy);
  const blocked = ['noAI', 'offline', 'empty', 'nothing'].includes(st);
  go.disabled = !draftUi.busy && blocked;
  go.setAttribute('aria-describedby', blocked ? 'dp-cost dp-status' : 'dp-cost');
  $('#dp-undo').hidden = !R.ballotUndo;
  $('#auto-ballot').checked = Boolean(S.autoBallot);
  const d = LV().ballotDraft && LV().ballotDraft.data;
  $('#dp-why-body').textContent = d ? 'AI confidence: ' + d.confidence + '\n' + (d.points_reasoning || '') : 'Draft the ballot first. The AI\'s reasons for the points show here.';
}
document.addEventListener('change', (e) => {
  const p = e.target.dataset && e.target.dataset.pick;
  if (p) { draftUi.picks ??= defaultPicks(); if (e.target.checked) draftUi.picks.add(p); else draftUi.picks.delete(p); draftUi.stopped = false; renderDraftPanel(); }
  if (e.target.id === 'dp-feedback') draftUi.feedback = e.target.checked;
});
$('#auto-ballot').addEventListener('change', (e) => { S.autoBallot = e.target.checked; saveSettings(); });

// One AI call for a draft. picks: group ids. redraft: { fields, previous } for [Redo this]. Returns the draft or null.
async function runDraft({ picks, redraft, text }) {
  if (!can('ballotDraft')) return null;
  if (draftUi.busy) return null;
  const level = lvl();
  const fields = picks.flatMap((id) => groupById(id).fields);
  const ctrl = new AbortController();
  Object.assign(draftUi, { busy: true, busyText: text || '', ctrl, err: '', stopped: false });
  renderDraftPanel();
  try {
    // One request for both paths: buildBallotPrompt and L.hostedState read the same keys (ballotRequestLines).
    const ask = { only: fields, redraft, range: ptsRangeNow(), liveEvalFeedback: draftUi.feedback ? evalFeedback() : null };
    const data = await callAI({
      feature: 'ballotDraft',
      system: BALLOT_SYSTEM(),
      prompt: L.buildBallotPrompt(R, DOCS, R.ballotInput || '', ask),
      schema: L.promptsFor(FMT()).ballotSchema, effort: 'high', reading: level, kind: 'ballot', signal: ctrl.signal,
      hosted: { job: 'ballot', extra: Object.assign({ judgeInput: R.ballotInput || '' }, ask) },
    });
    if (resetting) return null;
    LV(level).ballotDraft = { data, at: Date.now(), through: L.speechesSoFar(R) };
    return data;
  } catch (err) {
    if (err && err.kind === 'stopped') draftUi.stopped = true;
    else { draftUi.err = (err && err.message) || String(err); console.warn('Ballot draft failed:', err); }
    return null;
  } finally {
    draftUi.busy = false; draftUi.ctrl = null; draftUi.busyText = '';
    save(); renderDraftPanel();
  }
}
async function startDraft() {
  if (draftUi.busy) { draftUi.ctrl && draftUi.ctrl.abort(); return; } // the button is [Stop] while a call runs
  if (draftState() !== 'ready' && draftState() !== 'error' && draftState() !== 'stopped') return;
  const picks = draftGroupsNow().map((g) => g.id).filter((id) => (draftUi.picks || defaultPicks()).has(id));
  const data = await runDraft({ picks });
  if (!data) return;
  R.ballotReview = L.reviewFromDraft(R.ballot, data, { picks, range: ptsRangeNow(), through: L.speechesSoFar(R), at: Date.now(), format: FMT() });
  draftUi.idx = 0; save(); renderDraftPanel();
  const h = $('#rv-title'); if (h && draftUi.open) h.focus();
}
$('#dp-go').addEventListener('click', startDraft);
document.addEventListener('click', (e) => { if (e.target.id === 'dp-retry') startDraft(); });
// ⌘↵ / Ctrl+↵ in the note box runs Draft; in the review it runs Insert selected (spec 4.1, 4.3).
$('#draft-panel').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.isComposing) return;
  if (R.ballotReview) { e.preventDefault(); insertReview(false); }
  else if (e.target.id === 'ballot-input') { e.preventDefault(); startDraft(); }
});
$('#dp-prompt').addEventListener('click', async () => {
  const fields = draftGroupsNow().filter((g) => (draftUi.picks || defaultPicks()).has(g.id)).flatMap((g) => g.fields);
  const textDocs = DOCS.filter((d) => d.kind !== 'pdf').map((d) => '=== ' + L.docTitle(d, FMT()) + ' ===\n' + d.data).join('\n\n');
  const pdfs = DOCS.filter((d) => d.kind === 'pdf').map((d) => d.name);
  const text = L.anonymize(BALLOT_SYSTEM() + '\n\n' + L.readingGuide(lvl(), FMT()) + '\n\n' + (textDocs ? textDocs + '\n\n' + L.DOC_NOTE + '\n\n' : '')
    + L.buildBallotPrompt(R, DOCS, R.ballotInput || '', { only: fields, range: ptsRangeNow(), liveEvalFeedback: draftUi.feedback ? evalFeedback() : null }), R);
  const ok = await copy(text);
  toast(ok ? (pdfs.length ? 'Prompt copied. Attach these PDFs by hand: ' + pdfs.join(', ') : 'Prompt copied. Paste it into any AI chat.') : 'Copy did not work in this browser.');
});
// Undo the last insert (or auto refill): one step, until the next edit (spec 4.5).
function undoLastInsert() {
  if (!R.ballotUndo) return false;
  R.ballot = R.ballotUndo; R.ballotUndo = null;
  if (R.ballotReview) R.ballotReview = L.staleReviewCards(R.ballotReview, R.ballot);
  save(); renderBallot();
}
$('#dp-undo').addEventListener('click', () => { if (undoLastInsert() !== false) toast('Ballot put back.'); });
function insertedToast(n) {
  undoToast('AI text added to ' + n + (n === 1 ? ' field.' : ' fields.'), 'AI text added', undoLastInsert, 'Ballot put back.');
}

// ----- the review (spec 4.4) -----
const diffHtml = (diff) => diff.map((d) => d.op === 'del' ? `<del><span class="sr-only">removed: </span>${escapeHtml(d.text)}</del>` : d.op === 'ins' ? `<ins><span class="sr-only">added: </span>${escapeHtml(d.text)}</ins>` : escapeHtml(d.text)).join('');
const winText = (w) => (w === 'aff' || w === 'neg' ? L.sideLabel(FMT(), w) : '–');
function cardBody(c) {
  const e = escapeHtml;
  if (c.id === 'winner') return `<table class="rv-table"><thead><tr><th scope="col">Now</th><th scope="col">AI</th></tr></thead><tbody><tr><td>${winText(c.base.winner)}</td><td>${winText(c.after.winner)}</td></tr></tbody></table>`;
  if (c.id === 'pts') {
    const rows = FMT().speakers.map((sp) => {
      const s = sp.id;
      const now = [c.base['pts.' + s], c.base['ranks.' + s] ? 'rank ' + c.base['ranks.' + s] : ''].filter((x) => x !== '' && x != null).join(', ') || '–';
      const ai = [c.after['pts.' + s], c.after['ranks.' + s] ? 'rank ' + c.after['ranks.' + s] : ''].filter((x) => x !== '' && x != null).join(', ') || '–';
      return `<tr><th scope="row" class="${sp.side}">${sp.label}</th><td>${e(now)}</td><td>${e(ai)}</td></tr>`;
    }).join('');
    const r = R.ballotReview.range;
    const bad = (c.outOfRange || []).map((x) => `<p class="is-caution rv-note">${L.speakerOf(FMT(), x.speaker).label}: The AI gave ${x.value}, which is outside ${r.min}–${r.max}. Set this one by hand.</p>`).join('');
    return `<table class="rv-table"><thead><tr><th scope="col">Speaker</th><th scope="col">Now</th><th scope="col">AI</th></tr></thead><tbody>${rows}</tbody></table>${bad}`;
  }
  if (c.state === 'yours' && c.diff) return `<div class="rv-text rv-diff">${diffHtml(c.diff)}</div>`;
  return `<div class="rv-text">${e(c.after[c.id] || '') || '<span class="muted">The AI wrote nothing here.</span>'}</div>`;
}
function cardChoice(c) {
  if (c.empty) return '<p class="muted rv-none">Nothing to insert.</p>';
  if (c.state === 'yours') {
    return `<fieldset class="rv-choice"><legend class="sr-only">${escapeHtml(c.label)}</legend>`
      + `<label class="row check-row"><input type="radio" name="rv-${c.id}" data-rv-choice="${c.id}" value="keep"${c.choice !== 'ai' ? ' checked' : ''}> Keep mine</label>`
      + `<label class="row check-row"><input type="radio" name="rv-${c.id}" data-rv-choice="${c.id}" value="ai"${c.choice === 'ai' ? ' checked' : ''}> Use AI text</label></fieldset>`;
  }
  return `<label class="row check-row"><input type="checkbox" data-rv-choice="${c.id}"${c.choice !== 'skip' ? ' checked' : ''}> Insert this</label>`;
}
function renderReview() {
  const rv = R.ballotReview;
  const box = $('#dp-review');
  const narrow = narrowBallot.matches;
  const n = rv.cards.length;
  draftUi.idx = Math.max(0, Math.min(draftUi.idx, n - 1));
  const active = document.activeElement;
  const keepFocus = active && box.contains(active) ? (active.id || (active.dataset.rvChoice ? 'c:' + active.dataset.rvChoice + ':' + active.value : active.dataset.rvRedo ? 'r:' + active.dataset.rvRedo : '')) : '';
  const stale = L.speechEndedSince(rv, R);
  const st = draftState();
  const busy = st === 'loading';
  box.innerHTML = `<div class="rv-head"><h3 id="rv-title" tabindex="-1">Review the draft</h3>
      <p class="muted">Nothing goes on the ballot until you insert it.</p></div>
    ${stale ? `<p class="warn rv-stale">A speech ended after this draft. <button class="b small" type="button" id="rv-redo-all" aria-describedby="rv-cost"${busy ? ' disabled' : ''}>Redo all</button></p>` : ''}
    <p class="status-line" id="rv-status" role="status" aria-live="polite">${busy ? busyHtml(draftUi.busyText || 'Drafting…') : draftUi.err ? '<span class="is-error">' + escapeHtml(L.AI_ERROR_PREFIX.ballot + ' ' + draftUi.err) + '</span>' : draftUi.stopped ? '<span class="is-quiet">' + STATE_TEXT.stopped + '</span>' : ''}</p>
    ${narrow && n > 1 ? `<div class="rv-pager"><button class="b small" type="button" id="rv-prev"${draftUi.idx === 0 ? ' disabled' : ''}>Previous</button><p class="rv-count" aria-live="polite">${draftUi.idx + 1} of ${n}: ${escapeHtml(rv.cards[draftUi.idx].label)}</p><button class="b small" type="button" id="rv-next"${draftUi.idx === n - 1 ? ' disabled' : ''}>Next</button></div>` : ''}
    ${rv.cards.map((c, i) => `<section class="rv-card${i === draftUi.idx ? ' rv-current' : ''}" aria-labelledby="rv-h-${c.id}">
      <div class="rv-card-head"><h4 id="rv-h-${c.id}">${escapeHtml(c.label)}</h4>${c.changed ? '<span class="pill is-caution">Changed since the draft</span>' : ''}${L.fieldState(R.ballot, c.fields) === 'yours' ? `<span class="b-tag-ai">${LOCK_SVG} Protected from AI</span>` : ''}</div>
      ${cardBody(c)}
      <div class="rv-card-foot">${cardChoice(c)}<button class="b small" type="button" data-rv-redo="${c.id}" aria-describedby="rv-cost"${busy ? ' disabled' : ''}>Redo this</button></div>
    </section>`).join('')}
    <p class="muted rv-cost" id="rv-cost">Redo uses AI.</p>
    <div class="rv-foot"><button class="b primary" type="button" id="rv-insert" aria-keyshortcuts="Meta+Enter Control+Enter">Insert selected</button><button class="b" type="button" id="rv-accept">Accept all</button><button class="b" type="button" id="rv-discard">Discard draft</button>${busy ? '<button class="b" type="button" id="rv-stop">Stop</button>' : ''}</div>`;
  if (keepFocus) {
    const [k, id, v] = keepFocus.split(':');
    const el = k === 'c' ? box.querySelector(`[data-rv-choice="${id}"]${v && v !== 'on' ? `[value="${v}"]` : ''}`) : k === 'r' ? box.querySelector(`[data-rv-redo="${id}"]`) : document.getElementById(keepFocus);
    if (el) el.focus();
  }
}
$('#dp-review').addEventListener('change', (e) => {
  const id = e.target.dataset.rvChoice; if (!id) return;
  const c = R.ballotReview.cards.find((x) => x.id === id);
  c.choice = e.target.type === 'checkbox' ? (e.target.checked ? 'insert' : 'skip') : e.target.value;
  save();
});
$('#dp-review').addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'rv-insert') return insertReview(false);
  if (t.id === 'rv-accept') return insertReview(true);
  if (t.id === 'rv-stop' && draftUi.ctrl) return draftUi.ctrl.abort();
  if (t.id === 'rv-prev' || t.id === 'rv-next') { draftUi.idx += t.id === 'rv-next' ? 1 : -1; renderReview(); const b = $('#' + t.id); if (b && !b.disabled) b.focus(); else $('#rv-title').focus(); return; }
  if (t.id === 'rv-discard') {
    const before = R.ballotReview;
    R.ballotReview = null; save(); renderDraftPanel(); $('#draft-title').focus();
    undoToast('Draft discarded. The ballot did not change.', 'discard draft', () => { R.ballotReview = before; save(); renderDraftPanel(); }, 'Draft back for review.');
    return;
  }
  if (t.id === 'rv-redo-all') {
    const picks = R.ballotReview.picks;
    const data = await runDraft({ picks, text: 'Drafting again… usually 20–60 seconds' });
    if (data) { R.ballotReview = L.reviewFromDraft(R.ballot, data, { picks, range: ptsRangeNow(), through: L.speechesSoFar(R), at: Date.now(), format: FMT() }); save(); renderDraftPanel(); }
    return;
  }
  const redo = t.dataset.rvRedo;
  if (redo) {
    const old = R.ballotReview.cards.find((x) => x.id === redo);
    const data = await runDraft({ picks: [redo], redraft: { fields: old.fields.filter((f) => !f.startsWith('ranks.')), previous: old.id === 'pts' ? {} : { [redo]: old.after[redo] } }, text: 'Redrafting ' + old.label.toLowerCase() + '…' });
    if (!data || !R.ballotReview) return;
    const fresh = L.reviewFromDraft(R.ballot, data, { picks: [redo], range: ptsRangeNow(), format: FMT() }).cards[0];
    R.ballotReview.cards = R.ballotReview.cards.map((x) => (x.id === redo ? fresh : x));
    save(); renderDraftPanel();
    const b = $(`[data-rv-redo="${redo}"]`); if (b) b.focus();
  }
});
function insertReview(all) {
  const rv = R.ballotReview; if (!rv) return;
  const before = L.ballotSnapshot(R.ballot);
  const res = L.applyReview(R.ballot, rv, all);
  R.ballotReview = null;
  if (res.count) { R.ballot = res.ballot; R.ballotUndo = before; }
  save(); renderBallot(); renderDraftPanel();
  if ($('#draft-title') && draftUi.open) $('#draft-title').focus();
  if (res.count) insertedToast(res.count); else toast('Nothing was inserted. The ballot did not change.');
}

// ----- auto refill (spec 4.6): off by default (D2). Never on an empty round, offline, with no AI, or while a review waits.
function scheduleBallotSoon() {
  clearTimeout(fillSoonTimer);
  fillSoonTimer = setTimeout(() => {
    if (!can('ballotDraft') || !S.autoBallot || !ready() || resetting) return;
    if (navigator.onLine === false) { fillWaitsOnline = true; return; } // runs when online, if still on (spec 2.3, D2)
    runAutoRefill();
  }, 25000);
}
async function runAutoRefill() {
  if (!can('ballotDraft')) return;
  if (!S.autoBallot || !ready() || draftUi.busy || R.ballotReview || navigator.onLine === false || !L.roundHasContent(R, DOCS)) return;
  const picks = draftGroupsNow().map((g) => g.id);
  const data = await runDraft({ picks, text: 'Refilling after the speech…' });
  if (!data || R.ballotReview) return;
  const plan = L.autoRefillPlan(R.ballot, data, ptsRangeNow(), FMT());
  if (plan.write.length) {
    const before = L.ballotSnapshot(R.ballot);
    R.ballot = L.applyBallotDraft(R.ballot, data, { only: plan.write, range: ptsRangeNow(), mark: 'ai', format: FMT() });
    R.ballotUndo = before;
    const groups = new Set(plan.write.map((f) => (f.includes('.') ? 'row.' + f.split('.')[1] : f)));
    insertedToast(groups.size);
  }
  if (plan.review.length) {
    R.ballotReview = L.reviewFromDraft(R.ballot, data, { picks: plan.review, range: ptsRangeNow(), through: L.speechesSoFar(R), at: Date.now(), format: FMT() });
    toast('The AI would change text it wrote before. Review it in Draft with AI.');
  }
  save(); if (R.tab === 'ballot') renderBallot(); else renderDraftButton();
}

// ---------- backup and restore ----------
const readAllStorage = () => store.snapshot(STORE_PREFIX);
async function readAllDocs() {
  try { return (await docStore.tx('readonly', (st) => st.getAll())) || []; } catch { return DOCS.slice(); }
}
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }; // local time
async function downloadBackup(includeKeys, label) {
  // The backup time is saved first, so the file itself says it was backed up: a restore from it shows no reminder.
  const before = S.lastBackupAt;
  S.lastBackupAt = Date.now(); save(); saveSettings();
  let backup;
  try {
    const all = readAllStorage();
    if (includeKeys && !S.rememberKeys && Object.keys(keys).length) all[KEYS] = JSON.stringify(keys); // keys kept for this tab only
    backup = L.buildBackup(all, await readAllDocs(), { includeKeys });
  } catch (err) { S.lastBackupAt = before; saveSettings(); throw err; } // no file made: no backup time either
  download('tabula-' + (label || 'backup') + '-' + stamp() + '.json', JSON.stringify(backup), 'application/json');
  saveSettings(); renderBackup();
}
function renderBackup() {
  const el = $('#backup-last'); if (!el) return;
  el.textContent = S.lastBackupAt ? 'Last backup: ' + agoText(S.lastBackupAt) + '.' : 'No backup yet.';
  const due = $('#backup-due'); if (!due) return;
  const show = backupDue();
  // A button in the line that goes away hands focus to the card's own Download backup button, never to the page body.
  if (!show && due.contains(document.activeElement)) $('#backup-go').focus();
  due.hidden = !show;
  const msg = show ? 'You saved ballots since your last backup.' : '';
  if ($('#backup-due-status').textContent !== msg) $('#backup-due-status').textContent = msg;
}
// The day-end reminder (L.backupReminderDue): ballots saved since the last backup, and the judging looks over.
const backupDue = () => L.backupReminderDue({ lastSavedAt: S.lastSavedAt ?? null, lastBackupAt: S.lastBackupAt ?? null, dismissedAt: S.backupDismissedAt ?? null, now: Date.now() });
$('#backup-due-go').addEventListener('click', () => downloadBackup(false));
// "Not now" quiets the reminder until the next saved ballot.
$('#backup-due-no').addEventListener('click', () => { S.backupDismissedAt = S.lastSavedAt; saveSettings(); renderBackup(); });
// Opening the app after the judging day (a new day, or hours after the last save): one toast, once per save.
if (backupDue() && S.backupToastFor !== S.lastSavedAt) {
  S.backupToastFor = S.lastSavedAt; saveSettings();
  toast('You saved ballots since your last backup.', { key: 'backup-due', action: { label: 'Download backup', name: 'Download backup now', run: () => downloadBackup(false) } });
}
$('#backup-go').addEventListener('click', () => downloadBackup($('#backup-keys').checked));
$('#restore-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const st = $('#backup-status');
  let b;
  try { b = L.parseBackup(await file.text()); }
  catch (err) { tone(st, 'error'); st.textContent = 'Could not restore: ' + String(err.message || err); return; }
  const sum = L.backupSummary(b);
  const when = b.exportedAt ? new Date(b.exportedAt).toLocaleString() : 'an unknown time';
  const hasKeys = b.includesKeys && [KEYS, KEY, OAKEY].some((k) => b.storage[k] != null);
  // One dialog (spec 2.4 #13, #14), with the large-file note in it.
  const ok = await ask({
    title: 'Restore the backup from ' + when + '?',
    body: 'This replaces everything in this browser. Tabula downloads a copy of your current data first.',
    list: ['Round: ' + sum.round, 'Saved ballots: ' + sum.ballots, 'Documents: ' + sum.docs, L.restoreKeysLine(hasKeys, S.rememberKeys)],
    foot: file.size > 60 * 1024 * 1024 ? 'This file is large (' + Math.round(file.size / 1048576) + ' MB), so it may take a while.' : '',
    buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Restore', value: true, kind: 'danger' }], cancelValue: false,
  });
  if (!ok) return;
  // 1. Safety copy of the current data (with keys) before anything changes.
  await downloadBackup(true, 'before-restore');
  resetting = true; stopAll(); restoring = true;
  CQ.clear(); await clipStore.clear().catch(() => {}); // waiting audio never carries over into restored data
  // 2. Snapshot everything, so any failure below puts the old data back exactly.
  const oldStorage = readAllStorage();
  const oldDocs = await readAllDocs();
  // This tab's own key entries (Remember off keeps keys in sessionStorage, Q-3), so a failure can put them back too.
  const TAB_KEY_NAMES = [KEYS, KEY, OAKEY];
  const oldTab = {};
  for (const k of TAB_KEY_NAMES) { try { const v = sessionStorage.getItem(k); if (v != null) oldTab[k] = v; } catch {} }
  const writeTabKeys = (entries) => {
    for (const k of TAB_KEY_NAMES) { try { sessionStorage.removeItem(k); } catch {} }
    for (const [k, v] of Object.entries(entries)) sessionStorage.setItem(k, v); // a failure here runs the rollback below
  };
  const writeStorage = (entries) => {
    store.replaceAll(STORE_PREFIX, entries);
  };
  const writeDocs = (docs) => docStore.tx('readwrite', (store2) => { store2.clear(); let last = null; for (const d of docs) last = store2.put(d); return last; });
  try {
    // Docs first, in one all-or-nothing step.
    await writeDocs(b.docs);
    // Then the saved data. Keys stay as they are unless the backup carries its own.
    const entries = Object.assign({}, b.storage);
    if (!hasKeys) for (const k of [KEYS, KEY, OAKEY]) if (oldStorage[k] != null) entries[k] = oldStorage[k];
    // The restored file was a backup: its time counts as the last backup (no reminder for what was just restored).
    if (entries[SETTINGS] != null) entries[SETTINGS] = L.stampRestoredBackup(entries[SETTINGS], b.exportedAt);
    // With Remember off, the backup's keys go to this tab only, never to localStorage (spec 2.6, Q-3).
    const split = L.splitRestoreKeys(entries, S.rememberKeys, SETTINGS);
    writeStorage(split.local);
    writeTabKeys(L.restoreTabKeys(oldTab, split.session, hasKeys));
  } catch (err) {
    // Put the old data back, this tab's keys included.
    try { writeStorage(oldStorage); } catch {}
    try { writeTabKeys(oldTab); } catch {}
    try { await writeDocs(oldDocs); } catch {}
    resetting = false; restoring = false;
    tone(st, 'error');
    st.textContent = 'Restore failed, and your previous data was put back: ' + String(err.message || err);
    return;
  }
  tone(st, 'ok'); st.textContent = 'Restored. Reloading…';
  setTimeout(() => location.reload(), 1500);
});

// ---------- ballot (spec 4.1, 4.2, 4.7, 4.8, 4.12, and the narrow ballot 4.15 / 5.6c) ----------
const ranksOn = () => FMT().ballot.speakerRanks;
const LOCK_SVG = TabulaCore['ai-mark'].lockMark();
const AI_SPARKLE_SVG = TabulaCore['ai-mark'].aiMark();
// One tag per field group: the winner, each speaker row (points, and rank when the format has ranks), the RFD and
// each team's comments.
const tagGroups = () => Object.assign({ winner: ['winner'], rfd: ['rfd'], affFb: ['affFb'], negFb: ['negFb'] }, Object.fromEntries(FMT().speakerIds.map((s) => ['row.' + s, ranksOn() ? ['pts.' + s, 'ranks.' + s] : ['pts.' + s]])));
function tagHtml(key) {
  const locked = L.fieldState(R.ballot, tagGroups()[key]) === 'yours';
  const tip = locked ? 'Protected from AI. Click to allow changes.' : 'AI editing allowed. Click to protect.';
  return `<button type="button" class="b-tag-btn" data-ai="ballotDraft" data-protect="${key}" aria-label="Protect ${escapeHtml(L.fieldLabel(key, FMT()))} from AI" aria-pressed="${locked}" aria-description="${tip}" data-tip="${tip}">${locked ? LOCK_SVG : AI_SPARKLE_SVG}</button>`;
}
function renderBallotTags() {
  const focused = document.activeElement && document.activeElement.dataset.protect;
  document.querySelectorAll('#tab-ballot [data-tag]').forEach((el) => { const h = tagHtml(el.dataset.tag); if (el.innerHTML !== h) el.innerHTML = h; });
  if (focused) document.querySelector(`[data-protect="${focused}"]`).focus();
  renderDraftPanel();
}
// The icon stays visible in both states. Editing still protects the field automatically.
function toggleBallotProtection(key) {
  const fields = tagGroups()[key];
  const locked = L.fieldState(R.ballot, fields) === 'yours';
  const before = { touched: Object.assign({}, R.ballot.touched), aiFilled: Object.assign({}, R.ballot.aiFilled) };
  const values = fields.map((f) => L.fieldValue(R.ballot, f));
  const reviewBefore = R.ballotReview;
  const previousBallot = R.ballot;
  R.ballot = L.markFields(R.ballot, fields, locked ? 'free' : 'yours');
  if (R.ballotReview) R.ballotReview = L.staleReviewCards(R.ballotReview, R.ballot, previousBallot);
  const reviewAfter = R.ballotReview;
  const reviewSnapshot = reviewAfter && JSON.stringify(reviewAfter);
  save(); renderBallotTags();
  const label = L.fieldLabel(key, FMT());
  undoToast(locked ? 'The AI may now change ' + label + '.' : 'The AI cannot change ' + label + '.',
    (locked ? 'allow AI changes to ' : 'protect ') + label, () => {
      if (fields.some((f, i) => L.fieldValue(R.ballot, f) !== values[i])) {
        toast('Kept your newer edits protected.');
        return false;
      }
      for (const set of ['touched', 'aiFilled']) for (const f of fields) {
        if (before[set][f] === undefined) delete R.ballot[set][f];
        else R.ballot[set][f] = before[set][f];
      }
      if (R.ballotReview === reviewAfter && JSON.stringify(R.ballotReview) === reviewSnapshot) R.ballotReview = reviewBefore;
      if (R.ballotReview) R.ballotReview = L.staleReviewCards(R.ballotReview, R.ballot);
      save(); renderBallotTags();
    }, locked ? 'Protected from AI again.' : 'AI changes allowed again.');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-protect]'); if (!b) return;
  toggleBallotProtection(b.dataset.protect);
});

function renderBallot() {
  const r = ptsRangeNow();
  $('#ballot-ai-help').innerHTML = `<strong>AI editing</strong><span class="tip-line">${LOCK_SVG} Lock: AI cannot change this field.</span><span class="tip-line">${AI_SPARKLE_SVG} Star: AI can change this field.</span><span class="tip-line">Typing protects a field automatically. Click its icon to switch.</span>`;
  $('#ballot-title').textContent = 'Ballot' + (R.roundName ? ' · ' + R.roundName : '');
  $('#w-aff').textContent = R.aff.team ? '(' + R.aff.team + ')' : '';
  $('#w-neg').textContent = R.neg.team ? '(' + R.neg.team + ')' : '';
  $('#fb-aff-code').textContent = R.aff.team ? '(' + R.aff.team + ')' : '';
  $('#fb-neg-code').textContent = R.neg.team ? '(' + R.neg.team + ')' : '';
  document.querySelectorAll('input[name="winner"]').forEach((x) => { x.checked = x.value === R.ballot.winner; });
  $('#pts-head').textContent = 'Points (' + r.min + '–' + r.max + ')';
  // The rank columns show only when the format has speaker ranks (policy 1–4; LD has none).
  const ids = FMT().speakerIds, ranks = ranksOn();
  document.querySelectorAll('.pts-table .rank-h').forEach((th, i) => { th.hidden = !ranks || i >= ids.length; });
  $('#pts-body').innerHTML = FMT().speakers.map((sp) => {
    const s = sp.id, side = sp.side, lab = sp.label;
    const nm = L.speakerName(R, sp);
    const rankCells = ranks ? ids.map((_, i) => `<td class="rank-cell"><input type="radio" name="rank-${s}" value="${i + 1}" data-rank="${s}" aria-label="${lab}, rank ${i + 1}"></td>`).join('')
      + `<td class="rank-sel-cell"><label class="sr-only" for="rank-sel-${s}">${lab} rank</label><select id="rank-sel-${s}" data-rank-sel="${s}"><option value="">Rank</option>${ids.map((_, i) => `<option value="${i + 1}">${i + 1}${i ? '' : ' (best)'}</option>`).join('')}</select></td>` : '';
    return `<tr data-speaker="${s}">
    <th scope="row" class="sp-cell ${side}"><strong>${lab}</strong>${nm ? ' <span class="muted">' + escapeHtml(nm) + '</span>' : ''}</th>
    <td class="pts-cell"><div class="stepper"><button type="button" class="step" data-step="-1" data-sp="${s}" aria-label="Lower ${lab} points by 0.1">−</button><input type="number" inputmode="decimal" min="${r.min}" max="${r.max}" step="0.1" data-bind="ballot.pts.${s}" aria-label="${lab} points"><button type="button" class="step" data-step="1" data-sp="${s}" aria-label="Raise ${lab} points by 0.1">+</button></div></td>
    ${rankCells}
    <td class="tag-cell"><span class="b-tag" data-tag="row.${s}"></span></td>
  </tr>`;
  }).join('');
  bindAll(); syncRanks(); renderBallotTags(); renderBallotCheck(true); renderSaveStatus();
}
function syncRanks() {
  const rk = R.ballot.ranks || {};
  document.querySelectorAll('[data-rank]').forEach((x) => { x.checked = String(rk[x.dataset.rank] ?? '') === x.value; });
  document.querySelectorAll('[data-rank-sel]').forEach((x) => { x.value = String(rk[x.dataset.rankSel] ?? ''); });
}
// Picking a rank another speaker has moves it, with a message (spec 4.8). The radio grid and the narrow select share it.
function applyRank(speaker, value) {
  const m = L.moveRank(R.ballot.ranks, speaker, value, FMT());
  R.ballot.ranks = m.ranks;
  markTouched('ranks.' + speaker); save(); syncRanks(); renderBallotCheck();
  if (m.message) toast(m.message, { key: 'rank-moved' });
}
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'winner') { R.ballot.winner = t.value; markTouched('winner'); save(); renderBallotCheck(); return; }
  if (t.dataset && t.dataset.rank) return applyRank(t.dataset.rank, t.value);
  if (t.dataset && t.dataset.rankSel) return applyRank(t.dataset.rankSel, t.value);
  if (t.dataset && (t.dataset.bind || '').startsWith('ballot')) renderBallotCheck();
});
// − and + step the points by 0.1 inside the range (spec 4.8).
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-step]'); if (!b) return;
  const s = b.dataset.sp, input = document.querySelector(`[data-bind="ballot.pts.${s}"]`);
  const v = L.stepPoints(input.value, Number(b.dataset.step), ptsRangeNow());
  input.value = v; R.ballot.pts[s] = String(v); markTouched('pts.' + s); save(); renderBallotCheck();
});
// The check box is role="status": it changes at most once a second so a screen reader is not flooded (spec 4.8).
let checkAt = 0, checkTimer = null;
function renderBallotCheck(now) {
  const p = R.ballot.pts || {};
  const given = (id) => p[id] !== undefined && p[id] !== '';
  // A side's total: every debater on that side has points, else a dash.
  const sum = (side) => { const ids = L.speakersOn(FMT(), side).map((x) => x.id); return ids.every(given) ? ids.reduce((t, id) => t + Number(p[id]), 0).toFixed(1) : '–'; };
  $('#sum-aff').textContent = L.sideLabel(FMT(), 'aff') + ' ' + sum('aff');
  $('#sum-neg').textContent = L.sideLabel(FMT(), 'neg') + ' ' + sum('neg');
  $('#ranks-set').textContent = ranksOn() ? 'Ranks: ' + L.ranksSet(R.ballot, FMT()) + ' of ' + FMT().speakerIds.length + ' set.' : '';
  const wait = 1000 - (Date.now() - checkAt);
  if (now === true || wait <= 0) return drawBallotCheck();
  if (!checkTimer) checkTimer = setTimeout(drawBallotCheck, wait);
}
function drawBallotCheck() {
  clearTimeout(checkTimer); checkTimer = null; checkAt = Date.now();
  const issues = L.checkBallot(R.ballot, { range: ptsRangeNow(), format: FMT() });
  const html = issues.length
    ? `<div class="warn"><strong>Check before you submit:</strong><ul>${issues.map((i) => '<li>' + escapeHtml(i) + '</li>').join('')}</ul></div>`
    : '<p class="good">Ballot looks complete.</p>';
  if ($('#ballot-check').innerHTML !== html) $('#ballot-check').innerHTML = html;
}
function renderSaveStatus() {
  const el = $('#save-status'); if (!el) return;
  const t = lastSave.err === 'full' ? "Not saved: this browser's storage is full"
    : lastSave.err ? 'Not saved: this browser is blocking storage'
      : lastSave.at ? 'Saved in this browser · ' + new Date(lastSave.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  el.textContent = t;
  el.classList.toggle('is-error', Boolean(lastSave.err));
}

// ----- Save to History (spec 4.12) -----
// The one direct write left: Save to History needs the error kind ('full' or 'blocked') for its own message, which
// store.set does not return. LOG is a policyJudge.* key, so it stays inside debate's names.
function storeLog(list) { try { localStorage.setItem(LOG, JSON.stringify(list)); return ''; } catch (err) { return L.storageErrorKind(err); } }
$('#b-save').addEventListener('click', async () => {
  const issues = L.checkBallot(R.ballot, { range: ptsRangeNow(), format: FMT() });
  if (issues.length) {
    // "Fix it" gets first focus and goes to the first field with a problem; there is no danger button (spec 2.4 #15).
    const v = await ask({
      title: issues.length === 1 ? 'Save with 1 problem?' : 'Save with ' + issues.length + ' problems?',
      list: issues,
      buttons: [{ label: 'Save anyway', value: 'save', kind: 'plain' }, { label: 'Fix it', value: 'fix', kind: 'primary' }], cancelValue: 'fix',
    });
    if (v !== 'save') return focusBallotProblem();
  }
  const log = store.get(LOG, []);
  const entry = L.savedBallotEntry(R, new Date().toLocaleString(), ptsRangeNow());
  const last = log[log.length - 1];
  if (last && JSON.stringify(last.slice(1)) === JSON.stringify(entry.slice(1))) return toast('Already in History.');
  log.push(entry);
  const err = storeLog(log);
  if (err === 'full') return toast("Not saved: this browser's storage is full. Delete old saved ballots, or use Print / PDF to keep a copy.", { kind: 'error' });
  if (err) return toast('Not saved: this browser is blocking storage. Use Print / PDF to keep a copy.', { kind: 'error' });
  S.lastSavedAt = Date.now(); saveSettings(); renderBackup();
  // Offer a backup when there is none from the last 2 hours (spec 2.4 #16); else the round's end: a PDF of the ballot.
  if (!S.lastBackupAt || Date.now() - S.lastBackupAt > 2 * 3600 * 1000) toast('Saved to History. Your data lives only in this browser.', { action: { label: 'Download backup', run: () => downloadBackup(false) } });
  else toast('Saved to History.', { action: { label: 'Save as PDF', name: 'Save as PDF: this ballot', run: () => openPrintDialog() } });
});
// The first ballot field with a problem: the winner, then points, then ranks, then the RFD.
function focusBallotProblem() {
  const b = R.ballot, p = b.pts || {}, r = b.ranks || {}, rg = ptsRangeNow();
  const bad = (v) => v === undefined || v === '' || Number(v) < rg.min || Number(v) > rg.max;
  const narrow = narrowBallot.matches;
  const el = !b.winner ? document.querySelector('input[name="winner"]')
    : document.querySelector(FMT().speakerIds.map((s) => (bad(p[s]) ? `[data-bind="ballot.pts.${s}"]` : '')).filter(Boolean)[0] || 'x-none')
    || document.querySelector(FMT().speakerIds.map((s) => (ranksOn() && !r[s] ? (narrow ? `[data-rank-sel="${s}"]` : `[data-rank="${s}"]`) : '')).filter(Boolean)[0] || 'x-none')
    || document.querySelector('[data-bind="ballot.rfd"]');
  if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
}

// ----- Copy for the tournament ballot (spec 4.11) -----
const copyDlg = modalDialog($('#copy-sheet'), $('#copy-card'), { name: 'copy', rank: 85 });
let copyBlocks = [];
function openCopySheet() {
  copyBlocks = L.tournamentBlocks(R, { tips: flagOn('copyTips') });
  const n = L.checkBallot(R.ballot, { range: ptsRangeNow(), format: FMT() }).length;
  $('#copy-warn').hidden = !n;
  $('#copy-warn').textContent = n ? 'This ballot has ' + n + (n === 1 ? ' problem' : ' problems') + '. Fix them first, or copy anyway.' : '';
  $('#copy-blocks').innerHTML = window.TabulaCore.sheets.copyBlocksHtml(copyBlocks); // the shared copy sheet (core/sheets.js)
  copyDlg.open($('#copy-blocks [data-copy-block]') || $('#copy-done'));
}
$('#copy-btn').addEventListener('click', openCopySheet);
$('#copy-x').addEventListener('click', () => copyDlg.close());
$('#copy-done').addEventListener('click', () => copyDlg.close());
$('#copy-blocks').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy-block]'); if (!btn) return;
  const b = copyBlocks.find((x) => x.id === btn.dataset.copyBlock);
  if (await copy(b.text)) {
    btn.textContent = '✓ Copied'; announce(b.label + ' copied.');
    setTimeout(() => { if (document.contains(btn)) btn.textContent = 'Copy'; }, 2000);
  } else {
    // Copy failed: select the text so the judge can copy it by hand.
    const ta = $('#cb-t-' + b.id); $('#cb-f-' + b.id).hidden = false; ta.focus(); ta.select();
  }
});

// ----- Print / PDF (spec 4.10, Q20) -----
// The dialog builds #print-sheet from L.printModel, so long text prints in full, and removes it after printing.
const printDlg = modalDialog($('#print-dialog'), $('#print-card'), { name: 'print', rank: 85 });
let printSaved = null; // a saved ballot from History, or null for the round on screen
function openPrintDialog(saved) {
  if (typeof window.print !== 'function') return toast('This browser cannot print. Use Copy instead.', { kind: 'error' });
  printSaved = saved || null;
  $('#print-extras').hidden = Boolean(saved);
  $('#print-saved-note').hidden = !saved;
  syncOrient();
  printDlg.open($('#print-go'));
}
function syncOrient() { const land = !printSaved && $('#print-flow').checked; document.querySelector(`input[name="print-orient"][value="${land ? 'landscape' : 'portrait'}"]`).checked = true; }
$('#print-flow').addEventListener('change', syncOrient); // Landscape when the flow is included
$('#print-btn').addEventListener('click', () => openPrintDialog());
$('#print-x').addEventListener('click', () => printDlg.close());
$('#print-cancel').addEventListener('click', () => printDlg.close());
function currentPrintModel(opts) {
  const o = opts || {};
  const lens = R.analysis.lens[L.lensKey(R.ai.paradigm || 'policymaker', myParadigm()) + (lvl() === 'expert' ? '' : '|' + lvl())];
  const imp = LV().impacts && LV().impacts.data;
  const km = L.keyMoments(R.analysis.map && R.analysis.map.data, FMT()).map((k) => k.text).join('\n');
  return L.printModel(R, { ...o, range: ptsRangeNow(), liveEval: LV().liveEval && LV().liveEval.data,
    analysis: [['Paradigm Lens', lens && lens.data ? lens.data.rfd : ''], ['Impact Calculus', imp ? [imp.weighing_done, imp.comparison].filter(Boolean).join('\n\n') : ''], ['Key moments', km]] });
}
// The shared print sheet (core/sheets.js), from debate's print model.
function buildPrintSheet(model) { window.TabulaCore.sheets.showPrintSheet(L.printSheet(model)); }
function removePrintSheet() { window.TabulaCore.sheets.removePrintSheet(); }
$('#print-go').addEventListener('click', () => {
  const orientation = document.querySelector('input[name="print-orient"]:checked').value;
  const model = printSaved ? L.printModel(printSaved.round, { range: printSaved.ptsRange, orientation })
    : currentPrintModel({ flow: $('#print-flow').checked, transcripts: $('#print-tr').checked, aiNotes: $('#print-ai').checked, orientation });
  printDlg.close();
  buildPrintSheet(model);
  // A frame later, so the dialog is gone and focus is back before the print window opens.
  setTimeout(() => {
    try { window.print(); } catch { removePrintSheet(); toast('This browser cannot print. Use Copy instead.', { kind: 'error' }); }
  }, 50);
});
// The browser's own Print menu still prints the full ballot (the sheet is built just before, then removed).
addEventListener('beforeprint', () => { if (!$('#print-sheet')) buildPrintSheet(currentPrintModel({})); });
addEventListener('afterprint', () => removePrintSheet());

// ---------- log (History) ----------
function renderLog() {
  const log = store.get(LOG, []);
  if (!log.length) { $('#log-table').innerHTML = '<tr><td class="muted">No saved ballots yet. Save one from Decide → Ballot.</td></tr>'; return; }
  // Columns named by each ballot's format ('1A pts', 'Aff pts'); the rows are in log order, so n is the log index.
  const table = L.historyTable(log);
  const cols = L.historyColumns(table);
  $('#log-table').innerHTML = '<tr>' + cols.map((i) => `<th>${escapeHtml(table.header[i])}</th>`).join('') + '<th><span class="sr-only">Actions</span></th></tr>'
    + table.rows.map((r, n) => '<tr>' + cols.map((i) => `<td>${escapeHtml(r[i] ?? '')}</td>`).join('')
      + `<td class="log-acts"><button class="b small" type="button" data-print-log="${n}" aria-label="Print the saved ballot from ${escapeHtml(r[0] || 'an unknown date')}">Print</button><button class="iconbtn" type="button" data-del="${n}" aria-label="Delete saved ballot from ${escapeHtml(r[0] || 'an unknown date')}">×</button></td></tr>`).join('');
}
$('#log-table').addEventListener('click', (e) => {
  const pr = e.target.closest('[data-print-log]');
  if (pr) { const entry = store.get(LOG, [])[Number(pr.dataset.printLog)]; if (entry) openPrintDialog(L.savedBallotView(entry)); return; }
  const btn = e.target.closest('[data-del]'); if (!btn) return;
  const { list, undo } = L.removeAt(store.get(LOG, []), Number(btn.dataset.del));
  if (!undo) return;
  store.set(LOG, list); renderLog();
  undoToast('Saved ballot deleted.', 'delete saved ballot', () => { store.set(LOG, L.restoreAt(store.get(LOG, []), undo.index, undo.item)); renderLog(); }, 'Saved ballot restored.');
});
// The spreadsheet exports live here (spec 4.1 [A]): one flat table with a Format column (L.historyTable says why).
const historyRows = () => { const t = L.historyTable(store.get(LOG, [])); return [t.header, ...t.rows]; };
$('#log-tsv').addEventListener('click', () => copyToast(L.toTSV(historyRows())));
$('#log-csv').addEventListener('click', () => download('tabula_ballots.csv', L.toCSV(historyRows())));
