// Speech Events step S3 (S2 follow-up): where focus goes when the control that had it is gone. A toast's Undo button
// closes its toast before it runs, so after an Undo the focus would fall to the page body, and a keyboard or screen
// reader judge would have to start again from the top. No DOM import: the caller passes the document.

// If nothing (or the body) has focus, focus the first element that is there from the list of selectors. Returns the
// element that has focus after, or null.
export function focusIfLost(doc, selectors) {
  const d = doc || globalThis.document;
  if (!d) return null;
  const a = d.activeElement;
  if (a && a !== d.body && a !== d.documentElement) return a;
  for (const sel of selectors || []) {
    const el = d.querySelector(sel);
    if (el && typeof el.focus === 'function') { el.focus(); return el; }
  }
  return null;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).focus = Object.freeze({ focusIfLost });
