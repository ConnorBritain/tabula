// Round import by paste (docs/research/TABROOM.md, Option D): the judge pastes their round from the tournament site,
// Tabula shows what it found, and "Fill the round" puts it into Round setup. The text never leaves this browser.
// "Swap Aff and Neg" fixes the sides after a coin flip or a paste that had them backwards.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

const pasteBox = $('#paste-round-text'), pasteFound = $('#paste-round-found'), pasteFill = $('#paste-round-fill');
let pasteChanges = [];

// The list of what the paste would fill, with what each field replaces.
function renderPasteFound() {
  const text = pasteBox.value;
  const parsed = L.parseRoundPaste(text, FMT());
  pasteChanges = L.roundPasteChanges(R, parsed, FMT(), { details: flagOn('roundDetails') });
  pasteFill.setAttribute('aria-disabled', String(!pasteChanges.length));
  pasteFound.textContent = '';
  if (!text.trim()) return;
  if (!pasteChanges.length) {
    const p = document.createElement('p'); p.className = 'muted field-help';
    p.textContent = 'Tabula found no round in this text. Copy the part of the page with the team codes and sides.';
    pasteFound.append(p);
    return;
  }
  // Each found field has a tick box. Tabula cannot tell every note about a student from a name, so the judge unticks
  // anything that is not a name or a code, and only ticked fields are filled.
  const help = document.createElement('p'); help.className = 'muted field-help';
  help.textContent = 'Untick anything that is not a name, a team code or the round.';
  const list = document.createElement('div'); list.className = 'paste-found-list';
  for (const c of pasteChanges) {
    const row = document.createElement('label'); row.className = 'row check-row';
    const box = document.createElement('input'); box.type = 'checkbox'; box.checked = true; box.dataset.path = c.path;
    row.append(box, ' ' + c.label + ': ' + c.value + (c.old && c.old !== c.value ? ' (replaces ' + c.old + ')' : ''));
    list.append(row);
  }
  pasteFound.append(help, list);
  const notes = [];
  if (!parsed.sidesKnown && (parsed.aff.team || parsed.neg.team)) notes.push('The text does not say which team is Aff. Tabula put the first team on Aff. Check the sides.');
  if (parsed.flip) notes.push('The sides are set by a coin flip. After the flip, use Swap Aff and Neg if you need to.');
  for (const n of notes) { const p = document.createElement('p'); p.className = 'muted field-help'; p.textContent = n; pasteFound.append(p); }
}
pasteBox.addEventListener('input', renderPasteFound);

// After a fill, a swap or an Undo of either: the boxes, the save and the ballot check follow, and the preview's
// "replaces" notes are read again against the new round. Only this file's buttons use it.
function afterPasteChange() { bindAll(); save(); renderBallotCheck(); renderPasteFound(); }

pasteFill.addEventListener('click', () => {
  const ticked = new Set([...pasteFound.querySelectorAll('input[type="checkbox"]:checked')].map((b) => b.dataset.path));
  const picked = pasteChanges.filter((c) => ticked.has(c.path));
  if (!picked.length) { pasteBox.focus(); return; }
  const before = { tournament: R.tournament, roundName: R.roundName, judge: R.judge, room: R.room, start: R.start, flight: R.flight, aff: { ...R.aff }, neg: { ...R.neg } };
  const n = picked.length;
  for (const c of picked) setPath(R, c.path, c.value);
  afterPasteChange();
  pasteBox.value = ''; renderPasteFound();
  undoToast('Filled ' + n + (n === 1 ? ' field' : ' fields') + ' from the pasted round.', 'fill the round', () => { Object.assign(R, before); afterPasteChange(); });
});

$('#paste-round-swap').addEventListener('click', async () => {
  const words = FMT().sides;
  // Ballot points and the winner belong to a side, not a name, so they stay where they are.
  const b = R.ballot || {};
  if (b.winner || Object.values(b.pts || {}).some((v) => v !== '' && v != null)) {
    const ok = await ask({
      title: 'Swap the teams?',
      body: 'The team codes and names change sides. The ballot points and the winner stay with the side, so check them after the swap.',
      buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Swap', value: true, kind: 'primary' }], cancelValue: false,
    });
    if (!ok) return;
  }
  R = L.swapSides(R);
  afterPasteChange();
  undoToast('Swapped ' + words.aff.label + ' and ' + words.neg.label + '.', 'swap sides', () => { R = L.swapSides(R); afterPasteChange(); }, 'Sides swapped back.');
});
