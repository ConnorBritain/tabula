// Speech Events step S6 (docs/events/CONGRESS.md §4.2, §5.1, §5.3): the speech log. Pure: no DOM, no storage; the
// clock (now) and the id maker are passed in. Each function returns a new session; the page saves after each change,
// so a 3-hour session never loses a speech to a reload or a dead battery.
import { pointsRange } from '../../core/points.js';
import { ranksOnly } from './profiles.js';
import { statusIn } from './chamber.js';

export const SPEECH_MS = 180000; // 3:00 for every scored speech (NSDA 2026-27)
export const TYPES = Object.freeze(['authorship', 'sponsorship', 'firstNeg', 'rebuttal', 'extension', 'crystal', 'amendment']);
export const TYPE_WORDS = Object.freeze({ authorship: 'Authorship', sponsorship: 'Sponsorship', firstNeg: 'First negative', rebuttal: 'Rebuttal',
  extension: 'Extension', crystal: 'Crystallization', amendment: 'Amendment' });
export const SIDES = Object.freeze(['aff', 'neg', 'neutral']);
export const SIDE_WORDS = Object.freeze({ aff: 'Aff', neg: 'Neg', neutral: 'Neutral' });
export const PENALTY_WORDS = Object.freeze({ wrongSide: 'Wrong side', offFloor: 'Not on the floor' });

// The question time after a speech of this type: 2:00 after authorship, sponsorship and first negative; 1:00 after
// every other speech (CONGRESS.md §5.1).
export const questionMsFor = (type) => (type === 'authorship' || type === 'sponsorship' || type === 'firstNeg' ? 120000 : 60000);

// The item, side and type the next speech most likely has (§4.2). The judge can change each one with one tap.
//   On an item: speech 1 is the authorship (Aff), speech 2 the first negative (Neg); after that the side alternates
//   from the last speech on that item, and the type is a rebuttal.
export function nextDefaults(session) {
  const itemId = session.itemId || null;
  const onItem = session.speeches.filter((s) => s.itemId === itemId);
  if (!onItem.length) return { itemId, side: 'aff', type: 'authorship' };
  if (onItem.length === 1) return { itemId, side: 'neg', type: 'firstNeg' };
  const last = onItem[onItem.length - 1];
  return { itemId, side: last.side === 'aff' ? 'neg' : 'aff', type: 'rebuttal' };
}

// Start a speech for a legislator: it joins the log at once and the timer starts (session.live). A speech still live
// ends first, so its time is kept.
export function startSpeech(prev, legislatorId, input) {
  const session = prev.live ? endSpeech(prev, input.now) : prev;
  const d = nextDefaults(session);
  const speech = { id: input.makeId('sp'), legislatorId, itemId: d.itemId, side: d.side, type: d.type, startedAt: input.now,
    speakMs: 0, questionMs: 0, questionerIds: [], points: null, penalty: null, comment: '', commentSource: 'judge' };
  return Object.assign({}, session, {
    speeches: session.speeches.concat(speech),
    recency: session.recency.filter((id) => id !== legislatorId).concat(legislatorId),
    live: { speechId: speech.id, phase: 'speech', at: input.now },
  });
}

// Change fields of one speech. Only the fields the log knows are taken; points are kept as a whole number or null.
const EDITABLE = ['itemId', 'side', 'type', 'points', 'penalty', 'comment', 'commentSource'];
export function updateSpeech(session, speechId, patch) {
  const p = {};
  for (const k of EDITABLE) if (patch && Object.prototype.hasOwnProperty.call(patch, k)) p[k] = patch[k];
  if ('side' in p && !SIDES.includes(p.side)) delete p.side;
  if ('type' in p && !TYPES.includes(p.type)) delete p.type;
  if ('penalty' in p && p.penalty !== null && !PENALTY_WORDS[p.penalty]) delete p.penalty;
  if ('points' in p) p.points = p.points === null || p.points === '' ? null : Number.isInteger(Number(p.points)) ? Number(p.points) : null;
  return Object.assign({}, session, { speeches: session.speeches.map((s) => (s.id === speechId ? Object.assign({}, s, p) : s)) });
}

export function removeSpeech(session, speechId) {
  const live = session.live && session.live.speechId === speechId ? null : session.live;
  return Object.assign({}, session, { speeches: session.speeches.filter((s) => s.id !== speechId), live });
}

// ---------- the timer: speech, then questions (§4.2) ----------
// session.live: { speechId, phase: 'speech'|'questions', at } where at is when the phase started (wall clock, so a
// reload or a closed tab keeps time).
export function startQuestions(session, now) {
  const live = session.live;
  if (!live || live.phase !== 'speech') return session;
  const speeches = session.speeches.map((s) => (s.id === live.speechId ? Object.assign({}, s, { speakMs: Math.max(0, now - live.at) }) : s));
  return Object.assign({}, session, { speeches, live: { speechId: live.speechId, phase: 'questions', at: now } });
}

// End the speech (from either phase): the times are kept, the timer stops.
export function endSpeech(session, now) {
  const live = session.live;
  if (!live) return session;
  const ms = Math.max(0, now - live.at);
  const speeches = session.speeches.map((s) => (s.id !== live.speechId ? s : Object.assign({}, s, live.phase === 'speech' ? { speakMs: ms } : { questionMs: ms })));
  return Object.assign({}, session, { speeches, live: null });
}

// What the timer shows now. Returns null when no speech is live, or
// { phase, elapsedMs, leftMs (negative when over), limitMs, block (questions: the 30 s block number, from 1), blockLeftMs }.
export function timerView(session, now, blockMs = 30000) {
  const live = session.live;
  if (!live) return null;
  const sp = session.speeches.find((s) => s.id === live.speechId);
  if (!sp) return null;
  const elapsedMs = Math.max(0, now - live.at);
  const limitMs = live.phase === 'speech' ? SPEECH_MS : questionMsFor(sp.type);
  const out = { phase: live.phase, speechId: sp.id, elapsedMs, limitMs, leftMs: limitMs - elapsedMs };
  if (live.phase === 'questions') {
    out.block = Math.floor(elapsedMs / blockMs) + 1;
    out.blocks = Math.ceil(limitMs / blockMs);
    out.blockLeftMs = blockMs - (elapsedMs % blockMs);
  }
  return out;
}

// "2 min 51" for a time in milliseconds (the line after a speech).
export function minSec(ms) {
  const t = Math.round(Math.max(0, ms) / 1000);
  const m = Math.floor(t / 60), s = t % 60;
  return m ? m + ' min ' + String(s).padStart(2, '0') : s + ' s';
}
// "2:51" (or "−0:12" when over) for the timer face. The minus shows only once a whole second is past the limit, so
// the limit itself reads "0:00", never "−0:00".
export function clockText(ms) {
  const t = Math.floor(Math.abs(ms) / 1000);
  const neg = ms < 0 && t > 0;
  return (neg ? '−' : '') + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
// Over time on the timer face: from one whole second past the limit, the same moment the minus shows, so the color and
// the digits always agree.
export const isOver = (ms) => ms <= -1000;

// ---------- points (§5.2, §5.3) ----------
// The points that count for one speech, after the fixed penalties and the scored-speech cap:
//   offFloor  -> 0 (a speech on legislation not on the floor);
//   wrongSide -> the judge's points less profile.wrongSideOff ("at least 3 off", NSDA), never below the scale's low
//                end; or at most profile.wrongSideMax when the profile sets one (TFA: no more than 3);
//   a speech past profile.scoredSpeechCap for its legislator (UIL: 5) -> no points (null).
// nth: this speech is the legislator's nth (from 1) in the session.
export function countedPoints(speech, profile, nth) {
  if (ranksOnly(profile)) return null; // NCFL, CHSSA: no points
  if (profile.scoredSpeechCap && nth > profile.scoredSpeechCap) return null;
  if (speech.penalty === 'offFloor') return 0;
  if (speech.points == null) return null;
  const r = pointsRange(profile.scale, { min: 1, max: 8 });
  if (speech.penalty === 'wrongSide') {
    if (profile.wrongSideMax != null) return Math.min(speech.points, profile.wrongSideMax);
    return Math.max(r.min, speech.points - (profile.wrongSideOff == null ? 3 : profile.wrongSideOff));
  }
  return speech.points;
}

// Does this score need a specific reason? Only when the profile has a number (reasonBelow) and the comment is empty.
// It never blocks the save (§4.2).
// The log actions that give points. A ranks-only chamber refuses them, so no stray click or key can store points
// the league does not use (the views also hide the buttons).
export const POINTS_ACTIONS = Object.freeze(['points', 'penalty', 'po-score', 'po-clear']);
export const refusesAction = (profile, act) => ranksOnly(profile) && POINTS_ACTIONS.includes(act);

export const needsReason = (speech, profile) => profile.reasonBelow != null && speech.points != null && speech.points < profile.reasonBelow && !String(speech.comment || '').trim();

// One line for each legislator, in chamber order: their speeches (with counted points), count, total and average
// (to help with the rank, §4.2).
export function legislatorLines(chamber, session) {
  const by = new Map(chamber.legislators.map((l) => [l.id, []]));
  for (const s of session.speeches) if (by.has(s.legislatorId)) by.get(s.legislatorId).push(s);
  return chamber.legislators.map((l) => {
    const speeches = by.get(l.id).map((s, i) => ({ speech: s, counted: countedPoints(s, chamber.profile, i + 1), nth: i + 1 }));
    const scored = speeches.filter((x) => x.counted != null);
    const total = scored.reduce((a, x) => a + x.counted, 0);
    return { legislator: l, speeches, count: speeches.length, total, average: scored.length ? Math.round((total / scored.length) * 10) / 10 : null };
  });
}

// How many of a legislator's speeches still have no points (one line from legislatorLines). A speech past the
// scored-speech cap gets no points by rule, so it is not counted; a ranks-only chamber has no points at all.
export const openCount = (line, profile) => (ranksOnly(profile) ? 0 : line.speeches.filter((x) => x.counted == null && !(profile.scoredSpeechCap && x.nth > profile.scoredSpeechCap)).length);

// Precedence for the picker (§1): legislators who are present, fewest speeches first, then the one who spoke least
// recently (never spoken first; then by recency). This is a help for the scorer's search, not the official order
// (the parliamentarian keeps that, step S7).
export function precedenceOrder(chamber, session) {
  const count = new Map();
  for (const s of session.speeches) count.set(s.legislatorId, (count.get(s.legislatorId) || 0) + 1);
  const rec = new Map(session.recency.map((id, i) => [id, i]));
  return chamber.legislators.map((l, i) => ({ l, i })).filter((x) => statusIn(session, x.l) === 'present')
    .sort((a, b) => (count.get(a.l.id) || 0) - (count.get(b.l.id) || 0) || (rec.has(a.l.id) ? rec.get(a.l.id) : -1) - (rec.has(b.l.id) ? rec.get(b.l.id) : -1) || a.i - b.i)
    .map((x) => x.l);
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressSpeech = Object.freeze({ SPEECH_MS, TYPES, TYPE_WORDS, SIDES, SIDE_WORDS, PENALTY_WORDS,
  questionMsFor, nextDefaults, POINTS_ACTIONS, refusesAction, startSpeech, updateSpeech, removeSpeech, startQuestions, endSpeech, timerView, minSec, clockText, isOver, countedPoints, needsReason,
  legislatorLines, openCount, precedenceOrder });
