// Tests for the shared copy and print sheets, core/sheets.js. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as Sh from './sheets.js';

const require = createRequire(import.meta.url);
const L = require('../logic.js');
const GOLD = JSON.parse(readFileSync(new URL('../fixtures/sheets/golden.json', import.meta.url), 'utf8'));

// The same sample rounds the golden file was captured from (fixtures/sheets/README.md).
const r = { roundName: 'R3 <b>', tournament: 'T & "Co"', judge: 'J', topic: 'X', aff: { team: 'A&B', d1: 'Ann <i>', d2: 'Bo' }, neg: { team: 'N', d1: 'Cy', d2: '' },
  ballot: { winner: 'aff', pts: { '1A': 28, '2A': 27.5, '1N': 27 }, ranks: { '1A': 1, '2A': 2 }, rfd: 'Long RFD <x> '.repeat(30), affFb: 'a "q"', negFb: '' },
  flows: [{ name: 'Case', cells: { 0: 'Adv 1 & 2', 1: 'T <hi>' } }, { name: 'Empty', cells: {} }], transcripts: { '1AC': 'words & more' } };
const ld = Object.assign(L.formatFields(L.getFormat('ld', 1)), { roundName: 'LD1', tournament: 'T', aff: { team: 'X', d1: 'Al' }, neg: { team: 'Y', d1: 'Bea' },
  ballot: { winner: 'neg', pts: { Aff: 28, Neg: 29 }, ranks: {}, rfd: 'Framework won.', affFb: '', negFb: 'good' } });
const print = (model) => { const sheet = L.printSheet(model); return { cls: Sh.printSheetClass(sheet), html: Sh.printSheetHtml(sheet) }; };

// Why: a judge pastes these sheets into the tournament site and prints them for the tab room; if moving the code
// changed one character, a ballot could print or paste differently from what the judge saw before.
test('debate print sheets are the same HTML as before the move to core/', () => {
  assert.deepEqual(print(L.printModel(r, { range: { min: 25, max: 30 } })), GOLD['print-plain']);
  assert.deepEqual(print(L.printModel(r, { flow: true, transcripts: true, aiNotes: true, orientation: 'landscape', liveEval: { summary: 'S <s>' }, analysis: [['Round Map', ''], ['Impact Calculus', 'I & J']] })), GOLD['print-all']);
  assert.deepEqual(print(L.printModel(ld, { range: null })), GOLD['print-ld']);
});

// Why: same reason, for the text blocks a judge copies into the tournament site's boxes.
test('debate copy sheets are the same HTML as before the move to core/', () => {
  assert.equal(Sh.copyBlocksHtml(L.tournamentBlocks(r, { tips: true })), GOLD['copy-policy'].html);
  assert.equal(Sh.copyBlocksHtml(L.tournamentBlocks(ld, {})), GOLD['copy-ld'].html);
});

// Why: the second app builds its own sheets from these sections; text it does not escape could break the page or run
// a script from a pasted name.
test('a sheet from generic sections escapes every text and writes classes only when given', () => {
  const html = Sh.printSheetHtml({ title: 'Sheet <1>', sections: [
    { kind: 'lead', title: 'Result', text: 'A & B' },
    { kind: 'table', title: 'Ranks', head: [{ text: 'Code' }, { text: 'Rank', cls: 'num' }], rows: [[{ text: '<script>' }, { text: '1', cls: 'num' }]] },
    { kind: 'text', title: 'Notes', text: '' },
  ] });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('<th>Code</th><th class="num">Rank</th>'));
  assert.ok(html.includes('<span class="muted">Nothing written.</span>'));
  assert.equal(Sh.printSheetClass({ landscape: true }), 'print-sheet landscape');
  assert.equal(Sh.copyBlocksHtml([{ id: 'x', label: 'Empty', text: '' }]).includes('Nothing written yet'), true);
});

// Why: when printing, the page's <main> is hidden; a print sheet outside every landmark fails axe (landmark-one-main, region) for screen-reader users of the PDF view.
test('the print sheet is the main landmark, named by its title', () => {
  assert.deepEqual(Sh.printSheetAttrs({ title: 'Ballot: Round 3', sections: [] }), { role: 'main', 'aria-label': 'Ballot: Round 3' });
  assert.equal(Sh.printSheetAttrs({ sections: [] })['aria-label'], 'Sheet to print');
  const made = [];
  const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, set innerHTML(v) { this.html = v; } };
  const keep = globalThis.document;
  globalThis.document = { createElement: () => el, getElementById: () => null, body: { append: (x) => made.push(x), classList: { add() {}, remove() {} } } };
  try { Sh.showPrintSheet({ title: 'Ballot', sections: [] }); } finally { if (keep === undefined) delete globalThis.document; else globalThis.document = keep; }
  assert.equal(made[0], el);
  assert.equal(el.attrs.role, 'main');
  assert.equal(el.attrs['aria-label'], 'Ballot');
  assert.equal(el.id, 'print-sheet');
});
