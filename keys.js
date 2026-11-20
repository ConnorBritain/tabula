// The keyboard map: one registry of shortcuts, and the pure rules that decide if a key press runs one.
// No DOM here, so Node tests can check every rule. app.js reads the page state and asks matchKey().
// Slice 0/1 holds only the round-safety keys (spec 4.1). Later slices add more entries here.
(function (root) {
  'use strict';

  // keys: the key on Mac and on other systems. 'Meta' is ⌘; on Windows and ChromeOS it becomes 'Control'.
  // single: a one-key shortcut. These obey the single-key off switch (WCAG 2.1.4). Modifier keys always work.
  // typing: it also works while the focus is in a text box.
  // noFocus: it works only when nothing has focus (Space keeps its native job on buttons and boxes).
  // scope: 'flow' (only on the Flow place), 'ballot' (only on Decide → Ballot, spec 4.1) or 'global'.
  // action: what the key does. Two keys can run the same action.
  // label, group and palette are the fields spec 4.1 names for the shortcut sheet and palette (Slice 5).
  const REGISTRY = [
    { id: 'clock.toggle', action: 'clock', label: 'Start or pause the clock', group: 'Clock', scope: 'flow', keys: { mac: 'Space', other: 'Space' }, single: true, typing: false, noFocus: true, palette: false },
    { id: 'clock.toggle.mod', action: 'clock', label: 'Start or pause the clock, also while typing', group: 'Clock', scope: 'flow', keys: { mac: 'Meta+Enter', other: 'Control+Enter' }, single: false, typing: true, noFocus: false, palette: false },
    { id: 'pane.speeches', action: 'speeches', label: 'Show or hide the speeches pane', group: 'Panes', scope: 'flow', keys: { mac: '[', other: '[' }, single: true, typing: false, noFocus: false, palette: false },
    { id: 'pane.speeches.mod', action: 'speeches', label: 'Show or hide the speeches pane, also while typing', group: 'Panes', scope: 'flow', keys: { mac: 'Meta+\\', other: 'Control+\\' }, single: false, typing: true, noFocus: false, palette: false },
    // ⌘P / Ctrl+P on the Ballot opens the Print / PDF dialog (spec 4.1, 4.10) instead of the browser's print window.
    { id: 'ballot.print', action: 'print', label: 'Print or save the ballot as PDF', group: 'Ballot', scope: 'ballot', keys: { mac: 'Meta+p', other: 'Control+p' }, single: false, typing: true, noFocus: false, palette: true },
    // Esc is run by the one Esc stack in app.js (it closes only the top layer). It is listed here so the
    // shortcut sheet and the clash tests see it.
    { id: 'layer.close', action: 'close', label: 'Close the top layer', group: 'General', scope: 'global', keys: { mac: 'Escape', other: 'Escape' }, single: false, typing: true, noFocus: false, palette: false, esc: true },
  ];

  function parseCombo(combo) {
    const parts = String(combo).split('+');
    // 'Meta+\\' splits fine; a bare '+' key is not used.
    const key = parts.pop();
    return { mods: parts, key };
  }

  // Keys the browser or the keyboard layout already owns. No entry may use one (spec 4.1).
  function isReservedCombo(combo, platform) {
    const { mods, key } = parseCombo(combo);
    const has = (m) => mods.includes(m);
    const k = key.length === 1 ? key.toUpperCase() : key;
    if (has('Control') && has('Alt')) return true; // AltGr on many European layouts
    const browserMod = has('Control') || (platform === 'mac' && has('Meta'));
    if (browserMod) {
      if (['PageUp', 'PageDown', 'Tab'].includes(k)) return true;
      if (/^[0-9]$/.test(k)) return true;
      if (['T', 'W', 'N', 'L', 'H', 'J', 'D'].includes(k)) return true;
    }
    if (platform === 'mac' && has('Alt') && /^[A-Z0-9]$/.test(k)) return true; // Option+letter types a character
    return false;
  }

  // What kind of thing has focus. el is a plain object: { tagName, type, isContentEditable }.
  //   'none'    nothing (the page body)
  //   'text'    a box you type in (Space and single keys must type there)
  //   'control' a button, checkbox, link or similar (Space does its native job there)
  const NOT_TEXT_INPUTS = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'];
  function focusKind(el) {
    if (!el || !el.tagName) return 'none';
    const tag = String(el.tagName).toUpperCase();
    if (tag === 'BODY' || tag === 'HTML') return 'none';
    if (el.isContentEditable) return 'text';
    if (tag === 'TEXTAREA' || tag === 'SELECT') return 'text';
    if (tag === 'INPUT') return NOT_TEXT_INPUTS.includes(String(el.type || 'text').toLowerCase()) ? 'control' : 'text';
    return 'control';
  }

  // Does the pressed key match this entry's key? ev: { code, key, meta, ctrl, alt, shift, altGraph }.
  function keyMatches(entry, ev) {
    const { mods, key } = parseCombo(entry.keys.other);
    if (key === 'Space') return ev.code === 'Space' && !ev.meta && !ev.ctrl && !ev.alt && !ev.shift;
    if (key === 'Escape') return ev.key === 'Escape';
    if (!mods.length && key.length === 1) {
      // One character: match the character the layout makes. Shift is fine (some layouts need it); AltGr is fine.
      if (ev.meta || ev.ctrl) return false;
      if (ev.alt && !ev.altGraph) return false;
      return ev.key === key;
    }
    // A modifier key: ⌘ on Mac, Ctrl elsewhere. Either one is accepted, so a judge never has to think about it.
    if (!(ev.meta || ev.ctrl) || ev.alt || ev.shift) return false;
    return String(ev.key).toLowerCase() === key.toLowerCase();
  }

  // May this entry run now? ctx: { place, tab, focus, modal, singleKeysOn }. tab: the open tab (for the 'ballot' scope).
  function allowed(entry, ctx) {
    if (ctx.modal) return false; // a dialog, tour, welcome or node editor is open: shortcuts are off
    if (entry.scope === 'flow' && ctx.place !== 'flow') return false;
    if (entry.scope === 'ballot' && ctx.tab !== 'ballot') return false;
    if (entry.single && ctx.singleKeysOn === false) return false;
    if (entry.noFocus && ctx.focus !== 'none') return false;
    if (!entry.typing && ctx.focus === 'text') return false;
    return true;
  }

  // The registry id the key press runs, or null. Esc is not matched here (the Esc stack owns it).
  // Key repeat and input-method composing never run anything.
  function matchKey(ev, ctx) {
    if (!ev || ev.repeat || ev.composing) return null;
    const c = ctx || {};
    for (const entry of REGISTRY) {
      if (entry.esc) continue;
      if (keyMatches(entry, ev) && allowed(entry, c)) return entry.id;
    }
    return null;
  }

  // The action a key press runs ('clock', 'speeches', 'print') or null. app.js calls only this.
  function keyAction(ev, ctx) {
    const id = matchKey(ev, ctx);
    const entry = id && REGISTRY.find((e) => e.id === id);
    return entry ? entry.action : null;
  }
  // The clock rule (spec 1.3) and the speeches pane rule (spec 1.5), as spec 6.1 names them for the tests.
  // Each takes one object with the key and the context and returns 'toggle' or null. Both go through keyAction.
  const clockKeyAction = (x) => (keyAction(x, x) === 'clock' ? 'toggle' : null);
  const speechesKeyAction = (x) => (keyAction(x, x) === 'speeches' ? 'toggle' : null);

  const isMacPlatform = (platform) => /Mac|iPhone|iPad|iPod/i.test(String(platform || ''));

  // The tooltip copy on the Start button (spec 1.3). The only version; later slices reuse it.
  function startTip(mac, singleKeysOn) {
    const mod = mac ? '⌘ Enter' : 'Ctrl+Enter';
    return singleKeysOn === false ? 'Start or pause (' + mod + ')' : 'Start or pause (Space, or ' + mod + ' while typing)';
  }
  // The tooltip copy on the Speeches button (spec 1.5).
  function speechesTip(mac, singleKeysOn) {
    const mod = mac ? '⌘\\' : 'Ctrl+\\';
    return singleKeysOn === false ? 'Show speeches (' + mod + ')' : 'Show speeches ([ or ' + mod + ')';
  }
  const api = { REGISTRY, parseCombo, isReservedCombo, focusKind, keyMatches, matchKey, keyAction, clockKeyAction, speechesKeyAction, isMacPlatform, startTip, speechesTip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TabulaKeys = api;
})(typeof window !== 'undefined' ? window : globalThis);
