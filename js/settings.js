// Settings: the AI connections panel and the audio settings.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- connections UI ----------
const aOrAn = (w) => (/^[AEIOU]/i.test(w) ? 'an ' : 'a ') + w;
function capText(p) { return '<span class="cap">Does: <b>AI tools</b>' + (p.transcribe ? ' · <b>Transcription</b>' : ' · <i>no transcription</i>') + (p.pdf ? '' : ' · <i>reads text docs only, not PDFs</i>') + '</span>'; }
// Model picker for one provider: Auto (the cheap pick) or any chat model on the key, with premium ones marked.
function modelPicker(id) {
  const e = escapeHtml;
  const list = S.modelLists[id] || [];
  const auto = S.models[id] || {};
  const choice = S.modelChoice[id] || {};
  if (!list.length) return '<div class="cap" style="margin-top:4px">Click Test to load the list of models you can choose from.</div>';
  const sel = (purpose, label, autoId = auto[purpose] || P.pickModel(id, list, purpose)) => `<label class="model-pick">${label}
      <select data-model-pick="${id}" data-purpose="${purpose}">
        <option value="">Auto${autoId ? ': ' + e(autoId) : ''}</option>
        ${list.map((m) => `<option value="${e(m)}"${choice[purpose] === m ? ' selected' : ''}>${e(m)}${P.isPremium(m) ? ' (premium: costs much more)' : ''}</option>`).join('')}
      </select></label>`;
  return `<div class="row model-picks">${sel('ai', 'Routine (flow, Live Eval, analysis)')}${sel('deep', 'Ballot and decision')}</div>
    ${auto.transcribe ? `<div class="cap">Transcription: ${e(auto.transcribe)}</div>` : ''}`;
}
document.addEventListener('change', (ev) => {
  const t = ev.target.closest && ev.target.closest('[data-model-pick]'); if (!t) return;
  const id = t.dataset.modelPick, purpose = t.dataset.purpose;
  S.modelChoice[id] ??= {};
  if (t.value) S.modelChoice[id][purpose] = t.value; else delete S.modelChoice[id][purpose];
  saveSettings();
  if (P.isPremium(t.value)) toast('Premium models cost about 20 to 50 times more per round. Auto picks a cheaper model.');
});
function renderConnections() {
  const e = escapeHtml;
  $('#prov-list').innerHTML = Object.entries(P.PROVIDERS).map(([id, p]) => {
    const on = Boolean(keys[id]);
    const models = S.models[id] || {};
    return `<div class="prov">
      <div class="prov-head">
        <strong>${e(p.name)}</strong>
        <span class="pill ${on ? 'ok-pill' : ''}">${on ? (S.rememberKeys ? 'Connected' : 'Ready (this visit only)') : 'Not set up'}</span>
        ${capText(p)}
        <span class="grow"></span>
        ${on ? `<button class="b" data-prov-test="${id}">Test</button><button class="b" data-prov-del="${id}">Remove</button>` : ''}
      </div>
      ${on ? modelPicker(id) : ''}
      ${on ? '' : `<details style="margin-top:4px"><summary class="muted" style="cursor:pointer">How to get ${e(aOrAn(p.short))} key</summary>
        <ol>${p.steps.map((x) => '<li>' + e(x) + '</li>').join('')}</ol>
        <p class="muted" style="margin:var(--s2) 0 0">${e(p.cost)} <a href="${p.keyUrl}" target="_blank" rel="noopener">Open the ${e(p.short)} key page ↗</a></p></details>`}
    </div>`;
  }).join('');
  const opts = P.engineOptions(keys, S.helper);
  const aiSel = $('#ai-engine'), trSel = $('#tr-engine');
  aiSel.innerHTML = (opts.ai.length ? '' : '<option value="">Nothing connected yet</option>') + opts.ai.map((o) => `<option value="${o.id}">${e(o.label)}</option>`).join('');
  if (!opts.ai.some((o) => o.id === S.aiEngine)) S.aiEngine = opts.ai.length ? opts.ai[0].id : '';
  aiSel.value = S.aiEngine;
  trSel.innerHTML = opts.tr.map((o) => `<option value="${o.id}">${e(o.label)}</option>`).join('');
  if (!opts.tr.some((o) => o.id === S.trEngine)) S.trEngine = 'browser';
  trSel.value = S.trEngine;
  $('#remember-keys').checked = S.rememberKeys;
  renderSubscriptions();
  saveSettings();
  setTimeout(maybeD2Note, 0);
  aiChanged();
}
// Insights switches between its edge and the open pane with no reload when AI connects or goes (V9).
function aiChanged() { writeAiOff(); applyPanes(); renderInsights(); if (R.tab === 'eval') renderEvalStatus(); if (R.tab === 'analysis') renderAnalysis(); if (R.tab === 'ballot') renderDraftPanel(); }
async function connectKey(raw) {
  if (!canSetup()) return;
  const key = String(raw || '').trim();
  const msg = $('#key-msg');
  const id = P.detectProvider(key);
  if (!key) { tone(msg, 'error'); msg.textContent = 'Paste a key first.'; return; }
  if (!id) { tone(msg, 'error'); msg.textContent = 'This does not look like a key from ' + Object.values(P.PROVIDERS).map((x) => x.short + ' (' + x.prefix + '…)').join(', ').replace(/, ([^,]*)$/, ' or $1') + '. Check that you copied all of it.'; return; }
  const p = P.PROVIDERS[id];
  tone(msg, 'quiet'); msg.textContent = 'Looks like ' + aOrAn(p.name) + ' key. Checking it…';
  $('#key-connect').disabled = true;
  try {
    const req = P.modelsRequest(id, key);
    let res;
    try { res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(15000) }); }
    catch (err) { throw asAIError(err, id); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw httpAIError(res.status, j, id);
    const ids = P.modelIds(id, j);
    S.models[id] = { ai: P.pickModel(id, ids, 'ai') || undefined, deep: P.pickModel(id, ids, 'deep') || undefined };
    S.modelLists[id] = P.chatModels(id, ids);
    // Forget choices that are no longer on this key, so the picker and the calls agree.
    for (const [purpose, m] of Object.entries(S.modelChoice[id] || {})) if (!S.modelLists[id].includes(m)) delete S.modelChoice[id][purpose];
    if (p.transcribe && id !== 'google') S.models[id].transcribe = P.pickModel(id, ids, 'transcribe') || undefined;
    keys[id] = key; saveKeys();
    if (!aiReady()) S.aiEngine = id;
    if (S.trEngine === 'browser' && p.transcribe) S.trEngine = id;
    $('#key-paste').value = '';
    tone(msg, 'ok');
    msg.textContent = 'Connected ' + p.name + (p.transcribe ? ' — it can do AI tools and transcription.' : ' — it does AI tools. Transcription stays the free browser kind.');
    renderConnections(); setRecNote(''); setRecStatus();
    CQ.retryNow(); // clips paused for a missing or rejected key can go now
  } catch (err) {
    tone(msg, 'error');
    msg.textContent = 'Could not connect ' + p.name + '. ' + (err.message || err);
  } finally { $('#key-connect').disabled = false; }
}
$('#key-connect').addEventListener('click', () => connectKey($('#key-paste').value));
$('#key-paste').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectKey($('#key-paste').value); });
$('#key-paste').addEventListener('input', (e) => {
  const id = P.detectProvider(e.target.value);
  const m = $('#key-msg'); tone(m, 'quiet');
  m.textContent = id ? 'Looks like ' + aOrAn(P.PROVIDERS[id].name) + ' key. Click Connect.' : '';
});
$('#prov-list').addEventListener('click', (e) => {
  const del = e.target.dataset.provDel, tst = e.target.dataset.provTest;
  if (del) removeKey(del);
  if (tst) connectKey(keys[tst]);
});
async function removeKey(id) {
  const name = P.PROVIDERS[id].short;
  const ok = await ask({
    title: 'Remove the ' + name + ' key?',
    body: 'Tabula forgets this key on this computer. To use ' + name + ' again, paste the key again.',
    buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Remove key', value: true, kind: 'danger' }], cancelValue: false,
  });
  if (!ok) return;
  delete keys[id]; delete S.models[id]; delete S.modelChoice[id]; delete S.modelLists[id]; saveKeys(); renderConnections(); setRecNote('');
}
$('#ai-engine').addEventListener('change', (e) => { S.aiEngine = e.target.value; subShown = ''; saveSettings(); renderSubscriptions(); aiChanged(); });
$('#tr-engine').addEventListener('change', (e) => { S.trEngine = e.target.value; saveSettings(); setRecNote(''); });
$('#remember-keys').addEventListener('change', (e) => {
  S.rememberKeys = e.target.checked; saveKeys(); saveSettings(); renderConnections();
  if (Object.keys(keys).length) toast(S.rememberKeys ? 'Key saved on this computer.' : 'Keys removed from this computer. They work until you close this tab.');
});

// Subscriptions: the local helper (bridge.mjs) runs the Claude Code or Codex app already signed in on this Mac.
// The helper runs from the folder Tabula was downloaded to, so the command is relative to that folder.
const HELPER_CMD = 'node bridge.mjs';

async function checkHelper() {
  if (!canSetup()) { S.helper = {}; renderConnections(); return; }
  subShown = ''; // show what is true now, not an old click
  // The helper only exists on the judge's own computer. On the hosted site there is nothing to ask.
  if (!LOCAL_ORIGIN) { S.helper = {}; renderConnections(); return; }
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    const j = r.ok ? await r.json() : {};
    S.helper = { 'claude-cli': Boolean(j.claude), 'codex-cli': Boolean(j.codex) };
  } catch { S.helper = {}; }
  renderConnections();
}
// "Use your AI subscription": a ChatGPT button and a Claude button. A button that is ready (the local helper
// found the signed-in app) switches the AI tools to it; one that is not ready shows the steps for that app only.
let subShown = '';
function renderSubscriptions() {
  const h = S.helper || {};
  document.querySelectorAll('.sub-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(S.aiEngine === b.dataset.sub));
    b.disabled = !LOCAL_ORIGIN;
  });
  const body = $('#sub-body');
  if (!LOCAL_ORIGIN) { body.innerHTML = '<p style="margin:0">Subscriptions work only in the downloadable version of Tabula, through a small helper on your computer. On this website, connect an API key above.</p>'; return; }
  const id = subShown || (P.SUBSCRIPTIONS[S.aiEngine] ? S.aiEngine : '');
  if (!id) { body.innerHTML = ''; return; }
  // The app and plan names come from providers.js; they show only in this Settings section (copy rules, spec 4.5).
  const s = P.SUBSCRIPTIONS[id], app = escapeHtml(s.via), plan = escapeHtml(s.plan);
  if (h[id]) {
    body.innerHTML = `<p style="margin:0">${S.aiEngine === id ? '<b>In use:</b> ' : ''}your ${plan} plan, through the ${app} app on this computer. Each answer takes 10–30 s. PDFs are not read on this path; save docs as .docx or text. Transcription stays separate.</p>`
      + (id === 'codex-cli' ? `<div style="margin-top:var(--s2)"><label for="codex-model">Model (optional; leave empty to use your ${app} setting)</label><input id="codex-model" value="${escapeHtml(S.codexModel || '')}" placeholder="a model your ${plan} plan includes"></div>` : '');
    return;
  }
  body.innerHTML = `<ol style="margin:0;padding-left:20px">
      <li>Install the ${app} app and sign in once in Terminal: <code>${escapeHtml(s.cmd)}</code></li>
      <li>Start Tabula with its helper: <code>${escapeHtml(HELPER_CMD)}</code> (in the Tabula folder) <button class="b small" id="copy-helper">Copy</button></li>
      <li>Open <code>http://localhost:8765</code> again, then <button class="b small" id="recheck-helper">Check again</button></li></ol>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.sub-btn'); if (!b) return;
  const id = b.dataset.sub;
  subShown = id;
  if ((S.helper || {})[id]) { S.aiEngine = id; saveSettings(); renderConnections(); toast('AI tools now use your ' + P.SUBSCRIPTIONS[id].plan + ' plan.'); }
  else renderSubscriptions();
});
document.addEventListener('change', (e) => { if (e.target.id === 'codex-model') { S.codexModel = e.target.value.trim(); saveSettings(); } });
document.addEventListener('click', (e) => {
  if (e.target.id === 'copy-helper') copyToast(HELPER_CMD);
  if (e.target.id === 'recheck-helper') checkHelper();
});

// ---------- audio settings ----------
// Existing users were on Zoom-style settings, so they keep them; new users start "in the room".
S.audioMode ??= S.setupDone ? 'zoom' : 'room';
function renderAudio() {
  document.querySelectorAll('[data-audio]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.audio === S.audioMode)));
  $('#audio-mode-help').textContent = S.audioMode === 'zoom'
    ? 'For rounds you hear through your speakers (Zoom, Meet). Filters are off, so the speaker sound is not muted. Do not wear headphones.'
    : 'For rounds in a classroom. The browser removes echo and room hum and evens out loud and soft voices.';
}
async function listMics() {
  const sel = $('#mic-pick');
  let devices = [];
  try { devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'); } catch {}
  const named = devices.some((d) => d.label);
  sel.innerHTML = '<option value="">Default microphone</option>' + devices.filter((d) => d.deviceId && d.deviceId !== 'default')
    .map((d, i) => `<option value="${escapeHtml(d.deviceId)}">${escapeHtml(d.label || 'Microphone ' + (i + 1))}</option>`).join('');
  if (!named && devices.length) sel.insertAdjacentHTML('beforeend', '<option disabled>Run the mic test once to see the names</option>');
  const named2 = devices.some((d) => d.label); // ids are only stable once the mic is allowed
  if (S.micId && named2 && !devices.some((d) => d.deviceId === S.micId)) { S.micId = ''; saveSettings(); }
  sel.value = devices.some((d) => d.deviceId === S.micId) ? S.micId : '';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-audio]'); if (!b) return;
  S.audioMode = b.dataset.audio; saveSettings(); renderAudio();
  if (recWanted) toast('The new audio mode starts with the next speech.');
});
$('#mic-pick').addEventListener('change', (e) => { S.micId = e.target.value; saveSettings(); if (recWanted) toast('The new microphone starts with the next speech.'); });
$('#mic-refresh').addEventListener('click', listMics);
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', listMics);
// 5-second mic test: listen, show the level, then say in plain words whether it is good enough.
let testing = false, testAbort = false;
$('#mic-test').addEventListener('click', async () => {
  if (testing) return;
  if (recWanted) return toast('Pause the speech clock first. The mic is in use.');
  testing = true;
  const btn = $('#mic-test'), out = $('#mic-test-result'), meter = $('#test-meter');
  btn.disabled = true; tone(out, 'quiet'); out.textContent = 'Listening… talk normally from where the speaker stands.';
  let stream, ctx;
  const samples = [];
  try {
    stream = await openMic();
    ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    meter.hidden = false;
    const t0 = performance.now();
    await new Promise((resolve) => {
      // A timer, not animation frames, so the test still ends if the tab is in the background.
      const iv = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        const r = L.rms(buf); samples.push(r);
        const info = L.levelInfo(r);
        meter.firstElementChild.style.width = info.pct + '%'; meter.dataset.level = info.level;
        if (testAbort || performance.now() - t0 >= 5000) { clearInterval(iv); resolve(); }
      }, 100);
    });
    if (testAbort) { tone(out, 'quiet'); out.textContent = 'Mic test stopped because a speech started.'; }
    else {
      const v = L.micTestVerdict(samples);
      tone(out, v.ok ? 'ok' : 'caution');
      out.textContent = v.text;
    }
    listMics(); // names show up once the mic has been allowed
  } catch (err) {
    tone(out, 'error');
    out.textContent = 'Mic test failed: ' + (err && err.name === 'NotAllowedError' ? 'the microphone is blocked. Click the mic icon in the address bar and allow it.' : (err && err.message) || err);
  } finally {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close().catch(() => {});
    meter.hidden = true; btn.disabled = false; testing = false; testAbort = false;
  }
});
