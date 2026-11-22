// Speech Events paste parser (docs/events/LANDING.md §4.1 step E3, primitive N13 in docs/events/SHARED-VS-NEW.md).
// A judge pastes the room text a tournament site shows (Tabroom.com or SpeechWire). parseRoom turns it into the
// room's entries in speaking order, and the round and event when the text names them.
//
// Rules:
// - Pure: no DOM, no storage, no clock. It runs on the device (DESIGN.md §4.8).
// - No line is dropped in silence. Each non-blank line becomes an entry, a "Check these" item (check), or a
//   heading the parser knows (skipped). The setup screen shows all three.
// - The last fallback is one code per line (PLAN.md risk R5): if the sites change their layout, a list of codes
//   still works.
// - Codes first (ARCHITECTURE.md §6.3): the parser keeps names and piece titles only when the text has them. It
//   does not keep the school: the room record has no school field.
//
// How it loads: the page loads this file with type="module"; Node tests import it. The last line also puts the
// functions on globalThis.TabulaEvents.parse, the same pattern core/*.js uses for globalThis.TabulaCore.

// An entry code: digits with up to 4 letters before them and 1 letter after ("1024", "A12", "AB-104", "12B").
const CODE = /^(?=[A-Za-z0-9-]*\d)[A-Za-z]{0,4}-?\d{1,5}[A-Za-z]?$/;
// Words that open a heading line: the round, room, judge and so on. A heading line never holds an entry.
const HEADING = /^(round|rd\.?|room|rm\.?|flight|section|sect\.?|panel|judge|judges|event|tournament|start|time|date|building|location|prelim(inary|s)?|(double[- ]?|triple[- ]?)?(octa|quarter|semi)?[- ]?finals?|speaker order|speaking order)\b/i;
// The round, from a heading line.
const ROUND_NUM = /\b(?:round|rd\.?)\s*[:#]?\s*(\d{1,2})\b/i;
const ROUND_ELIM = /\b((?:double[- ]?|triple[- ]?)?(?:octa|quarter|semi)?[- ]?finals?)\b/i;
// Column words in a header row, by the field they name.
const COLUMNS = {
  order: ['order', 'spkr', 'spk', 'speaker', 'sp', 'pos', 'position', '#', 'speaker order', 'speaking order'],
  code: ['code', 'entry', 'entry code', 'competitor code'],
  name: ['name', 'names', 'competitor', 'competitors', 'student', 'students', 'performer', 'performers', 'entry name'],
  school: ['school', 'team', 'institution'],
  title: ['title', 'piece', 'selection'],
};
// A late-entry mark the judge or the site adds: "(late add)", "LATE", "Added:".
const LATE_TAG = /\s*[([]\s*(?:late(?: add(?:ed)?)?|added)\s*[)\]]\s*/i;
const LATE_LEAD = /^(?:late|added)\s*[:\-–]\s*/i;
// A speaking-order prefix: "Speaker 1:", "Spkr 2 -", "1.", "1)", "#1", "1st".
const ORDER_WORD = /^(?:speaker|spkr|spk)\.?\s*#?\s*(\d{1,2})\s*[:.)\-–]?\s+/i;
const ORDER_MARK = /^(?:#(\d{1,2})\s*[.):\-–]?\s+|(\d{1,2})(?:\s*[.)]|(?:st|nd|rd|th)\b|\s*[:\-–](?=\s))\s*)/i;
// Partners in a pair event (Duo): "A & B", "A and B", "A / B", "A + B".
const PARTNERS = /\s+(?:&|and|\/|\+)\s+/i;

// Web copy brings non-breaking and zero-width spaces and bullets; make them plain.
const clean = (raw) => raw.replace(/[​-‍﻿]/g, '').replace(/ /g, ' ').replace(/^\s*[•·▪◦*]\s+/, '').replace(/\s+$/, '');
const isCode = (t) => CODE.test(t);
const normCode = (t) => t.toUpperCase();
const tokens = (s) => s.split(/[\s,;]+/).filter(Boolean);
// Cells of a table row copied from a web page: split by tabs, or else by runs of 2+ spaces. Null for plain text.
function cellsOf(line) {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (/\S {2,}\S/.test(line)) return line.split(/ {2,}/).map((c) => c.trim());
  return null;
}
const columnOf = (cell) => Object.keys(COLUMNS).find((f) => COLUMNS[f].includes(cell.toLowerCase().replace(/[.:]$/, '')));

// A header row: every cell is a column word and one of them is the code column. Returns { field: cellIndex }.
function headerMap(line) {
  const cells = cellsOf(line) || tokens(line);
  if (cells.length < 2) return null;
  const map = {};
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    let f = columnOf(cells[i]);
    if (!f) return null;
    // Tabroom can show both "Code" and "Entry": then "Entry" is the name column.
    if (f === 'code' && 'code' in map) f = 'name';
    if (!(f in map)) map[f] = i;
  }
  return 'code' in map ? map : null;
}

// The name part after the code: drop separators, a school in brackets or after a comma or " - ".
function namePart(rest) {
  let s = rest.replace(/^\s*[-–—:|]\s*/, '').trim();
  s = s.replace(/\s*\([^)]*\)\s*$/, '');
  s = s.split(/\s*,\s*|\s+[-–—|]\s+/)[0];
  return s.trim();
}
const splitNames = (name) => (name ? name.split(PARTNERS).map((n) => n.trim()).filter(Boolean) : []);

// Event and round from a heading line. events: [{ id, name, short }] from the event files (optional).
function findEvent(line, events) {
  const low = ' ' + line.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  let best = null;
  for (const e of events) {
    for (const word of [e.name, e.short]) {
      if (!word) continue;
      const w = ' ' + String(word).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
      if (low.includes(w) && (!best || w.length > best.len)) best = { id: e.id, text: e.name, len: w.length };
    }
  }
  if (best) return { id: best.id, text: best.text };
  const m = /^event\s*[:\-–]\s*(.+)$/i.exec(line);
  return m ? { id: null, text: m[1].trim() } : null;
}
function findRound(line) {
  const n = ROUND_NUM.exec(line);
  if (n) return 'Round ' + n[1];
  const e = ROUND_ELIM.exec(line);
  if (!e) return null;
  const w = e[1].toLowerCase().replace(/[- ]+/g, '');
  return w.charAt(0).toUpperCase() + w.slice(1).replace(/finals?$/, 'final');
}

// Take a speaking-order prefix off a line. Returns { order, s } (order is null when there is none).
function stripOrder(body) {
  const m = ORDER_WORD.exec(body) || ORDER_MARK.exec(body);
  if (m) return { order: +(m[1] || m[2]), s: body.slice(m[0].length) };
  // A bare leading number before a code is the speaking order: "1 1024 Ava Moreno", "2\tB07".
  const t = tokens(body);
  if (t.length >= 2 && /^\d{1,2}$/.test(t[0]) && isCode(t[1])) return { order: +t[0], s: body.replace(/^\s*\d{1,2}\s+/, '') };
  return { order: null, s: body };
}

// Read one line with no header map. Returns { code, name, order } or { list, order } or { why, guess }.
function readLine(body) {
  const { order, s } = stripOrder(body);
  const t = tokens(s);
  const codeAt = t.map((x, i) => (isCode(x) ? i : -1)).filter((i) => i >= 0);
  if (!codeAt.length) return { why: 'No entry code found.', guess: '' };
  if (codeAt[0] !== 0) return { why: 'The code is not at the start of the line.', guess: codeAt.length === 1 ? normCode(t[codeAt[0]]) : '' };
  const code = normCode(t[0]);
  const rest = s.replace(/^\s*\S+/, '');
  // A list such as "A12, B07, C31": every token a code, split by commas or semicolons.
  if (codeAt.length === t.length && t.length > 1 && /[,;]/.test(s)) return { list: t.map(normCode), order };
  const name = namePart(rest);
  if (tokens(name).some(isCode)) return { why: 'More than one code on this line.', guess: code };
  return { code, name, order };
}

// Read one table row with a header map.
function readRow(cells, map) {
  const cell = (f) => (f in map && cells[map[f]] != null ? cells[map[f]] : '');
  const raw = cell('code');
  if (!isCode(raw)) {
    const t = tokens(cells.join(' '));
    const found = t.filter(isCode);
    return { why: raw ? 'The code column does not hold a code.' : 'The code column is empty.', guess: found.length === 1 ? normCode(found[0]) : '' };
  }
  const ord = /^#?(\d{1,2})/.exec(cell('order'));
  // The school has its own column here, so a comma in the name cell stays ("Moreno, Ava").
  return { code: normCode(raw), name: cell('name').trim(), title: cell('title').trim(), order: ord ? +ord[1] : null };
}

// Parse pasted room text.
// opts.events: [{ id, name, short }] to name the event (the event files' fields). Optional.
// opts.decided: { [key]: 'skip' | code } the judge's answers to "Check these" items, by item key. Optional.
// Returns {
//   entries: [{ key, line, lineNo, code, name, names, title, late, order }]  in speaking order, order 1..N
//   check:   [{ key, line, lineNo, why, guess }]   lines the judge must sort out
//   skipped: [{ key, line, lineNo }]               headings and lines the judge chose to skip
//   round:   'Round 2' | 'Semifinal' | null
//   event:   { id, text } | null                   id is null when no event file matches
// }
// key is `${lineNo}:${line}`: it stays the same while the judge edits other lines.
export function parseRoom(text, { events = [], decided = {} } = {}) {
  const entries = []; const check = []; const skipped = [];
  const seen = new Set();
  let round = null; let event = null; let map = null;
  const lines = String(text == null ? '' : text).split(/\r\n|\r|\n/);
  const add = (base, code, x, late) => {
    if (seen.has(code)) { check.push({ ...base, why: code + ' is already in the list.', guess: '' }); return; }
    seen.add(code);
    const name = x.name || '';
    entries.push({ ...base, code, name, names: splitNames(name), title: x.title || '', late, order: x.order ?? null });
  };
  lines.forEach((raw, i) => {
    const line = clean(raw).trim();
    if (!line) return;
    const lineNo = i + 1;
    const base = { key: lineNo + ':' + line, line, lineNo };
    const answer = Object.prototype.hasOwnProperty.call(decided, base.key) ? decided[base.key] : null;
    if (answer === 'skip') { skipped.push(base); return; }
    const late = LATE_TAG.test(line) || LATE_LEAD.test(line);
    const body = line.replace(LATE_TAG, ' ').replace(LATE_LEAD, '').trim();
    if (typeof answer === 'string' && answer.trim()) {
      // The judge typed the code: the rest of the line, less the order and the code, is the name.
      const code = normCode(answer.trim());
      const { order, s } = stripOrder(body);
      add(base, code, { name: namePart(tokens(s).filter((t) => normCode(t) !== code).join(' ')), order }, late);
      return;
    }
    const header = headerMap(line);
    if (header) { map = header; skipped.push(base); return; }
    const cells = map && cellsOf(body);
    const r = cells && cells.length >= 2 ? readRow(cells, map) : readLine(body);
    // A heading: it opens with a heading word, or it is not an entry and names a round or an event.
    const evt = r.code || r.list ? null : findEvent(line, events);
    const rnd = r.code || r.list ? null : findRound(line);
    if (HEADING.test(line) || evt || rnd) {
      round = round || findRound(line);
      event = event || evt || findEvent(line, events);
      skipped.push(base);
      return;
    }
    if (r.list) { r.list.forEach((code, j) => add({ ...base, key: base.key + '#' + j }, code, { order: null }, late)); return; }
    // A line with no code above the first entry is the page title (the tournament name and so on).
    if (!r.code && !r.guess && !entries.length && !check.length) { skipped.push(base); return; }
    if (!r.code) { check.push({ ...base, why: r.why, guess: r.guess }); return; }
    add(base, r.code, r, late);
  });
  // Speaking order: the numbers in the text when every entry has one and none repeats; else the text's order.
  const nums = entries.map((e) => e.order);
  const useNums = nums.length > 0 && nums.every((n) => n != null) && new Set(nums).size === nums.length;
  const ordered = useNums ? entries.slice().sort((a, b) => a.order - b.order) : entries;
  ordered.forEach((e, i) => { e.order = i + 1; });
  return { entries: ordered, check, skipped, round, event };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).parse = Object.freeze({ parseRoom });
