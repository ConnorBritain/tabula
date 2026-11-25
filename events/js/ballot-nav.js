// The clicks that move the judge to a row on the Rank and Rate screens (design build 2026-11-24; color review top 10 #6
// and #7). DOM helpers; the pure builders they serve are in ballot-status.js.
import { firstOpenRubric } from './ballot-status.js';
import { present } from './room.js';
import { layerOf } from './profile-layer.js';

// A click on a "Before you review" item: scroll its row into view and move the focus there. Returns true when the
// click was on such an item. root: the screen element.
export function jumpToRow(root, target) {
  const b = target.closest && target.closest('[data-jump]');
  if (!b) return false;
  const row = root.querySelector(`[data-row="${CSS.escape(b.dataset.jump)}"]`);
  if (row) { row.scrollIntoView({ block: 'center' }); row.focus({ preventScroll: true }); }
  return true;
}

// A tap on the footer's primary while work is open: go to the first open row instead (and say why). Returns true when
// it did. root: the screen element; announce: ui.announce.
export function footToOpenRow(root, target, announce) {
  const a = target.closest && target.closest('#go-review[data-open]');
  if (!a) return false;
  const row = root.querySelector(`[data-row="${CSS.escape(a.dataset.open)}"]`);
  if (!row) return false;
  row.scrollIntoView({ block: 'center' });
  row.focus({ preventScroll: true });
  if (announce) announce('Finish this row first. ' + (root.querySelector('#bf-progress') || {}).textContent);
  return true;
}

// One call for both screens' click handlers: a "Before you review" item, or the footer's primary while work is open.
// Returns true when the click was one of these (the caller then stops; for the footer it prevents the link).
export function ballotNavClick(root, ev, announce) {
  if (jumpToRow(root, ev.target)) return true;
  if (footToOpenRow(root, ev.target, announce)) { ev.preventDefault(); return true; }
  return false;
}

// The rubric folds (color review §5.4): one speaker's block open at a time. A block closes only when the judge opens
// another one (never on a score tap), so a mis-tap does not hide the grid. Returns the id now open, or null.
// root: the screen element; ev: a 'toggle' event (it does not bubble, so the screen listens in the capture phase).
export function rubricToggle(root, ev, openId) {
  const d = ev.target;
  if (!d.matches || !d.matches('details[data-rubfold]')) return openId;
  if (d.open) { for (const x of root.querySelectorAll('details[data-rubfold][open]')) if (x !== d) x.open = false; return d.dataset.rubfold; }
  return openId === d.dataset.rubfold ? null : openId;
}

// The rubric-fold state of one screen (Rank and Rate share it). start(room): open the first unscored speaker and
// listen; stop(): stop listening; open(): the id now open (the screen passes it to its builder on every redraw).
export function createRubricFolds(root) {
  let openId = null;
  const onToggle = (ev) => { openId = rubricToggle(root, ev, openId); };
  return {
    open: () => openId,
    start(room) { openId = firstOpenRubric(present(room), layerOf(room.profile).rubric); root.addEventListener('toggle', onToggle, true); },
    stop() { root.removeEventListener('toggle', onToggle, true); openId = null; },
  };
}
