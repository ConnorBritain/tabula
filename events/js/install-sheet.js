// Keeping the judge's device copy safe, on My day: the "Add to Home Screen" sheet for Safari on iPhone and iPad, and the
// banner shown when the browser says it may clear the saved data. The hint and the storage answer come from the shared
// core files (core/install-hint.js, core/keep-data.js); the builders at the top are pure (Node tests call them) and
// createInstallSheet does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { installHint, isStandalone } from '../../core/install-hint.js';
import { PREFIX } from './store.js';
import { dayOf } from './rooms.js';

// The sheet's choice on this device: { snoozedDay ('YYYY-MM-DD' the judge closed it on), never (true after "Don't show
// again") }. Only these two fields, nothing about the device or the browser.
export const INSTALL_HINT_KEY = PREFIX + 'installHint.v1';
// The day the judge dismissed the "may clear" banner ('YYYY-MM-DD'). It comes back the next day.
export const KEEP_BANNER_KEY = PREFIX + 'keepBanner.v1';

// The hint for the browser this page runs in (null in Node or when there is none).
export function pageHint(nav = globalThis.navigator, win = globalThis) {
  if (!nav) return null;
  return installHint({ ua: nav.userAgent, standalone: isStandalone(win), platform: nav.platform, maxTouchPoints: nav.maxTouchPoints });
}

// Does My day open the sheet by itself? Only for Safari on iPhone or iPad, not in the Home Screen app, at most once a
// day, and never after "Don't show again". pref: the saved INSTALL_HINT_KEY value (or null).
export function sheetDue({ hint, standalone, pref, now }) {
  if (!hint || hint.kind !== 'ios-safari' || standalone) return false;
  const p = pref && typeof pref === 'object' ? pref : {};
  if (p.never === true) return false;
  return p.snoozedDay !== dayOf(now);
}

// Does My day show the "may clear" banner? Only when the browser said 'may-clear' (never on 'unknown': no warning
// without a real answer), not in an installed app (which keeps its data), and not when dismissed today.
export function bannerDue({ kept, standalone, dismissedDay, now }) {
  return kept === 'may-clear' && !standalone && dismissedDay !== dayOf(now);
}

// The banner as HTML text. howTo: show "How to keep it" (there is a hint for this browser).
export const keepBannerHtml = (howTo) => `<section class="md-keep" aria-labelledby="md-keep-h">
      <h2 id="md-keep-h" class="sr-only">Keep your rounds</h2>
      <p>This browser may delete your saved rounds if you do not open the app for a while.</p>
      <div class="md-act"><button class="b" type="button" id="md-keep-backup">Download a backup</button>
        ${howTo ? '<button class="b" type="button" id="md-keep-how">How to keep it</button>' : ''}
        <button class="b quiet" type="button" id="md-keep-later">Not today</button></div>
    </section>`;

// The titles of the sheet for each kind of hint.
const TITLES = Object.freeze({ 'ios-safari': 'Add Speech Events to your Home Screen', 'android-chrome': 'Install Speech Events', desktop: 'Install Speech Events' });

// The sheet's card as HTML text. hint: installHint's answer. hasWork: rounds are saved here already, so the judge is
// told how to bring them along (a Home Screen app on iPhone and iPad keeps its own saved data, apart from Safari).
// auto: the sheet opened by itself, so it offers "Don't show again".
export function installSheetHtml(hint, { hasWork = false, auto = false } = {}) {
  const ios = hint.kind === 'ios-safari';
  return `<h2 id="ins-title">${esc(TITLES[hint.kind] || 'Install Speech Events')}</h2>
    <button class="iconbtn ask-x" type="button" data-ins="close" aria-label="Close">×</button>
    <div id="ins-body">
      <p class="ins-why">${esc(hint.why)}</p>
      <ol class="ins-steps">${hint.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${ios && hasWork ? '<p class="muted ins-note">Rounds already saved here stay in Safari. To bring them along, download a backup first, then restore it in the Home Screen app (Settings).</p>' : ''}
    </div>
    <div class="ask-btns">
      ${auto ? '<button class="b quiet" type="button" data-ins="never">Don\'t show again</button>' : ''}
      ${ios && hasWork ? '<button class="b" type="button" data-ins="backup">Download a backup</button>' : ''}
      <button class="b primary" type="button" data-ins="close">Got it</button>
    </div>`;
}

// The sheet in the page. env: { ui (core/ui.js: modalDialog), store, now() }. onBackup(): download a backup.
// afterClose() (optional): runs as the sheet closes, before focus goes back to the opener (My day redraws then).
// open(hint, { hasWork, auto }) shows it; focus moves to its first button and comes back to the opener; Esc, ×, "Got
// it" and the dim layer close it. Every close snoozes the sheet for today; "Don't show again" stops it for good.
export function createInstallSheet(env, onBackup, afterClose) {
  let wrap = null, card = null, dialog = null;
  function build() {
    if (dialog) return;
    wrap = document.createElement('div');
    wrap.className = 'overlay ins-wrap'; wrap.hidden = true;
    card = document.createElement('div');
    card.className = 'overlay-card ins-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'ins-title'); card.setAttribute('aria-describedby', 'ins-body');
    wrap.append(card);
    document.body.append(wrap);
    dialog = env.ui.modalDialog(wrap, card, { name: 'install-sheet', rank: 86, onClose: () => { snooze(); if (afterClose) afterClose(); } });
    card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ins]');
      if (!b) return;
      if (b.dataset.ins === 'never') save({ never: true });
      if (b.dataset.ins === 'backup') onBackup();
      dialog.close();
    });
  }
  const pref = () => { const p = env.store.get(INSTALL_HINT_KEY, null); return p && typeof p === 'object' ? p : {}; };
  const save = (more) => env.store.set(INSTALL_HINT_KEY, Object.assign({ snoozedDay: null, never: false }, pref(), more));
  function snooze() { save({ snoozedDay: dayOf(env.now()) }); }
  return {
    open(hint, opts) {
      if (!hint) return;
      build();
      card.innerHTML = installSheetHtml(hint, opts);
      dialog.open(card.querySelector('.ask-btns .primary'));
    },
    isOpen: () => Boolean(dialog && dialog.isOpen()),
    close() { if (dialog && dialog.isOpen()) dialog.close(); },
    pref,
  };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).installSheet = Object.freeze({ INSTALL_HINT_KEY, KEEP_BANNER_KEY, pageHint, sheetDue, bannerDue, keepBannerHtml, installSheetHtml, createInstallSheet });
