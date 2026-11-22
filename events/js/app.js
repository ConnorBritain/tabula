// Tabula Speech Events: the page (step E1). It boots the shared toast and dialog (core/ui.js), the store kept to the
// tabulaEvents.* keys (events/js/store.js), loads every event and rules profile (events/js/data.js), and draws the Rooms
// list (events/js/rooms.js). Room setup, the room screen, rank and review come in steps E4 to E8.
// Every events/js file is an ES module with named exports. Only this file boots the page; each new screen adds one
// import line here.
import { createUI } from '../../core/ui.js';
import { createEventsStore, ROOMS_KEY } from './store.js';
import { loadEventData } from './data.js';
import { groupRoomsByDay, roomsHtml } from './rooms.js';

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

loadEventData(readJson).then((data) => {
  renderRooms(data);
  document.documentElement.dataset.ready = 'true';
}).catch((err) => {
  console.error('Speech Events: the event rules did not load.', err);
  $('#rooms-status').textContent = 'The event rules did not load. Check the connection, then reload the page.';
  ui.toast('The event rules did not load.', { kind: 'error', key: 'load', action: { label: 'Reload', name: 'Reload the page', run: () => location.reload() } });
});
