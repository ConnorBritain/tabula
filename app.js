// Tabula app: the entry point of the page code. The code lives in files so the Content-Security-Policy can forbid
// inline scripts. It is split by job into classic scripts in js/, which index.html loads with defer, in this order,
// before this module: core, caps, clock, recording, flow, docs, ai, limits, settings, help, insights, decide, shell, palette, study, judging, account. They share one global
// scope (no imports, so no import cycles). This file draws the theme and starts the page.
// ---------- theme (V10, Q3) ----------
// Light / Dark / System in Settings, System by default. assets/theme-boot.js drew the saved theme before the page
// painted; a change here draws at once and is saved with the other settings (other open tabs follow).
function renderTheme() {
  const v = S.theme === 'light' || S.theme === 'dark' ? S.theme : 'system';
  document.querySelectorAll('input[name="theme"]').forEach((r) => { r.checked = r.value === v; });
}
document.addEventListener('change', (e) => {
  if (e.target.name !== 'theme') return;
  S.theme = e.target.value; saveSettings(); window.TabulaTheme.set(S.theme);
});

// ---------- start ----------
restoreClocksOnLoad();
bindAll(); renderSpeeches(); renderClock(); renderPrep(); renderTranscript(); renderRecStrip(); renderRecNotice(); renderTheme();
renderSingleKeys(); renderNetNote(); // the Start and Speeches tips follow the single-key switch (5.5); the offline note (5.1)
renderConnections(); checkHelper(); renderReadLevel(); renderRange(); applyPanes(); renderAudio(); listMics();
applyCapabilities(); // the AI gate, before the first place is drawn (js/caps.js)
showTab(R.tab || 'flow'); renderPrepPresets(); showDrawer(Boolean(S.trDrawer)); resumeClips();
renderSdList(); if (sdState().code) { sdFetchList(true); sdWatch(); } // resume watching this round's SpeechDrop room
booted = true;
studyBoot(); // study mode (5.7): only with ?study=1
if (L.shouldShowWelcome({ setupDone: S.setupDone, hostedPlan })) openWelcome();
else maybeD2Note();
