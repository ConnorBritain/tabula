// Speech Events step S2: tests for the four bugs the clean-context review found (delete Undo, History redraw, the
// round link, and the AI key on restore). Each test fails on the code before the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBackup } from '../core/store.js';
import { loadEventData } from './js/data.js';
import { createRoom, undoDeleteKey } from './js/room.js';
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

// Why: core/ui reuses an open toast with the same key and keeps its first Undo; if two deletes share a key, the
// second delete's Undo brings back the first round and the second round is lost for good.
test('each deleted round gets its own Undo toast key', () => {
  assert.notEqual(undoDeleteKey('rA'), undoDeleteKey('rB'));
  assert.equal(undoDeleteKey('rA'), undoDeleteKey('rA'));
});

// Why: the Undo toast stays up after the judge leaves History; if Undo then drew History, it would wipe out the
// Settings or round screen the judge is using now.
test('Undo after leaving History does not draw History over the new screen', () => {
  let after = null;
  const listeners = {};
  const el = { innerHTML: '', querySelector: () => null,
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
