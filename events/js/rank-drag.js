// Speech Events step E7: drag a rank board row by its handle (DESIGN.md §4.5, way 1 of 3). Pointer events, so a
// finger works too. The row under the pointer gets a full outline (no stripe). It only reports the move; the Rank
// screen applies it through rank.js moveTo, which may refuse it.
// The place math is pure (dropPlace); attachDrag does the DOM.

// The new place (1-based) of the dragged row among the other rows, from the pointer's height and the middles of the
// other rows (top to bottom): it goes before the first row whose middle is below the pointer, or last.
export function dropPlace(y, middles) {
  const at = middles.findIndex((m) => y < m);
  return (at < 0 ? middles.length : at) + 1;
}

// box: the element that holds the rows ([data-row] with a [data-drag] handle). opts: { enabled(), onDrop(id, place) }.
// Returns detach().
export function attachDrag(box, opts) {
  let drag = null;
  const others = () => [...box.querySelectorAll('[data-row]')].filter((row) => row.dataset.row !== drag.id);
  const clear = () => box.querySelectorAll('.dragging, .drop-here').forEach((x) => x.classList.remove('dragging', 'drop-here'));
  function down(ev) {
    const h = ev.target.closest('[data-drag]');
    if (!h || !opts.enabled()) return;
    ev.preventDefault();
    drag = { id: h.dataset.drag, place: null };
    h.setPointerCapture(ev.pointerId);
    const row = box.querySelector(`[data-row="${CSS.escape(drag.id)}"]`);
    if (row) row.classList.add('dragging');
  }
  function move(ev) {
    if (!drag) return;
    const rows = others();
    drag.place = dropPlace(ev.clientY, rows.map((row) => { const b = row.getBoundingClientRect(); return b.top + b.height / 2; }));
    rows.forEach((row, i) => row.classList.toggle('drop-here', i === Math.min(drag.place - 1, rows.length - 1)));
  }
  function up() {
    if (!drag) return;
    const { id, place } = drag;
    drag = null;
    clear();
    if (place) opts.onDrop(id, place);
  }
  const pairs = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]];
  for (const [t, f] of pairs) box.addEventListener(t, f);
  return () => { for (const [t, f] of pairs) box.removeEventListener(t, f); drag = null; };
}
