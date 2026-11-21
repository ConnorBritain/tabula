// Study mode (Slice 5, spec 5.7, Part 6.3, Q-12): time from the first view to the first Start of the round's first
// speech (the 1AC in policy, the AC in LD), for the
// five-judge test. Only with ?study=1 in the address; it never turns on by itself. It keeps two local time marks in
// this browser and sends nothing over the network. The rules are pure code in logic/shell.js (studyMark, studyResult).
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

const STUDY = 'tabula.study.v1';
const studyIsOn = L.studyOn(location.search);
// The first view: called once at boot. The mark is kept from the first time the page showed in this profile.
function studyBoot() {
  if (!studyIsOn) return;
  store.set(STUDY, L.studyMark(store.get(STUDY, {}), { type: 'view', at: Date.now() }));
  renderStudy();
}
// The first Start of the round's first speech, by any method (Start, Space, ⌘ Enter, the clock view, the palette).
// Called by startSpeech().
function studyStart(speechId) {
  if (!studyIsOn) return;
  const before = store.get(STUDY, {});
  const after = L.studyMark(before, { type: 'start', at: Date.now(), speechId }, FMT());
  if (after.firstStart === before.firstStart) return;
  store.set(STUDY, after);
  renderStudy();
}
function renderStudy() {
  const res = studyIsOn ? L.studyResult(store.get(STUDY, {})) : null;
  $('#study-card').hidden = !res || Boolean(sessionHidden());
  if (res) $('#study-text').textContent = res.text;
  measureHeader(); // the result is a row in the sticky header
}
const sessionHidden = () => { try { return sessionStorage.getItem(STUDY + '.hidden') === '1'; } catch { return false; } };
$('#study-copy').addEventListener('click', async () => {
  const res = L.studyResult(store.get(STUDY, {}));
  if (res) toast((await copy(res.copy)) ? 'Study result copied.' : 'Copy did not work in this browser. The result is: ' + res.text);
});
$('#study-x').addEventListener('click', () => {
  try { sessionStorage.setItem(STUDY + '.hidden', '1'); } catch {}
  $('#study-card').hidden = true; measureHeader();
});
