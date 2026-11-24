// Speech Events step S2 (docs/events/EXPERIENCE.md §7): the palette rows, "Search and commands" (⌘K / Ctrl+K).
// Pure: no DOM. core/keys.js searchCommands does the search; palette-screen.js draws the list and runs the row.
//
// A row: { id, label, group, alias, hash, hint? } where hash is the page address the row opens (every row is a place in the
// app today), or { ..., act } for a row the page runs itself (Undo).
// Step S3: the home row is "My day", and "Start a round" opens the type picker (#/pick).
// "Guide: <event>" rows open the type page (#/type/<eventId>): one for each enabled event, and one for Custom.
import { routeHash } from './routes.js';
import { roundLine, STATE_LABEL } from './rooms.js';
import { roomText } from './cards.js';
import { roomEvent, CUSTOM_EVENT } from './room.js';

// Each group shows once, in this order (design review §2.13, bug 4: the Congress rows came between other groups, so
// "Go to" and "New" showed twice). Rounds come first: "Open HI R2" is the common task in the middle of a day.
export const GROUP_ORDER = Object.freeze(['Undo', 'Rounds', 'Go to', 'New', 'Guide']);

// ctx: { events (the registry), choices ([{ id, name, short }] for each enabled event, in picker order), rooms (the
// saved rounds, newest first is best), undo (the waiting Undo's name, or '') }.
export function paletteRows(ctx) {
  const c = ctx || {};
  const rows = [];
  if (c.undo) rows.push({ id: 'undo', label: c.undo, group: 'Undo', alias: ['undo'], act: 'undo' });
  rows.push({ id: 'go-rooms', label: 'My day', group: 'Go to', alias: ['home', 'today', 'rooms'], hash: routeHash('rooms') });
  rows.push({ id: 'go-history', label: 'History', group: 'Go to', alias: ['table', 'export', 'csv', 'tsv'], hash: routeHash('history') });
  rows.push({ id: 'go-settings', label: 'Settings', group: 'Go to', alias: ['backup', 'restore', 'theme', 'keys', 'offline'], hash: routeHash('settings') });
  rows.push({ id: 'pick', label: 'Start a round', group: 'New', alias: ['pick', 'ballot', 'card'], hash: routeHash('pick') });
  rows.push({ id: 'go-chambers', label: 'Congress chambers', group: 'Go to', alias: ['congress', 'chamber', 'house', 'senate'], hash: routeHash('chamber') });
  rows.push({ id: 'new-chamber', label: 'New Congress chamber', group: 'New', alias: ['congress', 'chamber', 'scorer'], hash: routeHash('chamber', 'new') });
  rows.push({ id: 'new', label: 'New round', group: 'New', alias: ['start', 'room'], hash: routeHash('setup') });
  for (const ev of c.choices || []) {
    rows.push({ id: 'new-' + ev.id, label: 'New ' + (ev.short || ev.name) + ' round', group: 'New', alias: [ev.name], hash: routeHash('setup', ev.id) });
  }
  for (const ev of (c.choices || []).concat([{ id: CUSTOM_EVENT, name: 'Custom event', short: 'Custom event' }])) {
    rows.push({ id: 'guide-' + ev.id, label: 'Guide: ' + (ev.short || ev.name), group: 'Guide', alias: [ev.name, 'Guide ' + ev.name, 'rules', 'about'], hash: routeHash('type', ev.id) });
  }
  for (const r of (c.rooms || []).filter((x) => x && x.id)) {
    const ev = roomEvent(c.events, r);
    const short = ev ? ev.short || ev.name : 'Custom';
    const line = roundLine(r, true) || 'Untitled round';
    // hint: the room and the state, shown at the right of the row (design review §2.13).
    const hint = [roomText(r.roomLabel), STATE_LABEL[r.state] || STATE_LABEL.setup].filter(Boolean).join(' · ');
    rows.push({ id: 'open-' + r.id, label: 'Open ' + short + ' · ' + line, group: 'Rounds', hint, alias: [ev ? ev.name : 'Custom event'], hash: routeHash('round', r.id) });
  }
  // A stable sort by group: rows keep their order inside a group.
  const rank = (g) => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? GROUP_ORDER.length : i; };
  return rows.map((r, i) => [r, i]).sort((a, b) => rank(a[0].group) - rank(b[0].group) || a[1] - b[1]).map((x) => x[0]);
}

// Run the palette's Undo row. The row was made when the palette opened; by the time the judge picks it, its toast may
// have closed, or a newer Undo may wait instead. Only the Undo the row names runs; otherwise the judge is told, and
// nothing else is undone. ui: { pendingUndo, toast }. Returns true when it ran.
export function runUndo(ui, row) {
  const u = ui.pendingUndo();
  if (!u || !row || u.name !== row.label) { ui.toast('That Undo is no longer there.', { key: 'undo-gone' }); return false; }
  u.run();
  return true;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).palette = Object.freeze({ GROUP_ORDER, paletteRows, runUndo });
