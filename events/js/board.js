// Speech Events step E7: the glue between a room and the rank rules (events/js/rank.js, which stays the one source of
// the rank, overtime and rating rules). Pure. The Rank screen reads the board from the room and writes it back here.
//
// Ranks and ratings live on the entries (ARCHITECTURE.md §6.3: entry.rank, entry.rating); rank.js works on maps
// ({ id: '1' }), so this file turns one into the other. Only the entries in the room (not "No show") are on the board.
import { rankState } from '../../core/ranks.js';
import { startRanks } from './rank.js';
import { present } from './room.js';

const asText = (v) => (v == null ? '' : String(v));

// The ctx rank.js asks for: ids in speaking order, the room's frozen profile, the sticky over-grace flags (E5) and the
// codes for messages.
export function boardCtx(room) {
  const list = present(room);
  return {
    ids: list.map((e) => e.id),
    profile: room.profile,
    overGrace: Object.fromEntries(list.filter((e) => e.timing && e.timing.overGrace).map((e) => [e.id, true])),
    labels: Object.fromEntries(list.map((e) => [e.id, e.code])),
  };
}
export const ranksOf = (room) => Object.fromEntries(present(room).map((e) => [e.id, asText(e.rank)]));
export const ratingsOf = (room) => Object.fromEntries(present(room).map((e) => [e.id, e.rating == null ? '' : e.rating]));

// Write a ranking back to the entries. A no-show never keeps a rank.
export function withRanks(room, ranks, now) {
  return Object.assign({}, room, { updatedAt: now, entries: room.entries.map((e) => Object.assign({}, e, { rank: e.status === 'noShow' ? '' : asText(ranks[e.id]) })) });
}
// Write one rating back. value: a number text for points, the word for a word scale, '' for none.
export function withRating(room, id, value, now) {
  return Object.assign({}, room, { updatedAt: now, entries: room.entries.map((e) => (e.id === id ? Object.assign({}, e, { rating: value === '' ? null : value }) : e)) });
}

// The board when the Rank screen opens. A room that has no rank yet starts in speaking order (DESIGN.md §4.5; no
// "start from my notes", the app never ranks). A room with ranks keeps them, and loses only a no-show's rank, so a
// judge who comes back to the board finds it as they left it. Returns { room, started } (started: the speaking-order
// start was used now).
export function openBoard(room, now) {
  const ctx = boardCtx(room);
  const ranks = ranksOf(room);
  const stale = room.entries.some((e) => e.status === 'noShow' && asText(e.rank) !== '');
  if (!ctx.ids.some((id) => ranks[id] !== '')) return { room: Object.assign(withRanks(room, startRanks(ctx), now), { state: 'ranking' }), started: true };
  const next = stale ? withRanks(room, ranks, now) : room;
  return { room: next.state === 'judging' ? Object.assign({}, next, { state: 'ranking', updatedAt: now }) : next, started: false };
}

// Leaving "Tap in order" before every speaker has a rank: the speakers with no rank take the ranks still free, in
// speaking order, so the board is full again (rank.js moveTo needs a full board). A board that is not a clean
// partial ranking (a tie, a rank out of range) is not touched; checkBoard names the problem.
export function fillRest(ranks, ctx) {
  const st = rankState(ranks, ctx.ids);
  if (st.ties.length || st.outOfRange.length) return Object.assign({}, ranks);
  const free = st.missing.slice();
  const out = Object.assign({}, ranks);
  for (const id of ctx.ids) if (asText(out[id]) === '') out[id] = String(free.shift());
  return out;
}

// Is every entry on the board ranked 1 to N once?
export const boardFull = (room) => rankState(ranksOf(room), boardCtx(room).ids).complete;

// The − and + buttons of a points rating, in the profile's own step (rank.js ratingScale; the v1 invitational step is
// 1, so core/points.js stepPoints, which moves by 0.1, does not fit). An empty box starts 60% of the way up the
// range, as core/points.js does. scale: rank.js ratingScale(profile), kind 'points'.
export function stepRating(value, dir, scale) {
  const v = value === '' || value == null ? NaN : Number(value);
  const k = (n) => Math.round(n * 1e6) / 1e6;
  if (Number.isNaN(v)) return k(scale.min + Math.round(((scale.max - scale.min) * 0.6) / scale.step) * scale.step);
  const snapped = scale.min + Math.round((v - scale.min) / scale.step) * scale.step; // back on the scale first
  const next = snapped === v ? v + (dir < 0 ? -scale.step : scale.step) : snapped;
  return k(Math.min(scale.max, Math.max(scale.min, next)));
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).board = Object.freeze({ boardCtx, ranksOf, ratingsOf, withRanks, withRating, openBoard, fillRest, boardFull, stepRating });
