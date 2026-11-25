// Format names and the format pick (docs/design/FORMAT-PICK.md): one naming rule, the lock after the first speech,
// the header chip, the start panel line and the format choice in "New round". Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { readSource } = require('./test-sources.js');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const APP = readSource('app.js');
const pickable = () => L.FORMAT_IDS.map((id) => L.getFormat(id));

// ---------- the naming rule (§2) ----------

// Why: the owner asked for plain event names. An abbreviation or level in a label ("(LD)", "HS") confuses a lay
// judge, and "(CX)" reads as cross-examination; if this fails, the pick, the chip and History show jargon again.
test('every format a judge can pick has a plain name: no brackets, no abbreviation, no level', () => {
  assert.deepEqual(pickable().map((f) => L.labelOf(f)), ['Policy', 'Lincoln-Douglas', 'Public Forum']);
  for (const f of pickable()) {
    assert.doesNotMatch(L.labelOf(f), /[()]|\bHS\b|\bCX\b/, f.id);
    assert.ok(L.labelOf(f, 'blurb').length > 0, f.id + ' has no one-line summary for the pick');
  }
});

// Why: the fallback to a file's own name exists only for a format with no entry. If a new pickable format shipped with
// no entry, its pick card and chip would quietly show the old "Name (XX)" style; this catches it before release.
test('every pickable format has its own label entry, so the file-name fallback never shows', () => {
  for (const f of pickable()) assert.notEqual(L.labelOf(f), f.name, f.id + ' falls back to its file name');
  const bare = Object.assign({}, L.getFormat('ld'), { id: 'made-up' });
  assert.equal(L.labelOf(bare), bare.name, 'a format with no entry still gets a name, never an empty chip');
});

// Why: the narrow chip has room for a few letters. Policy's file abbreviation is "CX", which judges also say for
// cross-examination; a chip reading "CX" would tell a Policy judge they are in the wrong place.
test('the short label is the file abbreviation, except Policy, which stays "Policy"', () => {
  assert.deepEqual(pickable().map((f) => L.labelOf(f, 'short')), ['Policy', 'LD', 'PF']);
});

// Why: a published format file never changes (ARCHITECTURE.md §9); renaming on screen must not touch the frozen
// files, or old rounds and the server's copy would no longer match the version they were judged under.
test('the frozen format files keep their original names', () => {
  assert.deepEqual(pickable().map((f) => f.name), ['Policy (CX)', 'Lincoln-Douglas (LD)', 'Public Forum (PF)']);
});

// ---------- the lock (§3) ----------

// Why: a judge must never land in another format in the middle of a round. If the format lock and the "Judging for"
// lock ever disagreed, one round could keep its school but lose its format, or the other way round.
test('the format locks at the same moment as "Judging for": once a speech clock has run', () => {
  const cases = [{}, { run: null, timeLeft: {} }, { run: { id: 'AC' } }, { timeLeft: { AC: 200 } }, null];
  for (const r of cases) assert.equal(L.formatLocked(r), L.judgingLocked(r), JSON.stringify(r));
  assert.equal(L.formatLocked({ timeLeft: {} }), false);
  assert.equal(L.formatLocked({ timeLeft: { AC: 1 } }), true);
});

// Why: the lock is only real if the page obeys it. If switchFormat stopped checking it, a stray click on a card in
// the middle of a round would again offer "Clear and start new".
test('the page disables the cards and refuses a switch once the round is locked', () => {
  assert.match(APP, /if \(!fmt \|\| id === R\.format \|\| L\.formatLocked\(R\)\) return renderFormatSetup\(\);/);
  assert.match(APP, /r\.checked = r\.value === fmt\.id; r\.disabled = locked;/);
  assert.match(APP, /locked \? 'Set for this round\. Start a new round to change it\.'/);
  assert.match(APP, /if \(id === 'setup'\) \{ renderJudging\(\); renderFormatSetup\(\); \}/, 'opening Round setup redraws the lock');
});

// ---------- the chip, the start panel and "New round" (§3) ----------

// Why: before this, no screen outside Round setup named the format, so a judge carried over from last week's LD round
// saw nothing until the speech names looked wrong. The chip must be in the header and open Round setup.
test('the header has a format chip, before the clock chip, that opens the format pick', () => {
  const header = HTML.slice(HTML.indexOf('<header>'), HTML.indexOf('</header>'));
  const chip = header.indexOf('id="format-chip"');
  assert.ok(chip > header.indexOf('class="spacer"') && chip < header.indexOf('id="clock-chip"'), 'chip is out of place');
  assert.match(header, /<button class="fmt-chip" id="format-chip" type="button" aria-label="Format: Policy\. Opens Round setup\.">/);
  assert.match(APP, /\$\('#format-chip'\)\.addEventListener\('click', openFormatPick\);/);
  assert.match(APP, /'Format: ' \+ full \+ '\. Opens Round setup\.'/);
});

// Why: a lay judge never opens Round setup before round 1. The start panel is the one screen they see, so it must
// name the format and offer a way to change it, or they judge PF on a Policy flow.
test('the start panel names the format with a Change button', () => {
  assert.match(HTML, /<p class="start-format">Format: <strong id="start-format-name">Policy<\/strong><span id="start-format-from"><\/span> · <button class="linkish" id="start-format-change" type="button">Change<\/button><\/p>/);
  assert.match(APP, /\$\('#start-format-from'\)\.textContent = formatFromLink \? ' \(from your link\)' : '';/);
});

// Why: "New round" is the reset for a new tournament or event. If the dialog lost its format choice, or ignored the
// pick, a multi-event judge would again start round 4 in round 2's format.
test('"New round" offers every format, picks the current one, and starts the new round in the choice', () => {
  const h = APP.slice(APP.indexOf("$('#new-round').addEventListener"));
  assert.match(h, /radios: \{ legend: 'Format for the new round', name: 'new-round-format', value: FMT\(\)\.id,/);
  assert.match(h, /options: L\.FORMAT_IDS\.map\(\(id\) => \(\{ value: id, label: L\.labelOf\(L\.getFormat\(id\)\) \}\)\)/);
  assert.match(h, /if \(!res \|\| !res\.value\) return;\n  startNewRound\(L\.getFormat\(res\.choice\) \|\| undefined\);/);
});

// Why: the demo intro is the first sentence a new judge reads about a format; it must use the same plain name.
test('the demo intro uses the plain format name', () => {
  const steps = L.demoSteps({ speeches: [] }, L.getFormat('ld'));
  assert.match(steps[0].body, /^This is a Lincoln-Douglas round with made-up debaters\./);
});
