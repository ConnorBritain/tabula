// The a11y runner's plan, pure (no browser): the screens it walks, the themes and sizes it walks them in, and the
// summary it prints. events/a11y-runner.test.mjs tests this file under `node --test`; the browser part is run.mjs.
// Congress screens are not here: they have their own pass (events/congress/).

// Each screen type: id (a driver in drivers.mjs has the same id), label (for the table in docs/events/A11Y.md),
// group (what kind of screen it is).
export const SCREENS = Object.freeze([
  { id: 'myday', label: 'My day (rooms list)', group: 'home' },
  { id: 'myday-offline', label: 'My day, offline (header chip)', group: 'home' },
  { id: 'picker', label: 'Event picker', group: 'setup' },
  { id: 'picker-confirm', label: 'Event picker, confirm sheet', group: 'setup' },
  { id: 'setup-paste', label: 'Room setup, pasted room', group: 'setup' },
  { id: 'setup-typed', label: 'Room setup, typed codes and a line to check', group: 'setup' },
  { id: 'room-speech', label: 'Room: individual speech (OO)', group: 'room' },
  { id: 'room-interp', label: 'Room: interp with title and author (POI)', group: 'room' },
  { id: 'room-duo', label: 'Room: Duo', group: 'room' },
  { id: 'room-extemp', label: 'Room: extemp with a question (USX)', group: 'room' },
  { id: 'room-impromptu', label: 'Room: impromptu with prep (IMP)', group: 'room' },
  { id: 'room-roster', label: 'Room: roster open, entry menu open', group: 'room' },
  { id: 'rank', label: 'Rank board', group: 'ballot' },
  { id: 'rate-points', label: 'Rate: points (rate only)', group: 'ballot' },
  { id: 'rate-words', label: 'Rate: word scale', group: 'ballot' },
  { id: 'rate-rubric', label: 'Rate: rubric scores', group: 'ballot' },
  { id: 'review-ranks', label: 'Review and copy: stage 1, ranks', group: 'ballot' },
  { id: 'review-comments', label: 'Review and copy: stage 2, comments', group: 'ballot' },
  { id: 'print', label: 'Print sheet', group: 'ballot' },
  { id: 'history', label: 'History', group: 'pages' },
  { id: 'settings', label: 'Settings (all parts open)', group: 'pages' },
  { id: 'keyboard', label: 'Keyboard sheet (Settings)', group: 'pages' },
  { id: 'type', label: 'Type page', group: 'pages' },
  { id: 'palette', label: 'Command palette', group: 'overlays' },
  { id: 'dialog-ask', label: 'Dialog (Start the ranks again?)', group: 'overlays' },
  { id: 'dialog-input', label: 'Dialog with a field (Change room)', group: 'overlays' },
  { id: 'toast-undo', label: 'Toast with Undo (delete a round)', group: 'overlays' },
]);

export const THEMES = Object.freeze(['light', 'dark']);
// Phone and laptop (docs/design/SPEC.md §6.2 sizes). 360 is the narrow phone the layout bugs were seen on.
export const SIZES = Object.freeze([
  { id: 'phone', width: 390, height: 844 },
  { id: 'laptop', width: 1366, height: 768 },
]);
export const NARROW = Object.freeze({ id: 'narrow', width: 360, height: 740 });

// The impacts that fail the run.
export const BLOCKING = Object.freeze(['serious', 'critical']);

/** Every run: one per screen, theme and size, in a steady order (size, then theme, then screen). */
export function matrix(screens = SCREENS, themes = THEMES, sizes = SIZES) {
  const out = [];
  for (const size of sizes) for (const theme of themes) for (const s of screens) out.push({ screen: s.id, theme, size: size.id, width: size.width, height: size.height });
  return out;
}

/** The screens named in a comma list (the --only flag); all when the list is empty. Unknown ids throw. */
export function pickScreens(only, screens = SCREENS) {
  const ids = String(only || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return screens.slice();
  const bad = ids.filter((id) => !screens.some((s) => s.id === id));
  if (bad.length) throw new Error('Unknown screen: ' + bad.join(', '));
  return screens.filter((s) => ids.includes(s.id));
}

/**
 * The summary of a run. results: [{ screen, theme, size, violations: [{ id, impact, nodes: [...] }], overflow, error }].
 * Returns { runs, failed, byImpact: { critical, serious, moderate, minor }, rules: [{ id, impact, count, where }], errors,
 * overflow: [where] }. A run fails when it has a blocking violation, a page error, or the page scrolls sideways.
 */
export function summarize(results) {
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const rules = new Map();
  const errors = [];
  const overflow = [];
  let failed = 0;
  for (const r of results) {
    const where = r.screen + ' · ' + r.theme + ' · ' + r.size;
    let bad = false;
    if (r.error) { errors.push(where + ': ' + r.error); bad = true; }
    if (r.overflow) { overflow.push(where + ' (' + r.overflow + ' px)'); bad = true; }
    for (const v of r.violations || []) {
      const impact = v.impact in byImpact ? v.impact : 'minor';
      const n = (v.nodes || []).length || 1;
      byImpact[impact] += n;
      if (BLOCKING.includes(impact)) bad = true;
      const row = rules.get(v.id) || { id: v.id, impact, count: 0, where: [] };
      row.count += n;
      if (!row.where.includes(r.screen)) row.where.push(r.screen);
      rules.set(v.id, row);
    }
    if (bad) failed++;
  }
  const order = ['critical', 'serious', 'moderate', 'minor'];
  const list = [...rules.values()].sort((a, b) => order.indexOf(a.impact) - order.indexOf(b.impact) || b.count - a.count || a.id.localeCompare(b.id));
  return { runs: results.length, failed, byImpact, rules: list, errors, overflow };
}

/** One line per screen for the A11Y.md table: id, label, and per theme and size 'pass' or the blocking count. */
export function screenTable(results, screens = SCREENS, themes = THEMES, sizes = SIZES) {
  return screens.filter((s) => results.some((r) => r.screen === s.id)).map((s) => {
    const cells = [];
    for (const size of sizes) for (const theme of themes) {
      const r = results.find((x) => x.screen === s.id && x.theme === theme && x.size === size.id);
      if (!r) { cells.push('not run'); continue; }
      const blocking = (r.violations || []).filter((v) => BLOCKING.includes(v.impact)).reduce((n, v) => n + ((v.nodes || []).length || 1), 0);
      const other = (r.violations || []).filter((v) => !BLOCKING.includes(v.impact)).reduce((n, v) => n + ((v.nodes || []).length || 1), 0);
      cells.push(r.error ? 'error' : r.overflow ? 'scrolls sideways' : blocking ? blocking + ' serious' : other ? 'pass (' + other + ' moderate or minor)' : 'pass');
    }
    return '| ' + s.label + ' | ' + cells.join(' | ') + ' |';
  });
}
