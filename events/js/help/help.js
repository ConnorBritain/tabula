// Speech Events judge help (pure: no DOM, no clock). Three small helps so a parent who has never judged feels calm:
//   1. The first-room walk: 3 short steps (timer, comments, rank and copy), shown the first time this device opens a
//      room. Skippable, never a modal. The "seen" flag lives in tabulaEvents.help.v1, so it goes into the backup, a
//      restore brings it back, and Clear this device removes it. Settings has "Show the first-room tips again".
//   2. "What to listen for": a fold in the room. The bullets are in listen-for.js; the event's line, time limit,
//      grace and material come from the type page's Guide (events/js/guide.js), one source for both screens.
//      It is open in the device's first round and closed after that (on a phone it starts closed).
//   3. "How to rank": a fold on the Rank screen. The time rule is read from the round's rules profile, never typed.
// help-view.js draws these and hooks them in; the builders here return data or HTML text (Node tests call them).
import { escapeHtml as esc } from '../../../core/sheets.js';
import { foldSummaryHtml } from '../fold.js';
import { guideModel, eventLine } from '../guide.js';
import { overtimeEffect, ratingScale } from '../rank.js';
import { graceOf, clockText } from '../timer.js';
import { rankStageLabel } from '../profile-layer.js';
import { CUSTOM_EVENT } from '../room.js';
import { LISTEN_FOR } from './listen-for.js';

// The one saved value: { walkSeen: true } once the first-room walk has shown on this device.
export const HELP_KEY = 'tabulaEvents.help.v1';

// The saved help state, in today's shape. A missing or damaged value reads as "not seen yet".
export function readHelp(store) {
  const v = store && store.get(HELP_KEY, null);
  return { walkSeen: Boolean(v && typeof v === 'object' && v.walkSeen === true) };
}
export const walkDue = (store) => !readHelp(store).walkSeen;
export const markWalkSeen = (store) => store.set(HELP_KEY, Object.assign({}, readHelp(store), { walkSeen: true }));
// Settings: "Show the first-room tips again". The next room this device opens shows the walk.
export const resetWalk = (store) => store.set(HELP_KEY, Object.assign({}, readHelp(store), { walkSeen: false }));

// ---------- 1. the first-room walk ----------
export const WALK_STEPS = Object.freeze([
  Object.freeze({ title: 'Time each speaker', text: 'Tap a speaker, then tap the Start button. If the event has prep in the room, start when they get the topic. Tap Stop when they end.' }),
  Object.freeze({ title: 'Write a few kind notes', text: 'Type in the comment box while you listen. The questions above it help you get started. Short notes are fine.' }),
  Object.freeze({ title: 'Rank, then copy', text: 'When all have spoken, tap Rank the room. Put the best first. Then copy the ranks and comments into the tournament site.' }),
]);

// The walk card at step i (0, 1 or 2) as HTML text. Not a dialog: the room and the timer work around it.
export function walkSteps(profile) {
  const label = rankStageLabel(profile);
  if (label === 'Rank') return WALK_STEPS;
  const last = label === 'Rate'
    ? { title: 'Rate, then copy', text: 'When all have spoken, tap Rate the room. Give each speaker a rating. Then copy the ratings and comments into the tournament site.' }
    : { title: 'Review, then copy', text: 'When all have spoken, tap Review and copy. Check the comments. Then copy them into the tournament site.' };
  return [...WALK_STEPS.slice(0, 2), last];
}

export function walkHtml(i, profile) {
  const n = WALK_STEPS.length;
  const at = Math.min(Math.max(Number(i) || 0, 0), n - 1);
  const s = walkSteps(profile)[at];
  const last = at === n - 1;
  return `<section class="help-walk" id="help-walk" aria-labelledby="help-walk-h" data-step="${at}">
    <p class="help-walk-count muted">First time here? Step ${at + 1} of ${n}</p>
    <h2 class="help-walk-title" id="help-walk-h" tabindex="-1">${esc(s.title)}</h2>
    <p class="help-walk-text">${esc(s.text)}</p>
    <div class="help-walk-acts">
      ${last ? '' : '<button class="b small quiet" type="button" data-hact="skip">Skip tips</button>'}
      ${at > 0 ? '<button class="b small" type="button" data-hact="back">Back</button>' : ''}
      <button class="b small" type="button" data-hact="${last ? 'done' : 'next'}">${last ? 'Got it' : 'Next'}</button>
    </div></section>`;
}

// ---------- 2. what to listen for ----------
// The bullets for an event id ([] when there are none; the schema test makes sure every published event has some).
export const listenBullets = (id) => (LISTEN_FOR[id] ? LISTEN_FOR[id].slice() : []);

// The card's content for a room. def: the event file (a Custom room passes its own room.customEvent, or null).
// Returns { intro, facts, bullets }: intro is the Guide's plain line; facts the Guide's limit, grace and material in
// one short line, then the Guide's prep line for an event with prep in the room. A Custom room shows the limit the
// judge set (room.customEvent.timing.limit).
export function listenModel(def, room) {
  const custom = !def || def.id === CUSTOM_EVENT || Boolean(room && room.customEvent);
  const id = custom ? CUSTOM_EVENT : def.id;
  const g = guideModel(custom ? null : def, room && room.profile);
  const own = custom && room && room.customEvent && room.customEvent.timing ? Number(room.customEvent.timing.limit) : 0;
  const limit = custom ? (own > 0 ? clockText(own) : '') : g.limit;
  const prep = !custom && def.timing && def.timing.inRoomPrep ? g.prep : '';
  const facts = [limit ? 'Time: ' + limit : '', 'Grace: ' + g.grace, g.material].filter(Boolean).join(' · ') + (prep ? '. ' + prep : '');
  return { intro: custom ? eventLine(CUSTOM_EVENT) : g.line, facts, bullets: listenBullets(id) };
}

// Is the card open when the room opens? Yes in this device's first round: no other round has reached the Rank, Rate
// or Review stage yet. After the first round it starts closed (the judge can still open it).
// narrow: a phone-width screen (820 px or less, the comment view's break). There it always starts closed, so the
// timer stays near the top of the screen; the fold row is still right under the title.
const PAST_JUDGING = new Set(['ranking', 'review', 'done']);
export function listenOpen(rooms, roomId, narrow) {
  return !narrow && !(rooms || []).some((r) => r && r.id !== roomId && PAST_JUDGING.has(r.state));
}

export function listenHtml(model, open) {
  return `<details class="fold help-listen" id="help-listen"${open ? ' open' : ''}>
    ${foldSummaryHtml('What to listen for')}
    <div class="help-body">${model.intro ? `<p>${esc(model.intro)}</p>` : ''}${model.facts ? `<p class="muted">${esc(model.facts)}</p>` : ''}
      <ul>${model.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div></details>`;
}

// ---------- 3. how to rank ----------
// The lines for the Rank screen's fold, from the round's profile (the same rules rank.js uses for the board).
// No bias line here: the Rank screen already shows the profile's own reminder, or our line when it has none
// (DESIGN.md §4.4). No top-N line: the screen's help line under the tools already says it.
export function rankHelpLines(room) {
  const p = (room && room.profile) || {};
  const lines = ['Rank 1 is the best. Then 2, then 3, down to the last.', 'No ties. Each speaker gets a different rank.'];
  const g = graceOf(room);
  const over = g > 0 ? 'more than ' + g + ' seconds over the time limit' : 'over the time limit';
  const eff = overtimeEffect(p);
  if (eff === 'noFirst') lines.push('A speaker ' + over + ' cannot get rank 1.');
  else if (eff === 'flagOnly') lines.push('A speaker ' + over + ' gets a note for the tab room. You still rank them where you think best.');
  else lines.push('Going over time does not change the rank.');
  if (ratingScale(p).kind !== 'none') {
    const what = ratingScale(p).kind === 'words' ? 'rating' : 'points';
    const each = what === 'points' ? 'points' : 'a rating';
    lines.push(p.rankRatingRule ? 'You also give ' + each + '. A better rank needs the same or a better ' + (what === 'points' ? 'score' : 'rating') + '.' : 'You also give each speaker ' + each + '.');
    if (p.ratingNoTies) lines.push('No two speakers can get the same ' + what + '.');
  }
  return lines;
}

export function rankHelpHtml(room) {
  return `<details class="fold help-rank" id="help-rank">
    ${foldSummaryHtml('How to rank')}
    <ul class="help-body">${rankHelpLines(room).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`;
}

// ---------- the Settings line ----------
export const TIPS_AGAIN = 'Show the first-room tips again';
export function tipsPartHtml() {
  return `<section class="set-part" id="help-set" aria-labelledby="help-set-h"><h2 id="help-set-h">Tips</h2>
    <button class="b" type="button" id="help-tips-again">${esc(TIPS_AGAIN)}</button>
    <p class="field-help">The next room you open shows the ${WALK_STEPS.length} short steps.</p></section>`;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).help = Object.freeze({ HELP_KEY, readHelp, walkDue, markWalkSeen, resetWalk, WALK_STEPS, walkHtml, listenBullets, listenModel, listenOpen, listenHtml, rankHelpLines, rankHelpHtml, tipsPartHtml, TIPS_AGAIN });
