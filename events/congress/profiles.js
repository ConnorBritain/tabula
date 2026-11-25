// Speech Events step S6 (docs/events/CONGRESS.md §6, §7): the Congress rules profiles. Pure data.
//
// These are not in events/published.json: that list feeds the room setup's profile picker, and a Congress profile
// has other fields. A chamber keeps a frozen copy of its profile (chamber.profile), so an old chamber always opens
// with the rules it was scored under, even after a profile here gets a new version. Never edit a published profile in
// place: add a new version (version: 2) and keep the old one in this list.
//
// Each value that a primary source did not confirm is listed in `unverified` (CONGRESS.md §10, the brief's rule 9).
// The setup screen says so in plain words, and the judge can change the scale. No rule here is a guess: a value with
// no source is null (reasonBelow: null means "no number known, so the app does not ask"), or a marked default.
//
// Fields (CONGRESS.md §6):
//   scoring                'points', or 'ranksOnly' (no speech or PO points: scale and poScale are null; NCFL, CHSSA)
//   scale {min,max}        points for one speech          poScale {min,max}   points for one PO hour
//   reasonBelow            ask for a specific reason when the points are below this (null: never ask)
//   poRule                 'fullHourOnly' (scorers score each full hour; a part hour gets no score)
//                          'parliScores' (the parliamentarian scores the PO; scorers do not)
//                          'none' (no PO points at all: ranks-only leagues)
//   topN                   the scorer's rank length       rankPool  'present' | 'spokeOrPresided'
//   scoredSpeechCap        speeches per student that get points (null: no cap)
//   maxLegislators         the chamber limit              questionBlockMs   one question block
//   wrongSideOff           points off for an uncaught wrong-side speech ("at least" this many; NSDA), or null
//   wrongSideMax           the most a wrong-side speech can get (TFA: 3), or null

const base = Object.freeze({ scoring: 'points', topN: 8, rankPool: 'present', scoredSpeechCap: null, maxLegislators: 30, questionBlockMs: 30000, wrongSideOff: 3, wrongSideMax: null });
const make = (p) => Object.freeze(Object.assign({}, base, p, { scale: p.scale ? Object.freeze(p.scale) : null, poScale: p.poScale ? Object.freeze(p.poScale) : null, unverified: Object.freeze(p.unverified || []) }));

export const CONGRESS_PROFILES = Object.freeze([
  // PO 4-8: District Congress Officials 5.3. The same manual's "District Merit Points" line says 1-8 per complete
  // hour, so the PO scale stays marked. No reason-below number in the manual. The manual does not limit the rank pool.
  make({ id: 'nsda-district', version: 1, name: 'NSDA district', scale: { min: 1, max: 8 }, poScale: { min: 4, max: 8 }, reasonBelow: null,
    poRule: 'fullHourOnly', maxLegislators: 29, unverified: ['poScale', 'reasonBelow', 'rankPool'],
    source: 'NSDA High School Unified Manual v2027.1.2 (2026-27), District Congress Officials. See CONGRESS.md §5, §10.' }),
  make({ id: 'nsda-last-chance', version: 1, name: 'NSDA Last Chance', scale: { min: 1, max: 8 }, poScale: { min: 1, max: 8 }, reasonBelow: 5,
    poRule: 'fullHourOnly', rankPool: 'spokeOrPresided',
    source: 'NSDA 2023 Last Chance Congressional Debate Scorer Instructions. See CONGRESS.md §5.' }),
  // reasonBelow 5: the 2020 Nationals scorer instructions only (no 2026-27 sheet found).
  make({ id: 'nsda-nationals', version: 1, name: 'NSDA Nationals', scale: { min: 3, max: 9 }, poScale: { min: 3, max: 9 }, reasonBelow: 5,
    poRule: 'fullHourOnly', unverified: ['reasonBelow', 'rankPool'],
    source: 'NSDA High School Unified Manual v2027.1.2 (2026-27), National Congressional Debate Procedures; 2020 Nationals scorer instructions. See CONGRESS.md §5.' }),
  // PO: the rules say "up to six points per clock hour"; the PO form says 2-6. Part hours: no rule found.
  make({ id: 'uil', version: 1, name: 'UIL (Texas)', scale: { min: 1, max: 6 }, poScale: { min: 2, max: 6 }, reasonBelow: null,
    poRule: 'fullHourOnly', scoredSpeechCap: 5, unverified: ['poScale', 'poRule'],
    source: 'UIL Congress Rules 2026-27 (rev.); UIL Congress presiding evaluation form. See CONGRESS.md §5.' }),
  // IQTs. A wrong-side speech gets no more than 3 points. The parliamentarian scores the PO (one line also says
  // "and scorers", so the PO rule stays marked).
  make({ id: 'tfa', version: 1, name: 'TFA (Texas) IQT', scale: { min: 0, max: 6 }, poScale: { min: 0, max: 6 }, reasonBelow: null,
    poRule: 'parliScores', wrongSideOff: null, wrongSideMax: 3, unverified: ['reasonBelow', 'poRule'],
    source: 'TFA Constitution and Contest Rules 2026-27 (amended Oct 2026), Congressional Debate Tabulation. See CONGRESS.md §5.' }),
  // TFA State: scorers give 1-6 for each speech; the parliamentarian gives the PO 1-6 at the end of each hour; top 8;
  // a prelim chamber has no more than 20 (semifinals and Super Congress: 16). State floor debate points to the IQT
  // rules, so the wrong-side cap (no more than 3) is read from there and stays marked.
  make({ id: 'tfa-state', version: 1, name: 'TFA (Texas) State', scale: { min: 1, max: 6 }, poScale: { min: 1, max: 6 }, reasonBelow: null,
    poRule: 'parliScores', maxLegislators: 20, wrongSideOff: null, wrongSideMax: 3, unverified: ['reasonBelow', 'rankPool', 'wrongSideMax'],
    source: 'TFA Constitution and Contest Rules 2026-27 (amended Oct 2026), State Tournament: Congressional Debate (Chambers, Scoring). See CONGRESS.md §5, §11.' }),
  // NCFL Grand Nationals: no speech or PO points in the bylaws. Scorers rank; the parliamentarian ranks every member.
  // A top 8 (unranked = 9) is written only for the Grand Final, so the prelim rank length is marked. Chambers: a goal
  // of 18 in prelims, 16 to 20 in semifinals; no hard limit found, so 20 is marked.
  make({ id: 'ncfl', version: 1, name: 'NCFL Grand Nationals', scoring: 'ranksOnly', scale: null, poScale: null, reasonBelow: null,
    poRule: 'none', maxLegislators: 20, wrongSideOff: null, unverified: ['topN', 'maxLegislators', 'rankPool'],
    source: 'NCFL By-Laws, updated after the Fall 2025 Executive Committee meeting, for Grand Nationals 2026: Article II, Student Congress. See CONGRESS.md §11.' }),
  // CHSSA State: no points. Prelims: three scorers rank 1 to 9; unranked = 10. The PO is a separate contest (its own
  // entrants), so scorers give the PO nothing. No chamber limit found.
  make({ id: 'chssa', version: 1, name: 'CHSSA State (prelims)', scoring: 'ranksOnly', scale: null, poScale: null, reasonBelow: null,
    poRule: 'none', topN: 9, wrongSideOff: null, unverified: ['maxLegislators', 'rankPool'],
    source: 'CHSSA Rules and Regulations (posted October 2025), Article XIV State Tournament - Congress Tabulation, Section 4. See CONGRESS.md §11.' }),
  // CHSSA semifinal and final sessions: each scorer chooses 1st through 15th. The same section also says anyone not
  // ranked 1 to 9 scores 10 for tabulation, so the rank length is marked.
  make({ id: 'chssa-elim', version: 1, name: 'CHSSA State (semis and finals)', scoring: 'ranksOnly', scale: null, poScale: null, reasonBelow: null,
    poRule: 'none', topN: 15, wrongSideOff: null, unverified: ['topN', 'maxLegislators', 'rankPool'],
    source: 'CHSSA Rules and Regulations (posted October 2025), Article XIV State Tournament - Congress Tabulation, Section 4 D. See CONGRESS.md §11.' }),
]);

export const DEFAULT_CONGRESS_PROFILE = 'nsda-district';

// The scales a judge can pick at setup (the scale is a setting: an invitational often says "1 to 6" or "1 to 8").
export const SCALE_CHOICES = Object.freeze([
  Object.freeze({ id: '1-6', min: 1, max: 6 }), Object.freeze({ id: '1-8', min: 1, max: 8 }),
  Object.freeze({ id: '3-9', min: 3, max: 9 }), Object.freeze({ id: '0-6', min: 0, max: 6 }),
]);
export const scaleId = (s) => (s ? s.min + '-' + s.max : '');
export const scaleText = (s) => (s ? s.min + ' to ' + s.max : '');
// The open facts a judge can set at setup. A value a source did not confirm (listed in `unverified`) is not decided
// by the app: the setup screen shows a choice with "Check your tournament's rule", and the chamber keeps the pick.
//   poScaleChoices(p)   the PO ranges to offer: the profile's own first, then the speech scale (NSDA district: 4 to 8,
//                       or 1 to 8 as the manual's merit-points line reads). Empty when the PO range is confirmed, or
//                       when the scorer gives the PO no points.
//   rankPoolChoices(p)  'present' and 'spokeOrPresided', the profile's own first. Empty when the pool is confirmed.
export const RANK_POOL_WORDS = Object.freeze({ present: 'Every present legislator', spokeOrPresided: 'Only those who spoke or presided' });
export function poScaleChoices(p) {
  if (!p || !p.poScale || p.poRule !== 'fullHourOnly' || !(p.unverified || []).includes('poScale')) return [];
  const out = [p.poScale];
  if (p.scale && scaleId(p.scale) !== scaleId(p.poScale)) out.push(p.scale);
  return out;
}
export function rankPoolChoices(p) {
  if (!p || !(p.unverified || []).includes('rankPool')) return [];
  return [p.rankPool].concat(Object.keys(RANK_POOL_WORDS).filter((k) => k !== p.rankPool));
}

// A ranks-only profile gives no speech or PO points (NCFL, CHSSA).
export const ranksOnly = (p) => Boolean(p) && p.scoring === 'ranksOnly';

// The newest version of a profile by id, or null.
export function congressProfile(id) {
  let best = null;
  for (const p of CONGRESS_PROFILES) if (p.id === id && (!best || p.version > best.version)) best = p;
  return best;
}

// The plain-words list of values a source did not confirm, for the setup screen.
const FIELD_WORDS = Object.freeze({ reasonBelow: 'when to ask for a reason', poScale: 'the PO points range', poRule: 'how PO hours score', rankPool: 'who can be ranked', topN: 'how many to rank', maxLegislators: 'the chamber limit', wrongSideMax: 'the wrong-side cap', scale: 'the speech points range' });
export const unverifiedWords = (p) => (p && p.unverified ? p.unverified.map((f) => FIELD_WORDS[f] || f) : []);

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressProfiles = Object.freeze({ CONGRESS_PROFILES, DEFAULT_CONGRESS_PROFILE, SCALE_CHOICES, scaleId, scaleText, ranksOnly, congressProfile, unverifiedWords,
  RANK_POOL_WORDS, poScaleChoices, rankPoolChoices });
