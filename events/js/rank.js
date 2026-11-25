// Speech Events step E7, pure part (docs/events/LANDING.md §4.1): the rules behind the rank board (primitives N8 and
// N3) and ratings (N9). No DOM: the rank screen calls these functions and draws the result.
//
// The board state is a ranking in the core/ranks.js form: { id: '1' | '2' | ... | '' } (ranks as text, '' = no rank
// yet). Ranks always run 1 to N, N = the number of entries in the room (ARCHITECTURE.md §6.2), with no ties.
// Ratings are { id: value }: a number (or number text) for a points range, the word itself for a word scale.
//
// ctx, passed to most functions:
//   ids:       every entry id in the room, in speaking order (required).
//   profile:   the room's rules profile (events/profiles/*.json): rating, ratingNoTies, rankRatingRule, overtime.
//   overGrace: { id: true } for each entry whose run went past grace. The timer (E5) keeps this flag with
//              core/clock.js stickyOver and stores it; this file only reads it.
//   labels:    { id: 'A12' }, the name to show in messages (the id when left out).
//
// Messages are plain words for a lay judge (DESIGN.md §4.5, §4.6). Nothing moves silently: a refused move returns the
// board unchanged with a message that says why.

import { moveRank, rankState } from '../../core/ranks.js';
import { pointsRange, rangeError } from '../../core/points.js';

// The range used when a profile's points range is not valid (pointsRange needs a fallback). It is the range of the
// NSDA-style invitational profile (events/profiles/nsda-invitational.v1.json), the only points profile in v1.
export const POINTS_FALLBACK = Object.freeze({ min: 70, max: 100, step: 1 });

// What the tab room's note says under flagOnly (EVENTS.md §5.1, "What the app does").
export const FLAG_ONLY_NOTE = 'Your tab room applies the time penalty. Rank on performance.';
// The pill on an over-grace row, in words (DESIGN.md §4.5).
export const OVER_GRACE_PILL = 'Over grace';
// The row text when the rank-rating rule is broken (DESIGN.md §4.6).
export const RANK_RATING_ROW = 'Rating is higher than a better-ranked speaker';

const asText = (v) => (v == null ? '' : String(v).trim());
const toNum = (v) => (asText(v) === '' ? NaN : Number(v));
const labelOf = (ctx, id) => (ctx && ctx.labels && ctx.labels[id]) || id;
const isOver = (ctx, id) => Boolean(ctx && ctx.overGrace && ctx.overGrace[id]);
const idsOf = (ctx) => (ctx && ctx.ids) || [];
const rangeMessage = (ctx) => 'Ranks run 1 to ' + idsOf(ctx).length + '.';

// ---------- overtime (N3: overtime.effect) ----------

// The profile's overtime effect: 'noFirst', 'flagOnly' or 'none'.
// - A profile with no overtime effect gets 'noFirst', the default in ARCHITECTURE.md §6.2.
// - 'none' turns the rule off. Any other value (a later league effect such as 'dropRanks', P3) is not enforced and
//   shows no note, because the app enforces a time rule only when the judge applies it (EVENTS.md §5.1).
// The over-grace pill shows under every effect: the app always records the flag.
export function overtimeEffect(profile) {
  const e = profile && profile.overtime && profile.overtime.effect;
  if (e == null || e === '') return 'noFirst';
  return e === 'noFirst' || e === 'flagOnly' ? e : 'none';
}

// The message when the judge tries to put an over-grace entry at rank 1 under noFirst (DESIGN.md §4.5).
export const noFirstMessage = (label) => label + " went over grace, so it can't be ranked 1st. Clear the over-grace flag on the timer if the time was wrong.";

// The rule as a place on the Rank board (design review 2026-11-24 §2.8, top 10 #6): the line under rank 1 while a
// speaker is over grace under noFirst; '' when it does not apply. ctx: board.js boardCtx.
export function graceLineText(ctx) {
  const over = ctx && ctx.overGrace ? idsOf(ctx).some((id) => isOver(ctx, id)) : false;
  return over && overtimeEffect(ctx.profile) === 'noFirst' ? 'Rank 1 needs a speaker inside grace.' : '';
}

// What the row shows for one entry: { pill: 'Over grace' or '', note: text or '' }.
// noFirst: the pill and the rule. flagOnly: the pill and the tab-room note. none: the pill only.
export function overtimeRow(id, ctx) {
  if (!isOver(ctx, id)) return { pill: '', note: '' };
  const effect = overtimeEffect(ctx.profile);
  const note = effect === 'flagOnly' ? FLAG_ONLY_NOTE : effect === 'noFirst' ? "Can't be ranked 1st." : '';
  return { pill: OVER_GRACE_PILL, note };
}

// The id that a move would newly put at rank 1 although it went over grace (noFirst only), or null. An entry already
// at rank 1 before the move (for example the first speaker, from the start order) does not block other moves: the
// judge must still be able to move the rest, and checkBoard reports it until it moves.
function blockedFirst(before, after, ctx) {
  if (overtimeEffect(ctx.profile) !== 'noFirst') return null;
  for (const id of idsOf(ctx)) if (asText(after[id]) === '1' && asText(before[id]) !== '1' && isOver(ctx, id)) return id;
  return null;
}

// ---------- the rank board (N8) ----------

// The start ranks: the speaking order, 1 to N (DESIGN.md §4.5).
export function startRanks(ctx) {
  const out = {};
  idsOf(ctx).forEach((id, i) => { out[id] = String(i + 1); });
  return out;
}

// The ids in rank order. Entries with no rank (or a rank that is not 1 to N) come last, in speaking order.
export function orderOf(ranks, ctx) {
  const ids = idsOf(ctx);
  const n = ids.length;
  const r = ranks || {};
  const rankOf = (id) => { const v = toNum(r[id]); return Number.isInteger(v) && v >= 1 && v <= n ? v : Infinity; };
  return ids.map((id, i) => ({ id, i, k: rankOf(id) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.id);
}

// Drag, or the up and down buttons: put id at rank `to`; the entries in between shift by one, so a tie cannot happen.
// core/ranks.js moveRank cannot do this: it takes the rank from the entry that held it and leaves that entry with no
// rank, which suits tapRank but not a list. So the shift is built here, and rankState checks the board first.
// The board must be full (every entry 1 to N once, as startRanks gives). A partly ranked board (in the middle of
// "tap in order") is refused with 'not-full', because a shift would give the unranked entries ranks silently.
// Returns { ranks, moved: { id, from, to } | null, refused?: 'out-of-range' | 'not-full' | 'over-grace-first',
// message? }. A refused move returns the board unchanged.
export function moveTo(ranks, id, to, ctx) {
  const ids = idsOf(ctx);
  const before = Object.assign({}, ranks || {});
  const t = toNum(to);
  if (!ids.includes(id) || !Number.isInteger(t) || t < 1 || t > ids.length) {
    return { ranks: before, moved: null, refused: 'out-of-range', message: rangeMessage(ctx) };
  }
  if (!rankState(before, ids).complete) {
    return { ranks: before, moved: null, refused: 'not-full', message: 'Give every speaker a rank first, then move them.' };
  }
  const order = orderOf(before, ctx).filter((x) => x !== id);
  order.splice(t - 1, 0, id);
  const after = {};
  order.forEach((x, i) => { after[x] = String(i + 1); });
  const blocked = blockedFirst(before, after, ctx);
  if (blocked) return { ranks: before, moved: null, refused: 'over-grace-first', message: noFirstMessage(labelOf(ctx, blocked)) };
  const from = asText(before[id]);
  return { ranks: after, moved: from === String(t) ? null : { id, from, to: String(t) } };
}

// "Up" (toward rank 1) and "Down" by one place. At the top or bottom nothing moves (refused 'out-of-range').
export function moveUp(ranks, id, ctx) { return moveTo(ranks, id, orderOf(ranks, ctx).indexOf(id), ctx); }
export function moveDown(ranks, id, ctx) { return moveTo(ranks, id, orderOf(ranks, ctx).indexOf(id) + 2, ctx); }

// Tap a rank (and "tap in order" mode): give id this rank with core/ranks.js moveRank. An entry that had the rank
// loses it (no ties). '' clears id's rank.
// Returns moveRank's result plus refused 'over-grace-first' and a message when refused.
export function tapRank(ranks, id, rank, ctx) {
  const ids = idsOf(ctx);
  const before = Object.assign({}, ranks || {});
  const r = asText(rank);
  if (r === '1' && asText(before[id]) !== '1' && overtimeEffect(ctx.profile) === 'noFirst' && isOver(ctx, id)) {
    return { ranks: before, moved: null, refused: 'over-grace-first', message: noFirstMessage(labelOf(ctx, id)) };
  }
  const res = moveRank(before, id, r, ids, { cap: ids.length });
  return res.refused ? Object.assign(res, { message: rangeMessage(ctx) }) : res;
}

// "Tap in order" mode: the rank the next tap gives (the lowest rank no entry has), or null when all are given.
export function nextRank(ranks, ctx) {
  const missing = rankState(ranks, idsOf(ctx)).missing;
  return missing.length ? String(missing[0]) : null;
}

// ---------- ratings (N9) ----------

// The profile's rating scale:
//   { kind: 'none' }
//   { kind: 'points', min, max, step, fellBack } — min and max through core/points.js pointsRange; fellBack is true
//     when the profile's range was not valid and POINTS_FALLBACK is used instead. step: the profile's step (> 0), else 1.
//   { kind: 'words', words: [best first, in the tournament's own order] }
export function ratingScale(profile) {
  const r = profile && profile.rating;
  if (r && typeof r === 'object' && Array.isArray(r.words)) {
    const words = r.words.map(asText).filter(Boolean);
    if (words.length >= 2 && new Set(words).size === words.length) return { kind: 'words', words };
    return { kind: 'none', bad: true };
  }
  if (r && typeof r === 'object') {
    const range = pointsRange(r, POINTS_FALLBACK);
    const fellBack = range.min !== Number(r.min) || range.max !== Number(r.max);
    const step = !fellBack && Number(r.step) > 0 ? Number(r.step) : POINTS_FALLBACK.step;
    return { kind: 'points', min: range.min, max: range.max, step, fellBack };
  }
  return { kind: 'none' };
}

// The error for a points range the judge types in room settings (Custom profile), or ''. It is core/points.js
// rangeError, given here so the rank screen gets every rating rule from this one module.
export const customRangeError = rangeError;

// How good a rating is, as a number (higher is better), or NaN when it is empty or not on the scale.
// Points: the number. Words: best word = words.length, worst = 1.
export function ratingValue(value, scale) {
  if (!scale || scale.kind === 'none') return NaN;
  if (scale.kind === 'words') { const i = scale.words.indexOf(asText(value)); return i < 0 ? NaN : scale.words.length - i; }
  const v = toNum(value);
  if (Number.isNaN(v) || v < scale.min || v > scale.max) return NaN;
  const k = (v - scale.min) / scale.step;
  return Math.abs(k - Math.round(k)) < 1e-9 ? v : NaN;
}

// The inline error for one rating, or '' when it is fine or empty (an empty rating is checkBoard's job).
export function ratingError(value, scale) {
  if (!scale || scale.kind === 'none' || asText(value) === '') return '';
  if (!Number.isNaN(ratingValue(value, scale))) return '';
  if (scale.kind === 'words') return 'Pick one of: ' + scale.words.join(', ') + '.';
  const v = toNum(value);
  if (Number.isNaN(v)) return 'Type a number from ' + scale.min + ' to ' + scale.max + '.';
  if (v < scale.min || v > scale.max) return 'Use a number from ' + scale.min + ' to ' + scale.max + '.';
  return 'Use steps of ' + scale.step + ' from ' + scale.min + '.';
}

// Ties among ratings when the profile's ratingNoTies is on: [{ rating, ids }] for each rating more than one entry has.
export function ratingTies(ratings, ctx) {
  const scale = ratingScale(ctx.profile);
  if (scale.kind === 'none' || !(ctx.profile && ctx.profile.ratingNoTies)) return [];
  const by = new Map();
  for (const id of idsOf(ctx)) {
    const v = ratingValue((ratings || {})[id], scale);
    if (Number.isNaN(v)) continue;
    if (!by.has(v)) by.set(v, []);
    by.get(v).push(id);
  }
  // The rating is shown in one spelling (95, not '95.0'; the word itself on a word scale).
  const show = (v) => (scale.kind === 'words' ? scale.words[scale.words.length - v] : String(v));
  return [...by.entries()].filter(([, list]) => list.length > 1).map(([v, list]) => ({ rating: show(v), ids: list }));
}

// Breaks of the rank-rating rule (a better rank never has a lower rating) when the profile's rankRatingRule is on:
// [{ id, above }], one per pair, where id ranks below `above` but has a higher rating. The rank screen marks id's
// row with RANK_RATING_ROW (DESIGN.md §4.6). Entries with no valid rank or rating are skipped.
export function rankRatingConflicts(ranks, ratings, ctx) {
  const scale = ratingScale(ctx.profile);
  if (scale.kind === 'none' || !(ctx.profile && ctx.profile.rankRatingRule)) return [];
  const ids = idsOf(ctx);
  const n = ids.length;
  const rows = ids.map((id) => ({ id, k: toNum((ranks || {})[id]), v: ratingValue((ratings || {})[id], scale) }))
    .filter((x) => Number.isInteger(x.k) && x.k >= 1 && x.k <= n && !Number.isNaN(x.v));
  const out = [];
  for (const a of rows) for (const b of rows) if (a.k < b.k && a.v < b.v) out.push({ id: b.id, above: a.id });
  return out.sort((x, y) => toNum(ranks[x.id]) - toNum(ranks[y.id]) || toNum(ranks[x.above]) - toNum(ranks[y.above]));
}

// The "Fix" button on a row that breaks the rank-rating rule: the highest rating id can have without beating any
// better-ranked entry (one step lower when ratingNoTies is on), as a value to store; or null when no rating on the
// scale fits (the judge must then change a rank or another rating).
export function ratingFix(id, ranks, ratings, ctx) {
  const scale = ratingScale(ctx.profile);
  if (scale.kind === 'none') return null;
  const k = toNum((ranks || {})[id]);
  let cap = Infinity;
  for (const other of idsOf(ctx)) {
    const ko = toNum((ranks || {})[other]);
    const vo = ratingValue((ratings || {})[other], scale);
    if (other !== id && Number.isInteger(ko) && ko < k && !Number.isNaN(vo)) cap = Math.min(cap, vo);
  }
  if (cap === Infinity) return null;
  const noTies = Boolean(ctx.profile && ctx.profile.ratingNoTies);
  if (scale.kind === 'words') {
    const v = noTies ? cap - 1 : cap;
    return v >= 1 ? scale.words[scale.words.length - v] : null;
  }
  const v = Math.round((noTies ? cap - scale.step : cap) * 1e6) / 1e6;
  return v >= scale.min ? v : null;
}

// ---------- the review step ----------

// What is wrong with this board, in plain words, for the review step (like debate's checkBallot). [] when nothing is.
// board: { ranks, ratings }. It never blocks copying by itself; the screen decides.
export function checkBoard(board, ctx) {
  const b = board || {};
  const ranks = b.ranks || {};
  const ratings = b.ratings || {};
  const ids = idsOf(ctx);
  const n = ids.length;
  const label = (id) => labelOf(ctx, id);
  const out = [];
  if (!n) return ['Add the speakers in this room.'];

  // Ranks: 1 to N, each once.
  const st = rankState(ranks, ids);
  for (const id of ids) if (asText(ranks[id]) === '') out.push('Give ' + label(id) + ' a rank.');
  for (const id of st.outOfRange) out.push(label(id) + ' has rank ' + asText(ranks[id]) + ', but ranks run 1 to ' + n + '.');
  for (const t of st.ties) out.push('More than one speaker has rank ' + t + '. Each rank 1 to ' + n + ' is used once.');

  // Overtime: noFirst.
  if (overtimeEffect(ctx.profile) === 'noFirst') {
    if (ids.every((id) => isOver(ctx, id))) {
      out.push("Everyone went over grace, so no one can be 1st. Time wrong? Clear the flag on the timer.");
    } else {
      for (const id of ids) if (asText(ranks[id]) === '1' && isOver(ctx, id)) out.push(noFirstMessage(label(id)));
    }
  }

  // Ratings.
  const scale = ratingScale(ctx.profile);
  if (scale.bad) out.push("This rules profile's word scale is not valid. Check the profile's words.");
  if (scale.kind === 'points' && scale.fellBack) out.push("This rules profile's points range is not valid, so " + scale.min + '–' + scale.max + ' is used. Check the range in room settings.');
  if (scale.kind !== 'none') {
    for (const id of ids) {
      if (asText(ratings[id]) === '') out.push('Give ' + label(id) + ' a rating.');
      else { const e = ratingError(ratings[id], scale); if (e) out.push(label(id) + ': ' + e); }
    }
    for (const t of ratingTies(ratings, ctx)) {
      out.push(t.ids.map(label).join(', ') + ' have the same rating (' + t.rating + '). Each speaker needs a different rating.');
    }
    for (const c of rankRatingConflicts(ranks, ratings, ctx)) {
      out.push(label(c.id) + ' ranks below ' + label(c.above) + ' but has a higher rating. A better rank needs an equal or higher rating.');
    }
  }
  return out;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).rank = Object.freeze({
  POINTS_FALLBACK, FLAG_ONLY_NOTE, OVER_GRACE_PILL, RANK_RATING_ROW,
  overtimeEffect, noFirstMessage, overtimeRow, startRanks, orderOf, moveTo, moveUp, moveDown, tapRank, nextRank,
  ratingScale, customRangeError, ratingValue, ratingError, ratingTies, rankRatingConflicts, ratingFix, checkBoard,
});
