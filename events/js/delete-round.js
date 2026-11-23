// Speech Events step S2 (docs/events/EXPERIENCE.md §7): delete a round, with Undo in a toast that puts it back in the
// same place. No DOM here: app.js passes the store and the toast, so Node tests can drive a delete and its Undo.
//
// The toast rules live in core/ui (toastPlan): an open toast with the same key OR the same text is reused, and a reused
// toast keeps its FIRST action. Only one Undo waits at a time. So each delete first closes any earlier delete toast, then
// shows a fresh one with its own Undo. Without that, two deletes with the same text (or a delete just after an Undo's
// "The round is back." toast) would keep the old action, and the round just deleted would have no working Undo.
import { removeRoom, restoreRoom } from './room.js';

export const DELETE_TOAST_KEY = 'del-round';

// deps: { get() (the saved rounds), set(list) (false when the save failed), ui: { toast, dismissToast },
//   refresh() (redraw the screen that shows now, after an Undo) }.
// Returns deleteRound(id, after): after() runs once, right after the delete (the asking screen redraws and moves focus).
export function createDeleteRound({ get, set, ui, refresh }) {
  return function deleteRound(id, after) {
    const res = removeRoom(get(), id);
    if (!res.removed) return false;
    if (!set(res.rooms)) return false;
    const r = res.removed.room;
    const what = [r.round, r.tournament].filter(Boolean).join(', ') || 'the round';
    ui.dismissToast(DELETE_TOAST_KEY);
    // The toast goes up before the screen redraws, so a redraw that fails cannot take the Undo away.
    ui.toast('Deleted ' + what + '.', { key: DELETE_TOAST_KEY, action: { label: 'Undo', name: 'Undo: delete ' + what, run: () => {
      set(restoreRoom(get(), res.removed));
      if (refresh) refresh();
      ui.dismissToast(DELETE_TOAST_KEY);
      ui.toast('The round is back.', { key: DELETE_TOAST_KEY });
    } } });
    if (after) after();
    return true;
  };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).deleteRound = Object.freeze({ DELETE_TOAST_KEY, createDeleteRound });
