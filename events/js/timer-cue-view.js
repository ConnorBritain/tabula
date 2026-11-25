// Timer cues on the page (DESIGN.md §4.2, ARCHITECTURE.md §10): the buzz and the spoken line at each signal point,
// Big digits on the timer card, and the Timer part of Settings with the two switches (Vibrate, Big digits). The rules
// for which cue fires when are in timer-cue.js (pure). timer-view.js calls cueTick on each tick of a running speech
// clock and cueMount after the card is drawn; it adds no driver, no timer and no key binding. Both switches are off by
// default and are stored on this device with the other settings (settings.js withSetting).
// The spoken line goes to the page's one polite live region (#sr-status, through ui.announce), once per point.
import { escapeHtml as esc } from '../../core/sheets.js';
import { signalPoints } from './timer.js';
import { cueStep, forgetCues } from './timer-cue.js';
import { withSetting, TIMER_VIBRATE_KEY, TIMER_BIG_KEY } from './settings.js';

export const vibrateOn = (s) => Boolean(s && s[TIMER_VIBRATE_KEY] === true);
export const bigOn = (s) => Boolean(s && s[TIMER_BIG_KEY] === true);

/** Can this browser vibrate? The Vibrate switch shows only where it can. nav: for tests (default: navigator). */
export const canVibrate = (nav) => {
  const n = nav === undefined ? globalThis.navigator : nav;
  return Boolean(n && typeof n.vibrate === 'function');
};
function vibrate(pattern) {
  try { globalThis.navigator.vibrate(pattern); } catch { /* vibrate() refused or not allowed */ }
}

// A switch as HTML text: a checkbox with role="switch", so a screen reader says "on" or "off".
const switchHtml = (id, on, label) => `<label class="tick cue-switch"><input type="checkbox" role="switch" id="${id}"${on ? ' checked' : ''}> ${esc(label)}</label>`;

// The Timer part of Settings, as HTML text. s: the settings. vib: canVibrate() (the Vibrate switch is left out when
// the browser cannot vibrate).
export function timerCueSettingsHtml(s, vib) {
  const vibPart = vib ? `<div class="set-row">${switchHtml('set-vibrate', vibrateOn(s), 'Vibrate at signals')}</div>
    <p class="field-help">A short buzz at each signal, so you can watch the speaker: one tap for a time signal, two when grace starts, three when grace is over.</p>` : '';
  return `<section class="set-part" aria-labelledby="set-timer-h"><h2 id="set-timer-h">Timer</h2>
    ${vibPart}<div class="set-row">${switchHtml('set-big', bigOn(s), 'Big digits')}</div>
    <p class="field-help">Big digits make the time easier to read from far away.</p>
  </section>`;
}

/** Settings: a change on the page. env: { settings(), saveSettings(s) }. Returns true when it was one of the two
 * switches (and saves it). */
export function timerCueSettingChange(env, target) {
  const m = target && /^set-(vibrate|big)$/.exec(target.id || '');
  if (!m) return false;
  const on = Boolean(target.checked);
  env.saveSettings(withSetting(env.settings(), m[1] === 'vibrate' ? TIMER_VIBRATE_KEY : TIMER_BIG_KEY, on));
  if (m[1] === 'vibrate' && !on && canVibrate()) vibrate(0); // stop a buzz that is still going
  return true;
}

// ---------- on the Room screen ----------
let cueState = null; // timer-cue.js state, kept while the page is open
const keyOf = (room, entry) => (room && room.id ? room.id + '/' : '') + entry.id;

/**
 * Each tick of a running speech clock: fire the cue for a signal point once (timer-cue.js). env: { settings(), ui }.
 * room, entry: the room and the running entry. face: timer.js timerFace (or prep.js sharedFace). limit: the speech
 * part's own limit (on a prep event, what prep left of the shared limit); grace in seconds. quiet: true while another
 * view speaks the signals itself (the speaker view, while it is open): the point is still marked and the buzz still
 * comes, but nothing is spoken here, so a screen reader hears one line per signal.
 * Returns the cue that fired, or null.
 */
export function cueTick(env, room, entry, face, limit, grace, quiet) {
  if (!entry || !face) return null;
  const res = cueStep(cueState, { id: keyOf(room, entry), running: face.running, left: face.left, points: signalPoints(limit, grace), grace });
  cueState = res.state;
  const cue = res.cue;
  if (!cue) return null;
  const s = env.settings ? env.settings() : null;
  if (vibrateOn(s) && canVibrate()) vibrate(cue.pattern.slice());
  if (!quiet) env.ui.announce(entry.code + ': ' + cue.text);
  return cue;
}

// Forget what has fired (for tests).
export const resetCues = () => { cueState = null; };

// A speech with no time at all (new, or after "Reset time"): its cues start over.
const noSpeechTime = (e) => { const t = (e && e.timing) || {}; return !t.run && !(t.usedMs > 0); };

/**
 * After the timer card is drawn: set Big digits on the timer box (the card and the sticky phone bar inside it), and
 * let the cues of every speech with no time start over. env: { settings() }. box: the #timer-box element (none for
 * a no show). room: the room on screen.
 */
export function cueMount(env, box, room) {
  if (box) box.classList.toggle('cue-big', bigOn(env.settings ? env.settings() : null));
  const list = room && Array.isArray(room.entries) ? room.entries : [];
  cueState = forgetCues(cueState, list.filter(noSpeechTime).map((e) => keyOf(room, e)));
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).timerCueView = Object.freeze({
  vibrateOn, bigOn, canVibrate, timerCueSettingsHtml, timerCueSettingChange, cueTick, cueMount,
});
