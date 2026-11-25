// Speech Events step E6 (docs/events/LANDING.md §4.1): the comment sheet rules (primitives N10, N11). Pure.
//
// What each field is (ARCHITECTURE.md §6.3):
//   entry.notes        the judge's words for the student, as typed. Strength and To-work-on chips put a sentence in here.
//   entry.comment      null until the judge edits the ballot text on the Review screen (step E8); then that text.
//   entry.privateNote  the judge's own memory ("blue jacket"). Never on the ballot.
//   entry.checks       { checkId: 'flag' } for each rule check the judge flagged. A flag adds a line to the private
//                      note, never to the student comment (EVENTS.md §7).
//   entry.tags         ['strength:thesis', 'toWork:evidence', ...] the chips the judge tapped.
//   room.reasonForRank the reason for rank, for the whole room.
// The text that goes on the ballot is ballotComment(entry): the comment, or the notes. Nothing else ever reaches it.

// The plain label of each rule check (EVENTS.md §7). An event file lists the ids it uses.
export const CHECK_LABELS = Object.freeze({
  titleAuthor: 'Named the title and author',
  noProps: 'No props or costume',
  noVisualAids: 'No visual aids',
  aidsOk: 'Aids within the rules',
  manuscript: 'Read from the binder',
  memorized: 'Spoke from memory',
  noNotes: 'No notes',
  quoteLimit: 'Quoting looked within the limit',
  answeredQuestion: 'Answered the question drawn',
  offStageFocus: 'Off-stage focus',
  seated: 'Delivered seated',
  noAiText: 'No sign of AI-written text',
});
export const checkLabel = (id) => CHECK_LABELS[id] || id;
// The private-note line a flag adds.
export const flagLine = (id) => 'Flag: ' + checkLabel(id);

export const KINDS = Object.freeze(['strength', 'toWork']);
export const KIND_TITLE = Object.freeze({ strength: 'Strengths', toWork: 'To work on' });
export const tagKey = (kind, tagId) => kind + ':' + tagId;

// The text that goes on the ballot for one entry: the comment when it has words, else the notes. One rule for the
// whole app: the Review screen, the copy text and the AI clean-up (cleanup.js sourceText) all read it. A blank
// comment falls back to the notes, so an emptied Review box never sends an empty ballot by accident.
export function ballotComment(entry) {
  const e = entry || {};
  const c = String(e.comment || '');
  return c.trim() ? c : String(e.notes || '');
}

// The first sentence of a comment, for one quiet line on a list row (the Rank board, the room roster; design review
// 2026-11-24 §2.8): up to the first . ! or ? that ends a sentence, or the first line break; cut at max characters on a
// word with "…". '' when the text is blank. One helper, so the screens never cut the text two ways.
const ABBREV = /(?:^|\s)(?:mr|mrs|ms|dr|st|vs|etc|e\.g|i\.e)\.$/i;
export function firstSentence(text, max = 90) {
  const t = String(text || '').trim();
  if (!t) return '';
  const line = t.split(/\n/)[0].trim();
  let end = line.length;
  for (const m of line.matchAll(/[.!?](?=\s|$)/g)) {
    // "Dr. Lee" and "vs. the" do not end a sentence.
    if (m[0] === '.' && ABBREV.test(line.slice(0, m.index + 1))) continue;
    end = m.index + 1;
    break;
  }
  const s = line.slice(0, end).trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, '') + '…';
}

// Put a sentence into text at the cursor, as its own sentence: a space before it when the text before does not end
// in a space or a line break, and a space after it when text follows. Returns { text, cursor } (cursor after it).
export function insertSentence(text, sentence, cursor) {
  const t = String(text || '');
  const at = Number.isInteger(cursor) && cursor >= 0 && cursor <= t.length ? cursor : t.length;
  const before = t.slice(0, at), after = t.slice(at);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const tail = after && !/^\s/.test(after) ? ' ' : '';
  const out = before + lead + sentence + tail + after;
  return { text: out, cursor: (before + lead + sentence).length };
}
// Take a sentence back out (when the judge taps a chip again), only when the text still holds it unchanged; the
// space it added goes too. Returns the text (unchanged when the sentence is not there).
export function removeSentence(text, sentence) {
  const t = String(text || '');
  const i = t.lastIndexOf(sentence);
  if (!sentence || i < 0) return t;
  let a = i, b = i + sentence.length;
  if (t[b] === ' ') b++; else if (a > 0 && t[a - 1] === ' ') a--;
  return t.slice(0, a) + t.slice(b);
}

// A chip tap. tag: the event file's tag ({ id, label, strength, toWork }); kind: 'strength' | 'toWork'.
// Off → on: the sentence goes in at the cursor and the chip is marked. On → off: the mark goes, and the sentence goes
// too if the judge has not changed it. Returns { entry, cursor, on }.
export function tapChip(entry, tag, kind, cursor) {
  const key = tagKey(kind, tag.id);
  const sentence = tag[kind];
  const tags = entry.tags || [];
  if (tags.includes(key)) {
    const notes = removeSentence(entry.notes, sentence);
    return { entry: Object.assign({}, entry, { tags: tags.filter((k) => k !== key), notes }), cursor: notes.length, on: false };
  }
  const ins = insertSentence(entry.notes, sentence, cursor);
  return { entry: Object.assign({}, entry, { tags: tags.concat([key]), notes: ins.text }), cursor: ins.cursor, on: true };
}

// A rule check tap: OK → Flag adds the flag line to the private note; Flag → OK takes that one line out again.
// Every other line the judge typed (blank lines too) stays as it was.
export function toggleCheck(entry, checkId) {
  const checks = Object.assign({}, entry.checks || {});
  const line = flagLine(checkId);
  const text = String(entry.privateNote || '');
  const lines = text === '' ? [] : text.split('\n');
  if (checks[checkId] === 'flag') {
    delete checks[checkId];
    const i = lines.lastIndexOf(line);
    if (i >= 0) lines.splice(i, 1);
    return Object.assign({}, entry, { checks, privateNote: lines.join('\n') });
  }
  checks[checkId] = 'flag';
  if (!lines.includes(line)) lines.push(line);
  return Object.assign({}, entry, { checks, privateNote: lines.join('\n') });
}

// The judge's typing (autosave on every change; no Save button, DESIGN.md §4.3).
export const setNotes = (entry, text) => Object.assign({}, entry, { notes: String(text) });
export const setPrivateNote = (entry, text) => Object.assign({}, entry, { privateNote: String(text) });
export const setReason = (room, text, now) => Object.assign({}, room, { reasonForRank: String(text), updatedAt: now });

// One keystroke in the sheet, as the room to save. field: 'notes' | 'private' (the current entry) or 'reason' (the
// room). Unknown fields change nothing.
export function applyInput(room, field, value, now) {
  if (field === 'reason') return setReason(room, value, now);
  if (field !== 'notes' && field !== 'private') return room;
  return Object.assign({}, room, { updatedAt: now, entries: room.entries.map((e) => (e.id !== room.current ? e : field === 'notes' ? setNotes(e, value) : setPrivateNote(e, value))) });
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).comments = Object.freeze({
  CHECK_LABELS, checkLabel, flagLine, KINDS, KIND_TITLE, tagKey, ballotComment, firstSentence, insertSentence, removeSentence, tapChip,
  toggleCheck, setNotes, setPrivateNote, setReason, applyInput,
});
