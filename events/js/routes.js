// Speech Events: which screen shows, from the page address (step E4). Pure. The screen lives in the address hash, so
// a reload (or a phone that drops the tab) opens the same screen of the same room (ARCHITECTURE.md §6.3: refresh-safe).
//   #/            Rooms (home)          #/new          Room setup
//   #/room/<id>   the room screen       #/rank/<id>    Rank         #/review/<id>   Review and copy
// Every events/js file is an ES module with named exports; only app.js boots the page.

export const SCREENS = Object.freeze(['rooms', 'setup', 'room', 'rank', 'review']);
const WITH_ID = ['room', 'rank', 'review'];
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

// The route for a hash: { screen, id }. Anything unknown (or a room screen with a bad id) is the Rooms list.
export function parseRoute(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return { screen: 'rooms', id: null };
  if (parts[0] === 'new' && parts.length === 1) return { screen: 'setup', id: null };
  if (WITH_ID.includes(parts[0]) && parts.length === 2 && ID_RE.test(parts[1])) return { screen: parts[0], id: parts[1] };
  return { screen: 'rooms', id: null };
}

// The hash for a route (the reverse of parseRoute).
export function routeHash(screen, id) {
  if (screen === 'setup') return '#/new';
  if (WITH_ID.includes(screen) && id) return '#/' + screen + '/' + id;
  return '#/';
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).routes = Object.freeze({ SCREENS, parseRoute, routeHash });
