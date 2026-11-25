// Speech Events step S6 (docs/events/CONGRESS.md §4.1, §6): a chamber and its sessions. Pure: no DOM, no storage;
// the clock (now) and the id maker (makeId) are passed in.
//   setupChecks(parsed, docket, profile)   the "Check these" lines for the setup screen
//   createChamber(input)                   a new Chamber record (with a frozen copy of its profile)
//   newSession(chamber, sessions, input)   the next CongressSession; session 2 and later carry the chamber over
//   docketLines(text)                      the docket titles, one for each line, in agenda order
import { pointsRange } from '../../core/points.js';
import { ranksOnly } from './profiles.js';

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
export function frozenProfile(profile, scale) {
  if (ranksOnly(profile)) return Object.freeze(Object.assign({}, profile));
  const s = scale ? pointsRange(scale, profile.scale) : profile.scale;
  return Object.freeze(Object.assign({}, profile, { scale: Object.freeze({ min: s.min, max: s.max }) }));
}

// input: { entries (parseRoom entries), docket (titles), house ('house'|'senate'), profile, scale?, tournament?,
// roomLabel?, now, makeId }. The role is 'scorer' in S6 (the parliamentarian is step S7).
export function createChamber(input) {
  const { makeId, now } = input;
  return {
    id: makeId('ch'),
    tournament: input.tournament || '',
    roomLabel: input.roomLabel || '',
    house: input.house === 'senate' ? 'senate' : 'house',
    role: 'scorer',
    profile: frozenProfile(input.profile, input.scale),
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
  firstOpenItem, newSession, setStatus, markDebated, legislatorOf, codeOf, itemOf, houseWord });
