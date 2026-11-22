// Tabula Speech Events: the page (step E1). It boots the shared toast and dialog (core/ui.js), the store kept to the
// tabulaEvents.* keys (events/js/store.js), loads every event and rules profile (events/js/data.js), and draws the Rooms
// list (events/js/rooms.js). Room setup and the room screen came in step E4; rank and review come in steps E7 and E8.
// Every events/js file is an ES module with named exports. Only this file boots the page; each new screen adds one
// import line here.
import { createUI } from '../../core/ui.js';
import { focusKind } from '../../core/keys.js';
import { createEventsStore, ROOMS_KEY } from './store.js';
import { loadEventData } from './data.js';
import { groupRoomsByDay, roomsHtml } from './rooms.js';
import { parseRoute, routeHash } from './routes.js';
import { upsertRoom } from './room.js';
import { keymap, keyOf } from './keys.js';
import { createSetupScreen } from './setup-screen.js';
import { createRoomScreen } from './room-screen.js';
import { createTimerView } from './timer-view.js';
import { createCommentView } from './comment-view.js';
import { createRankScreen } from './rank-screen.js';
import { createReviewScreen } from './review-screen.js';

const $ = (s) => document.querySelector(s);
const ui = createUI({ behind: 'header, main' });
const store = createEventsStore(ui);

// Read one file under events/. A reply that is not JSON (for example a host's HTML error page) names the file.
async function readJson(path) {
  const res = await fetch(new URL('../' + path, import.meta.url));
  if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
  try { return await res.json(); } catch { throw new Error(path + ': not JSON'); }
}

function renderRooms(data) {
  const groups = groupRoomsByDay(store.get(ROOMS_KEY, []));
  $('#rooms-status').textContent = groups.length ? '' : 'No rooms yet. Rooms you judge show here, by day.';
  $('#rooms-list').innerHTML = roomsHtml(groups, data.events);
}

// The screens share one box (#screen) and these helpers.
function boot(data) {
  const env = {
    el: $('#screen'), ui, data,
    now: () => Date.now(),
    rooms: () => store.get(ROOMS_KEY, []),
    saveRoom: (room) => store.set(ROOMS_KEY, upsertRoom(store.get(ROOMS_KEY, []), room)),
    go: (screen, id) => { location.hash = routeHash(screen, id); },
  };
  const screens = { setup: createSetupScreen(env), room: createRoomScreen(env, [createTimerView(), createCommentView()]), rank: createRankScreen(env), review: createReviewScreen(env) };
  let current = null;

  function route() {
    const r = parseRoute(location.hash);
    if (current && current.hide) current.hide();
    current = screens[r.screen] || null;
    $('#rooms').hidden = Boolean(current);
    env.el.hidden = !current;
    if (current) current.show(r.id);
    else { env.el.innerHTML = ''; renderRooms(data); }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // One key handler for the page: core/keys.js matches the key in the showing screen's scope.
  document.addEventListener('keydown', (ev) => {
    if (!current || !current.run || ev.defaultPrevented) return;
    const action = keymap.keyAction(keyOf(ev), { scopes: [current.scope], focus: focusKind(document.activeElement),
      modal: ui.askIsOpen() || Boolean(document.querySelector('.overlay:not([hidden])')), narrow: window.innerWidth < 820 });
    if (action && current.run(action)) ev.preventDefault();
  });
  route();
}

loadEventData(readJson).then((data) => {
  boot(data);
  document.documentElement.dataset.ready = 'true';
}).catch((err) => {
  console.error('Speech Events: the event rules did not load.', err);
  $('#rooms-status').textContent = 'The event rules did not load. Check the connection, then reload the page.';
  ui.toast('The event rules did not load.', { kind: 'error', key: 'load', action: { label: 'Reload', name: 'Reload the page', run: () => location.reload() } });
});
