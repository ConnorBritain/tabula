// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C5): the keyboard rules and
// the palette search. Each app passes in its own shortcut list (registry), its scopes and its palette rows; nothing
// here names an app's command. Generic words only (core-words.test.mjs). No DOM. Loaded as described in core/defs.js.

// ---------- one shortcut ----------
// keys: the key on Mac and on other systems. 'Meta' is ⌘; on Windows and ChromeOS it becomes 'Control'.
// single: a one-key shortcut. These obey the single-key off switch (WCAG 2.1.4). Modifier keys always work.
// typing: it also works while the focus is in a text box.
// noFocus: it works only when nothing has focus (Space keeps its native job on buttons and boxes).
// scope: 'global', or a name the app puts in ctx.scopes while that part of the page is showing.
// wideOnly: off in the narrow layout. esc: listed for the sheet and the clash tests, but run by the Esc stack.
// action: what the key does. Two keys can run the same action. label and group: the shortcut sheet row.
// feature: an AI gate key; the sheet leaves the row out when can(feature) is false.

export function parseCombo(combo) {
  const parts = String(combo).split('+');
  // 'Meta+\\' splits fine; a bare '+' key is not used.
  const key = parts.pop();
  return { mods: parts, key };
}

// Keys the browser or the keyboard layout already owns. No shortcut may use one.
export function isReservedCombo(combo, platform) {
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
export function focusKind(el) {
  if (!el || !el.tagName) return 'none';
  const tag = String(el.tagName).toUpperCase();
  if (tag === 'BODY' || tag === 'HTML') return 'none';
  if (el.isContentEditable) return 'text';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return 'text';
  if (tag === 'INPUT') return NOT_TEXT_INPUTS.includes(String(el.type || 'text').toLowerCase()) ? 'control' : 'text';
  return 'control';
}

// Does the pressed key match this shortcut's key? ev: { code, key, meta, ctrl, alt, shift, altGraph }.
export function keyMatches(shortcut, ev) {
  const { mods, key } = parseCombo(shortcut.keys.other);
  if (key === 'Space') return ev.code === 'Space' && !ev.meta && !ev.ctrl && !ev.alt && !ev.shift;
  if (key === 'Escape') return ev.key === 'Escape';
  // A bare Enter (no modifier). 'Meta+Enter' and other combos still take the modifier path below.
  if (key === 'Enter' && !mods.length) return ev.key === 'Enter' && !ev.meta && !ev.ctrl && !ev.alt && !ev.shift;
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

// May this shortcut run now? ctx: { scopes: [names showing now], focus, modal, singleKeysOn, narrow }.
// modal: a dialog, tour, welcome or editor is open, so shortcuts are off.
export function allowed(shortcut, ctx) {
  if (ctx.modal) return false;
  if (shortcut.wideOnly && ctx.narrow) return false;
  if (shortcut.scope && shortcut.scope !== 'global' && !(ctx.scopes || []).includes(shortcut.scope)) return false;
  if (shortcut.single && ctx.singleKeysOn === false) return false;
  if (shortcut.noFocus && ctx.focus !== 'none') return false;
  if (!shortcut.typing && ctx.focus === 'text') return false;
  return true;
}

export const isMacPlatform = (platform) => /Mac|iPhone|iPad|iPod/i.test(String(platform || ''));

// ---------- key names for people (the shortcut sheet, the palette and a help menu) ----------
// 'Meta+Enter' -> '⌘ Enter' on Mac and 'Ctrl+Enter' elsewhere; 'Meta+k' -> '⌘K' / 'Ctrl+K'; 'Escape' -> 'Esc'.
export function formatKeys(combo, mac) {
  const { mods, key } = parseCombo(combo);
  const name = key === 'Escape' ? 'Esc' : key.length === 1 ? key.toUpperCase() : key;
  if (!mods.length) return name;
  if (mac) {
    const sym = mods.map((m) => ({ Meta: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧' }[m] || m)).join('');
    return sym + (name.length > 1 ? ' ' : '') + name;
  }
  return mods.map((m) => ({ Meta: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift' }[m] || m)).join('+') + '+' + name;
}
export const shortcutKeys = (shortcut, mac) => formatKeys(mac ? shortcut.keys.mac : shortcut.keys.other, mac);

// ---------- one app's shortcut list ----------
// createKeymap(registry) -> { matchKey, keyAction, shortcutRows } over the app's own shortcuts.
export function createKeymap(registry) {
  // The registry id the key press runs, or null. Esc is not matched here (the Esc stack owns it).
  // Key repeat and input-method composing never run anything.
  function matchKey(ev, ctx) {
    if (!ev || ev.repeat || ev.composing) return null;
    const c = ctx || {};
    for (const shortcut of registry) {
      if (shortcut.esc) continue;
      if (keyMatches(shortcut, ev) && allowed(shortcut, c)) return shortcut.id;
    }
    return null;
  }
  // The action a key press runs, or null.
  function keyAction(ev, ctx) {
    const id = matchKey(ev, ctx);
    const shortcut = id && registry.find((e) => e.id === id);
    return shortcut ? shortcut.action : null;
  }
  // The shortcut sheet: groups in registry order. A single-key row is marked off when the single-key switch is off.
  // query filters by the label or the key name. can: the AI gate (feature -> bool, optional).
  // Returns [{ group, rows: [{ id, label, keys, off }] }].
  function shortcutRows(mac, singleKeysOn, query, can) {
    const q = String(query || '').trim().toLowerCase();
    const groups = [];
    for (const e of registry) {
      if (e.feature && can && !can(e.feature)) continue;
      const keys = shortcutKeys(e, mac);
      if (q && !e.label.toLowerCase().includes(q) && !keys.toLowerCase().includes(q)) continue;
      let g = groups.find((x) => x.group === e.group);
      if (!g) { g = { group: e.group, rows: [] }; groups.push(g); }
      g.rows.push({ id: e.id, label: e.label, keys, off: Boolean(e.single && singleKeysOn === false) });
    }
    return groups;
  }
  return Object.freeze({ matchKey, keyAction, shortcutRows });
}

// ---------- the palette search ----------
// rows: [{ label, alias }] in the app's group order. Prefix match first, then word match, then alias, then fuzzy (the
// letters in order). Inside each tier the rows keep their order. An empty query gives every row.
const words = (t) => String(t).toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);
function fuzzy(q, text) {
  let i = 0;
  for (const ch of text) if (ch === q[i]) i++;
  return i === q.length;
}
function searchTier(row, q) {
  const label = row.label.toLowerCase();
  const qw = words(q);
  if (label.startsWith(q)) return 0;
  const lw = words(label);
  if (qw.length && qw.every((w) => lw.some((l) => l.startsWith(w)))) return 1;
  const aw = (row.alias || []).flatMap(words);
  if ((row.alias || []).some((a) => a.toLowerCase().startsWith(q)) || (qw.length && qw.every((w) => aw.some((a) => a.startsWith(w))))) return 2;
  if (q.replace(/\s+/g, '').length >= 2 && fuzzy(q.replace(/\s+/g, ''), label.replace(/\s+/g, ''))) return 3;
  return -1;
}
export function searchCommands(query, rows) {
  const q = String(query || '').trim().toLowerCase();
  const list = rows || [];
  if (!q) return list.slice();
  const tiers = [[], [], [], []];
  for (const r of list) { const t = searchTier(r, q); if (t >= 0) tiers[t].push(r); }
  return tiers.flat();
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).keys = Object.freeze({ parseCombo, isReservedCombo, focusKind, keyMatches, allowed,
  isMacPlatform, formatKeys, shortcutKeys, createKeymap, searchCommands });
