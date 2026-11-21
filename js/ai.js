// The AI client and its errors: the reading level, the AI keys and providers, requests, Stop and error text.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- reading level: "How the AI writes" (spec 4.9, Q15) ----------
// Results are saved per reading level, so switching is instant and does not re-ask the AI.
// One rule: this round's choice (R.reading, set in Round setup), else the device default (S.readLevel, in Settings).
S.readLevel ??= 'expert';
const lvl = () => L.readingFor(R.reading, S.readLevel);
R.byLevel ??= {};
(() => { // move results saved by older versions into the "expert" box
  const ex = (R.byLevel.expert ??= {});
  if (R.liveEval && !ex.liveEval) ex.liveEval = R.liveEval;
  if (R.ai && R.ai.output && !ex.output) ex.output = R.ai.output;
  if (R.analysis && R.analysis.impacts && !ex.impacts) ex.impacts = R.analysis.impacts;
  delete R.liveEval; if (R.ai) delete R.ai.output; if (R.analysis) delete R.analysis.impacts;
})();
const LV = (level) => (R.byLevel[level || lvl()] ??= {});
function renderReadLevel() {
  const device = L.readingFor(null, S.readLevel);
  document.querySelectorAll('[data-read]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.read === (b.dataset.readScope === 'device' ? device : lvl()))));
  const st = $('#dp-style'); if (st) st.textContent = 'Writing style: ' + L.READING_LEVELS[lvl()].label + '. Change it in Round setup.';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-read]');
  if (!b) return;
  if (b.dataset.readScope === 'device') { S.readLevel = b.dataset.read; saveSettings(); }
  else { R.reading = b.dataset.read; save(); }
  renderReadLevel();
  if (R.tab === 'eval') renderEval();
  if (R.tab === 'analysis') renderAnalysis();
});

// ---------- AI connections ----------
// Keys are kept per provider. With "Remember" on they are saved in this browser (localStorage). With it off, the
// default for new installs (spec 2.6, D1), they live in this tab only (sessionStorage, Q-3): a refresh keeps them,
// and closing the tab forgets them.
const P = window.Providers;
const KEYS = L.STORE_KEYS.keys;
const tabStore = {
  get(k, d) { try { const raw = sessionStorage.getItem(k); return raw ? JSON.parse(raw) : d; } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};
// A saved choice wins. With none, a judge who already has keys on disk keeps them, so no current user loses a key.
S.rememberKeys = L.resolveRememberKeys(S.rememberKeys, Object.keys(store.get(KEYS, {}) || {}).length > 0 || Boolean(store.get(KEY, '')) || Boolean(store.get(OAKEY, '')));
const keys = Object.assign({}, tabStore.get(KEYS, {}), store.get(KEYS, {}));
// Move keys saved by older versions of the app.
(() => { const a = store.get(KEY, '') || tabStore.get(KEY, ''), o = store.get(OAKEY, '') || tabStore.get(OAKEY, ''); if (a && !keys.anthropic) keys.anthropic = a; if (o && !keys.openai) keys.openai = o; })();
S.models = P.cleanSavedModels(S.models); // older versions saved premium or retired models
S.modelChoice ??= {}; // models the judge picked in Settings (these win over automatic picks)
S.modelLists ??= {}; // each provider's chat models, for the picker
S.helper = {};
// With several keys and no choice yet, take the first connected provider in alphabetical order (no favorite).
if (!S.aiEngine) S.aiEngine = ['anthropic', 'google', 'openai', 'openrouter', 'xai'].find((p) => keys[p]) || '';
if (!S.trEngine) S.trEngine = S.engine === 'openai' && keys.openai ? 'openai' : 'browser';
// Old single-key entries are removed only once the keys are safely saved in the new place.
function saveKeys() {
  if (restoring) return;
  const dropTab = () => { tabStore.del(KEY); tabStore.del(OAKEY); };
  if (S.rememberKeys) { if (store.set(KEYS, keys)) { store.del(KEY); store.del(OAKEY); tabStore.del(KEYS); dropTab(); } }
  else { tabStore.set(KEYS, keys); dropTab(); store.del(KEYS); store.del(KEY); store.del(OAKEY); }
}
saveKeys();
const aiReady = () => {
  const e = S.aiEngine;
  if (!e) return false;
  if (P.SUBSCRIPTIONS[e]) return Boolean(S.helper[e]);
  return Boolean(keys[e]);
};
// The "No AI" line (L.NO_AI) is muted, with a button to Settings (spec 2.2).
// L.NO_AI (it asks to connect AI) only while the Connect AI invite may show; else a plain line.
const noAiText = () => (showSetup() ? L.NO_AI : 'AI is not available right now.');
// The link to Settings shows only while the Connect AI invite may (CONTRACTS §5 rule 5); else the line is plain.
const noAiHtml = (extra, label) => '<span class="is-quiet">' + escapeHtml(noAiText()) + (showSetup() ? ' <button class="linkish" type="button" data-tab-go="ai" data-ai-setup="invite">' + escapeHtml(label || 'Open Settings') + '</button>' : '') + (extra ? ' ' + escapeHtml(extra) : '') + '</span>';
// An AI error line: orange, except "offline", which is muted (it is not the judge's fault, spec 2.3).
const errColor = (msg) => (msg === L.aiErrorText('offline') ? 'quiet' : 'error'); // a tone() name: offline is calm, not an error
// A loading line: muted, with a small spinner, never green (spec 2.3).
const busyHtml = (text) => '<span class="is-quiet"><span class="spin" aria-hidden="true"></span>' + escapeHtml(text) + '</span>';
// An Undo toast (spec 2.4, 4.3). The change is already made; Undo puts it back. The button is named "Undo: {what}".
// undo() returns false when it could not put the change back (it shows its own toast then).
function undoToast(msg, what, undo, doneMsg) {
  toast(msg, { action: { label: 'Undo', name: 'Undo: ' + what, run: () => { if (undo() !== false) toast(doneMsg || 'Restored.'); } } });
}

let claudeClient = null, claudeClientKey = '';
async function getClaude() {
  if (claudeClient && claudeClientKey === keys.anthropic) return claudeClient;
  const { default: Anthropic } = await import('./vendor/anthropic-sdk-0.137.0.bundle.mjs');
  claudeClient = new Anthropic({ apiKey: keys.anthropic, dangerouslyAllowBrowser: true });
  claudeClientKey = keys.anthropic;
  return claudeClient;
}

// Reads the provider's live model list once, and remembers the best model for each job.
async function modelFor(provider, purpose) {
  // Gemini transcribes with its routine model, so it follows the judge's routine choice.
  const chosen = (S.modelChoice[provider] || {})[purpose] || (provider === 'google' && purpose === 'transcribe' ? (S.modelChoice.google || {}).ai : '');
  if (chosen) return chosen;
  const saved = (S.models[provider] || {})[purpose];
  if (saved) return saved;
  const req = P.modelsRequest(provider, keys[provider]);
  let res;
  try { res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(15000) }); }
  catch (err) { throw asAIError(err, provider); }
  // A busy or broken provider may work again soon (retryable); a rejected key will not (hold).
  if (!res.ok) throw httpAIError(res.status, await res.json().catch(() => ({})), provider);
  const ids = P.modelIds(provider, await res.json());
  S.modelLists[provider] = P.chatModels(provider, ids);
  const id = P.pickModel(provider, ids, purpose);
  if (!id) throw Object.assign(new Error(P.chatModels(provider, ids).some(P.isPremium)
    ? 'This key only has premium models, which cost much more. To use one anyway, choose it in Settings under ' + P.PROVIDERS[provider].name + '.'
    : 'This ' + P.PROVIDERS[provider].name + ' key has no model that can do this. Test the key in Settings.'), { retryable: false, kind: 'noModel' });
  (S.models[provider] ??= {})[purpose] = id; saveSettings();
  return id;
}
// Forgets a model the provider retired, so the next call picks again. A model the judge chose is forgotten too, with a note.
function forgetModel(provider, purpose) {
  if ((S.modelChoice[provider] || {})[purpose]) { delete S.modelChoice[provider][purpose]; toast('The model you chose for ' + P.PROVIDERS[provider].name + ' was retired, so Tabula picked a new one.'); }
  delete (S.models[provider] || {})[purpose];
  saveSettings();
}
// Runs one model call with a fresh pick if the saved model was retired (404).
const withModel = (provider, purpose, run) => P.retryOnce404(async () => run(await modelFor(provider, purpose)), () => forgetModel(provider, purpose));

// One error for every failed AI or transcription call (spec 2.3): the kind comes from L.classifyAIError and the
// words from L.aiErrorText. The provider's own words go to the console only. info: { status, name, message, stop, helper }.
const providerName = (eng) => (P.PROVIDERS[eng] ? P.PROVIDERS[eng].short : P.SUBSCRIPTIONS[eng] ? P.SUBSCRIPTIONS[eng].plan : '');
function aiError(info, eng) {
  const i = info || {};
  const kind = L.classifyAIError(Object.assign({ online: navigator.onLine }, i));
  if (i.message) console.warn('AI call failed (' + kind + '):', i.message);
  return Object.assign(new Error(L.aiErrorText(kind, { provider: providerName(eng), status: i.status })), {
    kind, status: i.status, raw: i.message || '',
    retryable: ['offline', 'noReply', 'timeout', 'busy'].includes(kind),
    hold: kind === 'keyRejected', // a rejected key will not work until the judge fixes it
  });
}
// An error reply from a provider. Some providers say "invalid key" with a 400; that is a rejected key too.
function httpAIError(status, body, eng) {
  const raw = body && body.error;
  const message = typeof raw === 'string' ? raw : (raw && raw.message) || JSON.stringify(body || {}).slice(0, 300);
  const bad = /invalid.*key|api key not valid|incorrect api key/i.test(message);
  return aiError({ status: bad ? 401 : status, message }, eng);
}
// A thrown error from fetch or the SDK, as the classifier's input. Errors that already have a kind pass through.
function asAIError(err, eng, extra) {
  if (err && err.kind) return err;
  const name = err && err.name || '';
  const n = /Timeout/.test(name) ? 'TimeoutError' : /APIConnection/.test(name) ? 'TypeError' : name;
  return aiError(Object.assign({ status: err && err.status, name: n, message: err && err.message }, extra), eng);
}

// Text docs with students' names swapped for positions. PDFs go as they are (their text cannot be edited here).
// File names are swapped too ("Smith 1NC.docx" is a name the AI would see in the doc list).
const anonDocs = (docs) => docs.map((d) => ({ ...d, name: L.anonymize(d.name, R), data: d.kind === 'pdf' ? d.data : L.anonymize(d.data, R) }));
// One way to ask the AI for anything. schema = JSON Schema for a JSON reply, or null for plain text.
// kind = 'flow' | 'routine' | 'ballot' | 'decision': sets the output cap; ballot and decision use the mid-tier ("deep") model.
// docs = only the docs this call needs. The live flow sends one speech's docs; Live Eval, analysis, ballot and
// decision judge the whole round, so they keep the default (all of them).
// signal: an AbortSignal from a Stop button (spec 4.5). It is joined to each call's own timeout with AbortSignal.any.
// Where AbortSignal.any is missing, the call is not cut, but its late reply is thrown away (the caller sees 'stopped').
const STOPPED = () => Object.assign(new Error('Stopped.'), { kind: 'stopped' });
function withStop(signal, ms) {
  const t = AbortSignal.timeout(ms);
  if (!signal) return t;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, t]) : t;
}
// ---------- hosted AI (tabula-cloud docs/APP-CLIENT-PROPOSAL.md §3) ----------
// With hosted access (own credits, or the school pays for the feature), AI calls go to the Tabula server, which owns
// the prompts and the prices. The page sends round state only, with names swapped for roles. A problem becomes one
// error with plain words (L.hostedError); "out of rounds" also shows a toast with a Buy rounds link.
const useHosted = (f) => L.useHosted(capsGate, f, aiReady());
const newCallId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2, 10));
function hostedFail(info) {
  if (info.quiet) return STOPPED();
  if (info.signOut) clearCaps(); // signed out: today's app (AI-POLICY §6d)
  if (info.link && !(info.fallback && aiReady())) {
    const { label, url } = info.link;
    toast('Get more rounds on your Tabula account.', { key: 'hosted-link', action: { label, name: label + ' (opens a new tab)', run: () => window.open(url, '_blank', 'noopener') } });
  }
  return Object.assign(new Error(info.text), { kind: 'hosted', hosted: info.kind, retryable: info.retryable, fallback: info.fallback, status: info.status });
}
// ---------- round limits (Terms §6.4: "The app shows the current limits") ----------
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
  hostedResume = true;
  const idle = (hostedLimits.limits.idleMin || 0) * 60000;
  setHostedRound(Object.assign({}, hostedLimits.round, { state: 'active', idleAt: idle ? hostedNow() + idle : null }));
  toast('AI is on again for this round.');
});
setInterval(renderHostedRound, 30000); // time left counts down; a pause shows when it starts

// One hosted call. job: an L.HOSTED_TASKS key; extra: what that job needs from the caller (L.hostedState).
// Returns the answer text. The judge's Stop (signal) cancels the stream, and the server charges only what it sent.
async function callHosted({ job, extra, signal }) {
  const anon = (v) => L.anonymize(v, R);
  const state = L.hostedState(job, R, DOCS, extra);
  for (const k of Object.keys(state)) state[k] = anon(state[k]);
  // All of the round's text docs, the same text in the same order on every call (§3a: the provider caches them).
  const docs = P.docsAsText(anonDocs(DOCS), L.docTitle);
  if (docs) state.docs = docs;
  // A limit already reached: no request (Terms §6.4: the round goes on with the free tools).
  const blocked = L.roundBlocks(job, hostedLimits && hostedLimits.round, hostedNow());
  if (blocked) throw hostedFail(Object.assign(L.hostedError(409, blocked), { status: 409 }));
  const req = L.hostedRequest(R, job, state, newCallId(), hostedResume);
  let res;
  try { res = await fetch(req.url, { ...req.init, signal: withStop(signal, 240000) }); }
  catch (err) {
    if (signal && signal.aborted) throw STOPPED();
    if (navigator.onLine === false) throw aiError({ online: false }, '');
    throw hostedFail(Object.assign(L.hostedError(err && err.name === 'TimeoutError' ? 503 : 0, ''), { status: 0 }));
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const info = L.hostedError(res.status, j && j.error);
    const round = L.parseRound(j && j.round);
    if (round) setHostedRound(round);
    else if (info.roundState && hostedLimits && hostedLimits.round) setHostedRound(Object.assign({}, hostedLimits.round, { state: info.roundState }));
    else if (info.roundState) setHostedRound({ state: info.roundState, firstSpeechAt: null, endsAt: null, idleAt: null, freeReason: null, draftsLeft: { ballot: false, decision: false } });
    throw hostedFail(Object.assign(info, { status: res.status }));
  }
  hostedResume = false; // the server took the tap
  let acc = L.sseStep({}, {});
  try {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (!acc.done && !acc.error) {
      const { value, done } = await reader.read();
      if (done) break;
      const got = L.readSse(buf + dec.decode(value, { stream: true }));
      buf = got.rest;
      for (const ev of got.events) acc = L.sseStep(acc, ev);
    }
    if (acc.done || acc.error) reader.cancel().catch(() => {});
  } catch (err) {
    if (signal && signal.aborted) throw STOPPED();
    throw hostedFail(Object.assign(L.hostedError(0, 'stream'), { status: 0 }));
  }
  // A stream that ends without "done" gave no full answer. The balance shows at the next capability check (§3a).
  if (!acc.done) throw hostedFail(Object.assign(L.hostedError(0, acc.error || 'stream'), { status: 0 }));
  setHostedRound(acc.round);
  return acc.text;
}
// The answer as the caller wants it: JSON for a schema, else text; names put back.
// KNOWN GAP (2026-11-21): the server's task templates (tabula-cloud src/ai/tasks.ts) still ask for plain text, so a
// feature with a schema shows badReply until each task answers in that feature's schema (LIVE_FLOW_SCHEMA, EVAL_SCHEMA,
// LENS_SCHEMA, IMPACT_SCHEMA, MAP_SCHEMA, BALLOT_SCHEMA in logic/prompts.js). That is a server change.
function hostedResult(text, schema) {
  let out = text;
  if (schema) {
    try { out = P.extractJson(text); }
    catch { throw Object.assign(new Error(L.HOSTED_TEXT.badReply), { kind: 'hosted', hosted: 'badReply', retryable: true }); }
  }
  return L.deanonymize(out, R);
}

// feature: the gate key of the caller (platform 1B). A feature that is off makes no call and shows nothing (stopped).
// hosted: { job, extra } for the hosted path (L.HOSTED_TASKS, L.hostedState). With hosted access the call goes to the
// Tabula server, unless the judge connected an own key and pays for the feature themselves (their choice wins).
// When the server says this account cannot use it now (signed out, billing hold, busy), the own key is used if there
// is one. Without hosted access, the own key is used as before.
async function callAI({ feature, system, prompt, note, schema, effort = 'medium', reading, kind = 'routine', docs = DOCS, signal, hosted }) {
  if (!can(feature)) throw STOPPED();
  if (signal && signal.aborted) throw STOPPED();
  const eng = S.aiEngine;
  if (hosted && useHosted(feature)) {
    if (navigator.onLine === false) throw aiError({ online: false }, '');
    try { return hostedResult(await callHosted({ job: hosted.job, extra: hosted.extra, signal }), schema); }
    catch (err) {
      if (!(err.fallback && aiReady())) throw err;
      console.warn('Hosted AI is not available now (' + err.hosted + '); using the own key.');
    }
  }
  if (!aiReady()) throw Object.assign(new Error(noAiText()), { kind: 'noAI' });
  // Offline: show the offline text and make no call (spec 2.3).
  if (navigator.onLine === false) throw aiError({ online: false }, eng);
  const maxTokens = P.outputCap(kind);
  const purpose = kind === 'ballot' || kind === 'decision' ? 'deep' : 'ai';
  // Reading level: the same analysis, worded for an expert judge or in plain words.
  if (reading) system = system + '\n\n' + L.readingGuide(reading);
  // Students' names are swapped for positions (1A, 2N...) in everything typed or transcribed, and in text docs,
  // before it goes to the AI; names come back in the reply. PDFs are sent as they are (their text cannot be edited here).
  system = L.anonymize(system, R); prompt = L.anonymize(prompt, R);
  docs = anonDocs(docs);
  let text;
  // Every failure becomes one classified error (spec 2.3); errors that already have a kind pass through.
  try {
    if (eng === 'anthropic') {
      const client = await getClaude();
      const msg = await withModel('anthropic', purpose, (model) => {
        const params = P.claudeParams(model, {
          max_tokens: maxTokens, thinking: { type: 'adaptive' }, output_config: { effort },
          system, messages: [{ role: 'user', content: L.buildUserContent(docs, prompt, note) }],
        });
        if (schema) params.output_config.format = { type: 'json_schema', schema };
        return client.beta.messages.create(params, signal ? { signal } : undefined);
      });
      if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') throw aiError({ stop: msg.stop_reason }, eng);
      text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else if (P.SUBSCRIPTIONS[eng]) {
      // The subscription helper has no per-token bill, so it gets no output cap.
      const docText = P.docsAsText(docs, L.docTitle);
      const res = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: eng, system, prompt: (docText ? docText + '\n\n' + (note || L.DOC_NOTE) + '\n\n' : '') + prompt, schema, model: eng === 'codex-cli' ? (S.codexModel || '') : undefined }),
        signal: withStop(signal, 300000),
      });
      const j = await res.json().catch(() => ({}));
      // A helper 4xx or 5xx goes through the normal rules (401/403 = "rejected", 5xx = "busy"), named by the plan.
      // That can blame the plan when the helper itself failed; accepted for now (see L.classifyAIError).
      if (!res.ok) throw aiError({ status: res.status, message: j.error || 'the helper said ' + res.status, helper: true }, eng);
      text = j.text || '';
    } else {
      const res = await withModel(eng, purpose, (model) => {
        const req = P.buildAIRequest(eng, { key: keys[eng], model, system, prompt, docs, schema, title: L.docTitle, note: note || L.DOC_NOTE, maxTokens });
        return fetch(req.url, { ...req.init, signal: withStop(signal, 240000) });
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw httpAIError(res.status, j, eng);
      text = P.parseAIResponse(eng, j);
    }
    if (signal && signal.aborted) throw STOPPED(); // a late reply after Stop is thrown away
    return L.deanonymize(schema ? P.extractJson(text) : text, R);
  } catch (err) {
    if (signal && signal.aborted) throw STOPPED();
    throw asAIError(err, eng, P.SUBSCRIPTIONS[eng] ? { helper: true } : {});
  }
}
