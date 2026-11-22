// Tabula Debate's keyboard map: its one registry of shortcuts and its palette commands. The rules that decide if a key
// press runs an entry, the key names and the palette search are shared code in core/keys.js (step C5); this file
// passes debate's entries in and turns debate's place and tab into scopes. No DOM here, so Node tests can check every
// rule. app.js reads the page state and asks keyAction().
// Slice 0/1 holds the round-safety keys (spec 4.1); Slice 5 adds ⌘K, ?, ], \ and the palette commands (5.4).
(function (root) {
  'use strict';
  // The shared key rules (core/keys.js, an ES module): the page runs it before this file; Node requires it.
  const CK = typeof module !== 'undefined' && module.exports ? require('./core/keys.js') : root.TabulaCore.keys;
  const { parseCombo, isReservedCombo, focusKind, keyMatches, isMacPlatform, formatKeys, searchCommands } = CK;
  const entryKeys = CK.shortcutKeys; // kept under the name debate's page code (js/palette.js) uses

  // The shortcut fields are described in core/keys.js. Debate's scopes: 'flow' (only on the Flow place), 'ballot' (only on
  // Decide → Ballot, spec 4.1) or 'global'.
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

  // Debate's page state as the shared scopes: the Flow place and the Ballot tab.
  const scopesOf = (c) => [c.place === 'flow' ? 'flow' : '', c.tab === 'ballot' ? 'ballot' : ''].filter(Boolean);
  const KEYMAP = CK.createKeymap(REGISTRY);

  // The registry id the key press runs, or null. ctx: { place, tab, focus, modal, singleKeysOn, narrow }.
  const withScopes = (ctx) => Object.assign({}, ctx, { scopes: scopesOf(ctx || {}) });
  const matchKey = (ev, ctx) => KEYMAP.matchKey(ev, withScopes(ctx));
  // The action a key press runs ('clock', 'speeches', 'print', 'palette', 'shortcuts', 'insights', 'focus') or null. app.js calls only this.
  const keyAction = (ev, ctx) => KEYMAP.keyAction(ev, withScopes(ctx));
  // The clock rule (spec 1.3) and the speeches pane rule (spec 1.5), as spec 6.1 names them for the tests.
  // Each takes one object with the key and the context and returns 'toggle' or null. Both go through keyAction.
  const clockKeyAction = (x) => (keyAction(x, x) === 'clock' ? 'toggle' : null);
  const speechesKeyAction = (x) => (keyAction(x, x) === 'speeches' ? 'toggle' : null);

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

  // The shortcut sheet (spec 5.5), built from the registry by core/keys.js.
  const shortcutRows = KEYMAP.shortcutRows;

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
    { id: 'go.log', group: 'Go to', tab: 'log', label: 'Go to History', alias: ['log', 'saved', 'history', 'ballots', 'backup', 'csv'] },
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
    { id: 'ballot.save', group: 'Ballot', label: 'Save to History', alias: ['log', 'keep', 'ballots'] },
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

  // Search (5.4) is searchCommands in core/keys.js.

  const api = { REGISTRY, parseCombo, isReservedCombo, focusKind, keyMatches, matchKey, keyAction, clockKeyAction, speechesKeyAction, isMacPlatform, startTip, speechesTip,
    formatKeys, entryKeys, shortcutRows, GROUPS, COMMANDS, buildCommands, searchCommands };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TabulaKeys = api;
})(typeof window !== 'undefined' ? window : globalThis);
