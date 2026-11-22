// Tabula Speech Events: the page (step E1). It boots the shared toast and dialog (core/ui.js), the store kept to the
// tabulaEvents.* keys (events/js/store.js), loads every event and rules profile (events/js/data.js), and draws the Rooms
// list (events/js/rooms.js). Room setup and the room screen came in step E4; rank and review come in steps E7 and E8.
// Step S1 (docs/events/EXPERIENCE.md §2): a round opens through the round-type router. Its family picks a workspace
// module (events/js/workspaces.js); the room workspace draws the Room, Rank and Review screens. The old room, rank and
// review addresses are aliases of #/round/<id>/<stage> (events/js/routes.js). This file still makes those screens and
// hands them to the workspace (env.roomScreens).
// Every events/js file is an ES module with named exports. Only this file boots the page.
import { createUI } from '../../core/ui.js';
import { focusKind } from '../../core/keys.js';
import { createEventsStore, ROOMS_KEY } from './store.js';
import { loadEventData } from './data.js';
import { groupRoomsByDay, roomsHtml } from './rooms.js';
import { parseRoute, routeHash, roundTarget } from './routes.js';
import { upsertRoom, findRoom } from './room.js';
import { keymap, keyOf } from './keys.js';
import { createSetupScreen } from './setup-screen.js';
import { createRoomScreen } from './room-screen.js';
import { createTimerView } from './timer-view.js';
import { createCommentView } from './comment-view.js';
import { createPieceView } from './piece-view.js';
import { createRankScreen } from './rank-screen.js';
import { createReviewScreen } from './review-screen.js';
import { loadWorkspace, roundFamily } from './workspaces.js';
import { registerOffline } from './offline.js';
import { createPageAI } from './page-ai.js';

const $ = (s) => document.querySelector(s);
const ui = createUI({ behind: 'header, main' });
const store = createEventsStore(ui);
registerOffline();

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
    ai: createPageAI(store), // step E13: the AI gate and the judge's own key (Review screen clean-up)
  };
  const screens = { setup: createSetupScreen(env) };
  // The room workspace's stages are the shipped screens, made once here (only app.js makes screens).
  env.roomScreens = { judge: createRoomScreen(env, [createPieceView(), createTimerView(), createCommentView()]), rank: createRankScreen(env), review: createReviewScreen(env) };
  // The showing screen: { scope, run(action), hide() }. A round's comes from its workspace (keys and mount).
  let current = null;
  let routeNo = 0; // which route() call is the latest, so a round that finishes loading late never draws

  function showBox(open) {
    $('#rooms').hidden = open;
    env.el.hidden = !open;
    if (!open) { env.el.innerHTML = ''; renderRooms(data); }
  }

  // Open one stage of a saved round in its family's workspace.
  async function openRound(target, no) {
    const round = findRoom(env.rooms(), target.id);
    if (!round) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
    const ws = await loadWorkspace(roundFamily(data.events, round));
    if (no !== routeNo) return;
    const stage = target.stage || ws.stages(round)[0];
    if (!ws.stages(round).includes(stage)) { showBox(false); window.scrollTo(0, 0); return; } // an unknown stage is like an unknown address
    showBox(true);
    const hide = ws.mount(env.el, env, round, stage);
    const k = ws.keys(round, stage);
    current = { scope: k.scope, run: k.run, hide };
    window.scrollTo(0, 0);
  }

  function route() {
    const no = ++routeNo;
    const r = parseRoute(location.hash);
    if (current && current.hide) current.hide();
    current = null;
    const target = roundTarget(r);
    if (target) {
      openRound(target, no).catch((err) => {
        console.error('Speech Events: the round did not open.', err);
        if (no === routeNo) env.go('rooms');
      });
      return;
    }
    current = screens[r.screen] || null;
    showBox(Boolean(current));
    if (current) current.show(r.id);
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
