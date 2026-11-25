// Speech Events: the timer card as HTML text. Pure: every function here turns a face (timer.js timerFace or prep.js
// sharedFace) and a track model into HTML text, with no DOM, no clock and no state, so Node tests call them directly.
// The Room screen's timer view (timer-view.js createTimerView) owns the state, the two drivers and the DOM, and calls
// these builders to draw and to update the card in place.
// Cleanup (2026-11-25): split out of timer-view.js, with no change to the HTML. The design notes for each part are
// in timer-view.js (E5, E11 and the design build, docs/design/EVENTS-DESIGN-REVIEW.md §2.4–§2.7).
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { phasesHtml } from './phase-bar.js';
import { trackModel, trackHtml, miniTrackHtml, piecesFor, pointsFor } from './time-track.js';
import { clockText } from './timer.js';

// The over-grace line inside the card ('' when the flag is off). Design build (top 10 #2): it sits in the card, and
// "Clear over grace" is a quiet button (a rare fix). After a stop the result pill under the digits says it, so the
// line keeps only the clear button.
export const overGraceHtml = (face) => (face.overGrace ? `<div class="timer-flag">${face.stage === 'stopped' && face.used > 0 ? '' : statusPillHtml('err', 'Over grace')}
      <button class="b small quiet" type="button" data-tact="clear">Clear over grace</button></div>` : '');

// The result of a stopped speech (top 10 #2), or null before any time and while the clock runs: 'inside', 'grace'
// or 'over', with the amount past the limit. On a prep event the face's left is of the speech part.
export function stoppedResult(face, grace) {
  if (!face || face.stage !== 'stopped' || !(face.used > 0)) return null;
  const past = -face.left;
  if (past <= 0) return { kind: 'inside', past: 0 };
  return { kind: past <= grace ? 'grace' : 'over', past };
}
const RESULT_PILL = { inside: ['', 'circle-check', () => 'Inside time'], grace: ['caution', 'info', (p) => 'Grace +' + clockText(p)], over: ['err', 'triangle-alert', (p) => 'Over grace +' + clockText(p)] };
// The pill for a stoppedResult ('' for null).
function resultPill(r) {
  if (!r) return '';
  const [tone, ic, word] = RESULT_PILL[r.kind];
  return statusPillHtml(tone, word(r.past), ic, 'id="timer-result"');
}
// The pill under the digits after a stop ('' otherwise).
export const resultPillHtml = (face, grace) => resultPill(stoppedResult(face, grace));

// What the card shows: after a stop the big digits are the final time used (9:20), not the time left (top 10 #2).
export function cardFace(face) {
  return face && face.stage === 'stopped' && face.used > 0 ? Object.assign({}, face, { digits: clockText(face.used), sub: 'used' }) : face;
}

// The phase row of a prep event (DESIGN.md §4.2 "Prep" then "Speech"), as a phase-bar.js model. face: prep.js
// sharedFace(...). Prep shows its time once it has some; it freezes when the speech starts.
export function prepPhaseModel(face) {
  const inSpeech = face.phase === 'speech';
  const current = face.phase === 'ready' ? -1 : !inSpeech ? 0 : face.running || !face.used ? 1 : 2;
  const next = current === -1 ? 'Next: Prep. Tap Start prep when the speaker has the topic.'
    : current === 0 ? 'Next: Speech. Tap Speech started when the speech begins.'
      : current === 2 ? 'Prep and speech are done.' : '';
  return {
    label: 'Prep, then speech',
    phases: [{ id: 'prep', label: 'Prep', time: face.prepUsed ? clockText(face.prepUsed) : '' }, { id: 'speech', label: 'Speech', time: inSpeech && face.used ? clockText(face.used) : '' }],
    current, next,
  };
}

// The track for the card (time-track.js model, plus the phase row HTML). Pure. phasesFor(entry, event, now, limit):
// optional, the phase model of a family with phases of its own (F4 runs.js runsBarModel); a prep event uses
// prepPhaseModel; other events have no phase row.
export function cardTrack(entry, event, face, limit, grace, now, phasesFor) {
  const model = trackModel({ limit, grace, pieces: piecesFor(entry, event, limit, now), points: pointsFor(entry, event, limit, grace, now), running: face.running });
  const pm = phasesFor ? phasesFor(entry, event, now, limit) : face.phase ? prepPhaseModel(face) : null;
  return { model, phases: pm ? phasesHtml(pm, { id: 'card-phases' }) : '' };
}

// The one main button of the card, as { tact, label } (the big button and the sticky bar's button both draw it).
// startWord (optional; color review §6 PCC): the word before any time, as "Start Pro" (a family names its first part).
export function mainButton(face, startWord) {
  if (face.phase === 'ready') return { tact: 'prep', label: 'Start prep' };
  if (face.phase && face.phase !== 'speech') return { tact: 'speech', label: 'Speech started' };
  return { tact: 'startstop', label: face.running ? 'Stop' : face.used ? 'Resume' : startWord || 'Start' };
}

// The play or pause icon of the main button (§5.3): pause while a clock runs, play otherwise.
const goIcon = (face) => icon(face.running ? 'pause' : 'play', 20);
// The big main button of the card (data-key="startstop": the focus and the Space rule find it first). b: mainButton(...).
// primary: false when another step holds the room's one solid fill (top 10 #1: Next speaker after a stop, Rank the
// room at the end).
const bigButton = (face, primary, b) => `<button class="b${primary === false ? '' : ' primary'} timer-go" type="button" data-tact="${b.tact}" data-key="startstop">${goIcon(face)}${esc(b.label)}</button>`;

// −10 s and +10 s in one quiet track (top 10 #8): rare fixes, not peers of the primary. what: 'prep' or 'speech'.
function toolGroup(what) {
  const of = what === 'prep' ? 'the prep time' : 'the time used';
  return `<span class="tool-group" role="group" aria-label="Correct ${of}">
        <button class="b" type="button" data-tact="minus" aria-label="Take 10 seconds off ${of}">−10 s</button>
        <button class="b" type="button" data-tact="plus" aria-label="Add 10 seconds to ${of}">+10 s</button></span>`;
}
// "Reset time" is quiet, with the rotate icon (top 10 #8).
const resetHtml = `<button class="b quiet" type="button" data-tact="reset">${icon('rotate-ccw')}Reset time</button>`;

// The buttons under the card before the speech starts on a prep event: ready, prep running, prep stopped.
// b: mainButton(...).
function prepButtons(face, primary, b) {
  if (face.phase === 'ready') return `${bigButton(face, primary, b)}
      <button class="b" type="button" data-tact="speech">Start speech</button>`;
  return `${bigButton(face, primary, b)}
      <button class="b" type="button" data-tact="prep">${face.running ? 'Stop prep' : 'Resume prep'}</button>
      ${toolGroup('prep')}
      ${face.running ? '' : resetHtml}`;
}

// The sticky compact bar (OD1 A; review §2.4 change 2): stage word, time, mini track, the main button, and after a
// stop, "Next speaker". It shows only on a narrow screen while the big card is out of view (the CSS and an
// IntersectionObserver turn it on). The digits are hidden from screen readers, as on the card (the word says the stage).
// primary (design build, top 10 #1): which step holds the solid fill, as on the card ('timer' when left out).
export function stickyBarHtml(face, track, primary, startWord) {
  const b = mainButton(face, startWord);
  const p = primary || 'timer';
  const shown = cardFace(face);
  const next = face.stage === 'stopped' && face.used > 0 ? `<button class="b small${p === 'next' ? ' primary' : ''}" type="button" data-act="next">Next speaker</button>` : '';
  return `<div class="timer-mini stage-${face.stage}" id="timer-mini" role="group" aria-label="Timer">
      <span class="tm-word" id="tm-word">${esc(face.word)}</span>
      <span class="tm-digits" id="tm-digits" aria-hidden="true">${esc(shown.digits)}</span>
      <span class="tm-track" id="tm-track">${track ? miniTrackHtml(track.model) : ''}</span>
      <button class="b small${p === 'timer' ? ' primary' : ''}" type="button" data-tact="${b.tact}">${esc(b.label)}</button>${next}</div>`;
}

// The timer card for one entry as HTML text. face: timerFace(...). The stage shows as a fill of the whole card plus a
// word (DESIGN.md §3); colour never carries the meaning alone.
// limit: the event's limit (on a prep event, the shared limit for prep and speech). track: cardTrack(...) (optional;
// without it the card has no signal track and no sticky bar).
// opts (design build, top 10 #1; optional): { primary: 'timer' | 'next' | 'rank' | 'other' (room-primary.js; 'other':
// another part of the room holds it, as the F4 run button), nextHtml: the "Next speaker: U2" button, startWord: the
// main button's word before any time ("Start Pro") }. Left out, the big button is the primary, as before.
export function timerHtml(entry, face, limit, grace, track, opts) {
  // Copy trim E8: a pill and the undo button on the card, not directions to the roster menu.
  if (entry.status === 'noShow') return `<p class="timer-none">${statusPillHtml('outline', 'No show')} <button class="b small" type="button" data-act="show" data-id="${esc(entry.id)}" data-key="ns-timer-${esc(entry.id)}">Undo no show</button></p>`;
  const o = opts || {};
  const p = o.primary || 'timer';
  const over = overGraceHtml(face);
  const shared = Boolean(face.phase);
  const shown = cardFace(face);
  const res = stoppedResult(face, grace);
  const result = resultPill(res);
  const main = mainButton(face, o.startWord);
  const next = p === 'next' && o.nextHtml ? o.nextHtml : '';
  const btns = shared && face.phase !== 'speech' ? prepButtons(face, p === 'timer', main) : `${next}${bigButton(face, p === 'timer', main)}
      ${toolGroup('speech')}
      <button class="b" type="button" data-tact="set">Set time</button>
      ${!face.running && face.used ? resetHtml : ''}`;
  return `<div class="timer-box" id="timer-box">
    <div class="timer-card stage-${face.stage}" id="timer-card"${res ? ` data-result="${res.kind}"` : ''}>
      <p class="timer-word" id="timer-word">${esc(face.word)}</p>
      <p class="timer-digits" id="timer-digits" aria-hidden="true">${esc(shown.digits)}</p>
      <p class="timer-sub" id="timer-sub">${esc(shown.sub)}</p>
      ${result ? `<p class="timer-result">${result}</p>` : ''}
      ${track ? trackHtml(track.model, { id: 'timer-track', phases: track.phases }) : ''}
      <p class="signal-chip" id="signal-chip" hidden></p>
      <p class="timer-limit">Limit ${clockText(limit)}${shared ? ' for prep and speech' : ''} · grace ${clockText(grace)}</p>
      <div id="timer-flagbox">${over}</div>
    </div>
    <div class="timer-btns">
      ${btns}
    </div>${track ? stickyBarHtml(face, track, p, o.startWord) : ''}</div>`;
}

// The time on a roster row (after the code): the time used (on a prep event, prep and speech), once there is some.
export const rowTimeHtml = (entry, used) => (used > 0 || (entry.timing && (entry.timing.run || entry.timing.prepRun)) ? `<span class="row-time" data-time="${esc(entry.id)}">${clockText(used)}</span>` : '');

// The roster row's time while the room is open: none while the speaker speaks (the timer card shows it, and the name
// keeps its room; review §2.4 change 6), else rowTimeHtml.
export const rosterTimeHtml = (entry, used) => (entry.status === 'speaking' ? '' : rowTimeHtml(entry, used));

// The line under a roster row's name (D3-A): the mini track of a speech with time, and "Over grace" in words when the
// flag is on. Nothing while the speaker speaks, for a no show, or before any time. track: time-track.js rowTrackHtml.
export function rowTrackLine(entry, used, track) {
  if (!entry || entry.status === 'speaking' || entry.status === 'noShow' || !(used > 0)) return '';
  const over = entry.timing && entry.timing.overGrace ? ' ' + statusPillHtml('err', 'Over grace', 'triangle-alert') : '';
  return `<span class="row-track">${track}${over}</span>`;
}
