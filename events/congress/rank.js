// Speech Events step S6 (docs/events/CONGRESS.md §4.3, §5.4): the scorer's top-N rank ("the top-8 helper"). Pure.
// session.ranks is the ranked legislator ids in order, at most profile.topN long. The shared core/ranks.js does the
// slot rules (no ties, a top-N cap); this file adds the Congress rules:
//   - the pool: every present legislator (rankPool 'present', the NSDA default), or only those who spoke or presided
//     (rankPool 'spokeOrPresided', Last Chance);
//   - the pool is sorted by total counted points, then speech count, then chamber order;
//   - NO rank-rating rule: a legislator with fewer points can rank higher ("quality is more important than quantity");
//   - a tie in points between two ranked legislators is a warning, not a block.
import { moveRank } from '../../core/ranks.js';
import { legislatorLines } from './speech.js';
import { poHoursBy } from './po.js';

const fromMap = (map, ids, cap) => {
  const out = [];
  for (let r = 1; r <= cap; r++) { const id = ids.find((x) => map[x] === String(r)); if (id) out[r - 1] = id; }
  return out;
};

// The rank pool: [{ legislator, total, count, average, poHours }] in pool order.
export function rankPool(chamber, session) {
  const po = poHoursBy(session);
  const presided = new Set(session.poTerms.map((t) => t.legislatorId));
  return legislatorLines(chamber, session)
    .map((line, i) => ({ legislator: line.legislator, total: line.total, count: line.count, average: line.average, poHours: po[line.legislator.id] || [], presided: presided.has(line.legislator.id), i }))
    .filter((x) => x.legislator.status === 'present')
    .filter((x) => chamber.profile.rankPool !== 'spokeOrPresided' || x.count > 0 || x.presided)
    .sort((a, b) => b.total - a.total || b.count - a.count || a.i - b.i);
}

const cap = (chamber, pool) => Math.min(chamber.profile.topN || 8, pool.length);

// Tap a legislator in the pool: they take the next empty slot. Tap one who is ranked: their slot clears.
// Returns a new session. A legislator not in the pool, or a full list, changes nothing.
export function toggleRank(chamber, session, legislatorId) {
  const pool = rankPool(chamber, session);
  const ids = pool.map((x) => x.legislator.id);
  if (!ids.includes(legislatorId)) return session;
  const n = cap(chamber, pool);
  const ranks = session.ranks.slice(0, n);
  const at = ranks.indexOf(legislatorId);
  if (at >= 0) { ranks[at] = undefined; return Object.assign({}, session, { ranks: trimEnd(ranks) }); }
  let slot = 0;
  while (slot < n && ranks[slot]) slot++;
  if (slot >= n) return session;
  return placeRank(chamber, session, legislatorId, slot + 1);
}

// Put a legislator in a slot (1..topN). Whoever held it loses it (no ties).
export function placeRank(chamber, session, legislatorId, slot) {
  const pool = rankPool(chamber, session);
  const ids = pool.map((x) => x.legislator.id);
  const n = cap(chamber, pool);
  const current = {};
  session.ranks.slice(0, n).forEach((id, i) => { if (id && ids.includes(id)) current[id] = String(i + 1); });
  const res = moveRank(current, legislatorId, slot, ids, { cap: n });
  if (res.refused) return session;
  return Object.assign({}, session, { ranks: trimEnd(fromMap(res.ranks, ids, n)) });
}

function trimEnd(arr) {
  const out = Array.from(arr, (x) => x || null);
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

// Where the rank stands: { slots: [legislatorId|null] (length topN or the pool size), complete, ties: [[idA, idB]]
// (ranked legislators with the same total points: a warning), gone: [ids ranked who left the pool (absent)] }.
export function rankModel(chamber, session) {
  const pool = rankPool(chamber, session);
  const ids = pool.map((x) => x.legislator.id);
  const n = cap(chamber, pool);
  const slots = Array.from({ length: n }, (_, i) => (session.ranks[i] && ids.includes(session.ranks[i]) ? session.ranks[i] : null));
  const gone = session.ranks.filter((id) => id && !ids.includes(id));
  const totals = new Map(pool.map((x) => [x.legislator.id, x.total]));
  const ties = [];
  const ranked = slots.filter(Boolean);
  // A ranks-only profile has no points, so a points tie means nothing there.
  if (chamber.profile.scale) for (let i = 0; i < ranked.length; i++) for (let j = i + 1; j < ranked.length; j++) if (totals.get(ranked[i]) === totals.get(ranked[j])) ties.push([ranked[i], ranked[j]]);
  return { pool, slots, topN: n, complete: n > 0 && slots.every(Boolean), ties, gone };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressRank = Object.freeze({ rankPool, toggleRank, placeRank, rankModel });
