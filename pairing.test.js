// Round import by paste (logic/pairing.js, js/pairing.js; docs/research/TABROOM.md Option D). Run with: node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');

const POLICY = L.getFormat('policy-hs');
const LD = L.getFormat('ld');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

// Why: the most common copy is one line per side with the names after the code; if it misreads, the judge retypes
// every name and the import is worthless.
test('parseRoundPaste: side lines with the code and two names fill the policy round', () => {
  const p = L.parseRoundPaste('Round 3\nAff: Lincoln AB  Alex Smith & Bo Jones\nNeg: Westfield CD  Cam Lee and Dee Park', POLICY);
  assert.equal(p.roundName, 'Round 3');
  assert.deepEqual(p.aff, { team: 'Lincoln AB', d1: 'Alex Smith', d2: 'Bo Jones' });
  assert.deepEqual(p.neg, { team: 'Westfield CD', d1: 'Cam Lee', d2: 'Dee Park' });
  assert.equal(p.sidesKnown, true);
});

// Why: a judge page lists each side as a heading with the code and names on their own lines; reading it wrong puts
// names on the wrong team, and the ballot then credits the wrong students.
test('parseRoundPaste: a side heading with the code and names on the lines below', () => {
  const p = L.parseRoundPaste('Round 5 of VCX\nAFF\nLincoln AB\nAlex Smith\nBo Jones\nNEG\nWestfield CD\nCam Lee\nDee Park', POLICY);
  assert.equal(p.roundName, 'Round 5 of VCX');
  assert.deepEqual(p.aff, { team: 'Lincoln AB', d1: 'Alex Smith', d2: 'Bo Jones' });
  assert.deepEqual(p.neg, { team: 'Westfield CD', d1: 'Cam Lee', d2: 'Dee Park' });
});

// Why: the posted pairings are a table; a judge who copies their row with the header must get the right sides, or Aff
// and Neg are swapped on the ballot.
test('parseRoundPaste: a pairings table row with an Aff and a Neg column', () => {
  const p = L.parseRoundPaste('Room\tAff\tNeg\tJudge\n204\tLincoln AB\tWestfield CD\tPat Doe', POLICY);
  assert.equal(p.aff.team, 'Lincoln AB');
  assert.equal(p.neg.team, 'Westfield CD');
  assert.equal(p.judge, 'Pat Doe');
  assert.equal(p.sidesKnown, true);
});

// Why: "A vs B" does not say who is Aff; shown as fact, a wrong guess gives the win and the points to the wrong team.
test('parseRoundPaste: "A vs B" fills both teams but marks the sides as not known', () => {
  const p = L.parseRoundPaste('Lincoln AB vs. Westfield CD', POLICY);
  assert.equal(p.aff.team, 'Lincoln AB');
  assert.equal(p.neg.team, 'Westfield CD');
  assert.equal(p.sidesKnown, false);
});

// Why: a lost or misplaced tournament or judge name is printed wrong on the ballot and saved wrong in History.
test('parseRoundPaste: labelled tournament, round and judge lines', () => {
  const p = L.parseRoundPaste('Tournament: Fall Classic\nRound: Quarterfinals\nJudge: Pat Doe\nAff: Lincoln AB\nNeg: Westfield CD', POLICY);
  assert.equal(p.tournament, 'Fall Classic');
  assert.equal(p.roundName, 'Quarterfinals');
  assert.equal(p.judge, 'Pat Doe');
  assert.equal(p.aff.team, 'Lincoln AB');
});

// Why: pronouns and other personal notes are students' data that the round does not need; copying them stores more
// about minors than the judge asked for (TABROOM.md §2.2).
test('parseRoundPaste: pronouns and note lines are not copied into any field', () => {
  const p = L.parseRoundPaste('Aff: Lincoln AB  Alex Smith (she/her) & Bo Jones [they/them]\nNeg: Westfield CD\nNotes: needs extra time to read', POLICY);
  assert.deepEqual(p.aff, { team: 'Lincoln AB', d1: 'Alex Smith', d2: 'Bo Jones' });
  const all = JSON.stringify(p);
  assert.doesNotMatch(all, /she\/her|they\/them|extra time/);
});

// Why: an LD side has one debater; filling a hidden second name box would put a stray name into the saved round and
// the AI prompt.
test('parseRoundPaste: an LD round takes one name per side', () => {
  const p = L.parseRoundPaste('Aff: Lincoln AS  Alex Smith & Bo Jones\nNeg: Westfield CL  Cam Lee', LD);
  assert.deepEqual(p.aff, { team: 'Lincoln AS', d1: 'Alex Smith', d2: '' });
  assert.deepEqual(p.neg, { team: 'Westfield CL', d1: 'Cam Lee', d2: '' });
});

// Why: a coin-flip round has no sides yet; the judge must be told to check them after the flip.
test('parseRoundPaste: a flip round says so', () => {
  assert.equal(L.parseRoundPaste('Round 4  Flip for sides\nLincoln AB vs Westfield CD', POLICY).flip, true);
  assert.equal(L.parseRoundPaste('Aff: Lincoln AB', POLICY).flip, false);
});

// Why: text that is not a round (an empty paste, a stray paragraph) must fill nothing, or it overwrites the judge's
// typed fields with junk.
test('parseRoundPaste and roundPasteChanges: text with no round fills nothing', () => {
  for (const t of ['', '   ', 'hello there, this is a note about lunch', undefined]) {
    assert.deepEqual(L.roundPasteChanges({ format: 'policy-hs' }, L.parseRoundPaste(t, POLICY), POLICY), [], String(t));
  }
});

// Why: a judge who pastes a whole results page must not get a team from far down the page (another round) or a page
// that stops answering while it reads megabytes; only the start of the paste is read.
test('parseRoundPaste: a very long paste reads the round at the top and ignores text far below', () => {
  const p = L.parseRoundPaste('Aff: Lincoln AB\nNeg: Westfield CD\n' + 'x '.repeat(200000), POLICY);
  assert.equal(p.aff.team, 'Lincoln AB');
  const late = L.parseRoundPaste('word '.repeat(10000) + '\nAff: Late AB\nNeg: Later CD', POLICY);
  assert.equal(late.aff.team, '', 'a team 50,000 characters down is another round, not this one');
});

// Why: the judge sees each change before it is made; a missing "replaces" note lets a paste silently overwrite a name
// the judge typed.
test('roundPasteChanges: lists only found fields, with the old value each one replaces', () => {
  const round = { format: 'policy-hs', tournament: '', roundName: 'R2', judge: '', aff: { team: 'Old AB', d1: '', d2: '' }, neg: { team: '', d1: '', d2: '' } };
  const changes = L.roundPasteChanges(round, L.parseRoundPaste('Round 3\nAff: Lincoln AB  Alex Smith & Bo Jones\nNeg: Westfield CD', POLICY), POLICY);
  assert.deepEqual(changes, [
    { path: 'roundName', label: 'Round', value: 'Round 3', old: 'R2' },
    { path: 'aff.team', label: 'Aff team code', value: 'Lincoln AB', old: 'Old AB' },
    { path: 'aff.d1', label: '1A', value: 'Alex Smith', old: '' },
    { path: 'aff.d2', label: '2A', value: 'Bo Jones', old: '' },
    { path: 'neg.team', label: 'Neg team code', value: 'Westfield CD', old: '' },
  ]);
});

// Why: in LD the name box is labelled "Debater"; the preview must use the same word, or the judge cannot match it.
test('roundPasteChanges: an LD name is labelled "Aff debater"', () => {
  const changes = L.roundPasteChanges({ format: 'ld' }, L.parseRoundPaste('Aff: Lincoln AS  Alex Smith', LD), LD);
  assert.deepEqual(changes.map((c) => c.label), ['Aff team code', 'Aff debater']);
});

// Why: a swap after a coin flip must move codes and names together and touch nothing else; a half swap pairs a
// team code with the other team's students.
test('swapSides: swaps team codes and names, keeps the rest, and two swaps give the start', () => {
  const r = { format: 'policy-hs', judge: 'Pat', ballot: { winner: 'aff' }, aff: { team: 'A', d1: 'a1', d2: 'a2' }, neg: { team: 'N', d1: 'n1', d2: 'n2' } };
  const s = L.swapSides(r);
  assert.deepEqual(s.aff, { team: 'N', d1: 'n1', d2: 'n2' });
  assert.deepEqual(s.neg, { team: 'A', d1: 'a1', d2: 'a2' });
  assert.equal(s.judge, 'Pat');
  assert.equal(s.ballot, r.ballot);
  assert.deepEqual(L.swapSides(s), r);
});

// Why: the import must stay a paste. A network call from it would send students' names to a server and break the
// promise in the round card ("It does not connect to the tournament site") and the site's terms (TABROOM.md §2.1).
test('the paste import makes no network call', () => {
  for (const f of ['logic/pairing.js', 'js/pairing.js']) {
    assert.doesNotMatch(read(f), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|\bimport\s*\(/, f);
  }
});

// Why: "Flip for sides" is a note, not the round's name; left in, it is printed on the ballot and saved in History as
// the round name.
test('parseRoundPaste: a flip note is not kept in the round name', () => {
  assert.equal(L.parseRoundPaste('Round 4  Flip for sides\nLincoln AB vs Westfield CD', POLICY).roundName, 'Round 4');
  assert.equal(L.parseRoundPaste('Round: Octafinals (coin toss)\nAff: Lincoln AB', POLICY).roundName, 'Octafinals');
});

// Why: a note about a student's accommodation read as a name is saved in the round, printed on the ballot and sent to
// the AI; that data about a minor must never enter Tabula (TABROOM.md §2.2).
test('parseRoundPaste: accommodation notes under a name are not read as a debater', () => {
  for (const note of ['Extra Time Needed', 'Quiet Room', 'Needs Large Print', 'Wheelchair Access']) {
    const p = L.parseRoundPaste('AFF\nLincoln AB\nAlex Smith\n' + note + '\nNEG\nWestfield CD', POLICY);
    assert.deepEqual(p.aff, { team: 'Lincoln AB', d1: 'Alex Smith', d2: '' }, note);
    assert.doesNotMatch(JSON.stringify(p), new RegExp(note, 'i'), note);
  }
});

// Why: sites write pronouns in many ways; a variant the filter misses lands in a name or team code, stores a minor's
// personal data the round does not need, and breaks the names apart.
test('parseRoundPaste: pronouns in other spellings are dropped and the names stay right', () => {
  const cases = [
    'Aff: Lincoln AB  Alex Smith (he / him) & Bo Jones (she, her)',
    'Aff: Lincoln AB  Alex Smith (She/Her) Bo Jones',
    'AFF\nLincoln AB\nAlex Smith\nShe Her\nBo Jones',
    'AFF\nLincoln AB\nAlex Smith\n(they/them)\nBo Jones',
  ];
  for (const t of cases) {
    const p = L.parseRoundPaste(t, POLICY);
    assert.deepEqual(p.aff, { team: 'Lincoln AB', d1: 'Alex Smith', d2: 'Bo Jones' }, t);
    assert.doesNotMatch(JSON.stringify(p), /\b(she|her|he|him|they|them)\b/i, t);
  }
});

// Why: the source scan above can miss a renamed or indirect network call; reading a paste with every network door
// made to throw proves the parser itself sends nothing anywhere.
test('parseRoundPaste reads a paste with the network turned off', () => {
  const saved = globalThis.fetch;
  const doors = ['fetch', 'XMLHttpRequest', 'WebSocket'];
  const saved2 = Object.fromEntries(doors.map((k) => [k, globalThis[k]]));
  for (const k of doors) globalThis[k] = function () { throw new Error('the paste import tried to use the network: ' + k); };
  try {
    const p = L.parseRoundPaste('Room\tAff\tNeg\tJudge\n204\tLincoln AB\tWestfield CD\tPat Doe', POLICY);
    assert.equal(p.aff.team, 'Lincoln AB');
  } finally { for (const k of doors) globalThis[k] = saved2[k]; globalThis.fetch = saved; }
});

// Why: a note written inside a bracket or after a dash on the name line was saved as the team code, then printed on
// the ballot and sent to the AI; that is data about a minor the round must not hold (TABROOM.md §2.2).
test('parseRoundPaste: a note on the name line never reaches the team code or a name', () => {
  const cases = [
    ['Aff: Lincoln AB  Alex Smith (Extra Time) & Bo Jones', 'Bo Jones'],
    ['Aff: Lincoln AB  Alex Smith - Extra Time & Bo Jones', 'Bo Jones'],
    ['Aff: Lincoln AB  Alex Smith (Needs Interpreter)', ''],
    ['Aff: Lincoln AB  Alex Smith (any pronouns) & Bo Jones', 'Bo Jones'],
  ];
  for (const [t, d2] of cases) {
    const p = L.parseRoundPaste(t, POLICY);
    assert.deepEqual(p.aff, { team: 'Lincoln AB', d1: 'Alex Smith', d2 }, t);
    assert.doesNotMatch(JSON.stringify(p), /extra|interpreter|pronoun/i, t);
  }
});

// Why: the note list is best effort, so it should still catch common notes that are not about time or rooms; each
// one missed becomes a "debater" the judge must spot and untick.
test('parseRoundPaste: more kinds of notes under a name are not read as a debater', () => {
  for (const note of ['Service Dog', 'Sees Poorly', 'Autism Spectrum', 'Speaks Slowly']) {
    const p = L.parseRoundPaste('AFF\nLincoln AB\nAlex Smith\n' + note + '\nBo Jones', POLICY);
    assert.equal(p.aff.d2, '', note);
  }
});

// Why: no word list can catch every note about a student, so the judge is the last check; without a tick box per
// field the only way to keep a wrong field out is to fill it and then clear it by hand.
test('the paste preview gives each found field a tick box, and Fill uses only ticked fields', () => {
  const src = read('js/pairing.js');
  assert.match(src, /box\.type = 'checkbox'; box\.checked = true; box\.dataset\.path = c\.path/);
  assert.match(src, /pasteChanges\.filter\(\(c\) => ticked\.has\(c\.path\)\)/);
  assert.match(src, /for \(const c of picked\) setPath\(R, c\.path, c\.value\)/);
});
