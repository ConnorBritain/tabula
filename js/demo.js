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

const demoSample = window.TabulaDemo ? window.PolicyLogic.demoSample(window.TabulaDemoRounds, window.TabulaDemo.param) : null;
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
    const t = setTimeout(() => (reply ? resolve(reply) : reject(new Error(DEMO_NOT_HERE))), DEMO_AI_MS);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(STOPPED()); }, { once: true });
  });
}

// ---------- the player ----------
const demoUi = { steps: [], i: 0, busy: false, run: 0 };
const demoWait = (ms) => new Promise((res) => setTimeout(res, ms));
// Waits until cond() is true (checked every 100 ms), at most ms. run: the step's run number; a newer step stops it.
async function demoUntil(cond, run, ms = 15000) {
  for (let t = 0; t < ms && run === demoUi.run; t += 100) { if (cond()) return true; await demoWait(100); }
  return false;
}
// A speech has been given: its clock is used up, so its tile shows as done.
function demoMarkSpoken(id) {
  R.started = true; R.timeLeft[id] = 0; save();
}
// A speech as live transcription writes it: the words type in, then the end-of-speech AI flow pass runs.
async function demoSpeech(id, run) {
  selectSpeech(speechIdx(id));
  R.transcripts[id] = ''; demoMarkSpoken(id);
  showDrawer(true); renderTranscript();
  let text = '';
  for (const piece of L.transcriptChunks(L.demoTranscript(demoSample, id), DEMO_WORDS)) {
    if (run !== demoUi.run) return;
    text = L.appendChunk(text, piece);
    R.transcripts[id] = text; save();
    if (sp().id === id) setTranscriptView(text);
    await demoWait(DEMO_TYPE_MS);
  }
  scheduleFlow(id, true); // the real end-of-speech pass: callAI answers it with the saved flow
  await demoUntil(() => !flowBusy && !flowPending.size, run);
}
// The rest of the round at once: every transcript, then the flow passes one after another.
async function demoRest(ids, run) {
  for (const id of ids) { R.transcripts[id] = L.demoTranscript(demoSample, id); demoMarkSpoken(id); }
  selectSpeech(speechIdx(ids[ids.length - 1]));
  for (const id of ids) scheduleFlow(id, true);
  await demoUntil(() => !flowBusy && !flowPending.size, run, 30000);
}
// Presses a real button of the app once it can be pressed.
async function demoPress(sel, run) {
  if (!(await demoUntil(() => { const b = $(sel); return b && !b.disabled && b.offsetParent !== null; }, run))) return false;
  $(sel).click();
  return true;
}

// What each step does on the real screens. Each returns when its part has played.
const DEMO_ACTIONS = {
  intro: async () => { showTab('setup'); },
  speech: async (st, run) => {
    showTab('flow'); R.flowView = 'ai'; save(); renderFlow();
    await demoSpeech(st.speech, run);
  },
  rest: async (st, run) => { showTab('flow'); R.flowView = 'ai'; save(); renderFlow(); await demoRest(st.speeches, run); },
  eval: async (st, run) => {
    showDrawer(false); showTab('eval');
    if (await demoPress('#eval-go', run)) await demoUntil(() => Boolean(LV().liveEval) && !evalBusy, run);
  },
  draft: async (st, run) => {
    showTab('ballot'); openDraftPanel();
    if (await demoPress('#dp-go', run)) await demoUntil(() => Boolean(R.ballotReview) && !draftUi.busy, run);
  },
  decision: async (st, run) => {
    showTab('ballot'); if (!draftUi.open) openDraftPanel();
    if (R.ballotReview) await demoPress('#rv-accept', run);
    closeDraftPanel(false);
    const rfd = $('#b-rfd');
    if (rfd) rfd.scrollIntoView({ block: 'center' });
  },
  end: async () => { showTab('ballot'); },
};
const demoActionOf = (st) => DEMO_ACTIONS[st.speech ? 'speech' : st.id];

async function demoGo(i) {
  const st = demoUi.steps[i];
  if (!st) return;
  const run = ++demoUi.run;
  demoUi.i = i; demoUi.busy = true; renderDemoBar();
  try { await demoActionOf(st)(st, run); }
  catch (err) { console.warn('Demo step failed:', err); }
  if (run !== demoUi.run) return;
  demoUi.busy = false; renderDemoBar();
  // Focus moves to the next control once the step has played, so a keyboard user can go on.
  const next = $('#demo-next'); if (next && !next.hidden) next.focus({ preventScroll: true });
}

function renderDemoBar() {
  const st = demoUi.steps[demoUi.i];
  if (!st) return;
  const last = demoUi.i === demoUi.steps.length - 1;
  $('#demo-count').textContent = 'Step ' + (demoUi.i + 1) + ' of ' + demoUi.steps.length;
  $('#demo-title').textContent = st.title;
  $('#demo-body').textContent = st.body;
  const next = $('#demo-next');
  next.hidden = last;
  next.disabled = demoUi.busy;
  next.textContent = demoUi.busy ? 'Playing…' : 'Next';
  const cta = L.demoCtaButtons({ last, buyOn: flagOn('demoBuy') });
  $('#demo-plans').hidden = !cta.plans;
  $('#demo-buy').hidden = !cta.buy;
  $('#demo-bar').classList.toggle('demo-end', last);
}

// Leaving the demo opens the normal app. The demo's memory store goes with this page, so nothing is left.
const demoLeaveUrl = () => location.pathname;
// Starting over reloads the demo: a fresh memory store and the sample round from the start.
function demoStartOver() { location.reload(); }

function demoBoot() {
  const fmt = FMT();
  demoUi.steps = L.demoSteps(demoSample, fmt);
  $('#demo-plans').href = L.plansUrl(location.hostname);
  $('#demo-plans').textContent = L.DEMO_CTA.plans;
  $('#demo-buy').href = L.accountUrl(location.hostname);
  $('#demo-buy').textContent = L.DEMO_CTA.buy;
  $('#demo-next').addEventListener('click', () => { if (!demoUi.busy) demoGo(demoUi.i + 1); });
  $('#demo-again').addEventListener('click', demoStartOver);
  $('#demo-leave').addEventListener('click', () => { location.href = demoLeaveUrl(); });
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
