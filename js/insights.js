// Insights: Live Eval, Analysis, and hand-editing the round map.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- live eval ----------
let evalBusy = false, evalAgain = false, evalErr = '', evalSoonTimer = null;
// Auto updates wait 20 s after the last flow pass, so mapping several docs at once costs one eval, not one each.
// Offline, the automatic update waits and runs when the internet is back, but only if Live Eval is still on (D2).
let evalWaitsOnline = false;
function scheduleEvalSoon() {
  clearTimeout(evalSoonTimer);
  evalSoonTimer = setTimeout(() => { if (!S.autoEval) return; if (navigator.onLine === false) { evalWaitsOnline = true; return; } scheduleEval(); }, 20000);
}
function scheduleEval() {
  if (!can('liveEval') || !aiReady() || resetting) return;
  if (evalBusy) { evalAgain = true; return; }
  runEval();
}
async function runEval() {
  if (!can('liveEval')) return;
  const level = lvl();
  evalBusy = true; evalErr = ''; renderEvalStatus();
  try {
    const data = await callAI({ feature: 'liveEval', system: L.EVAL_SYSTEM, prompt: L.buildEvalPrompt(R, DOCS), schema: L.EVAL_SCHEMA, effort: 'medium', reading: level });
    if (resetting) return;
    LV(level).liveEval = { data, at: Date.now(), through: L.speechesSoFar(R) };
    save();
    if (R.tab === 'eval') renderEval();
  } catch (err) {
    evalErr = (err && err.message) || String(err) || 'unknown error';
    console.warn('Live eval failed:', err);
    if (R.tab !== 'eval') toast(L.AI_ERROR_PREFIX.eval + ' ' + evalErr);
  } finally {
    evalBusy = false; renderEvalStatus(); renderInsights();
    if (evalAgain && !resetting) { evalAgain = false; runEval(); }
  }
}
// Live Eval states (spec 4.13): Run when nothing is saved, Update when something is. Status colour comes from classes.
function renderEvalStatus() {
  const el = $('#eval-status'); if (!el) return;
  const ev = LV().liveEval;
  const go = $('#eval-go');
  go.textContent = L.runVerb(Boolean(ev));
  const empty = !L.roundHasContent(R, DOCS);
  go.disabled = evalBusy || !aiReady() || empty;
  tone(el);
  if (evalBusy) el.innerHTML = busyHtml('Updating… usually 20–60 seconds');
  else if (!aiReady()) el.innerHTML = noAiHtml('', 'Connect AI');
  else if (empty && !ev) el.innerHTML = '<span class="is-quiet">Nothing to read yet. Start the 1AC first.</span>';
  else if (evalErr) { tone(el, errColor(evalErr)); el.textContent = L.AI_ERROR_PREFIX.eval + ' ' + evalErr; }
  else el.textContent = '';
  const stale = ev ? L.outOfDateText(ev.through, R) : '';
  $('#eval-meta').innerHTML = ev ? escapeHtml('Last updated ' + agoText(ev.at) + ', through ' + ((ev.through || []).length ? ev.through[ev.through.length - 1] : 'no speeches') + '.')
    + (stale ? ' <span class="pill is-caution">' + escapeHtml(stale) + '</span>' : '') : '';
}
setInterval(() => { if (R.tab === 'eval') renderEvalStatus(); }, 5000);
const sideClass = (x) => (x === 'aff' ? 'aff' : x === 'neg' ? 'neg' : '');
const sideLabel = (x) => ({ aff: 'Aff', neg: 'Neg', even: 'Even', unclear: 'Unclear', 'toss-up': 'Toss-up' }[x] || x);
// The small Live Eval summary in the Flow workspace (V9). With no AI the pane is folded to its edge, so it stays empty.
// States: empty ("No read of the round yet."), loading ("Updating…"), error (the aiErrorText line and Try again),
// offline (the offline line; Update is off and the line says why).
function renderInsights() {
  const box = document.getElementById('insights-body'); if (!box) return;
  if (!aiReady()) { box.textContent = ''; return; }
  const e = escapeHtml;
  const entry = LV().liveEval, ev = entry && entry.data;
  const offline = navigator.onLine === false;
  let msg = '';
  if (evalBusy) msg = busyHtml('Updating…');
  else if (offline) msg = '<span class="is-quiet">' + e(L.aiErrorText('offline')) + '</span>';
  else if (evalErr) msg = '<span class="is-error">' + e(evalErr) + '</span>';
  const why = evalBusy || offline ? ' aria-describedby="ins-msg"' : '';
  const action = evalErr && !evalBusy && !offline
    ? '<button class="b small" id="ins-update">Try again</button>'
    : `<button class="b small" id="ins-update"${evalBusy || offline ? ' disabled' : ''}${why}>${ev ? 'Update' : 'Update (one AI call)'}</button>`;
  const open = '<button class="b small" data-tab-go="eval">Open Live Eval</button>';
  const status = msg ? `<p class="ins-msg" id="ins-msg">${msg}</p>` : '';
  if (!ev) {
    box.innerHTML = (status || '<p class="muted ins-msg">No read of the round yet.</p>') + `<div class="row">${action}${open}</div>`;
    return;
  }
  const lean = ev.leaning || {};
  box.innerHTML = `<div class="ins-lean ${sideClass(lean.side)}">Leaning ${e(sideLabel(lean.side))}${lean.side === 'aff' && R.aff.team ? ' (' + e(R.aff.team) + ')' : lean.side === 'neg' && R.neg.team ? ' (' + e(R.neg.team) + ')' : ''}</div>
    <p class="muted ins-meta">${e(lean.confidence || '')} confidence · ${e(agoText(entry.at))}</p>
    <p class="ins-why">${e(lean.why || '')}</p>
    <h3 class="ins-h">Listen for next</h3>
    <ul class="ins-list">${(ev.watch_for || []).slice(0, 4).map((w) => '<li>' + e(w) + '</li>').join('')}</ul>
    ${status}<div class="row mt-3">${action}${open}</div>`;
}
addEventListener('online', () => renderInsights());
addEventListener('offline', () => renderInsights());
document.addEventListener('click', (e) => {
  if (e.target.id === 'ins-update') { scheduleEval(); setTimeout(renderInsights, 0); }
  const go = e.target.closest && e.target.closest('[data-tab-go]');
  if (go) showTab(go.dataset.tabGo);
});
function renderEval() {
  renderEvalStatus();
  const ev = LV().liveEval && LV().liveEval.data;
  if (!ev) { $('#eval-body').innerHTML = ''; return; }
  const e = escapeHtml;
  const lean = ev.leaning || {};
  const team = lean.side === 'aff' ? R.aff.team : lean.side === 'neg' ? R.neg.team : '';
  const issues = ev.key_issues || [];
  const tally = L.issueTally(issues);
  const total = Math.max(1, tally.aff + tally.even + tally.neg);
  // The paired bar: Aff on the left, Even in the middle, Neg on the right. The words carry the meaning, not the colours.
  const bar = `<div class="tally" role="img" aria-label="${e(tally.text)}"><div class="tally-bar" aria-hidden="true">`
    + [['aff', tally.aff], ['even', tally.even], ['neg', tally.neg]].filter(([, n]) => n).map(([k, n]) => `<span class="tally-${k}" data-w="${Math.round((n / total) * 100)}"></span>`).join('')
    + `</div><p class="tally-text">${e(tally.text)}</p></div>`;
  const fb = (ev.feedback || []).map((f) => `<div class="card fb-card">
      <div class="row fb-head"><strong class="${String(f.speaker || '').endsWith('A') ? 'aff' : 'neg'}">${e(f.speaker)} ${e(nameOf(f.speaker) !== f.speaker ? '· ' + nameOf(f.speaker) : '')}</strong><span class="muted">Points so far: ${e(f.points)}</span></div>
      <p class="fb-line">${e(f.so_far)}</p>
      <p class="fb-line"><span class="fb-label">Did well:</span> ${e(f.strength)}</p>
      <p class="fb-line"><span class="fb-label">To work on:</span> ${e(f.fix)}</p></div>`).join('');
  $('#eval-body').innerHTML = `
    <div class="card">
      <div class="lean ${sideClass(lean.side)}">Leaning: ${e(sideLabel(lean.side))}${team ? ' (' + e(team) + ')' : ''} <span class="pill">${e(lean.confidence || '')} confidence</span></div>
      <p class="card-text">${e(lean.why || '')}</p>
    </div>
    <div class="card"><h2>State of the round</h2><p class="card-text">${e(ev.summary || '')}</p></div>
    <div class="card"><h2>Key issues</h2>${issues.length ? bar : ''}<div class="scroll"><table>
      <thead><tr><th>Issue</th><th>Ahead</th><th>Why</th></tr></thead>
      <tbody>${issues.map((k) => `<tr><td>${e(k.issue)}</td><td><span class="pill ${sideClass(k.ahead)}">${e(sideLabel(k.ahead))}</span></td><td>${e(k.note)}</td></tr>`).join('')}</tbody>
    </table></div></div>
    <div class="card"><h2>Listen for next</h2><ul class="plain-list">${(ev.watch_for || []).map((w) => '<li>' + e(w) + '</li>').join('')}</ul></div>
    <div class="grid">
      <div class="card"><h2 class="aff">Aff needs to</h2><p class="card-text">${e(ev.aff_needs || '')}</p></div>
      <div class="card"><h2 class="neg">Neg needs to</h2><p class="card-text">${e(ev.neg_needs || '')}</p></div>
    </div>
    <div class="card"><div class="row card-head"><h2>Feedback so far</h2><button class="b" id="eval-to-ballot" type="button">Use this feedback on the ballot</button></div>
      <div class="grid fb-grid">${fb}</div></div>`;
  // Widths come from data-w through a class-free style property (no inline style attribute in the markup).
  document.querySelectorAll('#eval-body .tally-bar span').forEach((el) => el.style.setProperty('--w', el.dataset.w + '%'));
}
$('#eval-go').addEventListener('click', () => {
  if (!aiReady()) return toast(noAiText());
  scheduleEval();
});
$('#auto-eval').checked = S.autoEval; // off unless the judge turned it on (spec 2.7, D2)
$('#auto-eval').addEventListener('change', (e) => { S.autoEval = e.target.checked; saveSettings(); });
// "Use this feedback on the ballot" opens the draft panel with the feedback option on (spec 4.13). No AI call here.
document.addEventListener('click', (e) => {
  if (e.target.id !== 'eval-to-ballot') return;
  draftUi.feedback = true;
  showTab('ballot'); openDraftPanel(e.target);
});

// ---------- analysis: paradigm lens, impact calculus, round map ----------
// Results are cached in R.analysis and only recomputed when the judge clicks a button.
R.analysis ??= { lens: {}, impacts: null, map: null };
R.analysis.lens ??= {};
R.ai.customParadigm = S.customParadigm || R.ai.customParadigm || '';
const busy = { lens: false, impacts: false, map: false };
const errs = { lens: '', impacts: '', map: '' };

async function askClaude(task, schema, opts) {
  return callAI({ feature: 'analysis', system: L.ANALYSIS_SYSTEM, prompt: L.buildAnalysisPrompt(R, DOCS, task, opts), schema, effort: 'medium', reading: schema === L.MAP_SCHEMA ? null : lvl() });
}
async function runTool(name, task, schema, opts, store) {
  if (!can('analysis')) return;
  if (!aiReady()) return toast(noAiText());
  if (busy[name]) return toast('Still working on the last one. Try again when it finishes.');
  busy[name] = true; errs[name] = ''; renderAnalysis();
  try {
    const data = await askClaude(task, schema, opts);
    if (resetting) return;
    store({ data, at: Date.now(), through: L.speechesSoFar(R) });
    save();
  } catch (err) {
    errs[name] = (err && err.message) || String(err) || 'unknown error';
    console.warn(name + ' failed:', err);
  } finally {
    busy[name] = false;
    if (R.tab === 'analysis') renderAnalysis();
  }
}
function cacheNote(entry) {
  if (!entry) return '';
  const now = L.speechesSoFar(R);
  const newer = now.filter((id) => !(entry.through || []).includes(id));
  return '<span class="muted">Saved ' + agoText(entry.at) + ', through ' + escapeHtml((entry.through || []).slice(-1)[0] || 'no speeches') + '.</span>'
    + (newer.length ? ' <span class="pill is-caution">' + escapeHtml(L.outOfDateText(entry.through, R)) + ' Click Update.</span>' : '');
}
function statusLine(el, name, entry, idle) {
  if (busy[name]) { tone(el); el.innerHTML = busyHtml('Working… usually 20–60 seconds'); }
  else if (!aiReady()) { tone(el); el.innerHTML = noAiHtml('', 'Connect AI'); }
  else if (errs[name]) { tone(el, errColor(errs[name])); el.textContent = L.AI_ERROR_PREFIX.analysis + ' ' + errs[name]; }
  else { tone(el); el.innerHTML = entry ? cacheNote(entry) : '<span class="muted">' + idle + '</span>'; }
}
function currentLensKey() { return L.lensKey($('#lens-pick').value, myParadigm()) + (lvl() === 'expert' ? '' : '|' + lvl()); }
function renderLensPicker() {
  const sel = $('#lens-pick');
  const cur = sel.value || R.lensPick || R.ai.paradigm || 'policymaker';
  sel.innerHTML = Object.keys(L.PARADIGM_LABELS).map((k) => {
    const has = R.analysis.lens[L.lensKey(k, myParadigm()) + (lvl() === 'expert' ? '' : '|' + lvl())] ? ' (saved)' : '';
    const yours = k === (R.ai.paradigm || 'policymaker') ? ' (yours)' : ''; // the paradigm set in Settings (spec 4.9)
    return `<option value="${k}">${escapeHtml(L.PARADIGM_LABELS[k])}${yours}${has}</option>`;
  }).join('');
  sel.value = cur;
}
// "Round at a glance" (spec 4.14): prep used and the key moments from the Round Map. No AI call.
function renderGlance() {
  const e = escapeHtml;
  const p = L.prepUsed(R);
  $('#glance-prep').innerHTML = p.any ? `<p class="glance-line"><span class="aff">${e(p.aff.text)}</span></p><p class="glance-line"><span class="neg">${e(p.neg.text)}</span></p>` : '<p class="muted glance-line">No prep used yet.</p>';
  const km = L.keyMoments(R.analysis.map && R.analysis.map.data);
  $('#glance-moments').innerHTML = km.length
    ? '<ul class="plain-list">' + km.map((k) => `<li><span class="${sideClass(k.side)}">${e(k.speech)}</span> ${e(k.label)} <span class="chip ${k.status === 'dropped' ? 'drop' : 'con'}">${k.status === 'dropped' ? 'Dropped' : 'Conceded'}</span></li>`).join('') + '</ul>'
    : '<p class="muted glance-line">' + (R.analysis.map && R.analysis.map.data && R.analysis.map.data.nodes.length ? 'No dropped or conceded arguments on the Round Map.' : 'Key moments show here after you run the Round Map.') + '</p>';
}
function renderAnalysis() {
  const e = escapeHtml;
  renderGlance();
  renderLensPicker();
  // Never overwrite the paradigm box while the judge is typing in it.
  // Signed in, the box shows the account paradigm, read-only: it is edited in Settings (js/account.js).
  $('#lens-custom').readOnly = Boolean(acctProfile);
  $('#lens-custom-note').hidden = !acctProfile;
  if (document.activeElement !== $('#lens-custom')) $('#lens-custom').value = myParadigm();
  if ($('#lens-pick').value === 'custom') $('#lens-custom-box').open = true;
  // Lens
  const lens = R.analysis.lens[currentLensKey()];
  $('#lens-go').textContent = L.runVerb(Boolean(lens));
  $('#lens-go').disabled = busy.lens;
  statusLine($('#lens-status'), 'lens', lens, 'Not weighed under this paradigm yet. Click Run.');
  if ($('#lens-pick').value === 'custom' && !myParadigm().trim()) $('#lens-status').innerHTML = acctProfile ? '<span class="is-caution">Your account has no paradigm yet. Add it in Settings.</span>' : '<span class="is-caution">Paste your paradigm below first.</span>';
  const d = lens && lens.data;
  $('#lens-out').innerHTML = d ? `
    <div class="lean ${sideClass(d.winner)}">${e(sideLabel(d.winner))}${d.winner === 'aff' && R.aff.team ? ' (' + e(R.aff.team) + ')' : d.winner === 'neg' && R.neg.team ? ' (' + e(R.neg.team) + ')' : ''} <span class="pill">${e(d.confidence)} confidence</span></div>
    <p>${e(d.rfd)}</p>
    <h2 class="sub-h">What decides it here</h2><ul class="plain-list">${(d.deciding_factors || []).map((x) => '<li>' + e(x) + '</li>').join('')}</ul>
    <h2 class="sub-h">How this paradigm changes the call</h2><p class="card-text">${e(d.lens_effect)}</p>` : '';
  // Impacts
  const imp = LV().impacts;
  $('#impact-go').disabled = busy.impacts;
  $('#impact-go').textContent = L.runVerb(Boolean(imp));
  statusLine($('#impact-status'), 'impacts', imp, 'Not run yet. Click Run.');
  const id = imp && imp.data;
  $('#impact-out').innerHTML = id ? `
    <div class="lean small ${sideClass(id.net)}">Net: ${e(sideLabel(id.net))} outweighs</div>
    <div class="mt-2"><table class="impact-table">
      <thead><tr><th>Impact</th><th>Side</th><th>Magnitude</th><th>Probability</th><th>Timeframe</th><th>Reversible?</th><th>Status</th></tr></thead>
      <tbody>${(id.impacts || []).map((x) => `<tr><td data-label="Impact"><strong>${e(x.impact)}</strong><div class="muted">${e(x.note)}</div></td><td data-label="Side"><span class="pill ${sideClass(x.side)}">${e(sideLabel(x.side))}</span></td><td data-label="Magnitude">${e(x.magnitude)}</td><td data-label="Probability">${e(x.probability)}</td><td data-label="Timeframe">${e(x.timeframe)}</td><td data-label="Reversible?">${e(x.reversibility)}</td><td data-label="Status">${e(x.status)}</td></tr>`).join('')}</tbody>
    </table></div>
    <h2 class="sub-h">Weighing the debaters did</h2><p class="card-text">${e(id.weighing_done)}</p>
    <h2 class="sub-h">Comparison</h2><p class="card-text">${e(id.comparison)}</p>` : '';
  // Map
  const map = R.analysis.map;
  $('#map-go').disabled = busy.map;
  $('#map-go').textContent = L.runVerb(Boolean(map));
  statusLine($('#map-status'), 'map', map, 'Not drawn yet. Click Run.');
  const view = R.mapView === 'diagram' ? 'diagram' : 'sheet';
  document.querySelectorAll('[data-mapview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mapview === view)));
  if (!(map && map.data)) { $('#map-out').innerHTML = '<p class="muted">No map yet. Click "+ Argument" to draw one by hand, or Run to let the AI map the round.</p>'; lastMapCode = ''; return; }
  if (view === 'diagram') drawMap(map.data);
  else { lastMapCode = ''; mapSeq++; $('#map-out').innerHTML = mapSheetHtml(map.data); } // mapSeq++ stops a late diagram from covering the sheet
}
const KIND_MARK = { answers: '↩ answers', turns: '↻ turns', extends: '→ extends', concedes: '= concedes' };
function mapSheetHtml(data) {
  const e = escapeHtml;
  const lay = L.layoutMap(data, L.speechesSoFar(R));
  if (!lay.rows.length) return '<p class="muted">No arguments yet. Click "+ Argument" to start, or Draw to let the AI map the round.</p>';
  const cols = lay.columns;
  const sideOf = (sp) => (/A[CR]$/.test(sp) ? 'aff' : 'neg');
  const card = (c) => {
    if (c.ghost) return `<div class="mcard ghost">${e(c.label)}</div>`;
    const chip = c.status === 'dropped' ? '<span class="chip drop">Dropped</span>'
      : c.status === 'extended' ? '<span class="chip ext">Extended</span>'
      : c.status === 'conceded' ? '<span class="chip con">Conceded</span>' : '';
    return `<button class="mcard ${c.side} ${c.status === 'dropped' ? 'dropped' : c.status === 'conceded' ? 'conceded' : ''}" data-node="${e(c.id)}" data-tip="Click to edit">`
      + (c.kind ? `<div class="mk">${e(KIND_MARK[c.kind] || c.kind)}</div>` : '')
      + `<span class="lbl">${e(c.label)}</span>${chip}</button>`;
  };
  return `<div class="mapsheet" style="grid-template-columns: repeat(${cols.length}, minmax(160px, 1fr))">`
    + cols.map((sp, i) => `<div class="mh ${sideOf(sp)}${i === cols.length - 1 ? ' last' : ''}">${e(sp)}</div>`).join('')
    + lay.rows.map((r) => `<div class="mrow" data-tip="${e(r.title)}">`
      + cols.map((sp, i) => `<div class="mc${i === cols.length - 1 ? ' last' : ''}">${(r.cells[sp] || []).map(card).join('')}<button class="madd" data-add-speech="${sp}" data-add-row="${e(r.root)}" aria-label="Add an argument in ${sp} on this row">+</button></div>`).join('')
      + '</div>').join('')
    + '</div>';
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-mapview]');
  if (!b) return;
  R.mapView = b.dataset.mapview; save(); renderAnalysis();
});
$('#lens-pick').addEventListener('change', (ev) => { R.lensPick = ev.target.value; save(); renderAnalysis(); });
$('#lens-custom').addEventListener('change', (ev) => {
  if (acctProfile) return; // signed in, the account paradigm is the source (js/account.js)
  S.customParadigm = ev.target.value; saveSettings();
  // Keep only the saved answer for the current paradigm text; drop answers for old versions of it.
  const keep = L.lensKey('custom', S.customParadigm);
  for (const k of Object.keys(R.analysis.lens)) if (k.startsWith('custom:') && k.split('|')[0] !== keep) delete R.analysis.lens[k];
  R.ai.customParadigm = S.customParadigm; save();
  renderAnalysis();
});
$('#lens-go').addEventListener('click', () => {
  const key = $('#lens-pick').value;
  if (key === 'custom' && !myParadigm().trim()) { $('#lens-custom-box').open = true; return toast(acctProfile ? 'Add your paradigm in Settings first.' : 'Paste your paradigm first.'); }
  const k = currentLensKey();
  runTool('lens', L.LENS_TASK, L.LENS_SCHEMA, { paradigm: L.paradigmText(key, myParadigm()) }, (v) => { R.analysis.lens[k] = v; });
});
$('#impact-go').addEventListener('click', () => { const box = LV(); runTool('impacts', L.IMPACT_TASK, L.IMPACT_SCHEMA, null, (v) => { box.impacts = v; }); });
$('#map-go').addEventListener('click', () => runTool('map', L.MAP_TASK, L.MAP_SCHEMA, null, (v) => {
  // Keep everything the judge drew or edited by hand.
  R.analysis.map = { ...v, data: L.mergeMap(R.analysis.map && R.analysis.map.data, v.data) };
}));
$('#map-copy').addEventListener('click', () => {
  if (!R.analysis.map) return toast('Draw the map first.');
  copyToast(L.buildMermaid(R.analysis.map.data));
});

// Mermaid is loaded only when a map is drawn (pinned version, integrity-checked).
let mermaidReady = null, mapSeq = 0, lastMapCode = '';
function loadMermaid() {
  mermaidReady ??= new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = 'vendor/mermaid-10.9.1.min.js';
    el.integrity = 'sha384-WmdflGW9aGfoBdHc4rRyWzYuAjEmDwMdGdiPNacbwfGKxBW/SO6guzuQ76qjnSlr'; el.crossOrigin = 'anonymous';
    el.onload = () => { mermaidTheme(); res(window.mermaid); };
    el.onerror = () => { mermaidReady = null; rej(new Error('could not load the diagram library (needs internet)')); };
    document.head.append(el);
  });
  return mermaidReady;
}
// The map drawing follows the app theme (V10). If a map is on screen when the theme changes, it is drawn again at once.
function mermaidTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', flowchart: { useMaxWidth: false } });
}
window.TabulaTheme.onChange(() => {
  if (!window.mermaid || !lastMapCode) return;
  mermaidTheme(); lastMapCode = '';
  if (R.analysis && R.analysis.map && R.analysis.map.data) drawMap(R.analysis.map.data);
});
async function drawMap(data) {
  const code = L.buildMermaid(data);
  if (code === lastMapCode && $('#map-out').querySelector('svg')) return; // already drawn
  lastMapCode = code;
  const seq = ++mapSeq;
  try {
    const m = await loadMermaid();
    const { svg } = await m.render('roundmap' + seq, code);
    if (seq === mapSeq) $('#map-out').innerHTML = svg;
  } catch (err) {
    if (seq === mapSeq) $('#map-out').innerHTML = '<p class="muted">Could not draw the map: ' + escapeHtml(err.message || String(err)) + '. Use "Copy Mermaid code" and paste it into mermaid.live.</p>';
    lastMapCode = '';
  }
}

// ---------- hand-editing the round map ----------
// Cards the judge makes are marked user; AI cards the judge changes are marked edited. Both survive AI redraws.
let neState = null;
function mapDataEnsure() {
  if (!R.analysis.map) R.analysis.map = { data: { nodes: [], edges: [] }, at: Date.now(), through: L.speechesSoFar(R) };
  return R.analysis.map.data;
}
function openNodeEditor(opts) {
  const data = mapDataEnsure();
  const node = opts.id ? data.nodes.find((n) => String(n.id) === String(opts.id)) : null;
  // Default speech for a new card: the one given, else the latest speech so far that has a flow column, else 1AC.
  let speech = node ? node.speech : opts.speech;
  if (!speech) speech = L.speechesSoFar(R).filter((x) => L.MAP_SPEECHES.includes(x)).pop() || '1AC';
  const out = node ? data.edges.find((x) => String(x.from) === String(node.id)) : null;
  neState = { id: node ? node.id : null };
  $('#ne-title').textContent = node ? 'Edit argument' : 'New argument';
  $('#ne-label').value = node ? node.label : '';
  $('#ne-speech').innerHTML = L.MAP_SPEECHES.map((x) => `<option${x === speech ? ' selected' : ''}>${x}</option>`).join('');
  $('#ne-status').value = node ? node.status : 'open';
  $('#ne-kind').value = out ? out.kind : 'answers';
  const others = data.nodes.filter((n) => !node || String(n.id) !== String(node.id));
  const target = out ? String(out.to) : opts.target ? String(opts.target) : '';
  $('#ne-target').innerHTML = '<option value="">Nothing (a new argument)</option>'
    + others.map((n) => `<option value="${escapeHtml(n.id)}"${String(n.id) === target ? ' selected' : ''}>${escapeHtml(n.speech + ': ' + n.label)}</option>`).join('');
  $('#ne-delete').hidden = !node;
  $('#node-editor').hidden = false;
  setTimeout(() => $('#ne-label').focus(), 0);
}
function closeNodeEditor() { $('#node-editor').hidden = true; neState = null; }
function edgeKey(e) { return e.from + '>' + e.to; }
$('#ne-save').addEventListener('click', () => {
  const data = mapDataEnsure();
  const label = $('#ne-label').value.trim();
  if (!label) { $('#ne-label').focus(); return toast('Type the argument first.'); }
  let node = neState.id ? data.nodes.find((n) => String(n.id) === String(neState.id)) : null;
  if (!node) { node = { id: 'u' + Date.now().toString(36), user: true }; data.nodes.push(node); }
  else if (!node.user) { if (!node.edited) node.aiLabel = node.label; node.edited = true; }
  node.label = label; node.speech = $('#ne-speech').value; node.status = $('#ne-status').value;
  // Replace this card's outgoing link. Remember AI links the judge removed, so a redraw does not restore them.
  data.removedEdges ??= [];
  for (const x of data.edges.filter((x) => String(x.from) === String(node.id))) if (!x.user) data.removedEdges.push(edgeKey(x));
  data.edges = data.edges.filter((x) => String(x.from) !== String(node.id));
  const to = $('#ne-target').value;
  if (to) data.edges.push({ from: node.id, to, kind: $('#ne-kind').value, user: true });
  save(); closeNodeEditor(); renderAnalysis();
});
// Delete closes the editor first, then offers Undo (spec 2.4 #10).
$('#ne-delete').addEventListener('click', () => {
  const data = mapDataEnsure();
  const node = data.nodes.find((n) => String(n.id) === String(neState.id));
  if (!node) return;
  const before = JSON.parse(JSON.stringify({ nodes: data.nodes, edges: data.edges, removedNodes: data.removedNodes || [] }));
  if (!node.user) (data.removedNodes ??= []).push({ id: String(node.id), key: node.speech + '|' + String(node.aiLabel || node.label).trim().toLowerCase() });
  data.nodes = data.nodes.filter((n) => n !== node);
  data.edges = data.edges.filter((x) => String(x.from) !== String(node.id) && String(x.to) !== String(node.id));
  save(); closeNodeEditor(); renderAnalysis();
  undoToast('Removed "' + node.label + '" from the map.', 'remove ' + node.label, () => {
    Object.assign(mapDataEnsure(), before); save(); renderAnalysis();
  });
});
$('#ne-cancel').addEventListener('click', closeNodeEditor);
$('#node-editor').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'ne-label') $('#ne-save').click(); });
escLayer('node-editor', 70, () => !$('#node-editor').hidden, () => closeNodeEditor());
$('#map-add').addEventListener('click', () => openNodeEditor({}));
$('#map-out').addEventListener('click', (e) => {
  const card = e.target.closest('[data-node]');
  if (card) return openNodeEditor({ id: card.dataset.node });
  const add = e.target.closest('[data-add-speech]');
  if (add) {
    // A new card in a row answers the latest card in an earlier speech on that row.
    const data = mapDataEnsure();
    const lay = L.layoutMap(data, L.speechesSoFar(R));
    const row = lay.rows.find((r) => r.root === add.dataset.addRow);
    const sp = add.dataset.addSpeech;
    let target = '';
    if (row) for (const col of lay.columns) { if (L.MAP_SPEECHES.indexOf(col) >= L.MAP_SPEECHES.indexOf(sp)) break; const c = (row.cells[col] || []).filter((x) => !x.ghost); if (c.length) target = c[c.length - 1].id; }
    openNodeEditor({ speech: sp, target });
  }
});
