// Shared code for Tabula Debate and Tabula Speech Events: ranks for any number of
// ids, with no ties. A ranking is { id: rank } with ranks stored as text ('1', '2', ...; '' means no rank yet), as the
// debate ballot stores them. Generic words only (core-words.test.mjs). No DOM. Loaded as described in core/defs.js.
//
// cap: how many ranks there are. rankState reads a missing cap as ids.length (a full ranking: every id gets one, 1 to
// N); pass a smaller number for a top-N ranking (for example the top 8 of a 30-person chamber; the rest stay '').
// moveRank checks the range only when cap is given; with no cap it moves any rank (the debate ballot relies on this).

const asText = (rank) => (rank == null || rank === '' ? '' : String(rank));
const validRank = (r, cap) => /^[1-9][0-9]*$/.test(r) && Number(r) <= cap;

// Give id this rank. If another id has it, that id loses it (no ties). ids: every id in the ranking.
// opts.cap: a rank above it (or above ids.length) is refused and nothing changes; refused is then 'out-of-range', the
// only refusal. Returns { ranks, moved: { rank, from, to } | null, refused? }.
export function moveRank(ranks, id, rank, ids, opts) {
  const out = Object.assign({}, ranks || {});
  const r = asText(rank);
  const cap = opts && Number.isFinite(opts.cap) ? Math.min(opts.cap, (ids || []).length) : Infinity;
  if (r && cap !== Infinity && !validRank(r, cap)) return { ranks: out, moved: null, refused: 'out-of-range' };
  let moved = null;
  if (r) for (const other of ids || []) if (other !== id && asText(out[other]) === r) { out[other] = ''; moved = { rank: r, from: other, to: id }; }
  out[id] = r;
  return { ranks: out, moved };
}

// Where a ranking stands (added in C8 for the rank board and the Congress top 8). opts.cap: as above (ids.length when
// left out).
// Returns { given: how many ids have a rank, missing: [the ranks 1..cap no id has], ties: [ranks held twice],
// outOfRange: [ids with a rank that is not 1..cap], complete: every rank 1..cap given once, nothing else wrong }.
export function rankState(ranks, ids, opts) {
  const list = ids || [];
  const cap = Math.min(opts && Number.isFinite(opts.cap) ? opts.cap : list.length, list.length);
  const r = ranks || {};
  const seen = {};
  const outOfRange = [];
  let given = 0;
  for (const id of list) {
    const v = asText(r[id]);
    if (!v) continue;
    given++;
    if (!validRank(v, cap)) { outOfRange.push(id); continue; }
    seen[v] = (seen[v] || 0) + 1;
  }
  const missing = [];
  for (let i = 1; i <= cap; i++) if (!seen[String(i)]) missing.push(i);
  const ties = Object.keys(seen).filter((k) => seen[k] > 1).map(Number).sort((a, b) => a - b);
  return { given, missing, ties, outOfRange, complete: !missing.length && !ties.length && !outOfRange.length };
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).ranks = Object.freeze({ moveRank, rankState });
