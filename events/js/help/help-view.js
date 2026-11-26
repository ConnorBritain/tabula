// Speech Events judge help: the DOM side of help.js. Each screen hooks in with one call:
//   room-screen.js  mountRoomHelp(env, room, el)  the first-room walk (once per device) and "What to listen for"
//   settings-screen.js  mountTipsPart(env, el)    the "Show the first-room tips again" line
// (The Rank screen's "How to rank" fold is plain HTML text: rank-screen.js puts rankHelpHtml(room) in its page.)
// Nothing here blocks the room: the walk is a card in the page, not a dialog, and the timer keys keep working.
// It reads and writes only tabulaEvents.help.v1 through the page's store (env.store); it sends nothing anywhere.
import { roomEvent } from '../room.js';
import { walkDue, markWalkSeen, resetWalk, walkHtml, WALK_STEPS, listenModel, listenOpen, listenHtml, tipsPartHtml } from './help.js';

// The room's help, put above the roster and stage. env: the room screen's env ({ el, ui, data, store, rooms() });
// room: the room being shown; el: the screen element (the help goes before its .room-grid). The room screen redraws
// only the roster and stage, so this part stays put while the judge works.
// Shown on this page already: if the browser cannot save the flag (a private window, full storage), the walk still
// shows only once until the page reloads.
let walkShownHere = false;

// A phone-width screen (the comment view's 820 px break).
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 820px)').matches;

export function mountRoomHelp(env, room, el) {
  const grid = el && el.querySelector('.room-grid');
  if (!grid || !room) return null;
  const box = document.createElement('div');
  box.className = 'help-room';
  const showWalk = Boolean(env.store) && walkDue(env.store) && !walkShownHere;
  box.innerHTML = (showWalk ? walkHtml(0, room.profile) : '') + listenHtml(listenModel(roomEvent(env.data.events, room), room), listenOpen(env.rooms(), room.id, narrow()));
  grid.parentNode.insertBefore(box, grid);
  // Shown once per device: marked as soon as it shows, so a judge who walks away mid-round never sees it twice.
  if (showWalk) { walkShownHere = true; markWalkSeen(env.store); }
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-hact]');
    if (!b || !box.contains(b)) return;
    const walk = box.querySelector('#help-walk');
    if (!walk) return;
    const at = Number(walk.dataset.step) || 0;
    const act = b.dataset.hact;
    if (act === 'next' || act === 'back') {
      const to = Math.min(Math.max(at + (act === 'next' ? 1 : -1), 0), WALK_STEPS.length - 1);
      walk.outerHTML = walkHtml(to, room.profile);
      const h = box.querySelector('#help-walk-h');
      if (h) h.focus();
      return;
    }
    // Skip tips or Got it: the card goes; the focus lands on the next real step, the room's title.
    walk.remove();
    if (env.ui && env.ui.announce) env.ui.announce('Tips closed. Settings can show them again.');
    const t = el.querySelector('#screen-title');
    if (t) t.focus();
  });
  return box;
}

// The Settings line, put just before About. env: the settings screen's env ({ ui, store }); el: the screen element.
// settings-screen.js redraws the whole screen at times, so it calls this after each draw.
export function mountTipsPart(env, el) {
  if (!el || el.querySelector('#help-set')) return;
  const about = el.querySelector('[aria-labelledby="set-about-h"]');
  const holder = document.createElement('div');
  holder.innerHTML = tipsPartHtml();
  const part = holder.firstElementChild;
  if (about) about.parentNode.insertBefore(part, about); else el.appendChild(part);
  part.querySelector('#help-tips-again').addEventListener('click', () => {
    resetWalk(env.store);
    walkShownHere = false;
    env.ui.toast('The tips show in the next room you open.', { key: 'help-tips' });
  });
}
