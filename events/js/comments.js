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

// The text that goes on the ballot for one entry.
export const ballotComment = (entry) => (entry && typeof entry.comment === 'string' ? entry.comment : (entry && entry.notes) || '');

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

// A rule check tap: OK → Flag adds the flag line to the private note; Flag → OK takes that line out again.
export function toggleCheck(entry, checkId) {
  const checks = Object.assign({}, entry.checks || {});
  const line = flagLine(checkId);
  const lines = String(entry.privateNote || '').split('\n').filter((l) => l !== '');
  if (checks[checkId] === 'flag') {
    delete checks[checkId];
    return Object.assign({}, entry, { checks, privateNote: lines.filter((l) => l !== line).join('\n') });
  }
  checks[checkId] = 'flag';
  return Object.assign({}, entry, { checks, privateNote: lines.concat(lines.includes(line) ? [] : [line]).join('\n') });
}

// The judge's typing (autosave on every change; no Save button, DESIGN.md §4.3).
export const setNotes = (entry, text) => Object.assign({}, entry, { notes: String(text) });
export const setPrivateNote = (entry, text) => Object.assign({}, entry, { privateNote: String(text) });

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).comments = Object.freeze({
  CHECK_LABELS, checkLabel, flagLine, KINDS, KIND_TITLE, tagKey, ballotComment, insertSentence, removeSentence, tapChip,
  toggleCheck, setNotes, setPrivateNote,
});
