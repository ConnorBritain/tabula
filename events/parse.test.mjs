// Tests for the Speech Events paste parser (docs/events/LANDING.md §4.1 step E3, primitive N13). Run with: node --test
// The sample texts in fixtures/paste/ follow how Tabroom.com and SpeechWire lay out a speech room. Every name in
// them is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRoom } from './js/parse.js';

const at = (p) => new URL(p, import.meta.url);
const EVENTS = readdirSync(at('defs/')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(at('defs/' + f), 'utf8')));
const fixture = (name) => readFileSync(at('fixtures/paste/' + name), 'utf8');
const FIXTURES = readdirSync(at('fixtures/paste/')).filter((f) => f.endsWith('.txt'));
const parse = (text, opts = {}) => parseRoom(text, { events: EVENTS, ...opts });
const codes = (r) => r.entries.map((e) => e.code);

// Why: a Tabroom table copy is the most common paste; if its columns are misread, the judge sees wrong codes or names and ballots go to the wrong students.
test('a Tabroom table with a header row gives codes, names, round and event in order', () => {
  const r = parse(fixture('tabroom-table.txt'));
  assert.deepEqual(codes(r), ['1024', '1107', '1033', '1215', '1190', '1052']);
  assert.equal(r.entries[0].name, 'Ava Moreno');
  assert.deepEqual(r.entries.map((e) => e.order), [1, 2, 3, 4, 5, 6]);
  assert.equal(r.round, 'Round 2');
  assert.deepEqual(r.event, { id: 'di', text: 'Dramatic Interpretation' });
  assert.deepEqual(r.check, []);
});

// Why: the room record has no school field and names are optional (ARCHITECTURE.md §6.3); a school left in the name would show on the roster and could go to hosted AI.
test('the school column does not end up in the name', () => {
  const r = parse(fixture('tabroom-table.txt'));
  for (const e of r.entries) assert.ok(!/HS|Academy|Prep/.test(e.name), e.name);
  assert.equal(parse('1. 104 Ava Moreno (Ridgeview HS)').entries[0].name, 'Ava Moreno');
  assert.equal(parse('1. 104 Ava Moreno, Ridgeview HS').entries[0].name, 'Ava Moreno');
});

// Why: a table copied without its header row still has a school cell; if it stayed in the name, schools would show on the roster and could go to hosted AI.
test('a table row with no header row keeps only the name cell', () => {
  const r = parse('1\t1024\tAva Moreno\tRidgeview HS\n2  2208  Maya Okafor & Theo Lindqvist  Harbor City HS\n3\t1033\tSofia Arnaud\tRidgeview HS\t(late add)');
  assert.deepEqual(codes(r), ['1024', '2208', '1033']);
  assert.equal(r.entries[0].name, 'Ava Moreno');
  assert.deepEqual(r.entries[1].names, ['Maya Okafor', 'Theo Lindqvist']);
  assert.equal(r.entries[2].name, 'Sofia Arnaud');
  assert.equal(r.entries[2].late, true);
});

// Why: the text's speaker numbers are the speaking order; if the parser kept row order instead, the judge would call speakers in the wrong order.
test('speaker numbers out of row order set the speaking order', () => {
  const r = parse(fixture('tabroom-out-of-order.txt'));
  assert.deepEqual(codes(r), ['5110', '5121', '5103', '5142', '5134']);
  assert.deepEqual(r.entries.map((e) => e.order), [1, 2, 3, 4, 5]);
});

// Why: if two rows claim the same speaker number the order is unclear; sorting by them would put a speaker in a random place, so the text order must win.
test('repeated speaker numbers fall back to the text order', () => {
  const r = parse('1 A12 Tessa Grove\n1 B07 Milo Haddad\n2 C31 Juno Ashby');
  assert.deepEqual(codes(r), ['A12', 'B07', 'C31']);
});

// Why: Duo is one entry with two performers (MODELS.md §4.1); splitting a pair into two rows would give two ranks for one entry.
test('a Duo pair stays one entry with both names', () => {
  const r = parse(fixture('tabroom-duo-spaces.txt'));
  assert.deepEqual(codes(r), ['2208', '2311', '2245', '2290']);
  for (const e of r.entries) assert.equal(e.names.length, 2, e.line);
  assert.deepEqual(r.entries[2].names, ['Callum Reyes', 'Ines Varga']);
  assert.deepEqual(r.event, { id: 'duo', text: 'Duo Interpretation' });
});

// Why: Tabroom can show both a "Code" and an "Entry" column; if "Entry" were read as a second code column, every name would be lost.
test('an Entry column next to a Code column is the name', () => {
  const r = parse(fixture('tabroom-duo-spaces.txt'));
  assert.equal(r.entries[0].name, 'Maya Okafor & Theo Lindqvist');
});

// Why: SpeechWire writes "Speaker 1: 304 - Name (School)"; if that layout fails, judges at SpeechWire tournaments must type every code by hand.
test('a SpeechWire speaker list gives codes, names and round', () => {
  const r = parse(fixture('speechwire-speakers.txt'));
  assert.deepEqual(codes(r), ['304', '317', '322', '341', '356']);
  assert.equal(r.entries[1].name, 'Bram Oduya');
  assert.equal(r.round, 'Round 3');
  assert.equal(r.event.id, 'pro');
  assert.deepEqual(r.check, []);
});

// Why: one code per line is the fallback when the sites change their layout (PLAN.md risk R5); if it breaks, there is no way left to paste a room.
test('one code per line works with no names and no headings', () => {
  const r = parse(fixture('codes-only.txt'));
  assert.deepEqual(codes(r), ['A12', 'B07', 'C31', 'D05', 'E19']);
  assert.equal(r.round, null);
  assert.equal(r.event, null);
  assert.deepEqual(parseRoom('A12\nB07').entries.map((e) => e.code), ['A12', 'B07']);
});

// Why: real pastes carry blank lines, tabs, lower-case codes, a repeated row and a late add; each must land in the right place or the roster is wrong.
test('a messy paste keeps good rows and sends unclear ones to Check these', () => {
  const r = parse(fixture('messy.txt'));
  assert.deepEqual(codes(r), ['A12', 'B07', 'C31', 'D05', 'E19', 'F22']);
  assert.equal(r.round, 'Semifinal');
  assert.equal(r.event.id, 'oo');
  assert.equal(r.entries.find((e) => e.code === 'F22').late, true);
  assert.equal(r.entries.find((e) => e.code === 'F22').name, 'Wren Calloway');
  assert.deepEqual(r.check.map((c) => c.line), ['4.  D05 - Rafael Mott', 'Ava Lindell']);
  assert.match(r.check[0].why, /already in the list/);
  assert.match(r.check[1].why, /No entry code/);
});

// Why: a duplicated code in a room means a copy error or two students with one code; taking the second row in silence would hide that from the judge.
test('a repeated code goes to Check these, not into the roster twice', () => {
  const r = parse('A12 Tessa Grove\na12 Tessa Grove');
  assert.deepEqual(codes(r), ['A12']);
  assert.equal(r.check.length, 1);
});

// Why: "never silently dropped" is the parser's promise (DESIGN.md §4.8); a lost line could be a student who never gets a ballot.
test('every non-blank line of every sample lands in entries, check or skipped', () => {
  for (const f of FIXTURES) {
    const text = fixture(f);
    const r = parse(text);
    const want = text.split(/\r\n|\r|\n/).map((l, i) => (l.trim() ? i + 1 : 0)).filter(Boolean);
    const got = [...r.entries, ...r.check, ...r.skipped].map((x) => x.lineNo).sort((a, b) => a - b);
    assert.deepEqual([...new Set(got)], want, f);
  }
});

// Why: a line with a code that is not at the start may still be an entry; the judge needs the guess to fix it in one tap instead of typing it.
test('a code in the wrong place goes to Check these with a guess', () => {
  const r = parse('A12 Tessa Grove\nMilo Haddad B07');
  assert.equal(r.check[0].guess, 'B07');
  assert.match(r.check[0].why, /not at the start/);
});

// Why: two codes on one line are two entries or a typo; taking only the first would lose a speaker without a word.
test('two codes and a name on one line go to Check these', () => {
  const r = parse('A12 Tessa Grove B07');
  assert.deepEqual(r.entries, []);
  assert.match(r.check[0].why, /More than one code/);
});

// Why: judges type short lists as "A12, B07, C31"; reading that as one entry would make a room of one.
test('a comma list of codes gives one entry per code', () => {
  assert.deepEqual(codes(parse('A12, B07; C31')), ['A12', 'B07', 'C31']);
});

// Why: the judge resolves Check these items on the setup screen; if the answers are not applied, the same lines stay stuck and the room cannot start.
test('the judge answers place or skip Check these lines', () => {
  const text = 'A12 Tessa Grove\nMilo Haddad B07\nAva Lindell';
  const first = parse(text);
  const [wrong, noCode] = first.check;
  const r = parse(text, { decided: { [wrong.key]: 'b07', [noCode.key]: 'skip' } });
  assert.deepEqual(codes(r), ['A12', 'B07']);
  assert.equal(r.entries[1].name, 'Milo Haddad');
  assert.deepEqual(r.check, []);
  assert.deepEqual(r.skipped.map((s) => s.line), ['Ava Lindell']);
});

// Why: an answer keyed to a line must not move to another line after the judge edits the text above it; a stale key would place the wrong code.
test('an answer for a line that changed is not applied', () => {
  const r = parse('Milo Haddad B07', { decided: { '1:Milo Haddad C99': 'C99' } });
  assert.deepEqual(r.entries, []);
  assert.equal(r.check.length, 1);
});

// Why: ordinal and "Spkr" prefixes are common on both sites; read as codes, they would push the real code off the start and every line would need a fix.
test('order prefixes in many forms are read as the speaking order', () => {
  const r = parse('2nd 317 Bram Oduya\n1st 304 Hana Whitlock\nSpkr 3 - 322 Lucia Fenn\n#4 341 Ezra Kowal\n5) 356 Nadia Quill');
  assert.deepEqual(codes(r), ['304', '317', '322', '341', '356']);
});

// Why: a late entry still speaks and gets a ballot; if the mark broke the line, the late student would be left out.
test('late marks are taken off and flagged', () => {
  const r = parse('A12 Tessa Grove\nAdded: B07 Milo Haddad\nC31 Juno Ashby [late]');
  assert.deepEqual(codes(r), ['A12', 'B07', 'C31']);
  assert.deepEqual(r.entries.map((e) => e.late), [false, true, true]);
  assert.equal(r.entries[2].name, 'Juno Ashby');
});

// Why: text copied from a web page brings Windows line ends, non-breaking spaces and bullets; if they leak into codes, codes stop matching.
test('web copy noise does not change codes or names', () => {
  const r = parse('• A12 Tessa Grove\r\n​B07 Milo Haddad\r\n');
  assert.deepEqual(codes(r), ['A12', 'B07']);
  assert.equal(r.entries[0].name, 'Tessa Grove');
});

// Why: without event files (or for an event the app lacks) the "Event:" label is still useful to show; with no match the id must be null so the app does not pick a wrong event.
test('an Event label with no matching file gives the text and a null id', () => {
  const r = parseRoom('Event: Storytelling Showcase\nA12', { events: [] });
  assert.deepEqual(r.event, { id: null, text: 'Storytelling Showcase' });
  assert.deepEqual(r.entries.map((e) => e.code), ['A12']);
});

// Why: elimination rounds have no number; if "Quarterfinals" were not read, the room would save with no round.
test('elimination round names are read', () => {
  assert.equal(parse('Quarterfinals\nA12').round, 'Quarterfinal');
  assert.equal(parse('Rd. 5 Section 2\nA12').round, 'Round 5');
});

// Why: the setup screen calls the parser on every key press, starting from an empty box; a throw there would break the screen.
test('empty or missing text gives an empty result', () => {
  for (const t of ['', '   \n\n', null, undefined]) {
    assert.deepEqual(parseRoom(t), { entries: [], check: [], skipped: [], round: null, event: null });
  }
});

// Why: the events page reaches the parser through globalThis.TabulaEvents.parse, like core/ files; if the bridge line is lost, the page cannot call it.
test('the parser is on globalThis.TabulaEvents.parse', () => {
  assert.equal(globalThis.TabulaEvents.parse.parseRoom, parseRoom);
  assert.ok(Object.isFrozen(globalThis.TabulaEvents.parse));
});
