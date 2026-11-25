// Timer cues on the page: the buzz and the spoken line at each signal point, and the two switches (Vibrate, Big
// digits) in the timer's "⋯" menu and in Settings. The rules for which cue fires when are in timer-cue.js (pure).
// timer-view.js calls cueTick on each tick of a running clock and cueMount after the card is drawn; it adds no driver,
// no timer and no key binding. Settings shows timerCueSettingsHtml and passes its changes to timerCueSettingChange.
// Both switches are off by default and are stored on this device with the other settings (settings.js withSetting).
// The spoken line goes to the page's one polite live region (#sr-status, through ui.announce), once per point.
import { escapeHtml as esc } from '../../core/sheets.js';
import { iconButton } from './icons.js';
import { signalPoints } from './timer.js';
import { cueStep } from './timer-cue.js';
import { withSetting } from './settings.js';

// The settings keys (booleans; missing means off).
export const VIBRATE_KEY = 'timerVibrate';
export const BIG_KEY = 'timerBigDigits';
export const vibrateOn = (s) => Boolean(s && s[VIBRATE_KEY] === true);
export const bigOn = (s) => Boolean(s && s[BIG_KEY] === true);

/** Can this browser vibrate? The Vibrate switch shows only where it can. nav: for tests (default: navigator). */
export const canVibrate = (nav) => {
  const n = nav === undefined ? globalThis.navigator : nav;
  return Boolean(n && typeof n.vibrate === 'function');
};

// A switch as HTML text: a checkbox with role="switch", so a screen reader says "on" or "off".
const switchHtml = (attrs, on, label) => `<label class="tick cue-switch"><input type="checkbox" role="switch" ${attrs}${on ? ' checked' : ''}> ${esc(label)}</label>`;

// The timer's "⋯" button and its menu (closed), as HTML text. s: the settings. vib: canVibrate().
export function cueMenuHtml(s, vib) {
  const vibrate = vib ? switchHtml('data-cue="vibrate"', vibrateOn(s), 'Vibrate at signals') : '';
  return `<span class="cue-more">${iconButton('ellipsis', 'Timer options', 'iconbtn cue-more-btn', 'data-cue="menu" aria-expanded="false" aria-controls="cue-menu"')}
    <span class="cue-menu" id="cue-menu" role="group" aria-label="Timer options" hidden>${vibrate}${switchHtml('data-cue="big"', bigOn(s), 'Big digits')}</span></span>`;
}

// The Timer part of Settings, as HTML text. s: the settings. vib: canVibrate().
export function timerCueSettingsHtml(s, vib) {
  const vibPart = vib ? `<div class="set-row">${switchHtml('id="set-vibrate"', vibrateOn(s), 'Vibrate at signals')}</div>
    <p class="field-help">A short buzz at each signal, so you can watch the speaker: one tap for a time signal, two when grace starts, three when grace is over.</p>` : '';
  return `<section class="set-part" aria-labelledby="set-timer-h"><h2 id="set-timer-h">Timer</h2>
    ${vibPart}<div class="set-row">${switchHtml('id="set-big"', bigOn(s), 'Big digits')}</div>
    <p class="field-help">Big digits make the time easier to read from far away.</p>
  </section>`;
}

// Save one switch. env: { settings(), saveSettings(s) }. name: 'vibrate' or 'big'. Returns the new settings.
function saveSwitch(env, name, on) {
  const s = withSetting(env.settings(), name === 'vibrate' ? VIBRATE_KEY : BIG_KEY, Boolean(on));
  env.saveSettings(s);
  if (name === 'vibrate' && !on && canVibrate()) { try { navigator.vibrate(0); } catch { /* the browser said no */ } }
  return s;
}

/** Settings: a change on the page. Returns true when it was one of the two switches (and saves it). */
export function timerCueSettingChange(env, target) {
  const m = target && /^set-(vibrate|big)$/.exec(target.id || '');
  if (!m) return false;
  saveSwitch(env, m[1], target.checked);
  return true;
}

// ---------- on the Room screen ----------
let cueState = null; // timer-cue.js cueStep state, kept while the page is open

/**
 * Each tick of a running speech clock: fire the cue for a signal point once (timer-cue.js). env: { settings(), ui }.
 * room, entry: the room and the running entry. face: timer.js timerFace. limit: the speech part's limit; grace in s.
 * Returns the cue that fired, or null.
 */
export function cueTick(env, room, entry, face, limit, grace) {
  if (!entry || !face) return null;
  const res = cueStep(cueState, { id: (room && room.id ? room.id + '/' : '') + entry.id, running: face.running, left: face.left, used: face.used, points: signalPoints(limit, grace), grace });
  cueState = res.state;
  const cue = res.cue;
  if (!cue) return null;
  const s = env.settings ? env.settings() : null;
  if (vibrateOn(s) && canVibrate()) { try { navigator.vibrate(cue.pattern.slice()); } catch { /* the browser said no */ } }
  env.ui.announce(cue.text);
  return cue;
}

// Forget what has fired (for tests).
export const resetCues = () => { cueState = null; };

// The open menu, if any, and its button.
const openMenu = () => document.querySelector('#cue-menu:not([hidden])');
function closeMenu(focusBtn) {
  const m = openMenu();
  if (!m) return;
  m.hidden = true;
  const b = document.querySelector('[data-cue="menu"]');
  if (b) { b.setAttribute('aria-expanded', 'false'); if (focusBtn) b.focus(); }
}
let wired = false; // Esc and the click outside are wired once for the page
const boxes = new WeakSet(); // the timer boxes that already have the menu

/**
 * After the timer card is drawn: put the "⋯" menu under the card and set Big digits. env: { settings(), saveSettings,
 * ui }. box: the #timer-box element (none for a no show: nothing to do).
 */
export function cueMount(env, box) {
  if (!box) return;
  const s = env.settings ? env.settings() : null;
  box.classList.toggle('cue-big', bigOn(s));
  if (boxes.has(box)) return;
  boxes.add(box);
  const btns = box.querySelector('.timer-btns');
  if (btns) btns.insertAdjacentHTML('beforeend', cueMenuHtml(s, canVibrate()));
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-cue="menu"]');
    if (!b) return;
    const m = box.querySelector('#cue-menu');
    const open = m.hidden;
    m.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    if (open) { const f = m.querySelector('input'); if (f) f.focus(); }
  });
  box.addEventListener('change', (ev) => {
    const name = ev.target.dataset && ev.target.dataset.cue;
    if (name !== 'vibrate' && name !== 'big') return;
    const next = saveSwitch(env, name, ev.target.checked);
    box.classList.toggle('cue-big', bigOn(next));
    env.ui.announce(name === 'big' ? (bigOn(next) ? 'Big digits on.' : 'Big digits off.') : (vibrateOn(next) ? 'Vibrate on.' : 'Vibrate off.'));
  });
  if (wired) return;
  wired = true;
  if (env.ui.escLayer) env.ui.escLayer('cue-menu', 40, () => Boolean(openMenu()), () => closeMenu(true));
  document.addEventListener('click', (ev) => { if (openMenu() && !ev.target.closest('.cue-more')) closeMenu(false); });
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).timerCueView = Object.freeze({
  VIBRATE_KEY, BIG_KEY, vibrateOn, bigOn, canVibrate, cueMenuHtml, timerCueSettingsHtml, timerCueSettingChange, cueTick, cueMount,
});
