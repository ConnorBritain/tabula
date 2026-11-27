// The staged demo of the AI features (?demo=policy or ?demo=ld). A sample round (demo/*.js) plays through the real
// screens: the transcript types in, the AI flow fills, Live Eval runs, and the ballot and decision are drafted. The AI
// answers are saved replies: callAI (js/ai.js) asks demoAnswer instead of a provider. assets/demo-boot.js already
// swapped storage and network for this page load, so the demo never touches the judge's real data and makes no calls.
// This part loads first of the page parts: it puts the sample round into the (in-memory) storage before js/core.js
// reads it. Its other code runs later, once the page has started (DOMContentLoaded).
// It drives other parts through their globals, so a rename there breaks the demo (the browser check, not node, sees it):
// core (R, save, showTab, FMT, flagOn, measureRoundBar, $), clock (selectSpeech, speechIdx, sp), flow (scheduleFlow,
// flowBusy, flowPending, renderFlow, renderTranscript, setTranscriptView, showDrawer), ai (LV, STOPPED), insights
// (evalBusy), decide (draftUi, openDraftPanel, closeDraftPanel).
// Live transcription (js/recording.js) calls its provider without callAI; in the demo it never runs (the player writes
// the transcript), and the sandbox blocks both the mic and the network anyway.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

let demoSample = window.TabulaDemo ? window.PolicyLogic.demoSample(window.TabulaDemoRounds, window.TabulaDemo.param) : null;
// The page is the demo: the sandbox is on and the sample round for its format is here.
const demoOn = Boolean(demoSample);
if (demoOn) {
  const seed = window.PolicyLogic.demoSeed(demoSample, window.PolicyLogic.getFormat(demoSample.format));
  const keys = window.PolicyLogic.STORE_KEYS;
  localStorage.setItem(keys.round, JSON.stringify(seed.round)); // the sandbox's memory store, never the real one
  localStorage.setItem(keys.settings, JSON.stringify(seed.settings));
}

// How long a saved AI answer "takes", so the busy states show as they do in a real round.
const DEMO_AI_MS = 1200;
// Typing speed of the sample transcript: words per piece, and time between pieces.
const DEMO_WORDS = 4, DEMO_TYPE_MS = 110;
const DEMO_NOT_HERE = 'This part is not in the demo. Try it in your own round.';

// callAI's answer in the demo: the saved reply for the job, after a short wait. A Stop (signal) stops it, as in a real call.
function demoAnswer({ hosted, signal }) {
  return new Promise((resolve, reject) => {
    const reply = L.demoReply(demoSample, hosted && hosted.job, hosted && hosted.extra);
    const pending = demoAnswer.pending ||= new Set();
    const finish = (error) => {
      clearTimeout(t); pending.delete(cancel);
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else if (reply) resolve(reply); else reject(new Error(DEMO_NOT_HERE));
    };
    const cancel = () => finish(STOPPED());
    let t;
    const deliver = () => {
      if (typeof demoUi !== 'undefined' && demoUi.paused) { t = setTimeout(deliver, 100); return; }
      finish();
    };
    t = setTimeout(deliver, DEMO_AI_MS);
    pending.add(cancel);
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
  });
}

// ---------- the player ----------
const demoUi = { steps: [], i: 0, busy: false, run: 0, paused: false, message: '', mappedSpeeches: new Set() };
const demoSetupFields = [
  'tournament', 'roundName', 'judge', 'topic', 'room', 'start', 'flight',
  'aff.team', 'aff.d1', 'aff.d2', 'neg.team', 'neg.d1', 'neg.d2',
];

// Use the selected format's sample for its speeches and AI replies. Carry over setup fields the visitor changed.
async function demoSwitchFormat(fmt) {
  const sample = window.TabulaDemoRounds.find(round => round.format === fmt.id);
  if (!sample) return renderFormatSetup();
  const round = R;
  const view = demoUi.run;
  if (demoUi.i !== 0 || L.roundHasContent(round, DOCS) || Object.keys(round.ballot?.touched || {}).length) {
    const confirmed = await ask({
      title: `Open the ${L.labelOf(fmt)} sample?`,
      body: 'This replaces the current practice flow, documents and ballot. Your edited round details carry over.',
      buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Switch sample', value: true, kind: 'primary' }],
      cancelValue: false,
    });
    if (!confirmed || R !== round || demoUi.run !== view) return renderFormatSetup();
  }
  demoCancel();
  const oldSeed = L.demoSeed(demoSample, L.getFormat(demoSample.format)).round;
  const newSeed = L.demoSeed(sample, fmt).round;
  const next = Object.assign(freshRound(null, fmt), newSeed);
  for (const field of demoSetupFields) {
    const value = getPath(round, field) ?? '';
    if (value !== (getPath(oldSeed, field) ?? '')) setPath(next, field, value);
  }
  demoSample = sample;
  R = next;
  DOCS = [];
  demoUi.mappedSpeeches.clear();
  const url = new URL(location.href);
  url.searchParams.set('demo', sample.param);
  history.replaceState(history.state, '', url);
  demoChapters();
  bindAll(); renderSpeeches(); renderClock(); renderPrep(); renderTranscript(); renderDocs();
  await demoGo(0);
  showTab('setup');
  demoCue.introSeen = true;
  demoCueSchedule();
}
const demoWait = (ms) => new Promise((res) => setTimeout(res, ms));
// Waits until cond() is true (checked every 100 ms), at most ms. run: the step's run number; a newer step stops it.
async function demoUntil(cond, run, ms = 15000) {
  for (let t = 0; t < ms && run === demoUi.run;) {
    if (!demoUi.paused) { if (cond()) return true; t += 100; }
    await demoWait(100);
  }
  return false;
}
// A speech has been given: its clock is used up, so its tile shows as done.
function demoMarkSpoken(id) {
  R.started = true; R.timeLeft[id] = 0; save();
}
// A speech as live transcription writes it: the words type in, then the end-of-speech AI flow pass runs.
async function demoSpeech(id, run) {
  FlowMobile.reveal({ speech: id });
  selectSpeech(speechIdx(id));
  showDrawer(true);
  const full = L.demoTranscript(demoSample, id);
  let text = R.transcripts[id] || '';
  if (text && !full.startsWith(text)) throw new Error('Your transcript has edits. Playback left them unchanged.');
  const replay = text === full;
  const initial = text;
  if (replay) text = '';
  const pieces = L.transcriptChunks(full.slice(text.length), DEMO_WORDS);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) pieces.splice(0, pieces.length, full.slice(text.length));
  for (const piece of pieces) {
    while (demoUi.paused && run === demoUi.run) await demoWait(100);
    if (run !== demoUi.run) return;
    if ((R.transcripts[id] || '') !== (replay ? initial : text)) throw new Error('Playback stopped to keep your transcript edit.');
    text = L.appendChunk(text, piece);
    if (!replay) { R.transcripts[id] = text; save(); }
    if (transcriptSpeech()?.id === id) setTranscriptView(text);
    await demoWait(DEMO_TYPE_MS);
  }
  if (!replay) demoMarkSpoken(id);
  return !replay;
}
// Stop pending saved answers before a chapter switch or exit.
function demoCancel() {
  ++demoUi.run; demoUi.paused = false; demoUi.busy = false;
  stopAll();
  flowPending.clear(); clearTimeout(flowTimer);
  for (const cancel of [...(demoAnswer.pending || [])]) cancel();
  renderTranscript();
}
async function demoMap() {
  const st = demoUi.steps[demoUi.i];
  if (!st?.speech || demoUi.busy) return;
  return demoApplyFlow(st, demoUi.run);
}
function demoMappedEntries(speech) {
  return R.itemFlow ? L.atomicFlow.live(R.itemFlow).filter(e => e.speech === speech && e.source === 'transcript') : [];
}
const demoEntryTarget = entry => `[data-entry="${CSS.escape(entry.id)}"] .item-text`;

function demoRevealResult(speech, previous = new Set()) {
  demoUi.mapped = speech;
  if (R.tab !== 'flow') return;
  const run = demoUi.run;
  const entries = demoMappedEntries(speech);
  const added = entries.filter(e => !previous.has(e.id));
  const candidates = added.length ? added : entries;
  const entry = candidates.find(e => $(demoEntryTarget(e))?.getClientRects().length) || candidates[0];
  if (!entry) return;
  demoUi.mappedEntry = entry;
  const sheet = L.atomicFlow.sheetOf(R.itemFlow, entry.group);
  R.flowIdx = R.itemFlow.sheets.indexOf(sheet);
  FlowMobile.reveal(entry);
  if ($('#phone-show-flow').getClientRects().length) $('#phone-show-flow').click();
  renderFlow(); save();
  requestAnimationFrame(() => {
    if (demoUi.run !== run || R.tab !== 'flow') return;
    const target = $(demoEntryTarget(entry));
    const rect = target?.getBoundingClientRect();
    const bottom = innerHeight - $('.roundbar').getBoundingClientRect().height - $('#flow-mobile-compose').getBoundingClientRect().height;
    if (rect && (rect.top < $('header').getBoundingClientRect().bottom || rect.bottom > bottom)) {
      target.scrollIntoView({block:'center', inline:'nearest', behavior:'auto'});
    }
  });
}

async function demoApplyFlow(st, run) {
  if (navigator.onLine === false) { demoUi.message = 'Offline: manual practice works. The app pauses AI flow until you reconnect.'; renderDemoBar(); return; }
  const previous = new Set(demoMappedEntries(st.speech).map(entry => entry.id));
  if (!scheduleFlow(st.speech, true)) { demoUi.message = 'Play the sample transcript first, then enable live flow in Flow options.'; renderDemoBar(); return; }
  demoUi.busy = true; demoUi.message = 'Applying a saved sample AI reply…'; renderDemoBar();
  const done = await demoUntil(() => !flowBusy && !flowPending.size, run);
  if (run !== demoUi.run) return;
  if (done && !lastFlowErr) { showDrawer(false); demoRevealResult(st.speech, previous); demoUi.mappedSpeeches.add(st.speech); }
  demoUi.busy = false; demoUi.paused = false; demoUi.message = !done ? 'Flow is still pending. Check Flow options, or choose another chapter to stop.' : lastFlowErr ? 'Flow could not run: ' + lastFlowErr : 'Saved reply applied to the flow.'; renderDemoBar();
}
const demoDocumentId = () => 'demo-document-' + demoSample.format;
function demoDocument() {
  const id = demoDocumentId();
  if (DOCS.some(d => d.id === id)) { demoUi.message = 'The sample document is already in this practice round.'; renderDemoBar(); return; }
  const speech = demoSample.speeches[0];
  const doc = { id, roundId: R.id, name: 'Sample speech.txt', side: 'aff', speech: speech.id, kind: 'text', data: '# Sample speech\n\n' + speech.transcript, addedAt: Date.now() };
  DOCS.push(doc); importFlowDocument(doc); renderDocs();
  demoUi.message = 'Sample document added for ' + speech.id + '. Open Flow to inspect unconfirmed entries.'; renderDemoBar();
}
// The rest of the round at once: every transcript, then the flow passes one after another.
async function demoRest(ids, run) {
  ids = ids.filter(id => !(R.transcripts[id] || '').trim());
  if (!ids.length) {
    demoUi.restReady = true;
    demoUi.message = 'The sample transcripts are already loaded. Next opens Live Eval.';
    return;
  }
  demoUi.message = 'Loading the remaining sample speeches…';
  renderDemoBar();
  for (const id of ids) { R.transcripts[id] = L.demoTranscript(demoSample, id); demoMarkSpoken(id); }
  selectSpeech(speechIdx(ids[ids.length - 1]));
  for (const id of ids) scheduleFlow(id, true);
  const done = await demoUntil(() => !flowBusy && !flowPending.size, run, 30000);
  if (done && !lastFlowErr && run === demoUi.run) {
    demoUi.restReady = true;
    demoUi.message = 'The remaining sample speeches are loaded. Next opens Live Eval.';
  }
}
// What each step does on the real screens. Each returns when its part has played.
const DEMO_ACTIONS = {
  intro: async () => { showTab('flow'); },
  manual: async () => { showTab('flow'); },
  options: async () => { showTab('flow'); },
  documents: async () => { showTab('setup'); },
  organize: async () => { showTab('flow'); },
  clocks: async () => { showTab('flow'); },
  speech: async (st, run) => {
    showTab('flow'); R.flowView = 'ai'; save(); renderFlow();
    const fresh = await demoSpeech(st.speech, run);
    if (run !== demoUi.run) return;
    if (fresh || (fresh === false && !demoUi.mappedSpeeches.has(st.speech))) { showDrawer(false); await demoApplyFlow(st, run); }
    else if (fresh === false) { showDrawer(false); demoRevealResult(st.speech); demoUi.message = 'Replay complete. Your flow entries stay unchanged.'; }
  },
  rest: async (st, run) => { showTab('flow'); R.flowView = 'ai'; save(); renderFlow(); await demoRest(st.speeches, run); },
  eval: async () => { showDrawer(false); showTab('eval'); },
  draft: async () => { showTab('ballot'); openDraftPanel(); },
  decision: async () => {
    showTab('ballot');
    if (R.ballotReview || !LV().ballotDraft) openDraftPanel();
  },
  end: async () => { showTab('ballot'); closeDraftPanel(false); },
};
const demoActionOf = (st) => DEMO_ACTIONS[st.speech ? 'speech' : st.id];

async function demoGo(i, play = false) {
  const st = demoUi.steps[i];
  if (!st) return;
  demoCancel();
  const run = demoUi.run;
  demoUi.i = i; demoUi.message = ''; demoUi.mapped = null; demoUi.mappedEntry = null; demoUi.restReady = false;
  demoUi.introReady = false;
  demoCue.dismissed = null; demoCue.introSeen = false; demoDetails(false); renderDemoBar();
  if ((st.speech || st.id === 'rest') && !play) { showTab('flow'); return; }
  demoUi.busy = true; renderDemoBar();
  try { await demoActionOf(st)(st, run); }
  catch (err) { if (run === demoUi.run) demoUi.message = err.message || 'This chapter could not run. Try again.'; }
  if (run !== demoUi.run) return;
  demoUi.busy = false; renderDemoBar();
}

function demoDetails(open) {
  $('#demo-details').hidden = !open;
  $('#demo-more').setAttribute('aria-expanded', String(open));
  measureRoundBar();
}

function demoIntroStage() {
  if (demoUi.i !== 0) return '';
  if (R.tab !== 'setup') return 'home';
  return demoUi.introReady ? 'ready' : 'setup';
}

function renderDemoIntro(step, stage) {
  $('#demo-bar').dataset.intro = stage;
  if (!stage) return;
  const title = { home: step.title, setup: 'Set up your round', ready: 'Ready to begin?' };
  $('#demo-title').textContent = title[stage];
  $('#demo-next').hidden = stage === 'home';
  $('#demo-next').textContent = stage === 'setup' ? 'Ready' : 'Begin';
  $('#demo-back').hidden = stage !== 'ready';
  $('#demo-back').textContent = 'Edit setup';
}

function renderDemoBar() {
  const st = demoUi.steps[demoUi.i];
  if (!st) return;
  const first = demoUi.i === 0, last = demoUi.i === demoUi.steps.length - 1;
  const count = $('#demo-count');
  count.textContent = `Demo · ${demoUi.i + 1} / ${demoUi.steps.length}`;
  count.setAttribute('aria-label', `Demo, step ${demoUi.i + 1} of ${demoUi.steps.length}`);
  $('#demo-title').textContent = st.title;
  $('#demo-detail').textContent = first ? `${st.body} ${st.detail}` : st.detail || 'Practice in this sample round. Changes stay on this page.';
  $('#demo-next').hidden = last;
  $('#demo-next').textContent = first ? 'Begin' : 'Next';
  $('#demo-back').hidden = first;
  $('#demo-back').textContent = 'Back';
  renderDemoIntro(st, demoIntroStage());
  const canWatch = Boolean(st.speech || st.id === 'rest');
  $('#demo-watch').hidden = !canWatch || demoUi.busy;
  $('#demo-watch').classList.toggle('primary', !demoUi.mapped && !demoUi.restReady);
  $('#demo-watch').textContent = st.id === 'rest' ? 'Fill untouched speeches' : R.transcripts[st.speech] === L.demoTranscript(demoSample, st.speech) ? 'Replay sample' : 'Watch sample';
  $('#demo-pause').hidden = !demoUi.busy;
  $('#demo-pause').textContent = demoUi.paused ? 'Resume' : 'Pause';
  $('#demo-map').hidden = !st.speech || !(R.transcripts[st.speech] || '').trim();
  $('#demo-map').disabled = demoUi.busy;
  $('#demo-document').hidden = st.id !== 'documents';
  const status = $('#demo-status');
  status.textContent = demoUi.paused ? 'Paused. Choose Resume when you’re ready.' : demoUi.message || (demoUi.busy ? 'Playing silent sample captions…' : '');
  $('#demo-body').hidden = Boolean(status.textContent);
  demoCueSchedule();
  measureRoundBar();
  const cta = L.demoCtaButtons({ last, buyOn: flagOn('demoBuy') });
  $('#demo-account').hidden = !last;
  $('#demo-plans').hidden = !cta.plans;
  $('#demo-buy').hidden = !cta.buy;
}

const demoCue = { target: null, dismissed: null, frame: null, observer: null, introSeen: false };
function demoInstruction(step, target, stage) {
  if (!step) return '';
  switch (step.id) {
    case 'intro':
      if (stage === 'home') return 'Open Round to choose a format and add your round details.';
      if (stage === 'ready') return 'Choose Begin. The blue highlight will point to the control for each task.';
      if (demoCue.introSeen) return 'Enter the tournament, round and both sides. Choose Ready when you’re done.';
      return 'Choose a format. Enter the tournament, round and both sides, or keep the sample details.';
    case 'manual':
      if (target?.id === 'mobile-analytic') return 'Type a reason in the note field, then tap Add.';
      if (target?.closest('.item-editor')) return 'Write one reason. Press Enter or choose Save.';
      break;
    case 'options':
      if (target?.id === 'mobile-tools') return 'Open Flow tools to find the display settings.';
      if (target?.id === 'flow-note-length') return 'Try a different AI note length.';
      break;
    case 'organize':
      if (target?.matches('[data-item-action="new-group"]')) return 'Add an argument group to organize this sheet.';
      if (target?.id === 'mobile-tools') return 'Open Flow tools to find argument groups.';
      break;
    case 'eval':
      if (LV().liveEval) return 'Read the result below, then choose Next to draft a ballot.';
      break;
    case 'draft':
      if (target?.id === 'rv-insert') return 'Review the draft, then insert the fields you want.';
      if (target?.id === 'draft-open') return 'Open Draft with AI to choose what goes on the ballot.';
      break;
    case 'decision':
      if (target?.id === 'dp-go') return 'Choose Draft to load the sample for review.';
      if (target?.id === 'b-rfd') return 'Write or revise the reason for your decision.';
      break;
  }
  return step.body;
}

function demoCueSchedule() {
  if (!demoOn || demoCue.frame !== null) return;
  demoCue.frame = requestAnimationFrame(() => { demoCue.frame = null; demoCueUpdate(); });
}
function demoCueUpdate() {
  const st = demoUi.steps[demoUi.i];
  const stage = demoIntroStage();
  if ($('#demo-bar').dataset.intro !== stage) {
    demoCue.dismissed = null;
    renderDemoIntro(st, stage);
  }
  const introTargets = {
    home: ['#nav [data-tab="setup"]'],
    setup: demoCue.introSeen ? ['#round-card [data-bind="tournament"]', '#demo-next'] : ['#format-chip'],
    ready: ['#demo-next'],
  };
  const selectors = {
    intro: introTargets[stage],
    manual: ['.item-editor [name="title"]', '#mobile-analytic', '[data-item-action="new"]'],
    options: ['#flow-note-length', '.flow-options > summary', '#mobile-tools'],
    documents: DOCS.some(doc => doc.id === demoDocumentId()) ? ['#nav [data-tab="flow"]'] : ['#demo-document'],
    organize: ['[data-item-action="menu"]', '[data-item-action="new-group"]', '#mobile-tools'],
    clocks: ['#t-start', '#cv-start'],
    eval: st?.id === 'eval' && LV().liveEval ? ['#demo-next'] : ['#eval-go'],
    draft: draftUi.open ? ['#rv-insert', '#dp-go'] : ['#draft-open'],
    decision: ['#rv-insert', '#dp-go', '#b-rfd'], end: ['#demo-buy', '#demo-plans'],
  };
  const mappedTargets = demoUi.mapped ? demoMappedEntries(demoUi.mapped).map(demoEntryTarget) : [];
  if (demoUi.mappedEntry) mappedTargets.unshift(demoEntryTarget(demoUi.mappedEntry));
  const choices = demoUi.busy ? (demoUi.paused ? ['#demo-pause'] : []) : st?.speech ? (demoUi.mapped ? mappedTargets : ['#demo-watch']) : st?.id === 'rest' ? [demoUi.restReady ? '#demo-next' : '#demo-watch'] : selectors[st?.id] || [];
  const visible = el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getClientRects().length && (!el.checkVisibility || el.checkVisibility());
  let target = null;
  for (const selector of choices) {
    target = [...document.querySelectorAll(selector)].find(visible);
    if (target) break;
  }
  const body = $('#demo-body');
  const copy = demoInstruction(st, target, stage);
  if (body.textContent !== copy) body.textContent = copy;
  $('#demo-show').hidden = !target || Boolean(target.closest('header')) || demoUi.busy;
  if (target === demoCue.dismissed) target = null;
  if (target === demoCue.target) return;
  demoCue.target?.classList.remove('demo-target'); demoCue.target = target;
  target?.classList.add('demo-target');
}

function demoChapters() {
  demoUi.steps = L.demoSteps(demoSample, FMT());
  const chapter = $('#demo-chapter');
  chapter.options.length = 1;
  demoUi.steps.forEach((step, i) => chapter.add(new Option(`${i + 1}. ${step.title}`, String(i))));
  chapter.value = '';
}

// Leaving the demo opens the normal app. The demo's memory store goes with this page, so nothing is left.
const demoLeaveUrl = () => location.pathname;
// Starting over reloads the demo: a fresh memory store and the sample round from the start.
function demoStartOver() { demoCancel(); location.reload(); }

function demoBoot() {
  for (const id of ['rec-on', 'cv-rec-on']) { const box = $('#' + id); box.checked = false; box.disabled = true; box.setAttribute('aria-label', 'Sample captions only. The demo does not use your microphone.'); }
  demoChapters();
  $('#eval-cost').textContent = 'Saved sample. Uses no rounds.';
  $('#dp-cost').textContent = 'Saved sample. Uses no rounds.';
  $('#demo-account').href = L.accountUrl(location.hostname);
  $('#demo-plans').href = L.plansUrl(location.hostname);
  $('#demo-plans').textContent = L.DEMO_CTA.plans;
  $('#demo-buy').href = L.accountUrl(location.hostname);
  $('#demo-buy').textContent = L.DEMO_CTA.buy;
  $('#demo-more').addEventListener('click', () => demoDetails($('#demo-details').hidden));
  const formatChip = $('#format-chip');
  function cueRoundDetails() {
    if (demoIntroStage() !== 'setup' || demoCue.target !== formatChip) return;
    demoCue.introSeen = true;
    demoCueSchedule();
  }
  formatChip.addEventListener('animationend', e => { if (e.animationName === 'demo-cue') cueRoundDetails(); });
  formatChip.addEventListener('click', cueRoundDetails);
  $('#format-cards').addEventListener('click', cueRoundDetails);
  $('#demo-show').addEventListener('click', () => {
    demoCue.dismissed = null;
    demoCue.target?.classList.remove('demo-target');
    demoCue.target = null;
    demoCueUpdate();
    demoCue.target?.scrollIntoView({ block: 'center', behavior: 'auto' });
    demoCue.target?.focus({ preventScroll: true });
  });
  demoCue.observer = new MutationObserver(demoCueSchedule);
  demoCue.observer.observe(document.querySelector('main'), {childList:true, subtree:true});
  demoCue.observer.observe(document.body, {attributes:true, attributeFilter:['data-place']});
  window.addEventListener('resize', demoCueSchedule);
  document.addEventListener('click', e => {
    if (demoCue.target?.contains(e.target)) {
      demoCue.dismissed = demoCue.target;
      demoCue.target.classList.remove('demo-target');
      demoCue.target = null;
    }
    // The draft sheet covers the ballot on phones. Once the visitor inserts a decision, show the editable ballot.
    if (demoUi.steps[demoUi.i]?.id === 'decision' && e.target.closest('#rv-insert, #rv-accept') && !R.ballotReview) {
      closeDraftPanel(false);
      $('#b-rfd').scrollIntoView({block:'center', behavior:'auto'});
    }
    demoCueSchedule();
  });
  window.addEventListener('pagehide', () => { demoCue.observer.disconnect(); cancelAnimationFrame(demoCue.frame); demoCue.target?.classList.remove('demo-target'); });

  const chapter = $('#demo-chapter');
  chapter.addEventListener('change', () => {
    const index = Number(chapter.value);
    chapter.value = '';
    demoGo(index);
  });
  $('#demo-back').addEventListener('click', () => {
    if (demoIntroStage() === 'ready') { demoUi.introReady = false; demoCue.dismissed = null; renderDemoBar(); }
    else demoGo(demoUi.i - 1);
  });
  $('#demo-watch').addEventListener('click', () => demoGo(demoUi.i, true));
  $('#demo-pause').addEventListener('click', () => { demoUi.paused = !demoUi.paused; renderDemoBar(); });
  $('#demo-map').addEventListener('click', demoMap);
  $('#demo-document').addEventListener('click', demoDocument);
  $('#demo-next').addEventListener('click', () => {
    if (demoIntroStage() === 'setup') { demoUi.introReady = true; demoCue.dismissed = null; renderDemoBar(); }
    else demoGo(demoUi.i + 1);
  });
  const pauseForPractice = e => { if (e.type === 'keydown' && !['Enter', ' ', 'Backspace', 'Delete'].includes(e.key) && e.key.length !== 1) return; if (demoUi.busy && !$('#demo-bar').contains(e.target)) { demoUi.paused = true; renderDemoBar(); } };
  document.addEventListener('pointerdown', pauseForPractice);
  document.addEventListener('keydown', pauseForPractice);
  window.addEventListener('pagehide', demoCancel);

  $('#demo-again').addEventListener('click', demoStartOver);
  $('#demo-leave').addEventListener('click', () => { demoCancel(); location.href = demoLeaveUrl(); });
  $('#demo-bar').hidden = false;
  measureRoundBar();
  demoGo(0);
}
// The Help menu's "Watch the AI demo" opens the demo for this round's format in a new tab, so the real round stays open.
// In the demo itself the item goes.
function demoLinkBoot() {
  const a = $('#demo-link'); if (!a) return;
  if (demoOn) a.remove(); else a.href = '?demo=' + L.demoParamFor(window.TabulaDemoRounds, FMT().id);
}
document.addEventListener('DOMContentLoaded', demoLinkBoot);
if (demoOn) document.addEventListener('DOMContentLoaded', demoBoot);
