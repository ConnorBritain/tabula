// Shared code for Tabula Debate and Tabula Speech Events: the review of an AI
// draft before it goes into a record the judge fills in (a ballot, a comment sheet). Pure: no DOM, no AI call. Generic
// words only (core-words.test.mjs). Loaded as described in core/defs.js.
//
// A record holds values by field path: 'name' or 'group.key' (one level deep). record.touched lists the fields the
// judge typed ("yours": the AI never changes them); record.aiFilled lists the fields the AI wrote.
// A group is { id, label, fields }: one review card. The app gives its groups and says which are long text.

export function fieldValue(record, f) {
  const r = record || {};
  const [a, k] = String(f).split('.');
  return k ? (r[a] || {})[k] : r[a];
}
export const isEmptyValue = (v) => v == null || String(v).trim() === '';
// { field: value } for a list of fields.
const byField = (fields, value) => { const o = {}; for (const f of fields) o[f] = value(f); return o; };

// One state per field: 'yours' (the judge typed it; the AI will not change it), 'empty', or 'ai' (an AI draft, or a
// value the AI may change). For a list of fields: yours if any is yours, else ai if any has a value, else empty.
export function fieldState(record, fields) {
  const r = record || {};
  const one = (f) => ((r.touched || {})[f] ? 'yours' : isEmptyValue(fieldValue(r, f)) ? 'empty' : 'ai');
  const states = [].concat(fields).map(one);
  if (states.includes('yours')) return 'yours';
  return states.includes('ai') ? 'ai' : 'empty';
}

// A deep copy of the record for Undo; later edits never reach the copy.
export function snapshot(record) { return JSON.parse(JSON.stringify(record || {})); }

// Moves fields between the two sets. kind: 'yours' (an edit or an insert), 'ai' (an auto refill), 'free' (unlock).
// Returns a new record; the old one is not changed.
export function markFields(record, fields, kind) {
  const r = snapshot(record);
  r.touched = Object.assign({}, r.touched); r.aiFilled = Object.assign({}, r.aiFilled);
  for (const f of [].concat(fields)) {
    if (kind === 'yours') { r.touched[f] = true; delete r.aiFilled[f]; }
    else if (kind === 'ai') { r.aiFilled[f] = true; delete r.touched[f]; }
    else delete r.touched[f];
  }
  return r;
}

// A word diff for a "Yours" card: same / del / ins runs. Whitespace stays with its word.
export function wordDiff(a, b) {
  const ta = String(a || '').match(/\S+\s*|\s+/g) || [], tb = String(b || '').match(/\S+\s*|\s+/g) || [];
  const n = ta.length, m = tb.length;
  const norm = (t) => t.trim();
  const out = [];
  const push = (op, text) => { const last = out[out.length - 1]; if (last && last.op === op) last.text += text; else out.push({ op, text }); };
  // Very long texts: no word-by-word diff (it would be slow); show the old text removed and the new one added.
  if (n * m > 4000000) { if (n) push('del', ta.join('')); if (m) push('ins', tb.join('')); return out; }
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = norm(ta[i]) === norm(tb[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (norm(ta[i]) === norm(tb[j])) { push('same', tb[j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', ta[i++]);
    else push('ins', tb[j++]);
  }
  while (i < n) push('del', ta[i++]);
  while (j < m) push('ins', tb[j++]);
  return out;
}

// One review card. A "yours" card starts on "Keep mine"; others start on "Insert this". The card remembers the record
// values it was made against (base), so an edit during the review shows. opts:
//   draftValue(f): the AI draft's value for field f, in record form (undefined when the draft has none).
//   isText(group): a long-text group, which must have exactly one field; a "yours" text card gets a word diff of it.
export function reviewCard(record, group, opts) {
  const state = fieldState(record, group.fields);
  const base = byField(group.fields, (f) => fieldValue(record, f) ?? '');
  const after = byField(group.fields, (f) => opts.draftValue(f) ?? '');
  // A card with no AI text has nothing to insert, so it does not start ticked ("empty": the panel shows no choice).
  const empty = group.fields.every((f) => isEmptyValue(after[f]));
  const card = { id: group.id, label: group.label, fields: group.fields.slice(), state, base, after, choice: state === 'yours' || empty ? 'keep' : 'insert', changed: false, empty };
  if (opts.isText && opts.isText(group) && state === 'yours') card.diff = wordDiff(base[group.fields[0]], after[group.fields[0]]);
  return card;
}

// A field the judge changed while the review waits: the card says "Changed since the draft", gets a fresh diff against
// the new text, and goes back to "Keep mine" (the judge's newer text wins until they choose). isText: as above.
export function staleCards(review, record, isText) {
  if (!review) return review;
  const cards = review.cards.map((c) => {
    const now = byField(c.fields, (f) => fieldValue(record, f) ?? '');
    const moved = c.fields.some((f) => String(now[f]) !== String(c.base[f]));
    if (!moved) return c;
    const n = Object.assign({}, c, { base: now, changed: true, state: 'yours', choice: 'keep' });
    if (isText && isText(c)) n.diff = wordDiff(now[c.fields[0]], c.after[c.fields[0]]);
    return n;
  });
  return Object.assign({}, review, { cards });
}

// Does an insert take this card? all = "Accept all": every card that is not on "Keep mine".
const reviewTakes = (c, all) => c.choice !== 'keep' && (all || c.choice !== 'skip');
// The fields an insert writes.
export const insertFields = (review, all) => ((review && review.cards) || []).filter((c) => reviewTakes(c, all)).flatMap((c) => c.fields);

// Insert from the review: the chosen cards' AI text goes into the record and becomes "yours". all = "Accept all"
// (never flips "Keep mine"). skip(card): the fields the app refuses (a Set or a list) (for example points outside the range).
// Returns { record, fields, count } (count = cards that wrote something).
// "Review never overwrites Yours" is checked here too: a field whose value changed since the card was made, or that
// became "yours" after a card that was not, is skipped. Only a card that was already "yours" and that the judge set to
// "Use AI text" may replace the judge's text.
export function applyReview(record, review, all, skip) {
  let r = snapshot(record);
  const fields = [];
  let count = 0;
  for (const c of (review && review.cards) || []) {
    if (!reviewTakes(c, all)) continue;
    const bad = new Set(skip ? skip(c) : []);
    let wrote = false;
    for (const f of c.fields) {
      const v = c.after[f];
      if (bad.has(f) || isEmptyValue(v)) continue;
      if (String(fieldValue(record, f) ?? '') !== String((c.base || {})[f] ?? '')) continue; // changed since the card
      if (c.state !== 'yours' && fieldState(record, f) === 'yours') continue; // became "yours" after the card
      const [a, k] = f.split('.');
      if (k) { r[a] = r[a] || {}; r[a][k] = v; } else r[a] = v;
      fields.push(f); wrote = true;
    }
    if (wrote) count++;
  }
  r = markFields(r, fields, 'yours');
  return { record: r, fields, count };
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).review = Object.freeze({ fieldValue, isEmptyValue, fieldState, snapshot, markFields,
  wordDiff, reviewCard, staleCards, insertFields, applyReview });
