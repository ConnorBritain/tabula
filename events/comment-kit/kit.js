// Comment kit: the rules (pure; Node tests call them). Sentence starters per event family, the performance check, and
// the length note. The data is in starters.json and words.json (built into kit-data.js). The screens are kit-view.js.
//
// Nothing here leaves the device: no AI, no network. The check is a plain word list. It warns and never blocks.
import { STARTERS, WORDS } from './kit-data.js';
import { familyOf } from '../js/data.js';

// The three kinds of starter: the two comment rows and the reason for rank.
export const STARTER_KINDS = Object.freeze(['strength', 'toWork', 'reason']);
export const STARTER_TITLE = Object.freeze({ strength: 'Strength', toWork: 'To work on', reason: 'Sentence starters' });
// (The reason row sits right under its own "Reason for rank" label, so its title does not repeat it.)

// The starter set for an event file (a v1 or v2 def, a Custom event, or a Congress chamber): its key in
// starters.json. The workspace family picks it (data.js familyOf); the F1 family splits into interp and platform.
export function starterSetKey(def) {
  if (!def) return 'general';
  if (def.family === 'congress' || def.category === 'congress') return 'congress';
  let fam = '';
  try { fam = familyOf(def); } catch { fam = ''; }
  if (fam === 'f4') return 'twoRuns';
  if (fam === 'f2' || fam === 'f3') return 'limitedPrep';
  if (fam === 'f1') return def.category === 'interp' ? 'interp' : 'platform';
  return 'general';
}

// The starters of one kind for an event file: a list of strings ([] for an unknown kind).
export function startersFor(def, kind) {
  const set = STARTERS.families[starterSetKey(def)] || STARTERS.families.general;
  return STARTER_KINDS.includes(kind) ? (set[kind] || []).slice() : [];
}

// Put a starter into text at the cursor. It starts a new sentence: a space before it when the text before does not
// end in a space or a line break, and one space after it, so the judge goes on typing. Returns { text, cursor }, the
// cursor right after that space. Nothing else in the text changes.
export function insertStarter(text, starter, cursor) {
  const t = String(text || '');
  const at = Number.isInteger(cursor) && cursor >= 0 && cursor <= t.length ? cursor : t.length;
  const before = t.slice(0, at), after = t.slice(at);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const tail = /^ /.test(after) ? '' : ' ';
  const head = before + lead + starter + tail;
  return { text: head + after, cursor: head.length + (tail ? 0 : 1) };
}

// ---------- Performance check ----------

// Words of a text, lower case, with where each one starts and ends. A curly apostrophe counts as a straight one.
// A hyphen splits words ("high-pitched" is "high pitched").
const WORD = /[a-z0-9]+(?:'[a-z]+)?/g;
function words(text) {
  const t = String(text || '').toLowerCase().replace(/[‘’ʼ]/g, "'");
  return [...t.matchAll(WORD)].map((m) => ({ w: m[0], start: m.index, end: m.index + m[0].length }));
}
// The sentences of a text as word lists: a . ! ? ; or a line break ends one.
function sentences(text) {
  const t = String(text || '');
  const out = [];
  let from = 0;
  for (const m of t.matchAll(/[.!?;\n]+/g)) { out.push([from, m.index]); from = m.index + m[0].length; }
  out.push([from, t.length]);
  return out.map(([a, b]) => words(t.slice(a, b)).map((x) => ({ w: x.w, start: x.start + a, end: x.end + a }))).filter((s) => s.length);
}

// The word list, made ready once: each term as its words, with its category.
function prepare(data) {
  const role = new Set(data.roleWords || []);
  const terms = [];
  for (const c of data.categories) {
    for (const raw of c.terms) {
      const o = typeof raw === 'string' ? { t: raw } : raw;
      terms.push({ category: c.id, roleSafe: Boolean(c.roleSafe), term: o.t, seq: words(o.t).map((x) => x.w), unlessPrev: new Set(o.unlessPrev || []), unlessNext: new Set(o.unlessNext || []) });
    }
  }
  return { role, terms };
}
const LIST = prepare(WORDS);
export const CHECK_CATEGORIES = Object.freeze(WORDS.categories.map((c) => c.id));

// The hits of the performance check in a text: [{ category, term, start, end }], in text order, one per place.
// data: the word list (words.json shape); the shipped list when left out.
export function checkComment(text, data) {
  const list = data ? prepare(data) : LIST;
  const t = String(text || '');
  const hits = [];
  for (const s of sentences(t)) {
    const hasRole = s.some((x) => list.role.has(x.w));
    for (const term of list.terms) {
      if (term.roleSafe && hasRole) continue;
      const n = term.seq.length;
      for (let i = 0; i + n <= s.length; i++) {
        let ok = true;
        for (let k = 0; k < n && ok; k++) ok = s[i + k].w === term.seq[k];
        if (!ok) continue;
        if (i > 0 && term.unlessPrev.has(s[i - 1].w)) continue;
        if (i + n < s.length && term.unlessNext.has(s[i + n].w)) continue;
        hits.push({ category: term.category, term: term.term, start: s[i].start, end: s[i + n - 1].end });
      }
    }
  }
  // One hit per place: a longer term that covers a shorter one wins ("whiny voice" over "whiny").
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const h of hits) if (!out.length || h.start >= out[out.length - 1].end) out.push(h);
  return out;
}

// The hits the judge has not seen yet while typing: a hit that ends at the very end of the text may be a word still
// being typed ("bad" on the way to "badge"), so it waits for the next space or mark. done: the judge left the box.
export function settledHits(text, done) {
  const t = String(text || '');
  return checkComment(t).filter((h) => done || h.end < t.length);
}

// The words of the hits as the judge wrote them, once each, in text order ("boring", "your outfit").
export function hitWords(text, hits) {
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    const w = String(text).slice(h.start, h.end);
    const k = w.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(w); }
  }
  return out;
}

// A key for a set of hits, so "Keep" hides the note until a new word comes up. Lower case terms, sorted.
export const hitKeys = (hits) => [...new Set(hits.map((h) => h.term.toLowerCase()))].sort();

// The note's words (plain, grade 6). The judge-facing text lives here, so a test can read it.
export const NOTE_TEXT = 'Is this about the performance? Comments about how a student looks or who they are can hurt.';
export const NOTE_HELP = 'Edit or keep.';

// ---------- Length note ----------

// From this many characters, a quiet count shows under the box. There is no limit: no limit is known for the online
// ballot boxes, so the count only informs.
export const LONG_AT = 500;
export const lengthNote = (text) => { const n = String(text || '').length; return n >= LONG_AT ? n.toLocaleString('en-US') + ' characters' : ''; };
