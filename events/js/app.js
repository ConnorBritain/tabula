// Tabula Speech Events: the page (step E1). It boots the shared toast and dialog (core/ui.js), the store kept to the
// tabulaEvents.* keys (events/js/store.js), loads every event and rules profile (events/js/data.js), and draws the Rooms
// list (events/js/rooms.js). Room setup and the room screen came in step E4; rank and review come in steps E7 and E8.
// Step S1 (docs/events/EXPERIENCE.md §2): a round opens through the round-type router. Its family picks a workspace
// module (events/js/workspaces.js); the room workspace draws the Room, Rank and Review screens. The old room, rank and
// review addresses are aliases of #/round/<id>/<stage> (events/js/routes.js). This file still makes those screens and
// hands them to the workspace (env.roomScreens).
// Step S2 (EXPERIENCE.md §7, §8.1): the header on every screen, History, Settings, delete with Undo, the palette, and
// the read-time migration: every room and the settings are read through events/js/migrate.js.
// Every events/js file is an ES module with named exports. Only this file boots the page.
import { createUI } from '../../core/ui.js';
import { focusKind } from '../../core/keys.js';
import { escapeHtml as esc } from '../../core/sheets.js';
import { createEventsStore, ROOMS_KEY, SETTINGS_KEY } from './store.js';
import { loadEventData } from './data.js';
import { groupRoomsByDay, roomsHtml } from './rooms.js';
import { parseRoute, routeHash, roundTarget } from './routes.js';
import { upsertRoom, findRoom } from './room.js';
import { createDeleteRound } from './delete-round.js';
import { migrateRooms, migrateSettings } from './migrate.js';
import { MODES, modeMenuShown, withSetting } from './settings.js';
import { keymap, keyOf } from './keys.js';
import { paletteRows } from './palette.js';
import { createSetupScreen, eventChoices } from './setup-screen.js';
import { createRoomScreen } from './room-screen.js';
import { createTimerView } from './timer-view.js';
import { createCommentView } from './comment-view.js';
import { createPieceView } from './piece-view.js';
import { createRankScreen } from './rank-screen.js';
import { createRateScreen } from './rate-screen.js';
import { createCrossExView } from './cross-ex-view.js';
import { createReviewScreen } from './review-screen.js';
import { createHistoryScreen } from './history-screen.js';
import { createSettingsScreen } from './settings-screen.js';
import { createPalette } from './palette-screen.js';
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

// Every read of the saved rounds and the settings goes through the read-time migration (EXPERIENCE.md §8.1).
const readRooms = () => migrateRooms(store.get(ROOMS_KEY, []));
const readSettings = () => migrateSettings(store.get(SETTINGS_KEY, {}));

function renderRooms(data) {
  const groups = groupRoomsByDay(readRooms());
  $('#rooms-status').textContent = groups.length ? '' : 'No rooms yet. Rooms you judge show here, by day.';
  $('#rooms-list').innerHTML = roomsHtml(groups, data.events);
}

// The header (EXPERIENCE.md §1.1): the mode menu shows only when the settings say so; the link for the screen that
// shows is marked with aria-current (a fill, never an underline); the offline chip shows with the network off.
function renderHeader(screen) {
  const s = readSettings();
  const menu = $('#mode-menu'), sel = $('#mode-select');
  menu.hidden = !modeMenuShown(s);
  if (!sel.options.length) sel.innerHTML = MODES.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('');
  sel.value = s.mode;
  for (const [id, name] of [['#nav-history', 'history'], ['#nav-settings', 'settings']]) {
    if (screen === name) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
  }
}
const renderOffline = () => { $('#offline-chip').hidden = navigator.onLine !== false; };

// The screens share one box (#screen) and these helpers.
function boot(data) {
  let route = () => {};
  const env = {
    el: $('#screen'), ui, data, store,
    now: () => Date.now(),
    rooms: readRooms,
    saveRoom: (room) => store.set(ROOMS_KEY, upsertRoom(store.get(ROOMS_KEY, []), room)),
    go: (screen, id) => { location.hash = routeHash(screen, id); },
    ai: createPageAI(store), // step E13: the AI gate and the judge's own key (Review screen clean-up, Settings)
    settings: readSettings,
    saveSettings: (s) => { store.set(SETTINGS_KEY, s); renderHeader(parseRoute(location.hash).screen); },
    // Delete a round, with Undo in the toast that puts it back in the same place (EXPERIENCE.md §7; events/js/delete-round.js).
    // after(): the asking screen redraws and moves focus. After an Undo, the screen that shows then redraws.
    deleteRound: createDeleteRound({ get: () => store.get(ROOMS_KEY, []), set: (list) => store.set(ROOMS_KEY, list), ui,
      refresh: () => { if (!$('#rooms').hidden) renderRooms(data); else if (current && current.refresh) current.refresh(); } }),
    // After a restore: the theme, the header and the screen read the new data.
    reload() {
      if (globalThis.TabulaTheme) globalThis.TabulaTheme.set(readSettings().theme);
      route();
    },
  };
  const screens = { setup: createSetupScreen(env), history: createHistoryScreen(env), settings: createSettingsScreen(env) };
  // The room workspace's stages are the shipped screens, made once here (only app.js makes screens).
  // Step S4: the F2 cross-ex part under the timer, and the Rate screen for a profile with ranks off (room-workspace.js).
  env.roomScreens = { judge: createRoomScreen(env, [createPieceView(), createTimerView(), createCrossExView(), createCommentView()]), rank: createRankScreen(env), rate: createRateScreen(env), review: createReviewScreen(env) };
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

  route = function () {
    const no = ++routeNo;
    const r = parseRoute(location.hash);
    if (current && current.hide) current.hide();
    current = null;
    renderHeader(r.screen);
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
  };
  window.addEventListener('hashchange', route);

  // The mode menu in the header (shown only after Coach or Student is on). In S2 the mode changes nothing else.
  $('#mode-select').addEventListener('change', (e) => env.saveSettings(withSetting(readSettings(), 'mode', e.target.value)));
  window.addEventListener('online', renderOffline);
  window.addEventListener('offline', renderOffline);
  renderOffline();

  // Delete from the Rooms list (with Undo, like History).
  $('#rooms-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-del]');
    if (b) env.deleteRound(b.dataset.del, () => { renderRooms(data); $('#rooms-title').focus(); });
  });

  // The palette (⌘K / Ctrl+K): each enabled event, each saved round, History and Settings, and the waiting Undo.
  const palette = createPalette(env,
    () => paletteRows({ events: data.events, choices: eventChoices(data), rooms: groupRoomsByDay(env.rooms()).flatMap((g) => g.rooms), undo: (ui.pendingUndo() || {}).name || '' }),
    (row) => {
      if (row.act === 'undo') { const u = ui.pendingUndo(); if (u) u.run(); return; }
      if (row.hash === location.hash || (row.hash === '#/' && !location.hash)) route(); else location.hash = row.hash;
    });

  // One key handler for the page: core/keys.js matches the key in the 'global' scope and the showing screen's scope.
  document.addEventListener('keydown', (ev) => {
    if (ev.defaultPrevented) return;
    const key = keyOf(ev);
    // ⌘K again closes the open palette (its own dialog makes every other shortcut wait).
    if (palette.isOpen()) {
      if (keymap.keyAction(key, { scopes: ['global'], focus: 'text' }) === 'palette') { ev.preventDefault(); palette.close(); }
      return;
    }
    const action = keymap.keyAction(key, { scopes: ['global'].concat(current && current.scope ? [current.scope] : []), focus: focusKind(document.activeElement),
      modal: ui.askIsOpen() || Boolean(document.querySelector('.overlay:not([hidden])')), narrow: window.innerWidth < 820 });
    if (action === 'palette') { ev.preventDefault(); palette.open(); return; }
    if (action && current && current.run && current.run(action)) ev.preventDefault();
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
