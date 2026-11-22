// Help: the guided tours and the welcome.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- guided tours ----------
// A dimmed screen with one part lit up and a short card beside it. Next/Back/Skip, arrow keys, Esc.
const TOURS = window.Tours;
let tourState = null; // { name, i, returnFocus, place, hideLeft, hideRight }
function tourStart(name) {
  if (name === 'page') name = TOURS.PLACE_TOUR[PLACE_OF[R.tab] || 'setup'] || 'main';
  const all = TOURS.TOURS[name]; if (!all) return;
  // The AI gate drops steps on removed parts and rewords steps that mention them (AI-POLICY §3b R3).
  let tour = { title: all.title, steps: L.visibleTourSteps(all.steps, gateHas) };
  if (!tour.steps.length) tour = { title: TOURS.TOURS.main.title, steps: L.visibleTourSteps(TOURS.TOURS.main.steps, gateHas) };
  if (askIsOpen() || !$('#node-editor').hidden) return; // never on top of another dialog
  closeHelpMenu(); $('#tour-offer').hidden = true;
  // Remember where the judge was and how the panes were, so the tour leaves everything as it found it.
  tourState = { name, tour, i: 0, returnFocus: document.activeElement, place: R.tab, hideLeft: Boolean(S.hideLeft), hideRight: Boolean(S.hideRight) };
  $('#tour').hidden = false;
  for (const el of document.querySelectorAll('header, main, .roundbar, #keys-sheet, #study-card')) el.inert = true; // the page behind is not reachable
  tourShow();
}
function tourShow() {
  const tour = tourState.tour;
  const step = tour.steps[tourState.i];
  if (step.place) showTab(step.place);
  // A step inside a hidden pane opens that pane.
  if (step.target === '#speech-list' || step.target === '#tab-timer') {
    if (isOverlay()) { if (!leftOpen) { leftOpen = true; applyPanes(); } } // below 1440 px the pane is an overlay
    else if (S.hideLeft) { S.hideLeft = false; applyPanes(); }
  } else if (leftOpen) { leftOpen = false; applyPanes(); }
  if (step.target === '#insights' && S.hideRight) { S.hideRight = false; applyPanes(); }
  $('#tour-count').textContent = tour.title + ' · ' + (tourState.i + 1) + ' of ' + tour.steps.length;
  $('#tour-dots').innerHTML = tour.steps.map((_, k) => '<i class="' + (k === tourState.i ? 'on' : k < tourState.i ? 'done' : '') + '"></i>').join('');
  $('#tour-title').textContent = step.title;
  $('#tour-body').textContent = step.body;
  $('#tour-back').disabled = tourState.i === 0;
  $('#tour-next').textContent = tourState.i === tour.steps.length - 1 ? 'Done' : 'Next';
  const el = document.querySelector(step.target);
  if (el && el.scrollIntoView && !el.closest('.roundbar') && !el.closest('header')) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  setTimeout(() => { tourPlace(); $('#tour-next').focus(); }, 0); // a plain timer: animation frames pause in background tabs
}
function tourPlace() {
  if (!tourState) return;
  const step = tourState.tour.steps[tourState.i];
  const el = document.querySelector(step.target);
  const spot = $('#tour-spot'), card = $('#tour-card');
  const view = { w: innerWidth, h: innerHeight };
  let r = el ? el.getBoundingClientRect() : null;
  if (!r || (!r.width && !r.height)) r = { top: view.h / 2, left: view.w / 2, width: 0, height: 0 };
  const pad = 6;
  const box = { top: Math.max(4, r.top - pad), left: Math.max(4, r.left - pad), width: Math.min(r.width + pad * 2, view.w - 8), height: Math.min(r.height + pad * 2, view.h - 8) };
  Object.assign(spot.style, { top: box.top + 'px', left: box.left + 'px', width: box.width + 'px', height: box.height + 'px' });
  const pos = TOURS.placeCard(box, { w: card.offsetWidth, h: card.offsetHeight }, view);
  card.style.top = pos.top + 'px'; card.style.left = pos.left + 'px';
}
function tourEnd(finished) {
  if (!tourState) return;
  const st = tourState; tourState = null;
  $('#tour').hidden = true;
  for (const el of document.querySelectorAll('header, main, .roundbar, #keys-sheet, #study-card')) el.inert = false;
  S.hideLeft = st.hideLeft; S.hideRight = st.hideRight; leftOpen = false; applyPanes();
  if (st.name === 'main') S.tourDone = true;
  saveSettings();
  if (st.place) showTab(st.place); // back to where the judge was
  if (st.returnFocus && st.returnFocus.focus) st.returnFocus.focus();
}
function tourGo(d) {
  const steps = tourState.tour.steps, n = steps.length;
  let i = tourState.i + d;
  // With no AI, Insights is folded to its "Connect AI" edge, so its step has nothing to show: skip it (V9).
  while (i >= 0 && i < n && steps[i].target === '#insights' && (insightsMode() === 'edge-connect' || insightsMode() === 'none')) i += d;
  if (i >= n) return tourEnd(true);
  if (i < 0) return;
  tourState.i = i; tourShow();
}
$('#tour-next').addEventListener('click', () => tourGo(1));
$('#tour-back').addEventListener('click', () => tourGo(-1));
$('#tour-skip').addEventListener('click', () => tourEnd(false));
addEventListener('resize', () => { if (tourState) tourPlace(); });
// Keep the light on its target when anything scrolls.
let tourScrollT = null;
addEventListener('scroll', () => { if (tourState && !tourScrollT) tourScrollT = setTimeout(() => { tourScrollT = null; tourPlace(); }, 50); }, true);
document.addEventListener('keydown', (e) => {
  if (!tourState) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); tourGo(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); tourGo(-1); }
  else if (e.key === 'Tab') { // keep focus inside the tour card
    const f = [...$('#tour-card').querySelectorAll('button:not([disabled])')];
    const i = f.indexOf(document.activeElement);
    e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}, true);
escLayer('tour', 100, () => Boolean(tourState), () => tourEnd(false)); // Esc ends the tour
// The ? menu (spec 5.3): tours · Watch the AI demo · Search and commands · Keyboard shortcuts · Debate library · About Tabula Debate.
// Real menu keys: ↑ and ↓ wrap, Home and End jump, Esc returns focus to ?, and Tab closes the menu.
// An item the AI gate hides (Watch the AI demo, data-ai="any") is skipped: it cannot take focus.
const helpItems = () => [...$('#help-menu').querySelectorAll('[role="menuitem"]')].filter((el) => el.getClientRects().length > 0);
function closeHelpMenu() { $('#help-menu').hidden = true; $('#help-btn').setAttribute('aria-expanded', 'false'); }
function openHelpMenu(at) {
  $('#help-menu').hidden = false; $('#help-btn').setAttribute('aria-expanded', 'true');
  const items = helpItems();
  items[at === 'last' ? items.length - 1 : 0].focus();
}
$('#help-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if ($('#help-menu').hidden) openHelpMenu('first'); else closeHelpMenu();
});
$('#help-btn').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openHelpMenu(e.key === 'ArrowUp' ? 'last' : 'first'); }
});
$('#help-menu').addEventListener('keydown', (e) => {
  const items = helpItems(), i = items.indexOf(document.activeElement);
  const go = (k) => { e.preventDefault(); items[(k + items.length) % items.length].focus(); };
  if (e.key === 'ArrowDown') go(i + 1);
  else if (e.key === 'ArrowUp') go(i - 1);
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(items.length - 1);
  else if (e.key === 'Tab') { e.preventDefault(); closeHelpMenu(); (e.shiftKey ? $('#help-btn') : $('#settings-btn')).focus(); }
});
$('#help-menu').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tour]'); if (t) return tourStart(t.dataset.tour);
  const h = e.target.closest('[data-help]');
  if (h) { closeHelpMenu(); return h.dataset.help === 'palette' ? openPalette($('#help-btn')) : toggleKeysSheet(true, $('#help-btn')); }
  if (e.target.closest('a')) closeHelpMenu();
});
$('#help-palette-key').textContent = K.formatKeys(IS_MAC ? 'Meta+k' : 'Control+k', IS_MAC);
document.addEventListener('click', (e) => { if (!$('#help-menu').hidden && !e.target.closest('.help-wrap')) closeHelpMenu(); });
escLayer('help-menu', 60, () => !$('#help-menu').hidden, () => { closeHelpMenu(); $('#help-btn').focus(); });
// The gentle offer after the welcome screen (never on top of a dialog).
function offerTour() { if (!S.tourDone && !S.tourOffered) { S.tourOffered = true; saveSettings(); $('#tour-offer').hidden = false; } }
$('#tour-offer-go').addEventListener('click', () => tourStart('main'));
$('#tour-offer-no').addEventListener('click', () => { $('#tour-offer').hidden = true; toast('You can take the tour any time from the ? menu.'); });

// ---------- welcome (spec 2.1, Q11): free users only, built on the shared dialog ask() ----------
// Hosted-plan judges never see it: hosted AI just works. With a plan (spec 2.1), setupDone is set and the "show again"
// button hides. At app start it waits for the account check (settled: acctBoot from js/account.js), because a new
// device has no cached capabilities yet and would show a paid judge the key welcome before the server's answer.
// The check always ends: both fetches have timeouts, and offline or with no account server it ends at once.
async function welcomeWhenKnown(settled) {
  await settled;
  const hostedPlan = L.hasHostedPlan(capsGate);
  $('#show-welcome').hidden = hostedPlan;
  if (hostedPlan && !S.setupDone) { S.setupDone = true; saveSettings(); }
  if (L.shouldShowWelcome({ setupDone: S.setupDone, hostedPlan })) openWelcome();
  else maybeD2Note();
}
async function openWelcome() {
  if (!showSetup()) return; // no own AI to set up (or already set up): no welcome
  // "Start judging" is the one primary button, alone and first. The setup rows are quieter rows under it.
  const choices = [
    { label: 'Start judging', value: 'start', kind: 'primary' },
    { label: 'Add an automatic flow and a draft ballot', desc: 'Paste a key from an AI company. You pay that company for what you use.', value: 'key' },
  ];
  if (LOCAL_ORIGIN) choices.push({ label: 'Use a subscription you have', desc: 'Connects to an app you pay for on this computer. Needs one Terminal command.', value: 'sub' });
  // "Start judging", × and Esc all mean the same thing: one click to Flow. A click on the dim layer does nothing.
  const v = await ask({ title: `Welcome to ${window.TabulaBrand.NAME}`, body: 'Your clock, flow and ballot are ready.', buttons: choices, variant: 'choices', backdrop: false, cancelValue: 'start' });
  if (v !== 'key' && v !== 'sub') return startJudging();
  S.setupDone = true; saveSettings(); showTab('ai'); setTimeout(offerTour, 400);
  if (v === 'key') setTimeout(() => $('#key-paste').focus(), 0);
  else setTimeout(() => { $('#sub-box').scrollIntoView({ block: 'center' }); const btn = $('#sub-box .sub-btn:not([disabled])'); if (btn) btn.focus(); }, 0);
}
function startJudging() {
  S.setupDone = true; saveSettings();
  showTab('flow'); setTimeout(offerTour, 400);
}
$('#show-welcome').addEventListener('click', () => openWelcome());

$('#chunk-sec').value = S.chunkSec; $('#live-flow').checked = S.liveFlow;
$('#chunk-sec').addEventListener('change', (e) => { S.chunkSec = Math.max(4, Math.min(30, Number(e.target.value) || 8)); e.target.value = S.chunkSec; saveSettings(); setRecNote(''); });
$('#live-flow').addEventListener('change', (e) => { S.liveFlow = e.target.checked; saveSettings(); setRecNote(''); });
// The one-time note (spec 2.7, Q-2, Q-4): the first time AI is ready, say that the paid live updates are off and
// where to turn them on. It waits while a clock runs, so it never covers the round.
let booted = false;
async function maybeD2Note() {
  if (!can('liveEval') || !can('aiFlow')) return; // its words name both; it never names a removed tool
  if (!booted || !L.needsD2Note({ aiReady: aiReady(), shown: S.d2NoteShown, clockRunning: Boolean(R.run) })) return;
  S.d2NoteShown = true; saveSettings();
  const v = await ask({
    title: 'Live updates are off',
    body: ['Live Eval and Live AI flow can update during the round. Each update uses AI, so they stay off until you turn them on.', 'Turn Live Eval on in Decide → Live Eval. Turn Live AI flow on in Settings.'],
    buttons: [{ label: 'Keep them off', value: 'off', kind: 'plain' }, { label: 'Turn on Live AI flow', value: 'flow', kind: 'plain' }, { label: 'Turn on Live Eval', value: 'eval', kind: 'plain' }],
    cancelValue: 'off', focus: 'off',
  });
  if (v === 'eval') { S.autoEval = true; $('#auto-eval').checked = true; saveSettings(); toast('Live Eval now updates with AI after each speech.'); }
  if (v === 'flow') { S.liveFlow = true; $('#live-flow').checked = true; saveSettings(); setRecNote(''); toast('Live AI flow is on. It uses AI while a speech runs.'); }
}
setRecNote('');
