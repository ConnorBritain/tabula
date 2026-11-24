// Tests for the Speech Events page shell (docs/events/LANDING.md §4.1, step E1). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { groupRoomsByDay, roomRow, roomsHtml } from './js/rooms.js';
import { createEventsStore, ROOMS_KEY, PREFIX, SETTINGS_KEY } from './js/store.js';

const at = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(at(p), 'utf8');
const readJson = async (p) => JSON.parse(read(p));
const PUB = JSON.parse(read('published.json'));
const HTML = read('index.html');

// Why: the app is only as good as its rules; if one listed event did not load, a judge could open a room with no
// time limit or the wrong one.
test('every published event and profile loads through the shared registry', async () => {
  const data = await loadEventData(readJson);
  assert.equal(data.events.keys().length, PUB.defs.length);
  assert.equal(data.profiles.keys().length, PUB.profiles.length);
  assert.equal(data.events.get('oo').limitMinutes, 10);
  const ids = await Promise.all(PUB.defs.map(async (f) => (await readJson('defs/' + f)).id));
  assert.deepEqual(data.order, ids, 'the picker order is published.json\'s order, by each file\'s own id');
  assert.deepEqual(data.order.slice(0, 3), ['oo', 'inf', 'usx']);
  await assert.rejects(loadEventData(async (p) => (p === 'published.json' ? { defs: ['nope.v1.json'], profiles: PUB.profiles } : readJson(p))), 'a listed file that is missing stops the load');
  await assert.rejects(loadEventData(async () => ({ defs: [], profiles: [] })), /no events or no profiles/, 'an empty manifest is an error, not an app with no rules');
});

// Why: the Rooms list is how a judge finds today's room; a broken saved record must not hide the others or draw a
// half row.
test('the Rooms list groups by day, newest first, and leaves out broken records', async () => {
  const data = await loadEventData(readJson);
  const day1 = new Date(2026, 10, 20, 9).getTime(), day2 = new Date(2026, 10, 21, 9).getTime();
  const groups = groupRoomsByDay([
    { id: 'a', createdAt: day1, eventId: 'oo', eventVersion: 1, round: 'R1', state: 'done', entries: [{}, {}] },
    { id: 'b', createdAt: day2, eventId: 'duo', eventVersion: 1, round: 'R2', entries: [{}] },
    { id: 'c' }, null,
  ]);
  assert.deepEqual(groups.map((g) => [g.day, g.rooms.map((r) => r.id)]), [['2026-11-21', ['b']], ['2026-11-20', ['a']]]);
  assert.deepEqual(roomRow(groups[1].rooms[0], data.events), { id: 'a', name: 'Original Oratory', round: 'R1', count: '2 entries', state: 'Copied' });
  assert.equal(roomRow({ id: 'x', eventId: 'zz', entries: [] }, data.events).name, 'Custom event');
  assert.deepEqual(groupRoomsByDay([]), []);
  const html = roomsHtml(groupRoomsByDay([{ id: 'z', createdAt: day1, eventId: 'oo', eventVersion: 1, round: '<b>R1</b>', entries: [] }]), data.events);
  assert.ok(html.includes('&lt;b&gt;R1&lt;/b&gt;') && !html.includes('<b>R1'), 'typed text is escaped in the list');
});

// Why: both apps share one browser; the events store must never read or write a judge's debate rounds.
test('the events store keeps to tabulaEvents.* and cannot touch debate keys', () => {
  const m = new Map([['policyJudge.round.v1', '{}']]);
  const box = { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const toasts = [];
  const s = createEventsStore({ toast: (m, o) => toasts.push(o.key), dismissToast() {} }, box);
  assert.ok(ROOMS_KEY.startsWith(PREFIX));
  assert.ok(s.set(ROOMS_KEY, []));
  assert.throws(() => s.get('policyJudge.round.v1'), /may not use the key/);
  assert.match(read('js/app.js'), /createEventsStore\(ui\)/, 'the page uses this store');
  const full = createEventsStore({ toast: (m, o) => toasts.push(o.key), dismissToast() {} }, { getItem: () => null, setItem() { throw new Error('full'); }, removeItem() {}, length: 0, key: () => null });
  full.set(ROOMS_KEY, []); full.set(ROOMS_KEY, []);
  assert.deepEqual(toasts, ['storage'], 'a failed save warns once, not on every keystroke');
});

// Why: the page must load the shared code and its own theme, and carry the markup the shared dialogs need; without
// it a toast or a confirm dialog would fail at the first use.
test('the page loads core/ tokens (no debate side colours), its own settings key for the theme, and the dialog markup', () => {
  assert.match(HTML, /<link rel="stylesheet" href="\.\.\/core\/tokens\.css">\n<link rel="stylesheet" href="\.\.\/core\/ui\.css">/);
  assert.doesNotMatch(HTML, /assets\/tokens\.css/, 'the debate token file adds debate side colours');
  assert.match(HTML, /<script src="\.\.\/assets\/theme-boot\.js" data-settings="tabulaEvents\.settings\.v1"><\/script>/);
  assert.match(HTML, /<script type="module" src="js\/app\.js"><\/script>/);
  for (const id of ['toasts', 'toasts-polite', 'toasts-alert', 'sr-status', 'ask', 'ask-card', 'ask-x', 'ask-title', 'ask-body', 'ask-field', 'ask-input', 'ask-err', 'ask-label', 'ask-foot', 'ask-btns']) {
    assert.match(HTML, new RegExp('id="' + id + '"'), id);
  }
  assert.doesNotMatch(read('js/app.js') + read('js/data.js') + read('js/rooms.js') + read('js/store.js'), /policyJudge\./, 'the events code never names a debate key');
  assert.match(HTML, new RegExp('data-settings="' + SETTINGS_KEY.replace(/\./g, '\\.') + '"'), 'the theme reads the store\'s settings key');
});
