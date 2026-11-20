// The keyboard map: one registry of shortcuts, and the pure rules that decide if a key press runs one.
// No DOM here, so Node tests can check every rule. app.js reads the page state and asks matchKey().
// Slice 0/1 holds the round-safety keys (spec 4.1); Slice 5 adds ⌘K, ?, ], \ and the palette commands (5.4).
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
    { id: 'clock.toggle', action: 'clock', label: 'Start or pause the clock', group: 'Clock', scope: 'flow', keys: { mac: 'Space', other: 'Space' }, single: true, typing: false, noFocus: true, palette: true },
    { id: 'clock.toggle.mod', action: 'clock', label: 'Start or pause the clock, also while typing', group: 'Clock', scope: 'flow', keys: { mac: 'Meta+Enter', other: 'Control+Enter' }, single: false, typing: true, noFocus: false, palette: false },
    { id: 'pane.speeches', action: 'speeches', label: 'Show or hide the speeches pane', group: 'Panes', scope: 'flow', keys: { mac: '[', other: '[' }, single: true, typing: false, noFocus: false, palette: true },
    { id: 'pane.speeches.mod', action: 'speeches', label: 'Show or hide the speeches pane, also while typing', group: 'Panes', scope: 'flow', keys: { mac: 'Meta+\\', other: 'Control+\\' }, single: false, typing: true, noFocus: false, palette: false },
    // ⌘P / Ctrl+P on the Ballot opens the Print / PDF dialog (spec 4.1, 4.10) instead of the browser's print window.
    { id: 'ballot.print', action: 'print', label: 'Print or save the ballot as PDF', group: 'Ballot', scope: 'ballot', keys: { mac: 'Meta+p', other: 'Control+p' }, single: false, typing: true, noFocus: false, palette: true },
    // Slice 5 (spec 4.1, 5.4, 5.5). ⌘K / Ctrl+K opens or closes the palette on every place, also while typing. In the
    // narrow layout the palette opens from the ? menu only (wideOnly).
    { id: 'palette.toggle', action: 'palette', label: 'Open or close Search and commands', group: 'General', scope: 'global', keys: { mac: 'Meta+k', other: 'Control+k' }, single: false, typing: true, noFocus: false, palette: false, wideOnly: true },
    { id: 'sheet.toggle', action: 'shortcuts', label: 'Show or hide keyboard shortcuts', group: 'General', scope: 'global', keys: { mac: '?', other: '?' }, single: true, typing: false, noFocus: true, palette: true },
    { id: 'pane.insights', action: 'insights', label: 'Show or hide insights', group: 'Panes', scope: 'flow', keys: { mac: ']', other: ']' }, single: true, typing: false, noFocus: false, palette: true, feature: 'liveEval' },
    { id: 'pane.focus', action: 'focus', label: 'Focus mode (hide both panes)', group: 'Panes', scope: 'flow', keys: { mac: '\\', other: '\\' }, single: true, typing: false, noFocus: false, palette: true },
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

  // May this entry run now? ctx: { place, tab, focus, modal, singleKeysOn, narrow }. tab: the open tab (for the 'ballot' scope).
  function allowed(entry, ctx) {
    if (ctx.modal) return false;
    if (entry.wideOnly && ctx.narrow) return false; // the narrow layout opens the palette from the ? menu only (5.4) // a dialog, tour, welcome or node editor is open: shortcuts are off
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

  // The action a key press runs ('clock', 'speeches', 'print', 'palette', 'shortcuts', 'insights', 'focus') or null. app.js calls only this.
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

  // ---------- key names for people (the shortcut sheet, the palette and the ? menu) ----------
  // 'Meta+Enter' -> '⌘ Enter' on Mac and 'Ctrl+Enter' elsewhere; 'Meta+k' -> '⌘K' / 'Ctrl+K'; 'Escape' -> 'Esc'.
  function formatKeys(combo, mac) {
    const { mods, key } = parseCombo(combo);
    const name = key === 'Escape' ? 'Esc' : key.length === 1 ? key.toUpperCase() : key;
    if (!mods.length) return name;
    if (mac) {
      const sym = mods.map((m) => ({ Meta: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧' }[m] || m)).join('');
      return sym + (name.length > 1 ? ' ' : '') + name;
    }
    return mods.map((m) => ({ Meta: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift' }[m] || m)).join('+') + '+' + name;
  }
  const entryKeys = (entry, mac) => formatKeys(mac ? entry.keys.mac : entry.keys.other, mac);

  // ---------- the shortcut sheet (spec 5.5): built from the registry ----------
  // Groups in registry order. A single-key row is marked off when the single-key switch is off. query filters by the
  // label or the key name. Returns [{ group, rows: [{ id, label, keys, off }] }].
  // can: the AI gate (feature -> bool, optional); an entry with a feature that is off is left out (platform 1B).
  function shortcutRows(mac, singleKeysOn, query, can) {
    const q = String(query || '').trim().toLowerCase();
    const groups = [];
    for (const e of REGISTRY) {
      if (e.feature && can && !can(e.feature)) continue;
      const keys = entryKeys(e, mac);
      if (q && !e.label.toLowerCase().includes(q) && !keys.toLowerCase().includes(q)) continue;
      let g = groups.find((x) => x.group === e.group);
      if (!g) { g = { group: e.group, rows: [] }; groups.push(g); }
      g.rows.push({ id: e.id, label: e.label, keys, off: Boolean(e.single && singleKeysOn === false) });
    }
    return groups;
  }

  // ---------- the palette, "Search and commands" (spec 5.4, Q13) ----------
  // The commands, in the spec's groups and order. label: the exact row text; a function when the text depends on
  // the round. key: the registry entry that runs the same thing (the row shows its key). flow: a Flow command (run
  // from another place, it first goes to Flow). ai: an AI row (its visibility goes through one page helper, so a later
  // program setting can hide it). feature: its AI gate key; the row is left out when ctx.can(feature) is false
  // (platform 1B). net: it needs the internet. alias: other words a judge may type.
  // Theme and reading level are not in the palette (5.4).
  const GROUPS = ['Go to', 'Clock and speeches', 'Sheets', 'Panes', 'Round', 'Ballot', 'Undo', 'Help'];
  const COMMANDS = [
    { id: 'go.flow', group: 'Go to', tab: 'flow', label: 'Go to Flow', alias: ['grid', 'clock'] },
    { id: 'go.setup', group: 'Go to', tab: 'setup', label: 'Go to Round setup', alias: ['teams', 'names', 'tournament', 'setup'] },
    { id: 'go.eval', group: 'Go to', tab: 'eval', feature: 'liveEval', label: 'Go to Live Eval', alias: ['decide', 'evaluation', 'feedback'] },
    { id: 'go.analysis', group: 'Go to', tab: 'analysis', label: 'Go to Analysis', alias: ['decide', 'map', 'impacts', 'paradigm'] },
    { id: 'go.ballot', group: 'Go to', tab: 'ballot', label: 'Go to Ballot', alias: ['decide', 'rfd', 'points', 'ranks', 'winner'] },
    { id: 'go.log', group: 'Go to', tab: 'log', label: 'Go to Ballots', alias: ['log', 'saved', 'history', 'backup', 'csv'] },
    { id: 'go.settings', group: 'Go to', tab: 'ai', label: 'Go to Settings', alias: ['preferences', 'options', 'key', 'audio', 'microphone', 'theme'] },
    { id: 'open.library', group: 'Go to', label: 'Open Debate library', alias: ['learn', 'guides', 'help'] },
    { id: 'open.about', group: 'Go to', label: 'Open About Tabula Debate', alias: ['privacy', 'version'] },
    { id: 'clock.toggle', group: 'Clock and speeches', label: 'Start or pause clock', key: 'clock.toggle', flow: true, alias: ['timer', 'stop', 'resume', 'play'] },
    { id: 'speech.next', group: 'Clock and speeches', label: 'Next speech', flow: true, alias: ['forward'] },
    { id: 'speech.prev', group: 'Clock and speeches', label: 'Previous speech', flow: true, alias: ['back'] },
    { id: 'speech.go', group: 'Clock and speeches', label: 'Go to speech', flow: true, each: 'speech', alias: ['speech'] },
    { id: 'clock.reset', group: 'Clock and speeches', label: 'Reset speech clock', flow: true, alias: ['timer', 'restart'] },
    { id: 'prep.aff', group: 'Clock and speeches', label: (c) => (c.prep === 'aff' ? 'Stop Aff prep' : 'Start Aff prep'), flow: true, alias: ['prep', 'timer'] },
    { id: 'prep.neg', group: 'Clock and speeches', label: (c) => (c.prep === 'neg' ? 'Stop Neg prep' : 'Start Neg prep'), flow: true, alias: ['prep', 'timer'] },
    { id: 'transcript', group: 'Clock and speeches', feature: 'transcription', label: (c) => (c.drawerOpen ? 'Hide transcript' : 'Show transcript'), flow: true, alias: ['drawer', 'words', 'text'] },
    { id: 'sheet.go', group: 'Sheets', label: 'Go to sheet', flow: true, each: 'sheet', alias: ['sheet', 'tab'] },
    { id: 'sheet.next', group: 'Sheets', label: 'Next sheet', flow: true, alias: ['tab'] },
    { id: 'sheet.prev', group: 'Sheets', label: 'Previous sheet', flow: true, alias: ['tab'] },
    { id: 'sheet.new', group: 'Sheets', label: 'New sheet', flow: true, alias: ['add', 'tab', 'create'] },
    { id: 'sheet.rename', group: 'Sheets', label: (c) => 'Rename sheet: ' + c.sheetName, flow: true, alias: ['name'] },
    { id: 'sheet.dup', group: 'Sheets', label: (c) => 'Duplicate sheet: ' + c.sheetName, flow: true, alias: ['copy'] },
    { id: 'sheet.del', group: 'Sheets', label: (c) => 'Delete sheet: ' + c.sheetName, flow: true, alias: ['remove'] },
    { id: 'flow.view', group: 'Sheets', label: (c) => (c.flowView === 'ai' ? 'Switch to My flow' : 'Switch to AI flow'), flow: true, ai: true, feature: 'aiFlow', alias: ['view', 'mine'] },
    { id: 'pane.speeches', group: 'Panes', label: (c) => (c.speechesShown ? 'Hide speeches pane' : 'Show speeches pane'), key: 'pane.speeches', flow: true, alias: ['left', 'docs'] },
    { id: 'pane.insights', group: 'Panes', label: (c) => (c.insights === 'open' ? 'Hide insights' : 'Show insights'), key: 'pane.insights', flow: true, feature: 'liveEval', alias: ['right'] },
    { id: 'pane.focus', group: 'Panes', label: 'Focus mode', key: 'pane.focus', flow: true, alias: ['zen', 'hide panes', 'full'] },
    { id: 'round.new', group: 'Round', label: 'New round', alias: ['clear', 'reset', 'start over'] },
    { id: 'round.save', group: 'Round', label: 'Save round file (.tab)', alias: ['download', 'export', 'tab file'] },
    { id: 'round.open', group: 'Round', label: 'Open round file', alias: ['import', 'load', 'tab file'] },
    { id: 'ballot.draft', group: 'Ballot', label: 'Draft with AI', ai: true, feature: 'ballotDraft', net: true, alias: ['rfd', 'write'] },
    { id: 'ballot.print', group: 'Ballot', label: 'Print or save as PDF', key: 'ballot.print', alias: ['pdf', 'print'] },
    { id: 'ballot.copy', group: 'Ballot', label: 'Copy for the tournament ballot', alias: ['paste', 'tabroom', 'clipboard'] },
    { id: 'ballot.save', group: 'Ballot', label: 'Save to Ballots', alias: ['log', 'keep'] },
    { id: 'undo', group: 'Undo', label: (c) => c.undo, alias: ['restore', 'back'] },
    { id: 'help.keys', group: 'Help', label: 'Keyboard shortcuts', key: 'sheet.toggle', alias: ['keys', 'hotkeys', 'shortcut'] },
    { id: 'help.tour', group: 'Help', label: 'Take the full tour', alias: ['help', 'guide', 'intro'] },
    { id: 'help.pagetour', group: 'Help', label: 'Tour this page', alias: ['help', 'guide'] },
  ];

  // The rows the palette shows now. ctx: { place, cur (the viewed speech index), running, runId, prep ('aff' |
  // 'neg' | ''), drawerOpen, flowView, sheets: [names], sheetIdx, speechesShown, insights (insightsMode), narrow,
  // online, undo ('Undo: …' or ''), aiAllowed (false hides AI rows), can (the AI gate, feature -> bool; optional),
  // speeches: [{ id, label }] }.
  // Each row: { id, arg, group, label, note, disabled, keyId, alias }. note is the grey text after the label: why a
  // row does nothing ("· already at 2AR"), or what it does first ("· goes to Flow").
  function buildCommands(ctx) {
    const c = Object.assign({ sheets: [], speeches: [], online: true, aiAllowed: true }, ctx || {});
    const speeches = c.speeches || [];
    const lastIdx = speeches.length - 1;
    const sheets = c.sheets || [];
    c.sheetName = sheets[c.sheetIdx] || sheets[0] || '';
    const runName = c.runId ? String(c.runId).replace('CX-', 'CX ') : '';
    const rows = [];
    for (const cmd of COMMANDS) {
      if (cmd.ai && c.aiAllowed === false) continue;
      if (cmd.feature && c.can && !c.can(cmd.feature)) continue;
      if (cmd.id === 'undo' && !c.undo) continue;
      const base = { id: cmd.id, group: cmd.group, keyId: cmd.key || '', alias: cmd.alias || [] };
      const why = disabledWhy(cmd, c, { lastIdx, sheets });
      const goes = cmd.flow && c.place !== 'flow' ? '· goes to Flow' : '';
      if (cmd.each === 'speech') {
        speeches.forEach((s, i) => rows.push(Object.assign({}, base, { arg: i, label: 'Go to speech: ' + s.label.replace(/ \(.*\)$/, ''), alias: base.alias.concat([s.id.toLowerCase()]), note: why || goes, disabled: Boolean(why) })));
        continue;
      }
      if (cmd.each === 'sheet') {
        sheets.forEach((n, i) => rows.push(Object.assign({}, base, { arg: i, label: 'Go to sheet: ' + n, note: why || goes, disabled: Boolean(why) })));
        continue;
      }
      const label = typeof cmd.label === 'function' ? cmd.label(c) : cmd.label;
      let note = why || goes;
      // A prep start pauses a running speech: say so on the row (5.4).
      if (!why && (cmd.id === 'prep.aff' || cmd.id === 'prep.neg') && c.running && c.prep !== cmd.id.slice(5)) note = '· pauses the ' + runName + (goes ? ' ' + goes : '');
      rows.push(Object.assign({}, base, { arg: null, label, note, disabled: Boolean(why) }));
    }
    return rows;
  }
  // Why a command cannot run now ('' when it can). The disabled rules (spec 5.4).
  function disabledWhy(cmd, c, x) {
    const speeches = c.speeches || [];
    if (cmd.net && c.online === false) return '· needs internet';
    if (cmd.id === 'speech.next' && speeches.length && Number(c.cur) >= x.lastIdx) return '· already at ' + speeches[x.lastIdx].id;
    if (cmd.id === 'speech.prev' && speeches.length && Number(c.cur) <= 0) return '· already at ' + speeches[0].id;
    if (cmd.id === 'sheet.del' && x.sheets.length < 2) return '· the last sheet cannot be deleted';
    if ((cmd.id === 'sheet.next' || cmd.id === 'sheet.prev') && x.sheets.length < 2) return '· there is only one sheet';
    if (cmd.group === 'Panes' && c.narrow) return '· needs a wider screen';
    if (cmd.id === 'pane.insights' && c.insights === 'edge-connect') return '· connect AI in Settings first';
    return '';
  }

  // Search (5.4): prefix match first, then word match, then alias, then fuzzy (the letters in order). Inside each
  // tier the rows keep their group order. An empty query gives every row.
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
  function searchCommands(query, rows) {
    const q = String(query || '').trim().toLowerCase();
    const list = rows || [];
    if (!q) return list.slice();
    const tiers = [[], [], [], []];
    for (const r of list) { const t = searchTier(r, q); if (t >= 0) tiers[t].push(r); }
    return tiers.flat();
  }

  const api = { REGISTRY, parseCombo, isReservedCombo, focusKind, keyMatches, matchKey, keyAction, clockKeyAction, speechesKeyAction, isMacPlatform, startTip, speechesTip,
    formatKeys, entryKeys, shortcutRows, GROUPS, COMMANDS, buildCommands, searchCommands };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TabulaKeys = api;
})(typeof window !== 'undefined' ? window : globalThis);
