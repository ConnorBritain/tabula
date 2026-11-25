// The round's format in Round setup (ARCHITECTURE.md §9): the Format pick, the ?format= link, who speaks first in a
// coin-flip format, and the boxes and words that change with the format (names per side, prep, side words).
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
// It loads right after core.js, so a ?format= link replaces the round before any other part draws it.
'use strict';

// A round keeps its format. Picking another one starts a new round in it: at once when the round is empty, else after
// a question. ?format=ld in the address does the same for an empty round (a link from the site or a coach).
async function switchFormat(id) {
  const fmt = L.getFormat(id);
  if (!fmt || id === R.format) return renderFormatSetup();
  const docs = await docStore.list(R.id).catch(() => []);
  if (!(L.isRoundEmpty(R) && !R.started && !docs.length)) {
    const ok = await ask({
      title: 'Start a new ' + fmt.name + ' round?',
      body: 'A round keeps the format it started with. ' + NEW_ROUND_BODY,
      buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Clear and start new', value: true, kind: 'danger' }], cancelValue: false,
    });
    if (!ok) return renderFormatSetup();
  }
  startNewRound(fmt);
}
for (const id of L.FORMAT_IDS) $('#format-pick').append(new Option(L.getFormat(id).name, id));
$('#format-pick').addEventListener('change', (e) => switchFormat(e.target.value));

// A coin-flip format (order: 'coinFlip', PF): the round stores the side that speaks first (R.firstSide). The speeches
// keep their places; each place's side and debater follow the choice. Once speech work exists (L.orderInUse), a change
// would move that work to the other side, so it asks first and pauses a running speech clock.
async function switchFirstSide(side) {
  const fmt = FMT();
  if (!L.isCoinFlip(fmt) || side === fmt.firstSide || (side !== 'aff' && side !== 'neg')) return renderFormatSetup();
  if (L.orderInUse(R)) {
    const ok = await ask({
      title: 'Change who speaks first?',
      body: 'The ' + L.sideLabel(fmt, side) + ' will give the first speech. Transcripts, flow notes and clock times stay in their place in the speech order, so they move to the other side.',
      buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Change the order', value: true, kind: 'danger' }], cancelValue: false,
    });
    if (!ok) return renderFormatSetup();
  }
  if (R.run) pauseSpeech();
  R.firstSide = side;
  save();
  renderFormatSetup(); renderSpeeches(); renderClock(); renderFlow(); renderBallot(); renderPrep();
}
$('#first-side').addEventListener('change', (e) => switchFirstSide(e.target.value));
// The side words in the page's fixed text (data-side-word: 'Aff' or 'Pro', plus data-side-after; data-side-name:
// 'Affirmative' or 'Pro') and the high-contrast side pills (--aff-word, --neg-word) follow the round's format.
function renderSideWords(fmt) {
  for (const el of document.querySelectorAll('[data-side-word]')) el.textContent = fmt.sides[el.dataset.sideWord].label + (el.dataset.sideAfter || '');
  for (const el of document.querySelectorAll('[data-side-name]')) el.textContent = fmt.sides[el.dataset.sideName].name;
  for (const side of ['aff', 'neg']) document.documentElement.style.setProperty('--' + side + '-word', JSON.stringify(fmt.sides[side].label));
}
// Round setup for the round's format: the format pick, one or two name boxes per side, prep per team or per debater.
function renderFormatSetup() {
  const fmt = FMT();
  $('#format-pick').value = fmt.id;
  renderSideWords(fmt);
  $('#first-side-row').hidden = !L.isCoinFlip(fmt);
  if (L.isCoinFlip(fmt)) {
    for (const o of $('#first-side').options) o.textContent = fmt.sides[o.value].label;
    $('#first-side').value = fmt.firstSide;
  }
  for (const side of ['aff', 'neg']) {
    const on = L.speakersOn(fmt, side);
    for (const slot of ['d1', 'd2']) {
      const box = document.querySelector(`[data-bind="${side}.${slot}"]`).parentElement;
      const sp = on.find((x) => x.slot === slot);
      box.hidden = !sp;
      if (sp) box.querySelector('label').textContent = on.length > 1 ? sp.label : 'Debater';
    }
  }
  $('#prep-min-label').textContent = fmt.prep.mode === 'perDebater' ? 'Prep per debater (minutes)' : 'Prep per team (minutes)';
  $('#prep-min').value = Math.round(R.prepSeconds / 60);
  renderPrepPresets();
  $('#times-note').textContent = fmt.timesNote;
  // Hints in shared boxes follow the format, so an LD round does not show policy words ("federal government", "plan").
  const copy = L.formatCopy(fmt);
  document.querySelector('[data-bind="topic"]').placeholder = copy.topicHint;
  $('#ballot-input').placeholder = copy.ballotExample;
  $('#ne-label').placeholder = copy.argExample;
  $('#pal-empty').textContent = 'No match. Try "sheet", "prep" or a speech like "' + fmt.flowSpeeches[2] + '".';
}
renderFormatSetup();
(() => {
  const asked = L.formatFromSearch(location.search);
  if (!asked) return;
  // The link has done its job once read, so a reload or a later round does not act on it again.
  try { const u = new URL(location.href); u.searchParams.delete('format'); history.replaceState(null, '', u); } catch {}
  if (asked === R.format) return;
  if (L.isRoundEmpty(R) && !R.started) { R = freshRound(R, L.getFormat(asked)); save(); renderFormatSetup(); return; }
  setTimeout(() => toast('This link is for a ' + L.getFormat(asked).name + ' round. The round on screen is ' + FMT().name + '. To switch, pick the format in Round.', { key: 'format' }));
})();
