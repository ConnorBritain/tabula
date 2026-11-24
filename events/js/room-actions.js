// Speech Events step S4: two Room screen actions that live outside room-screen.js, so the screen only wires them.
//   createNumberPicker()          the digit buffer for "type the number, then Enter" in a room over 8 (number-pick.js)
//   crossEntryAction(action, id, ctx)   the row menu's "Cross-entered" and "Back in the room", each with Undo
//                                       (EXPERIENCE.md §3.1; the rules are in cross-entry.js)
// ctx: { env, room(), save(room), draw(), closeMenu() } — the Room screen's own helpers.
import { entryOf } from './room.js';
import { digitOf, pressDigit, pressEnter } from './number-pick.js';
import { markCrossEntered, clearCrossEntered } from './cross-entry.js';

// A small state holder for the typed digits. run(action, count) returns { mine, handled, pick, hint, error }:
//   mine: the action is one of the number keys (the screen tries nothing else for it);
//   handled: the key was this picker's (the page then stops its default); pick: a place to pick now; hint: words to
//   show while digits wait; error: words when the number names no place.
export function createNumberPicker() {
  let buf = '';
  return {
    reset() { buf = ''; },
    run(action, count) {
      const d = digitOf(action);
      if (d != null) {
        const res = pressDigit(buf, d, count);
        buf = res.buf;
        // 1–8 were always the Room screen's keys; 9 and 0 count only while digits wait.
        return { mine: true, handled: (d >= 1 && d <= 8) || Boolean(buf), pick: res.pick, hint: buf ? 'Speaker ' + buf + '… Press Enter to pick.' : '', error: '' };
      }
      if (action === 'numEnter') {
        const res = pressEnter(buf, count);
        buf = res.buf;
        // Nothing typed: not handled, so Enter keeps its own job (a focused button).
        return { mine: true, handled: Boolean(res.pick || res.error), pick: res.pick, hint: '', error: res.error };
      }
      return { mine: false, handled: false, pick: null, hint: '', error: '' };
    },
  };
}

export async function crossEntryAction(action, id, ctx) {
  const { env } = ctx;
  if (action === 'cross') {
    const note = await env.ui.ask({ title: 'Cross-entered', body: 'The student is in another event now and speaks here later. They stay on the ballot.', input: { label: 'Note (optional)', placeholder: 'For example: in Room 204 for IX', required: false, maxLength: 120 }, buttons: [{ label: 'Cancel', value: null }, { label: 'Mark cross-entered', value: 'ok', kind: 'primary' }] });
    if (note == null) return;
    const res = markCrossEntered(ctx.room(), id, note, env.now());
    if (res.refused) { env.ui.toast(res.refused, { kind: 'error', key: 'roster' }); return; }
    if (!res.prev) return;
    ctx.closeMenu(); ctx.save(res.room); ctx.draw();
    const code = entryOf(ctx.room(), id).code;
    env.ui.toast(code + ' marked cross-entered.', { action: { label: 'Undo', name: 'Undo: ' + code + ' cross-entered', run: () => { const cur = ctx.room(); if (cur) { ctx.save(clearCrossEntered(cur, id, env.now(), res.prev)); ctx.draw(); } } } });
    return;
  }
  if (action === 'uncross') {
    const before = entryOf(ctx.room(), id);
    if (!before) return;
    const was = before.crossEntry || {};
    ctx.closeMenu(); ctx.save(clearCrossEntered(ctx.room(), id, env.now())); ctx.draw();
    env.ui.toast(before.code + ' is back in the room.', { action: { label: 'Undo', name: 'Undo: ' + before.code + ' back in the room', run: () => { const cur = ctx.room(); if (cur) { ctx.save(markCrossEntered(cur, id, was.note, env.now(), was.expectedAt).room); ctx.draw(); } } } });
  }
}
