// Speech Events step S4 (docs/events/EXPERIENCE.md §2.5): picking a speaker by number when a room holds more than 8.
// Pure. In a room of 8 or fewer, a number key 1–8 picks that place at once (as since step E4). Past 8, one key cannot
// name place 12, so the judge types the number, then presses Enter: the digits wait in a short buffer.
//
// The keys (keys.js): pick1..pick8, num9, num0 (the digits) and numEnter.

// The digit of a key action, or null.
export function digitOf(action) {
  const m = /^(?:pick([1-8])|num([09]))$/.exec(action || '');
  return m ? Number(m[1] || m[2]) : null;
}

// A digit key. count: the entries in the room. Returns { buf, pick } (pick: a place to pick now, or null).
export function pressDigit(buf, d, count) {
  if (count <= 8) return { buf: '', pick: d >= 1 && d <= count ? d : null };
  const next = (String(buf || '') + d).replace(/^0+/, '').slice(-2);
  return { buf: next, pick: null };
}

// Enter. Returns { buf: '', pick, error } — pick is null with an error in words when the number names no place;
// pick and error are both empty when nothing was typed (Enter keeps its own job then).
export function pressEnter(buf, count) {
  const s = String(buf || '');
  if (!s) return { buf: '', pick: null, error: '' };
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= count) return { buf: '', pick: n, error: '' };
  return { buf: '', pick: null, error: 'No speaker at place ' + s + '. This room has ' + count + '.' };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).numberPick = Object.freeze({ digitOf, pressDigit, pressEnter });
