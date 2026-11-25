// Speech Events step S6 (docs/events/CONGRESS.md §4.1, §6): a chamber and its sessions. Pure: no DOM, no storage;
// the clock (now) and the id maker (makeId) are passed in.
//   setupChecks(parsed, docket, profile)   the "Check these" lines for the setup screen
//   createChamber(input)                   a new Chamber record (with a frozen copy of its profile)
//   newSession(chamber, sessions, input)   the next CongressSession; session 2 and later carry the chamber over
//   docketLines(text)                      the docket titles, one for each line, in agenda order
import { pointsRange } from '../../core/points.js';
import { ranksOnly, poScaleChoices, rankPoolChoices, scaleId } from './profiles.js';

export const MIN_CHAMBER = 8; // the NSDA district minimum (a warning only)

export const docketLines = (text) => String(text == null ? '' : text).split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);

// The lines the judge should check before the chamber starts. parsed: events/js/parse.js parseRoom's result for the
// chamber list (a repeated code already comes back as a check line from the parser). docket: the titles.
// Returns [{ kind, text, block }]: block is true for a line that stops the chamber from starting.
export function setupChecks(parsed, docket, profile) {
  const out = [];
  const n = parsed.entries.length;
  const max = profile.maxLegislators;
  for (const c of parsed.check) out.push({ kind: 'line', text: c.line + ': ' + c.why, block: false });
  if (n > max) out.push({ kind: 'tooMany', text: n + ' legislators. ' + profile.name + ' allows ' + max + '. Remove ' + (n - max) + '.', block: true });
  if (n > 0 && n < MIN_CHAMBER) out.push({ kind: 'tooFew', text: 'Only ' + n + ' legislators. A district chamber has at least ' + MIN_CHAMBER + '.', block: false });
  if (!n) out.push({ kind: 'none', text: 'No legislators yet. Paste the chamber list.', block: true });
  if (!docket.length) out.push({ kind: 'noDocket', text: 'Add bill and resolution titles, one per line.', block: false });
  return out;
}

// A copy of the profile with the scale the judge picked (a whole-number range; anything else keeps the profile's).
// A ranks-only profile has no scale, so a picked scale is ignored.
// open: { poScale?, rankPool? }, the judge's pick for a value a source did not confirm. A pick is taken only when it
// is one of the choices the setup screen offers (profiles.js poScaleChoices, rankPoolChoices); anything else keeps the
// profile's value. The chamber keeps `picked` (the fields the judge set), so the overview can say what was chosen.
export function frozenProfile(profile, scale, open = {}) {
  const extra = {};
  const picked = [];
  const po = open && open.poScale ? poScaleChoices(profile).find((c) => scaleId(c) === scaleId(open.poScale)) : null;
  if (po) { extra.poScale = Object.freeze({ min: po.min, max: po.max }); picked.push('poScale'); }
  if (open && open.rankPool && rankPoolChoices(profile).includes(open.rankPool)) { extra.rankPool = open.rankPool; picked.push('rankPool'); }
  if (picked.length) extra.picked = Object.freeze(picked);
  if (ranksOnly(profile)) return Object.freeze(Object.assign({}, profile, extra));
  const s = scale ? pointsRange(scale, profile.scale) : profile.scale;
  return Object.freeze(Object.assign({}, profile, extra, { scale: Object.freeze({ min: s.min, max: s.max }) }));
}

// input: { entries (parseRoom entries), docket (titles), house ('house'|'senate'), profile, scale?, open?, tournament?,
// roomLabel?, now, makeId }. The role is 'scorer' in S6 (the parliamentarian is step S7).
export function createChamber(input) {
  const { makeId, now } = input;
  return {
    id: makeId('ch'),
    tournament: input.tournament || '',
    roomLabel: input.roomLabel || '',
    house: input.house === 'senate' ? 'senate' : 'house',
    role: 'scorer',
    profile: frozenProfile(input.profile, input.scale, input.open),
    legislators: input.entries.map((e) => ({ id: makeId('lg'), code: e.code, name: e.name || '', status: 'present' })),
    docket: (input.docket || []).map((title) => ({ id: makeId('it'), title })),
    sessionIds: [],
    createdAt: now,
  };
}

// The first docket item not debated in an earlier session, or null.
export const firstOpenItem = (chamber) => chamber.docket.find((d) => !d.debatedInSession) || null;

// The next session of a chamber. Each session is a fresh start: no speeches, no PO, no ranks, and only legislation not
// yet debated (CONGRESS.md §1). The chamber, its legislators and its docket carry over.
// Returns { chamber, session }: the chamber gains the session id.
export function newSession(chamber, sessions, input) {
  const number = (sessions || []).reduce((m, s) => Math.max(m, s.number || 0), 0) + 1;
  const item = firstOpenItem(chamber);
  const session = {
    id: input.makeId('cs'), chamberId: chamber.id, number, startedAt: input.now,
    recency: [], speeches: [], poTerms: [], ranks: [], live: null, itemId: item ? item.id : null,
  };
  return { chamber: Object.assign({}, chamber, { sessionIds: chamber.sessionIds.concat(session.id) }), session };
}

// A legislator's status changes (present, absent, left), with the time.
export function setStatus(chamber, legislatorId, status, now) {
  if (!['present', 'absent', 'left'].includes(status)) return chamber;
  return Object.assign({}, chamber, { legislators: chamber.legislators.map((l) => (l.id === legislatorId ? Object.assign({}, l, { status, statusAt: now }) : l)) });
}

// A legislator's status inside one session. Status lives on the chamber, so marking someone absent before session 2
// would also drop them from session 1's rank pool (and empty a slot on a ballot already handed in). So when a new
// session starts, each earlier session keeps a copy of the statuses it ended with (closeSession), and reads them here.
export const statusIn = (session, legislator) => (session && session.statuses && Object.prototype.hasOwnProperty.call(session.statuses, legislator.id) ? session.statuses[legislator.id] : legislator.status);

// The session with the chamber's statuses as they are now kept on it. A session that already has its copy is unchanged.
export function closeSession(session, chamber) {
  if (session.statuses) return session;
  const statuses = {};
  for (const l of chamber.legislators) statuses[l.id] = l.status;
  return Object.assign({}, session, { statuses });
}

// The sessions whose statuses must not follow a change made now: every session but the latest, and the latest too
// once it is marked submitted. The latest open session follows the chamber (someone can leave in the middle of it).
export const sessionsToClose = (sessions) => {
  const sorted = (sessions || []).slice().sort((a, b) => a.number - b.number);
  return sorted.filter((s, i) => i < sorted.length - 1 || s.submittedAt);
};

const withoutKey = (o, k) => { const out = Object.assign({}, o); delete out[k]; return out; };

// Mark a session submitted (on: true) or not. Submitted keeps the statuses it has now (closeSession). Taking it back
// on the latest session drops that copy, so the session follows the chamber again (someone who leaves still drops
// out). An earlier session keeps its copy: a later session has started since.
export function setSubmitted(session, chamber, on, now, isLatest) {
  if (on) return Object.assign({}, closeSession(session, chamber), { submittedAt: now });
  const out = Object.assign({}, isLatest ? withoutKey(session, 'statuses') : session, { submittedAt: null });
  return out;
}

// Undo "Next item": the item is open again and back under debate. Only that item changes on the docket.
export function reopenItem(chamber, session, itemId) {
  return {
    chamber: Object.assign({}, chamber, { docket: chamber.docket.map((d) => (d.id === itemId && d.debatedInSession === session.number ? withoutKey(d, 'debatedInSession') : d)) }),
    session: Object.assign({}, session, { itemId }),
  };
}

// The docket item is done in this session: later sessions gray it out.
export function markDebated(chamber, itemId, sessionNumber) {
  return Object.assign({}, chamber, { docket: chamber.docket.map((d) => (d.id === itemId && !d.debatedInSession ? Object.assign({}, d, { debatedInSession: sessionNumber }) : d)) });
}

export const legislatorOf = (chamber, id) => chamber.legislators.find((l) => l.id === id) || null;
// The code of a legislator, or '?' when the id is not in the chamber.
export const codeOf = (chamber, id) => { const l = legislatorOf(chamber, id); return l ? l.code : '?'; };
export const itemOf = (chamber, id) => chamber.docket.find((d) => d.id === id) || null;
export const houseWord = (chamber) => (chamber.house === 'senate' ? 'Senate' : 'House');

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressChamber = Object.freeze({ MIN_CHAMBER, docketLines, setupChecks, frozenProfile, createChamber,
  firstOpenItem, newSession, setStatus, statusIn, closeSession, sessionsToClose, setSubmitted, reopenItem, markDebated, legislatorOf, codeOf, itemOf, houseWord });
