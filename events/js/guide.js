// Speech Events step S3 (docs/events/EXPERIENCE.md §5.2, §7): the plain words about each event type, for the picker
// and the type page (#/type/<eventId>). Pure: no DOM.
// The one-line description is app copy, written in our own words for a first-time parent judge. It is not in the v1
// event files (those are published and never change). Every other line here comes from the event file or the rules
// profile, so the guide can never disagree with the rules the timer and rank board use.
import { CHECK_LABELS } from './comments.js';
import { CUSTOM_EVENT } from './room.js';
import { clockText } from './timer.js';

// One plain line per event id. Summarized in our own words; no rule text copied. Not verified line by line against
// the NSDA manual (brief rule 9): an owner or coach should check these before release.
export const EVENT_LINES = Object.freeze({
  oo: 'A student gives a speech they wrote, to persuade the room on a topic they chose.',
  inf: 'A student gives a speech they wrote, to teach the room about a topic.',
  usx: 'A student draws a question about United States news and answers it in a speech.',
  ix: 'A student draws a question about world news and answers it in a speech.',
  mx: 'A student draws a question about United States or world news and answers it in a speech.',
  com: 'A student draws a question about current events and answers it in a short speech, seated.',
  di: 'A student performs a serious cutting from a published work.',
  hi: 'A student performs a funny cutting from a published work and plays every character.',
  duo: 'Two students perform a cutting from a published work together.',
  poi: 'A student performs a program of published pieces on one theme, from a binder.',
  pro: 'A student reads a cutting of published prose from a binder.',
  poe: 'A student reads published poetry from a binder.',
  exp: 'A student gives a short speech they wrote that explains a topic.',
  imp: 'A student draws a topic in the room, prepares, and speaks on it.',
  sto: 'A student tells a published story from memory.',
  osw: 'A student performs spoken word poetry they wrote, from memory.',
  dec: 'A student gives, from memory, a speech that another person gave before.',
  pcc: 'A student picks a topic and argues both sides: first Pro, then Con, on one clock.',
  [CUSTOM_EVENT]: 'An event you set up yourself. You set the time limit and the grace.',
});
export const eventLine = (id) => EVENT_LINES[id] || '';

const MATERIAL = Object.freeze({ memorized: 'From memory', manuscript: 'Read from a binder', noNotes: 'No notes' });

// The Guide part of the type page. def: the event file (null for the Custom event); profile: the rules profile the
// grace comes from. Returns { line, limit, grace, prep, material, performers, checks [labels], prompts [lines] }.
export function guideModel(def, profile) {
  const g = Number(profile && profile.overtime && profile.overtime.grace);
  const grace = (Number.isFinite(g) && g >= 0 ? g : 30) + ' seconds over the limit';
  if (!def) return { line: eventLine(CUSTOM_EVENT), limit: 'You set it when you start the round', grace, prep: 'No prep in the room.', material: '', performers: '', checks: [], prompts: [] };
  const limit = clockText(Number(def.timing && def.timing.limit) || 0);
  return {
    line: eventLine(def.id),
    limit,
    grace,
    prep: def.timing && def.timing.inRoomPrep ? 'Prep happens in the room. Prep and speech share the ' + limit + ' limit.' : 'No prep in the room.',
    material: MATERIAL[def.material] || '',
    performers: def.performers === 2 ? 'Two students (a pair)' : 'One student',
    checks: (def.checks || []).map((id) => CHECK_LABELS[id] || id),
    prompts: (def.prompts || []).slice(),
  };
}

// One rules profile in plain words (the Rules part of the type page): { name, lines }.
export function rulesLines(profile) {
  const p = profile || {};
  const lines = [];
  const r = p.rating;
  if (r && typeof r === 'object' && Number.isFinite(r.min) && Number.isFinite(r.max)) lines.push('Ranks and points from ' + r.min + ' to ' + r.max + '.');
  else lines.push('Ranks only, no points.');
  if (p.ratingNoTies) lines.push('No two speakers can get the same points.');
  if (p.rankRatingRule) lines.push('Points must follow the ranks.');
  const g = Number(p.overtime && p.overtime.grace);
  lines.push('Grace: ' + (Number.isFinite(g) && g >= 0 ? g : 30) + ' seconds over the limit.');
  const eff = p.overtime && p.overtime.effect;
  if (eff === 'flagOnly') lines.push('A speaker over grace gets a note for the tab room. The rank stays as you give it.');
  else if (eff === 'none') lines.push('Going over grace does not change the rank.');
  else lines.push('A speaker over grace cannot be ranked 1st.');
  if (p.biasNote) lines.push(String(p.biasNote));
  return { name: String(p.name || p.id || 'Rules'), lines };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).guide = Object.freeze({ EVENT_LINES, eventLine, guideModel, rulesLines });
