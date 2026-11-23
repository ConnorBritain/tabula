// Speech Events: which screen shows, from the page address (step E4). Pure. The screen lives in the address hash, so
// a reload (or a phone that drops the tab) opens the same screen of the same room (ARCHITECTURE.md §6.3: refresh-safe).
//   #/            Rooms (home)          #/new          Room setup
//   #/room/<id>   the room screen       #/rank/<id>    Rank         #/review/<id>   Review and copy
//   #/round/<id>  and  #/round/<id>/<stage>   the round-type router (EXPERIENCE.md §1.3, step S1)
//   #/history     History (step S2)    #/settings     Settings (step S2)
//   #/new/<eventId>   Room setup with that event picked (the palette's "New HI round", step S2). The event id is a
//                     public event code ("hi"), never a name; nothing ever goes in a query string.
// The room, rank and review routes are aliases of #/round/<id>/judge, /rank and /review: old bookmarks and live rooms
// keep working. roundTarget gives the one round-and-stage shape for all four.
// Every events/js file is an ES module with named exports; only app.js boots the page.

export const SCREENS = Object.freeze(['rooms', 'setup', 'room', 'rank', 'review', 'round', 'history', 'settings']);
const WITH_ID = ['room', 'rank', 'review'];
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const STAGE_RE = /^[a-z]{1,20}$/;
const EVENT_RE = /^[a-z0-9-]{1,20}$/;
// Screens with no id: their hash is their name.
const PLAIN = ['history', 'settings'];
// The stage each old route names.
const ALIAS_STAGE = Object.freeze({ room: 'judge', rank: 'rank', review: 'review' });

// The route for a hash: { screen, id } (a round route adds stage, null when the hash names none). Anything unknown
// (or a room screen with a bad id) is the Rooms list.
export function parseRoute(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return { screen: 'rooms', id: null };
  if (parts[0] === 'new' && parts.length === 1) return { screen: 'setup', id: null };
  if (parts[0] === 'new' && parts.length === 2 && EVENT_RE.test(parts[1])) return { screen: 'setup', id: parts[1] };
  if (PLAIN.includes(parts[0]) && parts.length === 1) return { screen: parts[0], id: null };
  if (WITH_ID.includes(parts[0]) && parts.length === 2 && ID_RE.test(parts[1])) return { screen: parts[0], id: parts[1] };
  if (parts[0] === 'round' && (parts.length === 2 || parts.length === 3) && ID_RE.test(parts[1]) && (parts.length === 2 || STAGE_RE.test(parts[2]))) {
    return { screen: 'round', id: parts[1], stage: parts[2] || null };
  }
  return { screen: 'rooms', id: null };
}

// The round and stage a route opens: { id, stage }, or null for a route that is not a round (Rooms, setup).
// stage is null for #/round/<id> with no stage; the workspace then opens its first stage.
export function roundTarget(route) {
  if (!route || !route.id) return null;
  if (ALIAS_STAGE[route.screen]) return { id: route.id, stage: ALIAS_STAGE[route.screen] };
  if (route.screen === 'round') return { id: route.id, stage: route.stage || null };
  return null;
}

// The hash for a route (the reverse of parseRoute). For setup, id is the event to pick (optional).
export function routeHash(screen, id) {
  if (screen === 'setup') return id && EVENT_RE.test(id) ? '#/new/' + id : '#/new';
  if (PLAIN.includes(screen)) return '#/' + screen;
  if (screen === 'round' && id) return '#/round/' + id;
  if (WITH_ID.includes(screen) && id) return '#/' + screen + '/' + id;
  return '#/';
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).routes = Object.freeze({ SCREENS, parseRoute, roundTarget, routeHash });
