// Feature flags (logic/flags.js) and the tournament-site parts they switch: room, start time and flight on the Round
// card, and the copy sheet's word counts and low-point-win note. Paste parsing of room and flight is in pairing.test.js. Run with: node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const POLICY = L.getFormat('policy-hs');
const HTML = read('index.html');
const ON = { tournamentSite: true, pasteRound: true, roundDetails: true, copyTips: true };
const TOURNAMENT_PARTS = Object.keys(L.FLAG_GROUP).filter((n) => L.FLAG_GROUP[n] === 'tournamentSite');

// Why: the owner may drop every tournament-site part at once. If the main switch did not turn each part off, a part
// would stay on the page after the owner decided against it.
test('flagOn: the tournamentSite main switch turns every tournament-site part off', () => {
  assert.ok(TOURNAMENT_PARTS.length >= 3);
  for (const n of TOURNAMENT_PARTS) {
    assert.equal(L.flagOn(n, { flags: ON }), true, n);
    assert.equal(L.flagOn(n, { flags: { ...ON, tournamentSite: false } }), false, n);
  }
});

// Why: the owner may keep some parts and drop one. If one switch turned off its neighbours, keeping the paste import
// would need code changes instead of one flipped value.
test('flagOn: one part off leaves the other parts on', () => {
  const off = { ...ON, roundDetails: false };
  assert.equal(L.flagOn('roundDetails', { flags: off }), false);
  assert.equal(L.flagOn('pasteRound', { flags: off }), true);
  assert.equal(L.flagOn('copyTips', { flags: off }), true);
});

// Why: a typo in a flag name must hide the part, not show it. Showing an unknown part would ship work the owner never
// switched on.
test('flagOn: an unknown flag name is off', () => {
  assert.equal(L.flagOn('pasteRond', { flags: ON }), false);
  assert.equal(L.flagOn('toString', { flags: ON }), false);
});

// Why: the owner and testers check both looks without a new build. If ?flags= did not work, or a bad value turned a
// part on, a test page would not match what judges see.
test('flagOn: ?flags= changes flags for one page load, and bad names or values are ignored', () => {
  const local = (search, flags) => ({ search, local: true, flags });
  assert.equal(L.flagOn('pasteRound', local('?flags=pasteRound:off', ON)), false);
  assert.equal(L.flagOn('pasteRound', local('?flags=tournamentSite:off', ON)), false);
  assert.equal(L.flagOn('pasteRound', local('?flags=pasteRound:on', { ...ON, pasteRound: false })), true);
  assert.equal(L.flagOn('pasteRound', local('?flags=pasteRound:maybe,madeUp:on', { ...ON, pasteRound: false })), false);
  assert.equal(L.flagOn('madeUp', local('?flags=madeUp:on', ON)), false);
});

// Why: when the owner turns a part off, it must stay off on the website. If a link with ?flags=...:on could turn it
// back on, anyone could bring back a part the owner decided against.
test('flagOn: on the website ?flags= can turn a part off but not on', () => {
  const off = { ...ON, pasteRound: false, tournamentSite: true };
  assert.equal(L.flagOn('pasteRound', { search: '?flags=pasteRound:on', flags: off }), false);
  assert.equal(L.flagOn('pasteRound', { search: '?flags=pasteRound:on', local: false, flags: off }), false);
  assert.equal(L.flagOn('copyTips', { search: '?flags=copyTips:off', flags: ON }), false);
});

// Why: a flagged part that is not hidden in the HTML shows for a moment before the code runs, and shows for good if the
// flag is off. A data-flag with an unknown name is a part no switch controls.
test('index.html: every flagged part starts hidden and names a known flag', () => {
  const tags = [...HTML.matchAll(/<[a-z]+\b[^>]*\bdata-flag="([^"]+)"[^>]*>/g)];
  assert.ok(tags.length >= 2);
  for (const [tag, name] of tags) {
    assert.ok(Object.prototype.hasOwnProperty.call(L.FLAGS, name), name + ' is not in FLAGS');
    assert.match(tag, /\shidden(\s|>|$)/, name + ' does not start hidden');
  }
  assert.match(HTML, /\[data-flag\]\[hidden\]\s*\{\s*display:\s*none;\s*\}/, 'a grid or flex part needs this rule to hide');
  for (const n of ['pasteRound', 'roundDetails']) assert.ok(tags.some(([, name]) => name === n), n + ' has no flagged part');
});

// Why: a wiring guard (the page has no DOM test here). The page shows a flagged part only through flagOn. If core.js
// showed every [data-flag] part, or the copy sheet and the paste ignored their flags, turning a flag off would leave the
// part working.
test('page code: flagged parts show only when flagOn says so, and the paste and copy sheet read their flags', () => {
  const core = read('js/core.js');
  assert.match(core, /querySelectorAll\('\[data-flag\]'\)\.forEach\(\(el\) => \{ if \(flagOn\(el\.dataset\.flag\)\) el\.hidden = false; \}\)/);
  assert.match(core, /const flagOn = \(name\) => L\.flagOn\(name, \{ search: location\.search, local: LOCAL_ORIGIN \}\);/);
  assert.match(read('js/pairing.js'), /roundPasteChanges\(R, parsed, FMT\(\), \{ details: flagOn\('roundDetails'\) \}\)/);
  assert.match(read('js/decide.js'), /tournamentBlocks\(R, \{ tips: flagOn\('copyTips'\) \}\)/);
});

const ballotRound = (winner) => ({ aff: { team: 'AB' }, neg: { team: 'CD' },
  ballot: { winner, pts: { '1A': 29, '2A': 29, '1N': 27, '2N': 27 }, ranks: {}, rfd: 'The Neg won on the disad.', affFb: '', negFb: "Good cross-ex. Don't rush." } });

// Why: the tournament ballot asks the judge to tick a box for a low-point win. Without the note, the judge pastes the
// decision, misses the box, and the tab room sends the ballot back.
test('tournamentBlocks with tips: a low-point win gets the tick-box note on the decision only', () => {
  const low = L.tournamentBlocks(ballotRound('neg'), { tips: true });
  assert.match(low[0].note, /low-point win box/);
  for (const b of low.slice(1)) assert.equal('note' in b, false, b.id);
  const normal = L.tournamentBlocks(ballotRound('aff'), { tips: true });
  assert.equal('note' in normal[0], false);
});

// Why: some tournaments set a word minimum for the RFD and comments. A wrong count lets a judge paste a ballot that the
// site then refuses.
test('tournamentBlocks with tips: word counts on the text blocks, none on the decision', () => {
  const b = L.tournamentBlocks(ballotRound('neg'), { tips: true });
  assert.equal('words' in b[0], false);
  assert.equal(b.find((x) => x.id === 'rfd').words, 6);
  assert.equal(b.find((x) => x.id === 'affFb').words, 0);
  assert.equal(b.find((x) => x.id === 'negFb').words, 4, "a word with an apostrophe (Don't) counts once");
});

// Why: with the flag off, the copy sheet must look as it did before the flag. Extra fields would show counts and notes
// the owner turned off.
test('tournamentBlocks without tips: no word counts and no notes', () => {
  for (const b of L.tournamentBlocks(ballotRound('neg'))) {
    assert.equal('words' in b, false, b.id);
    assert.equal('note' in b, false, b.id);
  }
});
