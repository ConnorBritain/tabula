// Read a selection only from public feedback. Private notes and selections spanning comments are excluded.
const textBox = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest('[data-ai-text]');
const rectOf = (r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });

export function readFeedbackSelection(root, event) {
  const active = event?.target?.closest?.('textarea[data-vfield="comment"]') || document.activeElement;
  if (active?.matches?.('textarea[data-vfield="comment"]') && root.contains(active)) {
    const start = active.selectionStart, end = active.selectionEnd;
    if (start !== end && active.value.slice(start, end).trim()) return { id: active.dataset.id, start, end, base: active.value, rect: rectOf(active.getBoundingClientRect()), scrollY: window.scrollY, input: true };
    return null;
  }
  const selected = window.getSelection();
  if (!selected || selected.isCollapsed || selected.rangeCount !== 1) return null;
  const range = selected.getRangeAt(0), target = textBox(range.startContainer);
  if (!target || target !== textBox(range.endContainer) || !root.contains(target)) return null;
  const before = range.cloneRange();
  before.selectNodeContents(target);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length, text = range.toString();
  if (!text.trim()) return null;
  return { id: target.dataset.aiText, start, end: start + text.length, base: target.textContent, rect: rectOf(range.getBoundingClientRect()), scrollY: window.scrollY, input: false };
}

// Keep the selected words while the user clicks the floating toolbar or types a custom request.
export function trackFeedbackSelection(root, changed) {
  let dragging = false, frame = 0;
  const inEditor = (node) => node?.closest?.('[data-ai-layer]');
  function read(e) {
    if (inEditor(e?.target) || inEditor(document.activeElement)) return;
    changed(readFeedbackSelection(root, e));
  }
  const down = (e) => { if (!inEditor(e.target)) dragging = true; };
  const up = (e) => { dragging = false; read(e); };
  const selected = () => {
    if (dragging || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; read(); });
  };
  const key = (e) => { if (e.key !== 'Escape') read(e); };
  root.addEventListener('pointerdown', down);
  document.addEventListener('pointerup', up);
  root.addEventListener('keyup', key);
  root.addEventListener('select', read, true);
  document.addEventListener('selectionchange', selected);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    root.removeEventListener('pointerdown', down);
    document.removeEventListener('pointerup', up);
    root.removeEventListener('keyup', key);
    root.removeEventListener('select', read, true);
    document.removeEventListener('selectionchange', selected);
  };
}
