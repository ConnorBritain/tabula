// The room view must preserve signal history across redraws and distinguish a time correction from Reset time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimerView } from './js/timer-view.js';
import { resetCues, resetSpeechCues, cueTick } from './js/timer-cue-view.js';

function roomRig() {
  let now = 1_800_000_000_000;
  let room = { id: 'cue-room', eventId: 'custom', current: 'a',
    customEvent: { id: 'custom', name: 'Cue test', timing: { limit: 300 } },
    profile: { overtime: { grace: 30 } },
    entries: [{ id: 'a', code: 'A12', status: 'waiting', timing: { run: null, usedMs: 0, runs: [] } }] };
  const said = [], toasts = [];
  let box;
  let draws = 0;
  const makeBox = () => {
    const listeners = [];
    return { classList: { toggle() {} }, addEventListener: (type, fn) => { if (type === 'click') listeners.push(fn); },
      click(tact) {
        const button = { dataset: { tact }, closest: () => null };
        for (const fn of listeners) fn({ target: { closest: () => button } });
      } };
  };
  const env = { now: () => now, settings: () => ({}), data: { events: null },
    el: { querySelector: (selector) => selector === '#timer-box' ? box : null },
    ui: { announce: (text) => said.push(text), toast: (text, opts) => toasts.push({ text, opts }), ask: async () => '0:00' } };
  const draw = () => { draws++; box = makeBox(); view.mounted(); };
  const ctx = { env, room: () => room, save: (next) => { room = next; return next; }, draw, drawStage: draw, drawRoster() {} };
  const view = createTimerView();
  box = makeBox();
  view.show(ctx);
  view.mounted();
  return { view, said, toasts, room: () => room, now: (ms) => { now += ms; }, click: (tact) => box.click(tact), draws: () => draws };
}

async function withClock(run) {
  const oldSet = globalThis.setInterval, oldClear = globalThis.clearInterval, oldCss = globalThis.CSS;
  const ticks = new Map();
  let id = 0;
  globalThis.setInterval = (fn) => { ticks.set(++id, fn); return id; };
  globalThis.clearInterval = (key) => ticks.delete(key);
  globalThis.CSS = { escape: (value) => String(value) };
  resetCues();
  const rig = roomRig();
  const tick = (ms) => { rig.now(ms); for (const fn of [...ticks.values()]) fn(); };
  try { await run(rig, tick); }
  finally {
    rig.view.hide(); resetCues();
    globalThis.setInterval = oldSet; globalThis.clearInterval = oldClear; globalThis.CSS = oldCss;
  }
}

// Why: correcting elapsed time to zero must not make a judge give an earlier hand signal again after the card redraws.
for (const correction of ['set', 'minus']) test(`${correction} to zero redraws the real timer without resetting its spoken cue history`, async () => {
  await withClock(async (rig, tick) => {
    rig.view.run('startStop'); tick(0); tick(60000);
    assert.deepEqual(rig.said, ['A12: 4 minutes left']);
    rig.view.run('startStop');
    const beforeDraw = rig.draws();
    if (correction === 'set') {
      rig.click('set');
      await new Promise((resolve) => setImmediate(resolve));
    } else for (let n = 0; n < 6; n++) rig.click('minus');
    assert.equal(rig.room().entries[0].timing.usedMs, 0);
    assert.ok(rig.draws() > beforeDraw, 'the correction went through drawStage and mounted');
    rig.view.run('startStop'); tick(0); tick(60000);
    assert.deepEqual(rig.said, ['A12: 4 minutes left'], 'the already-given signal is not repeated');
    rig.view.run('startStop');
    rig.click('reset');
    assert.equal(rig.room().entries[0].timing.usedMs, 0);
    rig.view.run('startStop'); tick(0); tick(60000);
    assert.deepEqual(rig.said, ['A12: 4 minutes left', 'A12: 4 minutes left'], 'an explicit Reset time starts a new speech');
  });
});

// Why: Undo restores the previous speech, so its existing time signals must return with its timing record.
test('Undo Reset time restores the old cue history rather than repeating the last signal', async () => {
  await withClock(async (rig, tick) => {
    rig.view.run('startStop'); tick(0); tick(60000);
    rig.view.run('startStop');
    rig.click('reset');
    const undo = rig.toasts.find((toast) => toast.opts?.action?.label === 'Undo').opts.action.run;
    undo();
    assert.equal(rig.room().entries[0].timing.usedMs, 60000);
    rig.view.run('startStop'); tick(0);
    assert.deepEqual(rig.said, ['A12: 4 minutes left']);
    tick(60000);
    assert.deepEqual(rig.said, ['A12: 4 minutes left', 'A12: 3 minutes left']);
  });
});

// Why: undoing one speaker's reset must not erase signals already given to another speaker.
test('Reset time and its Undo change only the selected speech cue history', () => {
  resetCues();
  const said = [];
  const env = { settings: () => ({}), ui: { announce: (text) => said.push(text) } };
  const room = { id: 'scoped-reset' };
  const a = { id: 'a', code: 'A12' }, b = { id: 'b', code: 'B07' };
  const tick = (entry, left) => cueTick(env, room, entry, { running: true, left }, 300, 30);
  try {
    tick(a, 300); tick(a, 240);
    const undo = resetSpeechCues(room, a);
    tick(b, 300); tick(b, 240);
    tick(a, 300); tick(a, 240);
    undo();
    tick(a, 240); tick(b, 240); tick(b, 180);
    assert.deepEqual(said, ['A12: 4 minutes left', 'B07: 4 minutes left', 'A12: 4 minutes left', 'B07: 3 minutes left']);
  } finally { resetCues(); }
});
