// Speech Events step S3 (docs/events/EXPERIENCE.md §1.2, §5, §8.3): the judge's day and ballot cards. Pure: no DOM,
// no storage, no clock (the caller passes `now` and an id maker). myday-screen.js draws My day; day-store.js saves.
//
// A Day (tabulaEvents.days.v1) is one local date: { id, date, tournament, checkInAt, standby, createdAt }.
// A BallotCard (tabulaEvents.cards.v1) is one ballot the judge holds:
//   { id, dayId, createdAt, tournament, eventKey ('hi@1', or 'custom'), role: 'judge', round, flight, level,
//     roomLabel, startsAt, ranksDueAt, submittedAt, roundId, status, cancelledAt }
// The status the judge sees comes from the card AND its round (cardStatus), so it never goes stale: the card stores
// only 'notStarted' or 'cancelled' in `status`. A floater on standby has no card: standby lives on the Day (S3 makes
// no card with a null eventKey).
// Every function returns a NEW record and leaves the one it was given unchanged.
import { present, CUSTOM_EVENT } from './room.js';
import { dayOf } from './rooms.js';
import { clockText } from './timer.js';
import { RANKS_DUE_DEFAULT } from './migrate.js';
import { layerOf } from './profile-layer.js';

export const STATUS_WORDS = Object.freeze({
  notStarted: 'Not started',
  judging: 'Judging',
  ranksIn: 'Ranks copied (comments open)',
  submitted: 'Submitted',
  done: 'Done',
  cancelled: 'Cancelled',
});
// The My day section for each status (§1.2). "Mark submitted" moves a card from Now to Done (comments open).
export const SECTION_OF = Object.freeze({ notStarted: 'later', judging: 'now', ranksIn: 'now', submitted: 'open', done: 'done', cancelled: 'done' });
export const SECTIONS = Object.freeze([
  { id: 'now', title: 'Now' },
  { id: 'later', title: 'Later today' },
  { id: 'open', title: 'Done (comments open)' },
  { id: 'done', title: 'Done' },
]);
export const LEVELS = Object.freeze([{ id: 'prelim', label: 'Prelim' }, { id: 'elim', label: 'Elim' }]);
export const FLIGHTS = Object.freeze(['', 'A', 'B']);
// The ranks-due minutes when the setting is missing or bad (§5.3: "end of the last speaker plus 10 minutes").
export { RANKS_DUE_DEFAULT };
export const ROOM_MAX = 40;

const text = (s, max) => String(s == null ? '' : s).trim().slice(0, max || 80);
const isRecord = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);

// ---------- Day ----------
export function makeDay({ date, now, makeId }) {
  return { id: makeId('d'), date, tournament: '', checkInAt: null, standby: false, createdAt: now };
}
export const dayFor = (days, date) => (Array.isArray(days) ? days : []).find((d) => isRecord(d) && d.date === date) || null;
// The day for a local date, made when it is missing. Returns { days, day, made }.
export function ensureDay(days, date, now, makeId) {
  const have = dayFor(days, date);
  if (have) return { days: Array.isArray(days) ? days : [], day: have, made: false };
  const day = makeDay({ date, now, makeId });
  return { days: upsert(days, day), day, made: true };
}
// Standby on: the check-in time is set the first time only, so "checked in 40 min ago" stays true across a reload.
export const withStandby = (day, on, now) => Object.assign({}, day, { standby: Boolean(on), checkInAt: on ? (Number.isFinite(day.checkInAt) ? day.checkInAt : now) : day.checkInAt });

// ---------- BallotCard ----------
// The event id of a card ('hi@1' -> 'hi').
export const cardEventId = (card) => String((card && card.eventKey) || '').split('@')[0];
// The event file of a card from the registry, or null (a Custom card has none).
export function cardEvent(events, card) {
  const k = String((card && card.eventKey) || '');
  if (!k || k === CUSTOM_EVENT || !events) return null;
  const [id, v] = k.split('@');
  return events.get(id, Number(v)) || events.get(id) || null;
}

// A new card. event: the event file (or { id: 'custom' }). The tournament is the card's own (§5.4: a judge can go to
// two tournaments in one weekend).
export function makeCard({ day, event, tournament, round, flight, level, roomLabel, now, makeId }) {
  const ev = event || {};
  return {
    id: makeId('c'),
    dayId: day.id,
    createdAt: now,
    tournament: text(tournament),
    eventKey: ev.id === CUSTOM_EVENT ? CUSTOM_EVENT : ev.id + '@' + ev.version,
    role: 'judge',
    round: text(round, 40),
    flight: FLIGHTS.includes(flight) ? flight : '',
    level: level === 'elim' ? 'elim' : 'prelim',
    roomLabel: text(roomLabel, ROOM_MAX),
    startsAt: null,
    ranksDueAt: null,
    submittedAt: null,
    roundId: null,
    status: 'notStarted',
    cancelledAt: null,
  };
}

// A card for a round started with no card (#/new, or a round from before S3 that the judge acts on from My day).
// Decision 2a: every round started gets a card. The card copies the round's fields; the round is not changed.
export function cardForRound(round, day, now, makeId) {
  const event = round.customEvent ? { id: CUSTOM_EVENT } : { id: round.eventId, version: round.eventVersion };
  const card = makeCard({ day, event, tournament: round.tournament, round: round.round, flight: '', level: round.level, roomLabel: round.roomLabel, now, makeId });
  return Object.assign(card, { flight: text(round.flight, 10), roundId: round.id, createdAt: Number.isFinite(round.createdAt) ? round.createdAt : now });
}

// The status id for a card and its round (null when the round is not on this device).
export function cardStatus(card, round) {
  if (card && card.status === 'cancelled') return 'cancelled';
  if (!round) return card && card.submittedAt ? 'done' : 'notStarted';
  if (card && card.submittedAt) return round.state === 'done' ? 'done' : 'submitted';
  // A comments-only round (step S4 critiqueOnly) has no ranks to copy: it is done when its comments are copied.
  if (layerOf(round.profile).critiqueOnly) return round.state === 'done' ? 'done' : 'judging';
  // A copied round (state 'done') is never "Judging", even when it has no ranks mark: a round copied before E8 added
  // ranksCopiedAt has state 'done' only (design review §5 bug 9). Its ranks are in; "Mark submitted" is next.
  if (round.ranksCopiedAt || round.state === 'done') return 'ranksIn';
  return 'judging';
}

// When the ranks are due: the card's own time, else the stop time of the last present speaker plus the setting's
// minutes. null while a present speaker has not finished (or nobody has spoken).
export function ranksDueAt(card, round, minutes) {
  if (card && Number.isFinite(card.ranksDueAt)) return card.ranksDueAt;
  if (!round || layerOf(round.profile).critiqueOnly) return null; // a comments-only round has no ranks due
  const list = present(round);
  if (!list.length || list.some((e) => e.status !== 'done')) return null;
  const stops = list.flatMap((e) => ((e.timing && e.timing.runs) || []).map((r) => r && r.stoppedAt)).filter(Number.isFinite);
  if (!stops.length) return null;
  const m = Number.isInteger(minutes) && minutes > 0 ? minutes : RANKS_DUE_DEFAULT;
  return Math.max(...stops) + m * 60000;
}
// The countdown line: "Ranks due in 7:42", or "Ranks were due 2:10 ago" once the time has passed.
export function dueText(due, now) {
  if (!Number.isFinite(due)) return '';
  const s = Math.round((due - now) / 1000);
  return s > 0 ? 'Ranks due in ' + clockText(s) : 'Ranks were due ' + clockText(-s) + ' ago';
}

// The ranks-due pill in words (design review §2.1 change 3): "Ranks due in 7 min", then the caution tone at 2 minutes
// or less, then "Ranks 3 min late" in the late tone. No clock digits: "1:39" read as 1 hour 39 or 1 minute 39.
// Returns { text, tone } with tone '' | 'caution' | 'late', or null when there is no due time.
export const DUE_CAUTION_SEC = 120;
export function duePill(due, now) {
  if (!Number.isFinite(due)) return null;
  const s = Math.round((due - now) / 1000);
  if (s > 0) return { text: 'Ranks due in ' + Math.ceil(s / 60) + ' min', tone: s <= DUE_CAUTION_SEC ? 'caution' : '' };
  const late = Math.floor(-s / 60);
  return { text: late < 1 ? 'Ranks due now' : 'Ranks ' + late + ' min late', tone: 'late' };
}

// A room as the judge reads it (design review §5 bug 3): the label as typed ("Room 214", "Library"), with "Room" put
// in front only of a bare number ("214", "12B"). '' when there is no room.
export function roomText(label) {
  const t = String(label == null ? '' : label).trim();
  if (!t) return '';
  return /^\d+[a-z]?$/i.test(t) ? 'Room ' + t : t;
}

// The "Up next" item on My day (owner decision OD2 A): the round being judged now, else one whose ranks are copied,
// else the first round of Later today. null when none of those exists. m: mydayModel(...).
export function upNextItem(m) {
  const now = (m && m.sections && m.sections[0] && m.sections[0].items) || [];
  const later = (m && m.sections && m.sections[1] && m.sections[1].items) || [];
  return now.find((x) => x.status === 'judging') || now[0] || later[0] || null;
}

// The next round name: the last card's round with its last number plus one ("Round 2" -> "Round 3"). With no card
// yet it is "Round 1"; a last round with no number gives '' (the judge types it).
export function nextRoundLabel(items) {
  const last = (items || []).filter((x) => x && x.round).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).pop();
  if (!last) return 'Round 1';
  const m = /(\d+)(?!.*\d)/.exec(last.round);
  return m ? last.round.slice(0, m.index) + (Number(m[1]) + 1) + last.round.slice(m.index + m[1].length) : '';
}

// ---------- edits (each returns a new card) ----------
export const cancelCard = (card, now) => Object.assign({}, card, { status: 'cancelled', cancelledAt: now });
export const moveRoom = (card, label) => Object.assign({}, card, { roomLabel: text(label, ROOM_MAX) });
export const submitCard = (card, now) => Object.assign({}, card, { submittedAt: now });
export const linkRound = (card, roundId) => Object.assign({}, card, { roundId });

// The fields an edit changed, with their old values: an Undo puts back only these, so a change made since (another
// edit, a round linked) is kept.
export const undoFields = (before, after) => Object.fromEntries(Object.keys(after).filter((k) => after[k] !== before[k]).map((k) => [k, before[k] === undefined ? null : before[k]]));

// A new round and its card, joined (step S3, decision 2a). What the judge typed in setup wins: the card takes the
// round's round, flight and tournament; the round takes the card's day, level and room. Returns { round, card }.
export function linkRoundToCard(round, card) {
  const c = Object.assign(linkRound(card, round.id), { round: round.round || card.round, flight: round.flight || '', tournament: round.tournament || card.tournament });
  return { round: Object.assign({}, round, roundFields(c), { tournament: round.tournament || c.tournament }), card: c };
}

// The round fields a card gives the round it starts (§8.2: dayId, cardId, level, roomLabel).
export const roundFields = (card) => ({ cardId: card.id, dayId: card.dayId, level: card.level === 'elim' ? 'elim' : 'prelim', roomLabel: card.roomLabel || '' });

// Put a record into a list (replace the one with the same id, or add it at the end).
export function upsert(list, rec) {
  const out = Array.isArray(list) ? list.slice() : [];
  const i = out.findIndex((x) => isRecord(x) && x.id === rec.id);
  if (i >= 0) out[i] = rec; else out.push(rec);
  return out;
}
export const findById = (list, id) => (Array.isArray(list) ? list : []).find((x) => isRecord(x) && x.id === id) || null;

// ---------- My day ----------
// What My day shows. ctx: { day (or null), cards, rounds, now, ranksDueMin }.
// Today's cards (dayId is today's day), plus today's rounds that no card points to (made before S3, or a card was
// lost): those show by their round's state, with no card until the judge acts on one.
// Returns { sections: [{ id, title, items }], standby, commentsNote, items } where an item is
//   { card (or null), round (or null), status, word, due }.
export function mydayModel(ctx) {
  const c = ctx || {};
  const cards = (Array.isArray(c.cards) ? c.cards : []).filter(isRecord);
  const rounds = (Array.isArray(c.rounds) ? c.rounds : []).filter((r) => isRecord(r) && r.id && Number.isFinite(r.createdAt));
  const byId = new Map(rounds.map((r) => [r.id, r]));
  const linked = new Set(cards.map((k) => k.roundId).filter(Boolean));
  const today = dayOf(c.now);
  const items = [];
  for (const card of cards) {
    const it = item(card, card.roundId ? byId.get(card.roundId) || null : null, c);
    // Today's cards, and an earlier day's card that is still open work (judging, ranks copied, or comments open):
    // a round that runs past midnight, or comments Tabroom keeps open until the tournament ends (§5.3), must not
    // drop off My day when the date changes. An earlier day's finished, cancelled or never-started card stays in History.
    const isToday = Boolean(c.day && card.dayId === c.day.id);
    if (isToday || SECTION_OF[it.status] === 'now' || SECTION_OF[it.status] === 'open') items.push(Object.assign(it, { earlier: !isToday }));
  }
  for (const r of rounds) if (!linked.has(r.id) && dayOf(r.createdAt) === today) items.push(item(null, r, c));
  const at = (x) => (x.card ? x.card.createdAt : x.round.createdAt) || 0;
  const sections = SECTIONS.map((s) => {
    const list = items.filter((x) => SECTION_OF[x.status] === s.id).sort((a, b) => (s.id === 'now' || s.id === 'later' ? at(a) - at(b) : at(b) - at(a)));
    return { id: s.id, title: s.title, items: list };
  });
  const busy = sections[0].items.length + sections[1].items.length > 0;
  return {
    items,
    sections,
    standby: Boolean(c.day && c.day.standby) && !busy,
    commentsNote: !busy && sections[2].items.length > 0,
  };
}
function item(card, round, c) {
  const status = cardStatus(card, round);
  const due = SECTION_OF[status] === 'now' ? ranksDueAt(card, round, c.ranksDueMin) : null;
  return { card, round, status, word: STATUS_WORDS[status], due };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).cards = Object.freeze({ STATUS_WORDS, SECTION_OF, SECTIONS, LEVELS, FLIGHTS, RANKS_DUE_DEFAULT,
  makeDay, dayFor, ensureDay, withStandby, cardEventId, cardEvent, makeCard, cardForRound, cardStatus, ranksDueAt, dueText, duePill, DUE_CAUTION_SEC, roomText, upNextItem, nextRoundLabel,
  cancelCard, moveRoom, submitCard, linkRound, linkRoundToCard, undoFields, roundFields, upsert, findById, mydayModel });
