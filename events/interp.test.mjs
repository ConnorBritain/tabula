// Tests for step E9 (docs/events/LANDING.md §4.1, F1b interp): title and author fields, and Duo as one entry with two
// performers (events/js/piece.js, piece-view.js, and the room, rank and review screens). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { parseRoom } from './js/parse.js';
import { createRoom, updateEntry, setupError } from './js/room.js';
import { hasPiece, isPair, pairNames, joinPair, entryName, setPieceField, pieceLine } from './js/piece.js';
import { pieceHtml } from './js/piece-view.js';
import { rosterHtml } from './js/room-screen.js';
import { openBoard, withRanks } from './js/board.js';
import { setNotes } from './js/comments.js';
import { ranksBlock, cards, printModel } from './js/ballot.js';
import { cardHtml, commentsStageHtml } from './js/review-screen.js';
import { scrubMap } from './js/cleanup.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const ev = (id) => DATA.events.get(id);
const prof = () => DATA.profiles.get('nsda-district');
const INTERP = ['di', 'hi', 'duo', 'poi', 'pro', 'poe', 'sto', 'dec'];

// Why: a judge must be able to start a room for every F1b event; an interp event left off would send interp judges
// back to paper, and an event shown the title fields by mistake (OO) would ask for a piece it does not have.
test('every F1b event can start a room and asks for title and author; public address does not', () => {
  const parsed = parseRoom('1. A12\n2. B07');
  for (const id of INTERP) {
    assert.equal(setupError(parsed, id), '', id + ' starts');
    assert.ok(hasPiece(ev(id)), id + ' asks for the piece');
  }
  for (const id of ['oo', 'inf', 'exp', 'osw']) assert.ok(!hasPiece(ev(id)), id + ' has no piece');
  assert.ok(isPair(ev('duo')) && !isPair(ev('di')));
});

// Why: the title and author are how a judge tells pieces apart when writing comments later; if the review card left
// them off, a judge with 6 interp speakers could paste a comment under the wrong code (LANDING.md E9 done-check).
test('title and author show on the review card, and stay off the copied comment', () => {
  let r = createRoom({ event: ev('di'), profile: prof(), entries: [{ code: 'A12' }, { code: 'B07' }], now: 1 });
  const a = r.entries[0].id;
  r = updateEntry(r, a, (e) => setPieceField(setPieceField(e, 'title', 'The Long Road'), 'author', 'Maria Diaz'), 2);
  r = updateEntry(r, a, (e) => setNotes(e, 'Clear characters. Work on the intro.'), 3);
  const c = cards(r, 'speaking').find((x) => x.id === a);
  assert.equal(c.piece, '“The Long Road” by Maria Diaz');
  const html = cardHtml(c, false);
  assert.match(html, /class="card-piece">“The Long Road” by Maria Diaz</);
  assert.equal(c.comment, 'Clear characters. Work on the intro.', 'the comment the judge copies has no added piece line');
  assert.doesNotMatch(cardHtml(cards(r, 'speaking')[1], false), /card-piece/, 'no empty piece line for an entry with none');
  assert.match(printModel(r, ev('di'), 600).sections.find((s) => s.kind === 'text' && /A12/.test(s.title)).title, /The Long Road/);
});

// Why: a title or author typed in the room must reach the clean-up scrub (ARCHITECTURE.md §6.4), or a student's
// piece could be sent to an AI provider beside a code it identifies.
test('typed title and author are on the clean-up scrub list', () => {
  let r = createRoom({ event: ev('pro'), profile: prof(), entries: [{ code: 'A12' }], now: 1 });
  r = updateEntry(r, r.entries[0].id, (e) => setPieceField(setPieceField(e, 'title', 'Night Bus'), 'author', 'Sam Okafor'), 2);
  const values = scrubMap(r).map((s) => s.value);
  assert.ok(values.includes('Night Bus') && values.includes('Sam Okafor'));
});

// Why: Duo is ONE entry with two performers (MODELS.md §3); if the pair split into two rows the judge would have to
// give two ranks and write two comments for one performance, and the tab room would reject the ballot.
test('a Duo pasted with two names is one row, one rank and one comment, showing both names', () => {
  const parsed = parseRoom('1. A12 Ava Moreno and Ben Li\n2. B07 Cy Park & Di Ross\n3. C33');
  let r = createRoom({ event: ev('duo'), profile: prof(), entries: parsed.entries, now: 1 });
  assert.equal(r.entries.length, 3);
  assert.equal(r.entries[0].name, 'Ava Moreno & Ben Li');
  const roster = rosterHtml(r, null);
  assert.equal((roster.match(/class="roster-row/g) || []).length, 3, 'one roster row per Duo');
  assert.match(roster, /<span class="row-name">Ava Moreno &amp; Ben Li<\/span>/);
  r = openBoard(r, 2).room;
  const ids = r.entries.map((e) => e.id);
  r = withRanks(r, { [ids[0]]: '1', [ids[1]]: '2', [ids[2]]: '3' }, 3);
  r = updateEntry(r, ids[0], (e) => setNotes(e, 'Great partnership.'), 4);
  assert.equal(ranksBlock(r).rows.length, 3, 'one rank line per Duo');
  const list = cards(r, 'speaking');
  assert.equal(list.length, 3, 'one comment card per Duo');
  assert.match(commentsStageHtml(r, { order: 'speaking', editing: null }), /Ava Moreno &amp; Ben Li/);
});

// Why: the judge fixes or adds the two performers in the room; each box must change only its own performer, or typing
// the second name would wipe the first and the card would show the wrong pair.
test('the two performer boxes edit one name field; a solo event shows no performer boxes', () => {
  const duo = ev('duo');
  let e = createRoom({ event: duo, profile: prof(), entries: [{ code: 'A12' }], now: 1 }).entries[0];
  e = setPieceField(e, 'name1', 'Ava Moreno');
  e = setPieceField(e, 'name2', 'Ben Li');
  assert.equal(e.name, 'Ava Moreno & Ben Li');
  assert.deepEqual(pairNames(setPieceField(e, 'name1', 'Ava M.').name), ['Ava M.', 'Ben Li']);
  assert.equal(setPieceField(e, 'title', ''), e, 'no change gives the same entry, so nothing is saved');
  const html = pieceHtml(e, duo);
  assert.match(html, /Performer 1/); assert.match(html, /value="Ben Li"/); assert.match(html, /id="piece-title"/);
  const di = pieceHtml(e, ev('di'));
  assert.doesNotMatch(di, /Performer/); assert.match(di, /id="piece-author"/);
  assert.equal(pieceHtml(e, ev('oo')), '', 'public address has no piece fields');
  assert.equal(pieceHtml(Object.assign({}, e, { status: 'noShow' }), duo), '', 'a no show has no piece fields');
});

// Why: a solo event must keep the pasted name as written; joining "and" there would change a real name such as
// "Smith and Sons" into something the judge never typed.
test('entryName joins partners only for a pair event; pieceLine words each part', () => {
  assert.equal(entryName({ name: 'Ava and Ben' }, ev('di')), 'Ava and Ben');
  assert.equal(entryName({ name: 'Ava and Ben', names: ['Ava', 'Ben'] }, ev('duo')), 'Ava & Ben');
  assert.equal(joinPair('', 'Ben'), 'Ben');
  assert.equal(pieceLine({ title: 'X' }), '“X”');
  assert.equal(pieceLine({ author: 'Y' }), 'by Y');
  assert.equal(pieceLine({}), '');
});
