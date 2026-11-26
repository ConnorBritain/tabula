// The flow: the live AI flow, the transcript drawer, the flow grid and sheets, and the flow mark layer.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- live AI flow (Claude) ----------
// While a speech runs, Claude re-flows it about every 30 s from the transcript.
// Only one request runs at a time; extra triggers wait for the next turn.
// Pending passes are kept per speech. A forced pass (end of speech) is never dropped;
// normal passes wait so Claude runs at most once every 30 s.
let flowBusy = false, lastFlowAt = 0, flowTimer = null, lastFlowErr = '';
const flowPending = new Map(); // speechId -> force
const FLOW_EVERY_MS = 30000;
function hasFlowSource(speechId) {
  return Boolean((R.transcripts[speechId] || '').trim()) || DOCS.some((d) => L.docSpeech(d, FMT()) === speechId);
}
function scheduleFlow(speechId, force) {
  if (!can('aiFlow')) return false;
  if (resetting || !S.liveFlow || L.speechColumn(speechId, FMT()) == null || !ready()) return false;
  if (!hasFlowSource(speechId)) return false;
  flowPending.set(speechId, Boolean(flowPending.get(speechId) || force));
  pumpFlow();
  return true;
}
function pumpFlow() {
  if (flowBusy || !flowPending.size || resetting) return;
  if (navigator.onLine === false) return; // offline: passes wait; the 'online' event resumes them (spec 2.3)
  for (const id of [...flowPending.keys()]) if (!hasFlowSource(id)) flowPending.delete(id);
  if (!flowPending.size) return;
  const forced = [...flowPending].find(([, f]) => f);
  if (forced) { flowPending.delete(forced[0]); return runFlow(forced[0], true); }
  const wait = FLOW_EVERY_MS - (Date.now() - lastFlowAt);
  if (wait <= 0) { const id = flowPending.keys().next().value; flowPending.delete(id); return runFlow(id, false); }
  clearTimeout(flowTimer); flowTimer = setTimeout(pumpFlow, wait);
}
let flowRunningId = null;
async function runFlow(speechId, forced) {
  flowBusy = true; flowRunningId = speechId; lastFlowAt = Date.now(); renderRecBadge();
  try {
    const data = await callAI({ feature: 'aiFlow', system: L.promptsFor(FMT()).liveFlowSystem, prompt: L.buildLiveFlowPrompt(R, speechId, DOCS), note: L.DOC_FLOW_NOTE, schema: L.LIVE_FLOW_SCHEMA, effort: 'low', kind: 'flow', docs: L.docsForSpeech(DOCS, speechId), hosted: { job: 'flow', extra: { speech: speechId } } });
    // (No format needed above: addDocFiles sets each new doc's speech, so only docs from before formats, all policy,
    // use the default speech rule. cost.test.js checks this exact call.)
    if (resetting) return;
    // The docs for this speech may have been removed while Claude was working. Then drop the result.
    if (!hasFlowSource(speechId)) return;
    R.aiFlows = L.applyLiveFlow(R.aiFlows, speechId, data);
    R.aiFlowAt = Date.now(); save(); lastFlowErr = '';
    // A forced pass is the end-of-speech (or doc) pass: refresh the Live Eval after it.
    if (forced && S.autoEval) scheduleEvalSoon();
    if (forced && S.autoBallot) scheduleBallotSoon();
    if (R.tab === 'flow' && R.flowView === 'ai') redrawAIFlowSafely();
  } catch (err) {
    // Shown with the AI flow (its status line and a toast), not in the transcription note.
    if (err.kind === 'stopped') return; // the AI policy turned off (hosted 403 policyOff): stop quietly
    if (err.kind === 'offline') { flowPending.set(speechId, Boolean(flowPending.get(speechId) || forced)); return; } // tried again when online
    if (err.status === 413 || /too long|too large|exceed/i.test(err.raw || '')) {
      S.liveFlow = false; saveSettings(); $('#live-flow').checked = false; flowPending.clear();
      toast('Live AI flow turned off: the docs and transcript are too big. Remove a doc, then turn it back on.');
    } else if (err.message !== lastFlowErr) toast(L.AI_ERROR_PREFIX.flow + ' ' + err.message);
    lastFlowErr = err.message || String(err) || 'unknown error';
    console.warn('AI flow failed:', err);
  } finally {
    flowBusy = false; flowRunningId = null; renderRecBadge();
    pumpFlow();
  }
}

// The transcript lives only in the drawer above the round bar (V8, Q7). It shows the speech on screen (the viewed
// one, spec 1.2); live words still go to the running speech's transcript.
function renderTranscript() {
  $('#tr-drawer-label').textContent = sp().label;
  setTranscriptView(R.transcripts[sp().id] || '');
}
function setTranscriptView(text) {
  const el = $('#transcript-big');
  if (el.value === text) return;
  // Keep the view at the newest words, unless the judge scrolled up to read.
  const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  el.value = text;
  if (atEnd && document.activeElement !== el) el.scrollTop = el.scrollHeight;
}
$('#transcript-big').addEventListener('input', (e) => { R.transcripts[sp().id] = e.target.value; save(); });
function showDrawer(on) {
  if (on && $('#tr-drawer').hidden) layerOpened('drawer');
  S.trDrawer = on; saveSettings();
  $('#tr-drawer').hidden = !on;
  $('#tr-toggle').setAttribute('aria-expanded', String(on));
  $('#tr-toggle').classList.toggle('on', on);
  document.body.classList.toggle('drawer-open', on);
  if (on) { const t = $('#transcript-big'); t.scrollTop = t.scrollHeight; }
}
$('#tr-toggle').addEventListener('click', () => showDrawer($('#tr-drawer').hidden));
$('#tr-drawer-close').addEventListener('click', () => showDrawer(false));
// The drawer and the shortcut sheet can both be open; Esc closes the one opened last (spec 5.5).
escLayer('drawer', () => 30 + layerRank('drawer'), () => !$('#tr-drawer').hidden, () => showDrawer(false));
// The drawer sits just above the round bar, which can wrap to two lines on narrow screens.
// It is hidden off Flow and in the narrow layout (spec 5.2, 5.6), so --rb-h is 0 there. Measured by the observer and also
// right after a place change (resize observers wait for a paint, which a hidden tab skips).
function measureRoundBar() { document.documentElement.style.setProperty('--rb-h', Math.ceil(document.querySelector('.roundbar').getBoundingClientRect().height) + 'px'); }
new ResizeObserver(measureRoundBar).observe(document.querySelector('.roundbar'));
// The sticky header grows when the "Recording" strip shows; the panes and the overlay sit below it.
// Measured on resize and right after the strip changes (resize observers wait for a paint, which a hidden tab skips).
function measureHeader() { document.documentElement.style.setProperty('--header-h', Math.ceil(document.querySelector('header').getBoundingClientRect().height) + 'px'); }
new ResizeObserver(measureHeader).observe(document.querySelector('header'));

// ---------- flow ----------
// A round nobody has touched opens on a calm start screen instead of an empty flow.
function renderStart() {
  const on = L.isRoundEmpty(R) && !R.started;
  $('#tab-flow').classList.toggle('starting', on);
  $('#start-panel').hidden = !on;
}
$('#start-new').addEventListener('click', () => { R.started = true; save(); showTab('setup'); });
$('#start-flow').addEventListener('click', () => { R.started = true; save(); renderFlow(); });
// "Open a round file (.tab)" is a real button (owner, 2026-11-20), so Tab reaches it and Enter and Space press it;
// it opens the hidden file input's picker. The input's change handler (core.js) does the rest.
$('#start-open').addEventListener('click', () => $('#round-open').click());
function renderFlow() {
  renderStart();
  if (R.flowView === 'ai') return renderAIFlow();
  const f = R.flows[R.flowIdx] || R.flows[0];
  $('#flow-tabs').innerHTML = viewToggle() + R.flows.map((x, i) => sheetTab(x.name, `data-i="${i}"`, i === R.flowIdx)).join('')
    + '<button data-act="add">+ Sheet</button><button data-act="rename">Rename</button>'
    // With one sheet left, Delete stays focusable but says why it does nothing (spec 2.4 #7).
    + (R.flows.length < 2 ? `<button data-act="del" aria-disabled="true" aria-describedby="one-sheet-why" data-tip="${ONE_SHEET}">Delete</button><span class="sr-only" id="one-sheet-why">${ONE_SHEET}</span>` : '<button data-act="del">Delete</button>')
    + sheetLearnLink(f && f.name);
  setFlowCols();
  // The column shell (div.col, h3 with .col-mark, .flow-cell) is also in renderAIFlow and L.emptyFlowHtml: change all three.
  $('#flow').innerHTML = FMT().flowColumns.map((c, i) => `<div class="col ${c.side}"><h3><span>${c.label}</span><span class="col-mark"></span></h3><div class="flow-cell"><div class="flow-hl" aria-hidden="true"></div><textarea data-col="${i}" spellcheck="false" aria-label="${c.label} column, sheet ${escapeHtml(f.name)}">${escapeHtml((f.cells || {})[i] || '')}</textarea></div></div>`).join('');
  markFlowColumns();
  paintAllFlowMarks();
}
// The running speech's column gets a 2 px outline on all four sides and a filled "Now" pill; a different column
// the judge is looking at gets an outline "Viewing" pill (V7, spec 1.2). No bar (docs/design/NO-STRIPES.md).
// Only classes and labels change, so the caret stays put.
// The grid has one column per flow column of the round's format (7 in policy, 5 in LD).
function setFlowCols() { $('#flow').style.setProperty('--flow-cols', FMT().flowColumns.length); }
function markFlowColumns() {
  const m = L.flowMarks(R.run ? R.run.id : null, sp().id, FMT());
  document.querySelectorAll('#flow .col').forEach((col, i) => {
    col.classList.toggle('is-current', i === m.current);
    const mark = col.querySelector('.col-mark');
    if (mark) {
      mark.textContent = i === m.now ? 'Now' : i === m.viewing ? 'Viewing' : '';
      mark.classList.toggle('is-now', i === m.now);
      mark.classList.toggle('is-viewing', i === m.viewing && i !== m.now);
    }
    const ta = col.querySelector('textarea');
    if (ta) ta.placeholder = i === m.current ? 'Type here' : '';
  });
}
// A link from the open sheet to its Debate Library page (for example DA -> learn/disadvantages/). A real link, not a
// tooltip, so keyboard and screen-reader users can reach it. Sheets with no page (for example "Notes") show nothing.
function sheetLearnLink(name) {
  const p = L.sheetPage(name);
  if (p && L.learningCutover) {
    const mode = location.hostname.endsWith('.tabulaspeech.dev') ? 'staging' : 'prod';
    const link = L.learningLink(L.formatOf(R).id, p, { mode });
    return `<a class="sheet-learn" href="${esc(link.href)}" target="_blank" rel="noopener" aria-label="Learn about ${esc(link.title)} (opens a new tab)" data-tip="Learn about ${esc(link.title)}">ⓘ Learn</a>`;
  }
  return p ? `<a class="sheet-learn" href="learn/${p.slug}/" target="_blank" rel="noopener" aria-label="Learn about ${p.topic} in the Debate Library (opens a new tab)" data-tip="Learn about ${p.topic}">ⓘ Learn</a>` : '';
}
function viewToggle() {
  if (!can('aiFlow')) return ''; // no AI flow: no one-tab view switch
  return `<button data-view="mine" class="${R.flowView !== 'ai' ? 'on' : ''}">My flow</button><button data-view="ai" class="ai-action${R.flowView === 'ai' ? ' on' : ''}">${TabulaCore['ai-mark'].aiMark()}AI flow</button><span class="tab-gap"></span>`;
}
let aiIdx = 0;
function agoText(t) {
  if (!t) return 'never';
  const sec = Math.round((Date.now() - t) / 1000);
  return sec < 90 ? sec + ' s ago' : Math.round(sec / 60) + ' min ago';
}
function flowStatusHtml() {
  if (flowBusy) return busyHtml('AI is flowing… (10–30 s)');
  if (!ready()) return noAiHtml();
  if (navigator.onLine === false) return '<span class="is-quiet">' + escapeHtml(L.AI_ERROR_PREFIX.flow + ' ' + L.aiErrorText('offline')) + '</span>';
  if (lastFlowErr) return '<span class="is-error">' + escapeHtml(L.AI_ERROR_PREFIX.flow + ' ' + lastFlowErr) + '</span>';
  if (!S.liveFlow) return '<span class="is-quiet">Live AI flow is off (uses AI). <button class="linkish" type="button" data-tab-go="ai">Turn it on in Settings</button></span>';
  return '';
}
// Keep the status line and "updated" time fresh without redrawing the flow.
setInterval(() => {
  if (R.tab !== 'flow' || R.flowView !== 'ai') return;
  const st = document.getElementById('ai-flow-status');
  const html = flowStatusHtml();
  if (st && st.innerHTML !== html) st.innerHTML = html;
  const ag = document.getElementById('ai-flow-ago'); if (ag) ag.textContent = 'Updated ' + agoText(R.aiFlowAt) + '.';
}, 1000);
function mapDocsNow() {
  if (!can('aiFlow')) return;
  if (!ready()) return toast(noAiText());
  if (!S.liveFlow) { S.liveFlow = true; saveSettings(); $('#live-flow').checked = true; toast('Turned Live AI flow on.'); }
  const speeches = [...new Set(DOCS.map((d) => L.docSpeech(d, FMT())).filter((sp) => sp && L.speechColumn(sp, FMT()) != null))];
  if (!speeches.length) return toast(DOCS.length ? 'Your docs are all set to "Context only". Pick a speech for each doc in Round.' : 'No docs yet. Add them in Round or in the Flow workspace.');
  lastFlowErr = '';
  // Skip a speech Claude is already working on, so one click never sends it twice.
  const started = speeches.filter((sp) => sp !== flowRunningId && scheduleFlow(sp, true));
  const running = speeches.includes(flowRunningId) ? ' (' + flowRunningId + ' is already in progress)' : '';
  toast(started.length ? 'Mapping docs onto ' + started.join(', ') + running + '. The AI maps one speech at a time.' : 'Nothing new to map' + running + '.');
}
function renderAIFlow() {
  const sheets = R.aiFlows || [];
  aiIdx = Math.min(aiIdx, Math.max(0, sheets.length - 1));
  const level = L.FLOW_LEVELS.includes(R.flowLevel) ? R.flowLevel : 'standard';
  const ago = agoText(R.aiFlowAt);
  $('#flow-tabs').innerHTML = viewToggle() + sheets.map((x, i) => sheetTab(x.name, `data-ai-sheet="${i}"`, i === aiIdx)).join('')
    + '<span class="tab-gap"></span>' + L.FLOW_LEVELS.map((lv) => `<button data-level="${lv}" class="${lv === level ? 'on' : ''}">${lv[0].toUpperCase() + lv.slice(1)}</button>`).join('')
    + '<span class="tab-gap"></span><button data-act="map-docs">Map docs to flow now</button>'
    + `<span class="muted" style="margin-left:var(--s2)" id="ai-flow-ago">Updated ${ago}.</span>` + sheetLearnLink((sheets[aiIdx] || {}).name)
    + `<div id="ai-flow-status">${flowStatusHtml()}</div>`
    + (sheets.length ? '' : `<p class="muted ai-flow-empty">${escapeHtml(L.AI_FLOW_EMPTY)}</p>`);
  const sh = sheets[aiIdx];
  // Every cell can be edited. An edited cell keeps the judge's text; if the AI writes something newer
  // underneath, a small bar offers "Use AI" or "Keep mine".
  setFlowCols();
  // Same column shell as renderFlow's My flow and L.emptyFlowHtml (logic/flow.js): change all three.
  $('#flow').innerHTML = sh
    ? FMT().flowColumns.map((c, i) => {
      const ed = sh.edits && sh.edits[i];
      const behind = L.editIsBehind(sh, i, FMT());
      return `<div class="col ${c.side}"><h3><span>${c.label}</span>${ed ? `<span class="chip con ai-protected" data-tip="You edited this cell. AI updates will not overwrite it.">${TabulaCore['ai-mark'].lockMark()}Edited</span>` : ''}<span class="col-mark"></span></h3>`
        + (behind ? `<div class="aibar">AI has a newer version. <button data-ai-use="${i}">Use AI</button><button data-ai-keep="${i}">Keep mine</button></div>` : ed ? `<div class="aibar quiet"><button data-ai-use="${i}">Undo my edit</button></div>` : '')
        + `<div class="flow-cell"><div class="flow-hl" aria-hidden="true"></div><textarea data-aicol="${i}" spellcheck="false" aria-label="${c.label} column, sheet ${escapeHtml(sh.name)}">${escapeHtml(L.flowCellText(sh, i, level, FMT()))}</textarea></div></div>`;
    }).join('')
    : L.emptyFlowHtml(FMT().flowColumns); // no sheet yet: the columns, empty, and the note above (L.AI_FLOW_EMPTY)
  markFlowColumns();
  paintAllFlowMarks();
}
$('#flow-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.view) { R.flowView = b.dataset.view; save(); return renderFlow(); }
  if (b.dataset.aiSheet != null) { aiIdx = Number(b.dataset.aiSheet); return renderFlow(); }
  if (b.dataset.level) { R.flowLevel = b.dataset.level; save(); return renderFlow(); }
  if (b.dataset.act === 'map-docs') return mapDocsNow();
  if (b.dataset.i != null) R.flowIdx = Number(b.dataset.i);
  else if (b.dataset.act === 'add') return addSheet();
  else if (b.dataset.act === 'rename') return renameSheet();
  else if (b.dataset.act === 'del') return deleteSheet();
  save(); renderFlow();
});
// Sheet names come from the in-app dialog (spec 2.4 #5, #6); a deleted sheet has an Undo (#7).
// renderFlow() redraws the tab row, so focus goes back to a tab (the new or current sheet, or the clicked action).
function focusFlowTab(sel) { const el = $('#flow-tabs ' + sel) || $('#flow-tabs button.on[data-i]'); if (el) el.focus(); }
const SHEET_INPUT = { label: 'Sheet name', placeholder: 'For example: DA, Cap K, T', maxLength: 40, emptyError: 'Type a name.' };
async function addSheet() {
  const n = await ask({ title: 'New sheet', input: SHEET_INPUT, buttons: [{ label: 'Cancel', value: null, kind: 'plain' }, { label: 'Add sheet', kind: 'primary' }] });
  if (!n) return;
  R.flows.push({ name: n, cells: {} }); R.flowIdx = R.flows.length - 1; save(); renderFlow(); focusFlowTab('button.on[data-i]');
}
async function renameSheet() {
  const f = R.flows[R.flowIdx]; if (!f) return;
  const n = await ask({ title: 'Rename sheet', input: Object.assign({}, SHEET_INPUT, { value: f.name }), buttons: [{ label: 'Cancel', value: null, kind: 'plain' }, { label: 'Save', kind: 'primary' }] });
  if (!n || !R.flows.includes(f)) return;
  f.name = n; save(); renderFlow(); focusFlowTab('[data-act="rename"]');
}
// Duplicate the open sheet (palette, spec 5.4): the copy goes right after it, with "copy" in the name, and opens.
function duplicateSheet() {
  const f = R.flows[R.flowIdx]; if (!f) return;
  const name = (f.name + ' copy').slice(0, 40);
  R.flows.splice(R.flowIdx + 1, 0, { name, cells: JSON.parse(JSON.stringify(f.cells || {})) });
  R.flowIdx += 1; save(); renderFlow(); focusFlowTab('button.on[data-i]');
  toast('Sheet "' + name + '" added.');
}
const ONE_SHEET = 'A round needs at least one sheet.';
function deleteSheet() {
  if (R.flows.length < 2) return toast(ONE_SHEET);
  const { list, undo } = L.removeAt(R.flows, R.flowIdx);
  if (!undo) return;
  const wasIdx = R.flowIdx;
  R.flows = list; R.flowIdx = Math.min(wasIdx, list.length - 1); save(); renderFlow(); focusFlowTab('[data-act="del"]');
  const token = Object.assign({ roundId: R.id }, undo);
  undoToast('Sheet "' + undo.item.name + '" deleted.', 'delete sheet ' + undo.item.name, () => {
    // A new round may have started since the delete; the sheet never goes into a different round.
    const back = L.undoSheetDelete(R, token);
    if (!back) { toast('A new round started, so the sheet cannot come back.'); return false; }
    R.flows = back.flows; R.flowIdx = back.flowIdx; save(); if (R.tab === 'flow') renderFlow();
  }, 'Sheet "' + undo.item.name + '" restored.');
}
// Option B (Q-8): the mark layer. Behind each flow textarea sits a mirror (.flow-hl) with the same font, padding,
// wrapping and scroll position. It shows the same text, see-through, with a light shade on typed marks such as
// "ext", "*" or "L/T" (L.flowMarkTokens). The textarea stays on top, so the caret, selection, undo and screen
// readers work as before, and the saved flow is still plain text. One div per line, and a keystroke repaints only
// the lines that changed, so a column of thousands of lines stays fast.
const flowMarkLines = new WeakMap();
function paintFlowMarks(ta) {
  const hl = ta.previousElementSibling;
  if (!hl || !hl.classList.contains('flow-hl')) return;
  const lines = ta.value.split('\n');
  const old = flowMarkLines.get(ta);
  if (!old || hl.childElementCount !== old.length) {
    hl.innerHTML = lines.map((ln) => '<div>' + L.flowMarkHtml(ln) + '</div>').join('');
  } else {
    const d = L.flowLinesChanged(old, lines);
    const kids = hl.children;
    const before = kids[d.oldTo] || null;
    for (let i = d.oldTo - 1; i >= d.from; i--) kids[i].remove();
    if (d.newTo > d.from) {
      const html = lines.slice(d.from, d.newTo).map((ln) => '<div>' + L.flowMarkHtml(ln) + '</div>').join('');
      if (before) before.insertAdjacentHTML('beforebegin', html); else hl.insertAdjacentHTML('beforeend', html);
    }
  }
  flowMarkLines.set(ta, lines);
  hl.scrollTop = ta.scrollTop;
}
function paintAllFlowMarks() { document.querySelectorAll('#flow .flow-cell textarea').forEach(paintFlowMarks); }
// Scroll does not bubble, so listen in the capture phase. A resize or a new font size reflows both the same way.
$('#flow').addEventListener('scroll', (e) => {
  const ta = e.target;
  if (ta.tagName === 'TEXTAREA' && ta.previousElementSibling && ta.previousElementSibling.classList.contains('flow-hl')) ta.previousElementSibling.scrollTop = ta.scrollTop;
}, true);
$('#flow').addEventListener('input', (e) => {
  if (e.target.tagName === 'TEXTAREA') paintFlowMarks(e.target);
  const aicol = e.target.dataset.aicol;
  if (aicol != null) {
    const sh = (R.aiFlows || [])[aiIdx]; if (!sh) return;
    const wasEdited = Boolean(sh.edits && sh.edits[aicol]);
    (sh.edits ??= {})[aicol] = { text: e.target.value, base: (sh.edits[aicol] && sh.edits[aicol].base) ?? L.aiFlowCell(sh, Number(aicol), 'standard', FMT()) };
    save();
    if (!wasEdited) { const h = e.target.closest('.col').querySelector('h3'); if (h && !h.querySelector('.chip')) h.querySelector('.col-mark').insertAdjacentHTML('beforebegin', `<span class="chip con ai-protected" data-tip="You edited this cell. AI updates will not overwrite it.">${TabulaCore['ai-mark'].lockMark()}Edited</span>`); }
    return;
  }
  const col = e.target.dataset.col; if (col == null) return;
  (R.flows[R.flowIdx].cells ??= {})[col] = e.target.value; save();
});
$('#flow').addEventListener('click', (e) => {
  const use = e.target.dataset.aiUse, keep = e.target.dataset.aiKeep;
  const sh = (R.aiFlows || [])[aiIdx]; if (!sh || (use == null && keep == null)) return;
  if (use != null) delete sh.edits[use];
  if (keep != null) sh.edits[keep].base = L.aiFlowCell(sh, Number(keep), 'standard', FMT());
  save(); renderFlow();
});
// Do not redraw the AI flow under the judge's cursor; redraw when they leave the cell instead.
let flowRedrawPending = false;
function redrawAIFlowSafely() {
  if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.aicol != null) { flowRedrawPending = true; return; }
  renderFlow();
}
$('#flow').addEventListener('focusout', () => { if (flowRedrawPending) { flowRedrawPending = false; setTimeout(renderFlow, 0); } });
// A sheet tab: the short name on the tab, the full argument name on a long hover (data-tip) and for screen readers.
function sheetTab(name, attr, on) {
  const { short, full } = L.sheetLabel(name);
  return `<button ${attr} class="${on ? 'on' : ''}"${full ? ` data-tip="${escapeHtml(full)}" aria-label="${escapeHtml(full)}"` : ''}>${escapeHtml(short)}</button>`;
}
// Label tips (data-tip) and help bubbles (?) are one module in ui.js (V11, spec 4.4).
// Status colour comes only from the .is-error / .is-caution / .is-ok classes (spec colour rule 4). .is-quiet is not a
// status colour: it is the one class for calm, muted status text (offline, busy, no AI), here and in rendered HTML.
// kind: 'error' | 'caution' | 'ok' | 'quiet' | '' (none). The words beside the colour always carry the meaning.
function tone(el, kind) {
  el.classList.remove('is-error', 'is-caution', 'is-ok', 'is-quiet');
  if (kind) el.classList.add('is-' + kind);
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
