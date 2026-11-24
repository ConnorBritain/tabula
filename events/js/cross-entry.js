// Speech Events step S4 (docs/events/EXPERIENCE.md §3.1, §8.2): students in two events. Pure: no DOM, no storage.
// A student often has two events in the same round slot and runs from one room to the other. The judge marks the
// entry "Cross-entered: speaks later". It is not a no show: the entry stays on the board and gets a rank, and Next
// speaker comes back to it after the waiting entries (room.js nextWaiting).
//
// Entry.crossEntry: { note, expectedAt? } (expectedAt: a time, when known). Status: 'crossEntered'.
// Not built: reading a Tabroom double-entry mark in parse.js. No Tabroom room paste we have seen shows one (not
// verified that Tabroom gives one), so there is nothing to read yet.
import { entryOf, updateEntry } from './room.js';

export const CROSS_NOTE_MAX = 120;

// Mark an entry cross-entered. Only a waiting entry can be marked: one with time on the clock is speaking or has
// spoken. Returns { room, prev, refused } (prev: the status it had, for Undo).
export function markCrossEntered(room, id, note, now, expectedAt) {
  const e = entryOf(room, id);
  if (!e) return { room, prev: null, refused: 'That entry is not in this room.' };
  if (e.status === 'crossEntered') return { room, prev: null, refused: '' };
  if (e.status !== 'waiting') return { room, prev: null, refused: e.code + ' is not waiting to speak, so it cannot be marked cross-entered.' };
  const crossEntry = { note: String(note || '').trim().slice(0, CROSS_NOTE_MAX) };
  if (Number.isFinite(expectedAt)) crossEntry.expectedAt = expectedAt;
  return { room: updateEntry(room, id, (x) => Object.assign({}, x, { status: 'crossEntered', crossEntry }), now), prev: e.status, refused: '' };
}

// The student is back: the entry waits again and the note goes. status: the status to give back ('waiting').
export function clearCrossEntered(room, id, now, status) {
  const e = entryOf(room, id);
  if (!e || e.status !== 'crossEntered') return room;
  return updateEntry(room, id, (x) => { const n = Object.assign({}, x, { status: status || 'waiting' }); delete n.crossEntry; return n; }, now);
}

// The note line for the stage and the roster ('' when none).
export const crossNote = (e) => (e && e.status === 'crossEntered' && e.crossEntry && e.crossEntry.note ? e.crossEntry.note : '');

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).crossEntry = Object.freeze({ CROSS_NOTE_MAX, markCrossEntered, clearCrossEntered, crossNote });
