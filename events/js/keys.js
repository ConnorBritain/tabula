// Speech Events: the shortcut list (step E4; DESIGN.md §1 rule 10: one key registry). core/keys.js does the matching;
// this file only names the app's keys. Pure.
// Scopes: each screen puts its own scope in ctx.scopes while it shows ('room', 'rank'); 'global' is on every screen.
// single: a one-key shortcut (obeys the single-key off switch). A shortcut without typing: true never runs while a
// text box has focus, so number keys still type in a box. noFocus: only when nothing has focus (Space keeps its own
// job on a button).
import { createKeymap } from '../../core/keys.js';

const digit = (n) => ({ id: 'pick' + n, keys: { mac: String(n), other: String(n) }, single: true, scope: 'room', action: 'pick' + n, label: 'Pick speaker ' + n, group: 'Room' });

export const SHORTCUTS = Object.freeze([
  // Space starts and stops the clock (the debate Space rule, DESIGN.md §4.2). noFocus: on a button Space presses it.
  { id: 'startStop', keys: { mac: 'Space', other: 'Space' }, single: true, noFocus: true, scope: 'room', action: 'startStop', label: 'Start or stop the clock', group: 'Room' },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(digit),
  // Step S2 (EXPERIENCE.md §7): the palette, on every screen. typing: it also opens from a text box (it is a modifier
  // combo, so it never types a character). ⌘K on Mac, Ctrl+K elsewhere; core/keys.js accepts either.
  { id: 'palette', keys: { mac: 'Meta+k', other: 'Meta+k' }, typing: true, scope: 'global', action: 'palette', label: 'Search and commands', group: 'Page' },
]);

export const keymap = createKeymap(SHORTCUTS);

// A browser key event in the plain shape core/keys.js matches ({ code, key, meta, ctrl, alt, shift, ... }).
export const keyOf = (ev) => ({ code: ev.code, key: ev.key, meta: ev.metaKey, ctrl: ev.ctrlKey, alt: ev.altKey, shift: ev.shiftKey,
  repeat: ev.repeat, composing: ev.isComposing, altGraph: Boolean(ev.getModifierState && ev.getModifierState('AltGraph')) });

// The speaker number of a 'pickN' action, or null.
export const pickNumber = (action) => (/^pick([1-8])$/.test(action || '') ? Number(action.slice(4)) : null);

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).keys = Object.freeze({ SHORTCUTS, keymap, keyOf, pickNumber });
