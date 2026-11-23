// Speech Events step S2: tests for the four bugs the clean-context review found (delete Undo, History redraw, the
// round link, and the AI key on restore). Each test fails on the code before the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBackup } from '../core/store.js';
import { loadEventData } from './js/data.js';
import { createRoom } from './js/room.js';
import { createDeleteRound, DELETE_TOAST_KEY } from './js/delete-round.js';
import { historyTableHtml, createHistoryScreen } from './js/history-screen.js';
import { historyRows, historyColumns } from './js/history.js';
import { readBackup, restoreItems, BACKUP_APP } from './js/settings.js';
import { PREFIX, ROOMS_KEY } from './js/store.js';
import { KEYS_KEY } from './js/ai-key.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const PROFILE = DATA.profiles.get('nsda-district');
let n = 0;
const room = (id, round) => Object.assign(createRoom({ event: DATA.events.get('hi'), profile: PROFILE, entries: [{ code: 'A1' }],
  round, now: new Date(2026, 10, 20, 9).getTime(), makeId: (p) => p + 'fx' + (++n) }), { id });

// A fake core/ui toast with the same reuse rule as core/ui.js (toastPlan): an open toast with the same key or the
// same text is reused and keeps its first action. Clicking a toast's button runs the action it holds.
function fakeUI() {
  const open = [];
  return {
    open,
    toast(msg, o = {}) {
      const same = open.find((t) => (o.key && t.key === o.key) || t.msg === msg);
      if (same) { same.msg = msg; return same; }
      const t = { msg, key: o.key || '', action: o.action || null };
      if (t.action) open.splice(0, open.length, ...open.filter((x) => !x.action)); // only one Undo waits at a time
      open.push(t); return t;
    },
    dismissToast(key) { for (let i = open.length - 1; i >= 0; i--) if (open[i].key === key) open.splice(i, 1); },
    click(t) { open.splice(open.indexOf(t), 1); t.action.run(); },
  };
}
const harness = (list) => {
  let saved = list.slice();
  const ui = fakeUI();
  let refreshed = 0;
  const del = createDeleteRound({ get: () => saved, set: (l) => { saved = l; return true; }, ui, refresh: () => { refreshed++; } });
  return { del, ui, ids: () => saved.map((r) => r.id), refreshed: () => refreshed };
};

// Why: two rounds can share a name ("R1" at two tournaments with no tournament typed); if the second delete reused the
// first toast, its Undo would bring back the wrong round and the round just deleted would be lost for good.
test('a second delete with the same text gets its own working Undo', () => {
  const h = harness([room('rA', 'R1'), room('rB', 'R1'), room('rC', 'R2')]);
  h.del('rA'); h.del('rB');
  const undo = h.ui.open.filter((t) => t.action);
  assert.equal(undo.length, 1, 'one Undo waits');
  h.ui.click(undo[0]);
  assert.deepEqual(h.ids(), ['rB', 'rC'], 'Undo brought back the round deleted last, in its place');
});

// Why: a judge who taps Undo and then deletes the same round again within a few seconds must still get an Undo;
// reusing the "The round is back." toast (which has none) would leave that delete with no way back.
test('deleting a round again right after its Undo still offers Undo', () => {
  const h = harness([room('rA', 'R1'), room('rB', 'R2')]);
  h.del('rA');
  h.ui.click(h.ui.open.find((t) => t.action));
  assert.deepEqual(h.ids(), ['rA', 'rB']);
  h.del('rA');
  const undo = h.ui.open.find((t) => t.action);
  assert.ok(undo, 'the second delete has an Undo');
  h.ui.click(undo);
  assert.deepEqual(h.ids(), ['rA', 'rB']);
  assert.equal(h.refreshed(), 2, 'each Undo redraws the screen that shows then');
});

// Why: the Undo toast must be up before the asking screen redraws; if the redraw throws (bad data from a backup), the
// round is already deleted, and without the toast the judge could not get it back.
test('the Undo toast shows even when the redraw after a delete fails', () => {
  const h = harness([room('rA', 'R1')]);
  assert.throws(() => h.del('rA', () => { throw new Error('redraw failed'); }));
  assert.ok(h.ui.open.some((t) => t.action && t.key === DELETE_TOAST_KEY));
});

// Why: the Undo toast stays up after the judge leaves History; if Undo then drew History, it would wipe out the
// Settings or round screen the judge is using now.
test('Undo after leaving History does not draw History over the new screen', () => {
  let after = null;
  const listeners = {};
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: (t) => { delete listeners[t]; } };
  const rooms = [room('rA', 'R1'), room('rB', 'R2')];
  const screen = createHistoryScreen({ el, data: DATA, now: () => 0, rooms: () => rooms, ui: { toast() {} },
    deleteRound: (id, cb) => { after = cb; } });
  screen.show();
  const del = { dataset: { del: 'rA' }, closest: () => null };
  listeners.click({ target: { closest: (s) => (s === 'button[data-del]' ? del : null), id: '' } });
  assert.equal(typeof after, 'function', 'History passed a redraw for the Undo');
  screen.hide();
  el.innerHTML = '<p>Settings screen</p>';
  after();
  assert.equal(el.innerHTML, '<p>Settings screen</p>', 'Undo left the new screen alone');
  screen.show();
  after();
  assert.match(el.innerHTML, /hist-table/, 'Undo still redraws History while it shows');
});

// Why: a restored backup file can hold any room id; an id with a quote in it must not break out of the link and put
// its own HTML (for example a script handler) into the History page.
test('the History round link escapes the round id', () => {
  const r = room('x" onmouseover="alert(1)', 'R1');
  const html = historyTableHtml(historyRows([r], DATA.events), historyColumns(''));
  assert.ok(!html.includes('" onmouseover="'), 'no raw attribute break-out');
  assert.match(html, /href="#\/round\/x&quot; onmouseover=&quot;alert\(1\)"/);
});

// Why: a judge who ticks "Include my AI key" when the key lives only in this tab gets a file that says it has keys
// but holds none; restoring that file must not sign the judge out of AI on the device they restore to.
test('a backup that claims keys but holds none keeps the key on this device', () => {
  const file = buildBackup({ [ROOMS_KEY]: '[]' }, { prefix: PREFIX, app: BACKUP_APP, secretKeys: [KEYS_KEY], includeSecrets: true, now: '2026-11-22T00:00:00.000Z' });
  const back = readBackup(JSON.stringify(file));
  assert.equal(back.includesKeys, true);
  assert.equal(restoreItems({ [KEYS_KEY]: 'mine' }, back)[KEYS_KEY], 'mine');
});

// Why: the restore dialog shows the backup's date with slice(); a hand-edited file with a number there must still
// open the dialog, not fail with no message.
test('a backup whose date is not text still reads, with no date', () => {
  const file = Object.assign(buildBackup({}, { prefix: PREFIX, app: BACKUP_APP, now: 'x' }), { exportedAt: 12345 });
  assert.equal(readBackup(JSON.stringify(file)).exportedAt, '');
});

// Why: if the Undo save fails (storage full), telling the judge "The round is back." would make them trust a round
// that is gone; they must see that it did not come back.
test('an Undo whose save fails says the round did not come back', () => {
  let saved = [room('rA', 'R1')];
  let fail = false;
  const ui = fakeUI();
  const del = createDeleteRound({ get: () => saved, set: (l) => { if (fail) return false; saved = l; return true; }, ui, refresh() {} });
  del('rA');
  fail = true;
  ui.click(ui.open.find((t) => t.action));
  assert.ok(!ui.open.some((t) => /is back/.test(t.msg)));
  assert.ok(ui.open.some((t) => /did not come back/.test(t.msg)));
});
