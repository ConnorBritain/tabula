// Speech Events step S4 (docs/events/EXPERIENCE.md §2.4, §8.5): the profile layer. Pure: no DOM, no storage, no clock.
// The profile layer (the old F5, VENN.md §3) never picks a workspace. It changes only the Rank stage and Review:
//
//   profile field             effect                                              read with
//   ranks: 'all'              the Rank board, every entry 1 to N (the v1 rule)    layerOf(p).ranks
//   ranks: 'topN', topN: 3    the board still orders everyone, but only the top   layerOf(p).ranks, .topN
//                             N get a rank on the ballot; the rest "Not in top N"
//   ranks: 'off'              Rank becomes Rate: a rating (and/or rubric) for     layerOf(p).ranks
//                             each entry, no order (rate-screen.js)
//   rubric: [{id,label,min,max}]  a grid of steppers for each entry, on Rank or   layerOf(p).rubric
//                             Rate; scores live on entry.rubric { critId: n }
//   critiqueOnly: true        no Rank stage at all: judge, then review            layerOf(p).critiqueOnly
//   maxEntries: n             the room's entry cap (room.js entryCap)             layerOf(p).maxEntries
//   elim: { cx: true }        the F2 cross-ex phase, in elim rounds only          cross-ex.js cxOn
//
// API for other steps (S5 PCC and later). Every function takes the room's frozen profile copy (room.profile), so a
// round keeps the layer it was judged under. A profile with none of these fields (every v1 profile) gives the v1
// behaviour: ranks 'all', no rubric, Rank stage on, cap 8.
//   layerOf(profile)            -> { ranks, topN, rubric, critiqueOnly, maxEntries }   (always valid values)
//   stagesOf(profile)           -> ['judge', 'rank', 'review'] or ['judge', 'review'] (critiqueOnly)
//   rankStageLabel(profile)     -> 'Rank' | 'Rate' | ''   (the button and title word; '' when there is no Rank stage)
//   ranksShown(profile)         -> true when the ballot carries ranks (not ranks 'off', not critiqueOnly)
//   shownRank(rank, profile)    -> the rank as the ballot shows it ('' below the top N)
//   layerProblems(room)         -> the lines that stop the ranks or ratings from being copied ([] = none)
//   rubric helpers: rubricScores(entry), rubricTotal(entry, rubric), rubricMax(rubric), stepRubric(value, dir, crit),
//                   withRubric(room, id, critId, value, now)
import { checkBoard, ratingScale, ratingError, ratingTies } from './rank.js';
import { boardCtx, ranksOf, ratingsOf, stepRating } from './board.js';
import { entryCap, present } from './room.js';

const RANK_MODES = Object.freeze(['all', 'topN', 'off']);

const asText = (v) => (v == null ? '' : String(v).trim());
const isInt = (n) => Number.isInteger(n);

// The rubric of a profile, cleaned: only rows with a text id and label and whole-number min < max are kept, ids once.
export function rubricOf(profile) {
  const list = profile && Array.isArray(profile.rubric) ? profile.rubric : [];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    if (!c || !asText(c.id) || !asText(c.label) || !isInt(c.min) || !isInt(c.max) || c.min >= c.max || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, label: asText(c.label), min: c.min, max: c.max });
  }
  return out;
}

// The layer of a profile, with every value valid. ranks 'topN' with no valid topN reads as 'all'.
export function layerOf(profile) {
  const p = profile || {};
  let ranks = RANK_MODES.includes(p.ranks) ? p.ranks : 'all';
  const topN = ranks === 'topN' && isInt(p.topN) && p.topN >= 1 ? p.topN : null;
  if (ranks === 'topN' && !topN) ranks = 'all';
  return { ranks, topN, rubric: rubricOf(p), critiqueOnly: p.critiqueOnly === true, maxEntries: entryCap(p) };
}

const STAGES_ALL = Object.freeze(['judge', 'rank', 'review']);
const STAGES_CRITIQUE = Object.freeze(['judge', 'review']);
export const stagesOf = (profile) => (layerOf(profile).critiqueOnly ? STAGES_CRITIQUE : STAGES_ALL);

// Does the ballot carry ranks? The one test for it (ballot.js, review-screen.js and the Rank stage word use it).
export function ranksShown(profile) {
  const l = layerOf(profile);
  return !l.critiqueOnly && l.ranks !== 'off';
}

// The name of the whole-room note (one word everywhere, from the profile; color review §4 repair): "Reason for rank"
// under ranks, "Notes for the room" when the rules turn ranks off.
export const reasonLabel = (profile) => (layerOf(profile).ranks === 'off' ? 'Notes for the room' : 'Reason for rank');

export function rankStageLabel(profile) {
  if (layerOf(profile).critiqueOnly) return '';
  return ranksShown(profile) ? 'Rank' : 'Rate';
}

// The rank as the ballot shows it: under 'topN', a rank past N is '' (the entry is not ranked); under 'off' and
// critiqueOnly there are no ranks at all.
export function shownRank(rank, profile) {
  const l = layerOf(profile);
  const r = asText(rank);
  if (!ranksShown(profile)) return '';
  if (l.ranks === 'topN' && r && Number(r) > l.topN) return '';
  return r;
}
// The words for an entry with no rank on a top-N ballot.
export const notRankedText = (profile) => 'Not in top ' + layerOf(profile).topN;
// The labelled line under rank N on a top-N board of n entries (design review 2026-11-24 §2.8); '' when every entry is
// inside the top N or the profile is not top N.
export function cutLineText(profile, n) {
  const l = layerOf(profile);
  return l.ranks === 'topN' && n > l.topN ? 'Top ' + l.topN + ' get a rank. The rest are not ranked on the ballot.' : '';
}

// ---------- rubric ----------

export const rubricScores = (entry) => (entry && entry.rubric && typeof entry.rubric === 'object' ? entry.rubric : {});
const scoreOk = (v, c) => isInt(Number(v)) && asText(v) !== '' && Number(v) >= c.min && Number(v) <= c.max;
// The sum of the valid scores, or null when no criterion has one.
export function rubricTotal(entry, rubric) {
  const s = rubricScores(entry);
  const ok = rubric.filter((c) => scoreOk(s[c.id], c));
  return ok.length ? ok.reduce((t, c) => t + Number(s[c.id]), 0) : null;
}
export const rubricMax = (rubric) => rubric.reduce((t, c) => t + c.max, 0);

// The − and + steppers: board.js stepRating on the criterion's range in steps of one (an empty box starts 60% of the
// way up, then moves by one inside min..max).
export const stepRubric = (value, dir, crit) => stepRating(asText(value) === '' ? '' : value, dir, { min: crit.min, max: crit.max, step: 1 });

// Write one rubric score back. value: a whole number or '' (clears it).
export function withRubric(room, id, critId, value, now) {
  return Object.assign({}, room, { updatedAt: now, entries: room.entries.map((e) => {
    if (e.id !== id) return e;
    const scores = Object.assign({}, rubricScores(e));
    // A whole number is stored as a number; other typed text is kept as text so rubricError can name it.
    if (asText(value) === '') delete scores[critId]; else scores[critId] = /^-?\d+$/.test(asText(value)) ? Number(value) : asText(value);
    return Object.assign({}, e, { rubric: scores });
  }) });
}

// The error for one rubric box, or '' (empty or fine).
export function rubricError(value, crit) {
  if (asText(value) === '' || scoreOk(value, crit)) return '';
  return 'Use a whole number from ' + crit.min + ' to ' + crit.max + '.';
}

function rubricProblems(room, rubric) {
  const out = [];
  for (const e of present(room)) {
    const s = rubricScores(e);
    const missing = rubric.filter((c) => asText(s[c.id]) === '').map((c) => c.label);
    if (missing.length) out.push('Score ' + e.code + ' on ' + missing.join(', ') + '.');
    for (const c of rubric) { const err = rubricError(s[c.id], c); if (err) out.push(e.code + ', ' + c.label + ': ' + err); }
  }
  return out;
}

// ---------- the checks before copy ----------

// What stops the ranks or ratings from being copied, in plain words ([] = they can be copied).
//   critiqueOnly: nothing (there is nothing to rank).
//   ranks 'off': each entry needs its rating (when the profile has a scale) and every rubric score; ratingNoTies
//                still applies. A profile with neither a scale nor a rubric says so.
//   'all' and 'topN': rank.js checkBoard (the full board), then the rubric scores when there is a rubric.
export function layerProblems(room) {
  const l = layerOf(room.profile);
  if (l.critiqueOnly) return [];
  if (l.ranks !== 'off') return checkBoard({ ranks: ranksOf(room), ratings: ratingsOf(room) }, boardCtx(room)).concat(rubricProblems(room, l.rubric));
  const list = present(room);
  if (!list.length) return ['Add the speakers in this room.'];
  const scale = ratingScale(room.profile);
  if (scale.kind === 'none' && !l.rubric.length) return ['This rules profile turns ranks off but has no rating scale or rubric. Pick other rules for this room.'];
  const out = [];
  if (scale.kind !== 'none') {
    for (const e of list) {
      const v = e.rating == null ? '' : e.rating;
      if (asText(v) === '') out.push('Give ' + e.code + ' a rating.');
      else { const err = ratingError(v, scale); if (err) out.push(e.code + ': ' + err); }
    }
    const ctx = boardCtx(room);
    for (const t of ratingTies(ratingsOf(room), ctx)) out.push(t.ids.map((id) => ctx.labels[id]).join(', ') + ' have the same rating (' + t.rating + '). Each speaker needs a different rating.');
  }
  return out.concat(rubricProblems(room, l.rubric));
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).profileLayer = Object.freeze({
  rubricOf, layerOf, stagesOf, ranksShown, rankStageLabel, reasonLabel, shownRank, notRankedText, rubricScores, rubricTotal, rubricMax,
  stepRubric, withRubric, rubricError, layerProblems,
});
