// Tabula Speech Events: the page (step E1). It boots the shared toast and dialog (core/ui.js), the store kept to the
// tabulaEvents.* keys (events/js/store.js), loads every event and rules profile (events/js/data.js), and draws the Rooms
// list (events/js/rooms.js). Room setup and the room screen came in step E4; rank and review come in steps E7 and E8.
// Step S1 (docs/events/EXPERIENCE.md §2): a round opens through the round-type router. Its family picks a workspace
// module (events/js/workspaces.js); the room workspace draws the Room, Rank and Review screens. The old room, rank and
// review addresses are aliases of #/round/<id>/<stage> (events/js/routes.js). This file still makes those screens and
// hands them to the workspace (env.roomScreens).
// Step S2 (EXPERIENCE.md §7, §8.1): the header on every screen, History, Settings, delete with Undo, the palette, and
// the read-time migration: every room and the settings are read through events/js/migrate.js.
// Step S3 (EXPERIENCE.md §1.2, §5): #/ is My day (events/js/myday-screen.js), not the Rooms list. The judge's days and
// ballot cards are read and saved through events/js/day-store.js (env.day). New routes: #/pick, #/start/<cardId>,
// #/type/<eventId>.
// Every events/js file is an ES module with named exports. Only this file boots the page.
import { rules as demoRules } from '../sample-guide/rules.js';
import { savedDraft, createSampleWriter } from '../sample-guide/scenario.js';
import { mountDemo } from '../sample-guide/journey.js';
import { createUI } from '../../core/ui.js';
import { focusKind } from '../../core/keys.js';
import { escapeHtml as esc } from '../../core/sheets.js';
import { createEventsStore, ROOMS_KEY, SETTINGS_KEY } from './store.js';
import { loadEventData } from './data.js';
import { groupRoomsByDay } from './rooms.js';
import { parseRoute, routeHash, roundTarget } from './routes.js';
import { upsertRoom, findRoom } from './room.js';
import { createDeleteRound } from './delete-round.js';
import { migrateRooms, migrateSettings } from './migrate.js';
import { MODES, modeMenuShown, withSetting } from './settings.js';
import { keymap, keyOf } from './keys.js';
import { paletteRows, runUndo } from './palette.js';
import { createSetupScreen, eventChoices } from './setup-screen.js';
import { createRoomScreen } from './room-screen.js';
import { createTimerView } from './timer-view.js';
import { createCommentView } from './comment-view.js';
import { createPieceView } from './piece-view.js';
import { createQuoteView } from './quote-view.js';
import { createRunsParts } from './runs-view.js';
import { createRankScreen } from './rank-screen.js';
import { createRateScreen } from './rate-screen.js';
import { createCrossExView } from './cross-ex-view.js';
import { createReviewScreen } from './review-screen.js';
import { createHistoryScreen } from './history-screen.js';
import { createSettingsScreen } from './settings-screen.js';
import { createPalette } from './palette-screen.js';
import { mountSprite } from './icons.js';
import { loadWorkspace, roundFamily } from './workspaces.js';
import { registerOffline } from './offline.js';
import { watchUpdates, pageBusy } from './update-gate.js';
import { createPageAI } from './page-ai.js';
import { createDayStore } from './day-store.js';
import { createMydayScreen } from './myday-screen.js';
import { createPickerScreen } from './picker-screen.js';
import { createTypeScreen } from './type-screen.js';
import { focusIfLost } from './focus.js';
import { createChamberScreen } from '../congress/chamber-screen.js';
import { findRound as findCongressRound } from '../congress/workspace.js';
import { congressIO, congressToday } from '../congress/store.js';
import { autoDeleteAtStart, finishLifetimeRecovery } from './lifetime.js';
import { createDataRecoveryView } from './data-recovery-view.js';
import { eventsWriter as realWriter } from './writer.js';
import { createWriterWaitingView } from './writer-view.js';

const demoParam = new URLSearchParams(location.search).get('demo');
const demoRequested = demoParam !== null && !['off', '0', 'false'].includes(demoParam.trim().toLowerCase());
if (demoRequested && !globalThis.TabulaDemo) throw new Error('The sample could not start safely. Close this tab.');
const isDemo = Boolean(globalThis.TabulaDemo);
const writer = isDemo ? createSampleWriter() : realWriter;
let stopDemo = null;
const $ = (s) => document.querySelector(s);
const ui = createUI({ behind: 'header, main' });
mountSprite(document); // the Lucide sprite (icons.js): every icon on every screen points into it
const store = isDemo ? createEventsStore(ui, undefined, { writer }) : createEventsStore(ui);
let loadedData = null;
let booted = false;
let skipAutoDelete = false;
let resumeCurrent = null;
let resumeSettingsRecovery = null;
let stopCurrent = null;
let stalePage = false;
let recoveryStarted = false;
const waitingView = createWriterWaitingView({ el: $('#screen'), writer, retry: acquireWriter });
const recoveryView = createDataRecoveryView({ el: $('#screen'), journal: store.journal, ui,
  onRecovered(result) {
    skipAutoDelete = skipAutoDelete || result.recovered;
    finishLifetimeRecovery(result);
    if (booted && resumeSettingsRecovery?.(result)) return;
    document.querySelector('header').inert = false;
    if (booted) resumeCurrent(); else startWhenSafe();
  },
});
function showWaiting() {
  if (stopCurrent) stopCurrent();
  recoveryView.hide();
  document.documentElement.dataset.writer = writer.state().status;
  document.documentElement.dataset.ready = 'false';
  document.querySelector('header').inert = true;
  $('#main').inert = false;
  $('#toasts').inert = true;
  $('#boot-status').hidden = true;
  waitingView.show();
}
function quarantine() {
  if (!writer.isHeld()) { showWaiting(); return; }
  document.documentElement.dataset.recovery = 'blocked';
  document.documentElement.dataset.ready = 'false';
  document.querySelector('header').inert = true;
  $('#boot-status').hidden = true;
  recoveryView.show();
}
// The native lock comes before recovery, saved-data views, startup deletion, AI keys and clocks.
async function acquireWriter() {
  const status = await writer.acquire();
  if (!status.held || !writer.isHeld()) { showWaiting(); return; }
  if (stalePage) { location.reload(); return; }
  waitingView.hide();
  document.documentElement.dataset.writer = 'held';
  $('#toasts').inert = false;
  if (!recoveryStarted) {
    recoveryStarted = true;
    const initialRecovery = store.journal.recover();
    skipAutoDelete = initialRecovery.recovered;
    if (!initialRecovery.ok) { quarantine(); return; }
  }
  startWhenSafe();
}
writer.onLost(() => { stalePage = true; stopDemo?.(); stopDemo = null; showWaiting(); });
window.addEventListener('pagehide', () => {
  stalePage = true;
  if (stopCurrent) stopCurrent();
  writer.release();
  if (ui.askIsOpen()) $('#ask-x').click();
  showWaiting();
});
window.addEventListener('pageshow', (event) => { if (event.persisted) { stalePage = true; showWaiting(); } });
acquireWriter();
function startWhenSafe() {
  if (!writer.isHeld()) { showWaiting(); return; }
  if (store.journal.state().blocked) { quarantine(); return; }
  if (!loadedData || booted) return;
  if (!skipAutoDelete) {
    skipAutoDelete = true;
    autoDeleteAtStart({ store, ui, now: () => Date.now(), refresh: () => { if (resumeCurrent) resumeCurrent(); } });
    if (store.journal.state().blocked) { quarantine(); return; }
  }
  recoveryView.hide();
  document.querySelector('header').inert = false;
  document.documentElement.dataset.recovery = 'ready';
  boot(loadedData);
  booted = true;
  $('#boot-status').hidden = true;
  document.documentElement.dataset.ready = 'true';
}

// Read one file under events/. A reply that is not JSON (for example a host's HTML error page) names the file.
async function readJson(path) {
  if (isDemo) {
    if (!(path in demoRules)) throw new Error('Missing sample rules: ' + path);
    return structuredClone(demoRules[path]);
  }
  const res = await fetch(new URL('../' + path, import.meta.url));
  if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
  try { return await res.json(); } catch { throw new Error(path + ': not JSON'); }
}

// Every read of the saved rounds and the settings goes through the read-time migration (EXPERIENCE.md §8.1).
const readRooms = () => migrateRooms(store.get(ROOMS_KEY, []));
const readSettings = () => migrateSettings(store.get(SETTINGS_KEY, {}));
if (!isDemo) watchUpdates(registerOffline(), () => !writer.isHeld() || store.journal.state().blocked || pageBusy({ screen: parseRoute(location.hash).screen, rooms: readRooms(), congress: congressIO(store).read() })); // a new release waits for a quiet screen

// The header (EXPERIENCE.md §1.1): the mode menu shows only when the settings say so; the link for the screen that
// shows is marked with aria-current (a fill, never an underline); the offline chip shows with the network off.
function renderHeader(screen) {
  if (!writer.isHeld() || store.journal.state().blocked) { $('#mode-menu').hidden = true; return; }
  const s = readSettings();
  const menu = $('#mode-menu'), sel = $('#mode-select');
  menu.hidden = !modeMenuShown(s); // Shows only for a saved Coach or Student mode (copy trim E46); Settings cannot set one now.
  if (!sel.options.length) sel.innerHTML = MODES.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('');
  sel.value = s.mode;
  // Design build (color review §6 Header): My day joins the nav; the current page gets a tint and bold.
  for (const [id, name] of [['#nav-myday', 'rooms'], ['#nav-history', 'history'], ['#nav-settings', 'settings']]) {
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
    sampleDraft: isDemo ? savedDraft : null,
    rooms: readRooms,
    saveRoom: (room) => store.set(ROOMS_KEY, upsertRoom(store.get(ROOMS_KEY, []), room)),
    go: (screen, id) => { location.hash = routeHash(screen, id); },
    ai: createPageAI(store), // step E13: the AI gate and the judge's own key (Review screen clean-up, Settings)
    settings: readSettings,
    saveSettings: (s) => { const saved = store.set(SETTINGS_KEY, s); renderHeader(parseRoute(location.hash).screen); return saved; },
    // Delete a round, with Undo in the toast that puts it back in the same place (EXPERIENCE.md §7; events/js/delete-round.js).
    // after(): the asking screen redraws and moves focus. After an Undo, the screen that shows then redraws.
    deleteRound: createDeleteRound({ get: () => store.get(ROOMS_KEY, []), set: (list) => store.set(ROOMS_KEY, list), ui,
      refresh: () => { if (current && current.refresh) current.refresh(); focusIfLost(document, ['#screen-title', '#main']); } }),
    // After a restore: the theme, the header and the screen read the new data.
    reload() {
      if (!writer.isHeld()) { showWaiting(); return; }
      if (store.journal.state().blocked) { route(); return; }
      if (globalThis.TabulaTheme) globalThis.TabulaTheme.set(readSettings().theme);
      route();
    },
  };
  resumeCurrent = () => env.reload();
  env.day = createDayStore({ store, now: env.now });
  env.congressToday = (now) => congressToday(congressIO(store).read(), now); // My day lists today's Congress chambers (S6 keeps them apart)
  const screens = { rooms: createMydayScreen(env), setup: createSetupScreen(env), history: createHistoryScreen(env), settings: createSettingsScreen(env),
    pick: createPickerScreen(env), type: createTypeScreen(env), chamber: createChamberScreen(env) };
  resumeSettingsRecovery = (result) => screens.settings.finishRecovery(result);
  screens.start = { scope: 'setup', show: (cardId) => screens.setup.show(null, { cardId }) }; // #/start/<cardId>: setup filled from the card
  // The room workspace's stages are the shipped screens, made once here (only app.js makes screens).
  // Step S4: the F2 cross-ex part under the timer, and the Rate screen for a profile with ranks off (room-workspace.js).
  env.roomScreens = { judge: createRoomScreen(env, [createQuoteView(), createTimerView(), createPieceView(), createCrossExView(), createCommentView()]), rank: createRankScreen(env), rate: createRateScreen(env), review: createReviewScreen(env) };
  // Step S5: the F4 workspace's judge stage (PCC), a Room screen with the run parts (runs-view.js).
  env.runsScreens = { judge: createRoomScreen(env, [createQuoteView(), ...createRunsParts(), createCommentView()]) };
  // The showing screen: { scope, run(action), hide() }. A round's comes from its workspace (keys and mount).
  let current = null;
  let routeNo = 0; // which route() call is the latest, so a round that finishes loading late never draws

  // Show a screen that is not a round (My day for an unknown address).
  function showScreen(name, id) {
    current = screens[name] || screens.rooms;
    current.show(id);
    env.onRendered?.();
    window.scrollTo(0, 0);
  }

  // Open one stage of a saved round in its family's workspace.
  async function openRound(target, no) {
    // Step S6: a Congress session lives in its own key (tabulaEvents.congress.v1), never in rooms.v1.
    const room = findRoom(env.rooms(), target.id);
    const round = room || findCongressRound(store, target.id);
    if (!round) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
    const ws = await loadWorkspace(room ? roundFamily(data.events, round) : 'congress');
    if (no !== routeNo || !writer.isHeld()) return;
    const stage = target.stage || ws.stages(round)[0];
    if (!ws.stages(round).includes(stage)) { showScreen('rooms'); return; } // an unknown stage is like an unknown address
    const hide = ws.mount(env.el, env, round, stage);
    env.onRendered?.();
    const k = ws.keys(round, stage);
    current = { scope: k.scope, run: k.run, hide };
    window.scrollTo(0, 0);
  }

  route = function () {
    const no = ++routeNo;
    const r = parseRoute(location.hash);
    if (current && current.hide) current.hide();
    current = null;
    if (!writer.isHeld()) { current = waitingView; showWaiting(); return; }
    if (store.journal.state().blocked) { current = recoveryView; quarantine(); return; }
    document.querySelector('header').inert = false;
    document.documentElement.dataset.recovery = 'ready';
    renderHeader(r.screen);
    const target = roundTarget(r);
    if (target) {
      openRound(target, no).catch((err) => {
        console.error('Speech Events: the round did not open.', err);
        if (no === routeNo) env.go('rooms');
      });
      return;
    }
    showScreen(r.screen, r.id);
  };
  window.addEventListener('hashchange', route);

  // The mode menu in the header (shown only after Coach or Student is on). In S2 the mode changes nothing else.
  $('#mode-select').addEventListener('change', (e) => env.saveSettings(withSetting(readSettings(), 'mode', e.target.value)));
  window.addEventListener('online', renderOffline);
  window.addEventListener('offline', renderOffline);
  renderOffline();

  // The palette (⌘K / Ctrl+K): each enabled event, each saved round, History and Settings, and the waiting Undo.
  const palette = createPalette(env,
    () => paletteRows({ events: data.events, choices: eventChoices(data), rooms: groupRoomsByDay(env.rooms()).flatMap((g) => g.rooms), undo: (ui.pendingUndo() || {}).name || '' }),
    (row) => {
      if (row.act === 'undo') { runUndo(ui, row); return; }
      if (row.hash === location.hash || (row.hash === '#/' && !location.hash)) route(); else location.hash = row.hash;
    });

  // One key handler for the page: core/keys.js matches the key in the 'global' scope and the showing screen's scope.
  document.addEventListener('keydown', (ev) => {
    if (ev.defaultPrevented || (isDemo && env.el.inert) || !writer.isHeld() || store.journal.state().blocked) return;
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
  stopCurrent = () => { routeNo++; if (current?.hide) current.hide(); current = null; palette.close(); };
  route();
  if (isDemo) stopDemo = mountDemo(env);
}

loadEventData(readJson).then((data) => {
  loadedData = data;
  startWhenSafe();
}).catch((err) => {
  console.error('Speech Events: the event rules did not load.', err);
  $('#boot-status').textContent = 'The event rules did not load. Check the connection, then reload the page.';
  ui.toast('The event rules did not load.', { kind: 'error', key: 'load', action: { label: 'Reload', name: 'Reload the page', run: () => location.reload() } });
});
