// Speech Events step E9 (docs/events/LANDING.md §4.1, family F1b interp): the piece an entry performs (title and
// author) and the two performers of a pair event (Duo). Pure: no DOM, no storage.
//
// - Title and author are optional and stay on the device (ARCHITECTURE.md §6.3: "names, piece titles and authors are
//   optional"). The fields show for the events whose rule checks include "Named the title and author" (EVENTS.md §7:
//   DI, HI, DUO, POI, PRO, POE, STO, DEC).
// - A pair event (event.performers 2) is ONE entry with two performers: one roster row, one rank, one comment
//   (MODELS.md §3, F1). The two names live in the entry's one `name` field as "First & Second", so every screen that
//   shows a name, and the clean-up scrub (cleanup.js nameParts splits on "&"), already handles both.

import { PARTNERS } from './parse.js';

const PAIR_JOIN = ' & ';
const str = (s) => String(s == null ? '' : s).trim();

// Does this event ask for the piece's title and author?
export const hasPiece = (event) => Boolean(event && Array.isArray(event.checks) && event.checks.includes('titleAuthor'));
// Is this a pair event (one entry, two performers)?
export const isPair = (event) => Boolean(event && event.performers === 2);

// The two performers' names from one name field: always two strings ('' when not typed).
export function pairNames(name) {
  const parts = str(name).split(PARTNERS).map((p) => p.trim());
  return [parts[0] || '', parts.slice(1).join(PAIR_JOIN)];
}
// One name field from the two performers: "First & Second", or just the one that is typed.
export const joinPair = (a, b) => [str(a), str(b)].filter(Boolean).join(PAIR_JOIN);

// The name an entry gets at setup from a pasted line. pasted: { name, names } from parse.js. A pair event joins the
// partners the same way every time ("Moreno and Li" -> "Moreno & Li"); a solo event keeps the name as pasted.
export function entryName(pasted, event) {
  const p = pasted || {};
  if (!isPair(event)) return str(p.name);
  const names = Array.isArray(p.names) && p.names.length ? p.names : pairNames(p.name);
  return joinPair(names[0], names.slice(1).join(PAIR_JOIN));
}

// The judge types in one piece field. field: 'title' | 'author' | 'name1' | 'name2'. Returns the new entry (the same
// entry when nothing changed, so updateEntry saves nothing).
export function setPieceField(entry, field, value) {
  let key, next;
  if (field === 'title' || field === 'author') { key = field; next = String(value == null ? '' : value); }
  else if (field === 'name1' || field === 'name2') {
    const [a, b] = pairNames(entry.name);
    key = 'name'; next = field === 'name1' ? joinPair(value, b) : joinPair(a, value);
  } else return entry;
  return (entry[key] || '') === next ? entry : Object.assign({}, entry, { [key]: next });
}

// The piece in words for a card or the print sheet: "“Title” by Author", "“Title”", "by Author", or ''.
export function pieceLine(entry) {
  const t = str(entry && entry.title);
  const a = str(entry && entry.author);
  return [t ? '“' + t + '”' : '', a ? 'by ' + a : ''].filter(Boolean).join(' ');
}
