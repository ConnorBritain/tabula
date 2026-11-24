// Speech Events step E10 (docs/events/LANDING.md §4.1; MODELS.md §4.2, family F2: USX, IX, COM, MX): the drawn
// question on each entry. Pure: no DOM, no storage, no clock.
//
// In an extemp event the speakers draw their question outside the room and arrive one at a time, about 7 minutes apart,
// not always in roster order (EVENTS.md §3). The judge picks any row and starts that speaker (room.js, timer.js need
// nothing new for that); this file adds the question the speaker drew.
//
// entry.question: the question as the judge typed it, or '' / missing. It stays on the device. It is not part of the
// ballot comment (comments.js ballotComment), so an AI clean-up never sends it (cleanup.js sends ballotComment only).
// It shows on the comment sheet, the review card, Copy all and the print sheet.

// The longest question the field keeps (a drawn extemp question is one sentence; this stops a paste of a whole page).
export const QUESTION_MAX = 300;

// Does this event have a drawn question? Limited-prep events with prep outside the room (USX, IX, COM, MX). Impromptu
// (prep in the room, F3) draws a topic, which MODELS.md §4.3 leaves for later.
// On purpose by category: any later limited-prep event with prep outside the room (a league extemp pack) gets the
// field too, as MODELS.md §4.2 lists those events under F2.
export const asksQuestion = (event) => Boolean(event && event.category === 'limitedPrep' && !(event.timing && event.timing.inRoomPrep));

// The question to show: one line, trimmed. A missing field reads as ''.
export const questionOf = (entry) => String((entry && entry.question) || '').replace(/\s+/g, ' ').trim();

// The first words of a line, for a row that has little room (the roster's quote line, design review §2.5): the
// whole text when it fits in max characters, else the words that fit and "…". Pure; it never cuts a word in two
// unless that one word is longer than max.
export function shortText(text, max) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  const n = Math.max(1, Number(max) || 60);
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s,.;:!?-]+$/, '') + '…';
}

// The judge typed in the Question field of the current entry. Line breaks become spaces (it is a one-line field);
// the text is kept as typed otherwise, so the cursor does not jump. Returns the new room (the same room when the value
// did not change or there is no current entry).
export function setQuestion(room, value, now) {
  const text = String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').slice(0, QUESTION_MAX);
  const cur = room && room.current;
  const e = cur && (room.entries || []).find((x) => x.id === cur);
  if (!e || (e.question || '') === text) return room;
  return Object.assign({}, room, { updatedAt: now, entries: room.entries.map((x) => (x.id === cur ? Object.assign({}, x, { question: text }) : x)) });
}

