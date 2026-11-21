// Run with: node --test
// The keyboard map (keys.js). Spec: docs/design/SPEC.md §1.3, §1.5, §4.1 and §6.1.
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('./keys.js');

const SPACE = { code: 'Space', key: ' ' };
const CMD_ENTER = { code: 'Enter', key: 'Enter', meta: true };
const CTRL_ENTER = { code: 'Enter', key: 'Enter', ctrl: true };
const flow = (over) => Object.assign({ place: 'flow', focus: 'none', modal: false, singleKeysOn: true }, over);
const act = (ev, ctx) => K.clockKeyAction(Object.assign({}, ev, flow(ctx)));

// Why: Space is the judge's main clock key; if it fails with nothing focused, the judge loses speech time.
test('clockKeyAction: Space with nothing focused, on Flow, toggles', () => {
  assert.equal(act(SPACE), 'toggle');
});

// Why: Space on a focused checkbox or button must do its native job (Q6), or keyboard users cannot tick boxes.
test('clockKeyAction: Space with focus on a control gives null', () => {
  assert.equal(act(SPACE, { focus: 'control' }), null);
});

// Why: Space in a flow column must type a space, never start or stop the clock.
test('clockKeyAction: Space with focus in text gives null', () => {
  assert.equal(act(SPACE, { focus: 'text' }), null);
});

// Why: the clock lives on Flow only (Q6); Space on Decide must scroll or press buttons as normal.
test('clockKeyAction: Space on Decide gives null', () => {
  assert.equal(act(SPACE, { place: 'decide' }), null);
});

// Why: a Space under an open dialog would start the clock behind the judge's back.
test('clockKeyAction: Space with a modal open gives null', () => {
  assert.equal(act(SPACE, { modal: true }), null);
});

// Why: a held Space key would flick the clock on and off many times a second.
test('clockKeyAction: Space with repeat gives null', () => {
  assert.equal(act(Object.assign({ repeat: true }, SPACE)), null);
});

// Why: WCAG 2.1.4 needs a way to turn one-key shortcuts off; the off switch must also silence Space.
test('clockKeyAction: Space with singleKeysOn false gives null', () => {
  assert.equal(act(SPACE, { singleKeysOn: false }), null);
});

// Why: ⌘ Enter is the only way to run the clock while typing in a column (Q6).
test('clockKeyAction: ⌘ Enter with focus in text, on Flow, toggles', () => {
  assert.equal(act(CMD_ENTER, { focus: 'text' }), 'toggle');
});

// Why: Windows and Chromebook judges use Ctrl+Enter; it must work the same way.
test('clockKeyAction: Ctrl+Enter with focus in text, on Flow, toggles', () => {
  assert.equal(act(CTRL_ENTER, { focus: 'text' }), 'toggle');
});

// Why: off Flow the clock key must do nothing (Q6), so ⌘ Enter in a Round form never starts a speech.
test('clockKeyAction: ⌘ Enter on Round gives null', () => {
  assert.equal(act(CMD_ENTER, { place: 'setup', focus: 'text' }), null);
});

// Why: Enter that ends an input-method word (Chinese, Japanese) must not also start the clock.
test('clockKeyAction: ⌘ Enter while composing gives null', () => {
  assert.equal(act(Object.assign({ composing: true }, CMD_ENTER), { focus: 'text' }), null);
});

// Why: Shift+Space or Alt+Space has other jobs; only a plain Space runs the clock.
test('clockKeyAction: Space with a modifier gives null', () => {
  for (const m of ['meta', 'ctrl', 'alt', 'shift']) assert.equal(act(Object.assign({ [m]: true }, SPACE)), null, m);
});

// Why: [ must open the speeches pane from the grid, but type "[" inside a column.
test('speechesKeyAction: [ on Flow toggles; in text gives null; ⌘\\ works while typing; off Flow gives null', () => {
  const sk = (ev, ctx) => K.speechesKeyAction(Object.assign({}, ev, flow(ctx)));
  assert.equal(sk({ key: '[', code: 'BracketLeft' }), 'toggle');
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { focus: 'control' }), 'toggle');
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { focus: 'text' }), null);
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { singleKeysOn: false }), null);
  assert.equal(sk({ key: '\\', code: 'Backslash', ctrl: true }, { focus: 'text' }), 'toggle');
  assert.equal(sk({ key: '\\', code: 'Backslash', meta: true }, { focus: 'text' }), 'toggle');
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { place: 'decide' }), null);
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { modal: true }), null);
});

// Why: single-character keys match the character the layout makes, so AltGr layouts can still type "[".
test('matchKey: [ with AltGr or Shift matches; with Ctrl or plain Alt it does not', () => {
  assert.equal(K.matchKey({ key: '[', altGraph: true, alt: true, ctrl: false }, flow()), 'pane.speeches');
  assert.equal(K.matchKey({ key: '[', shift: true }, flow()), 'pane.speeches');
  assert.equal(K.matchKey({ key: '[', ctrl: true }, flow()), null);
  assert.equal(K.matchKey({ key: '[', alt: true }, flow()), null);
});

// Why: the shortcut sheet and palette read the registry; an entry with no label or no key set shows as blank.
test('registry: every entry has an id, a label, a group and both key sets', () => {
  const ids = new Set();
  for (const e of K.REGISTRY) {
    assert.ok(e.id && !ids.has(e.id), 'unique id ' + e.id); ids.add(e.id);
    assert.ok(e.label && e.group, e.id + ' has a label and a group');
    assert.ok(e.keys && e.keys.mac && e.keys.other, e.id + ' has mac and other keys');
    // CHANGED 2026-11-20 because the owner's spec 4.1 adds ⌘P / Ctrl+P with the Ballot scope (Slice 4, 4.10).
    // Old check: assert.ok(['flow', 'global'].includes(e.scope), e.id + ' has a known scope');
    assert.ok(['flow', 'ballot', 'global'].includes(e.scope), e.id + ' has a known scope');
  }
});

// Why: two entries on one key in one scope would make one of them unreachable.
test('registry: no two entries in one scope share a key', () => {
  for (const os of ['mac', 'other']) {
    const seen = new Map();
    for (const e of K.REGISTRY) {
      const k = e.scope + '|' + e.keys[os];
      assert.ok(!seen.has(k), e.id + ' clashes with ' + seen.get(k) + ' on ' + os);
      seen.set(k, e.id);
    }
  }
});

// Why: a shortcut on a browser key (Ctrl+T, Ctrl+Tab) or an AltGr/Option key would either never fire or block typing.
test('registry: no entry uses a reserved key (spec 4.1)', () => {
  for (const e of K.REGISTRY) {
    assert.equal(K.isReservedCombo(e.keys.mac, 'mac'), false, e.id + ' mac');
    assert.equal(K.isReservedCombo(e.keys.other, 'other'), false, e.id + ' other');
  }
  // The reserved test itself must catch the keys the spec names.
  for (const c of ['Control+Alt+K', 'Control+PageDown', 'Control+Tab', 'Control+1', 'Control+T', 'Control+W', 'Control+D']) assert.equal(K.isReservedCombo(c, 'other'), true, c);
  assert.equal(K.isReservedCombo('Alt+K', 'mac'), true);
  assert.equal(K.isReservedCombo('Meta+W', 'mac'), true);
});

// Why: Space and the single keys must never fire inside a text box, so focusKind must call every typing box "text".
test('focusKind: body is none; inputs, textareas, selects and editable areas are text; buttons and checkboxes are controls', () => {
  assert.equal(K.focusKind(null), 'none');
  assert.equal(K.focusKind({ tagName: 'BODY' }), 'none');
  assert.equal(K.focusKind({ tagName: 'TEXTAREA' }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT', type: 'text' }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT', type: 'number' }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT' }), 'text');
  assert.equal(K.focusKind({ tagName: 'SELECT' }), 'text');
  assert.equal(K.focusKind({ tagName: 'DIV', isContentEditable: true }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT', type: 'checkbox' }), 'control');
  assert.equal(K.focusKind({ tagName: 'BUTTON' }), 'control');
  assert.equal(K.focusKind({ tagName: 'A' }), 'control');
});

// Why: the tooltip is the main place a judge learns the keys; the wrong key name on Windows teaches a key that fails.
test('startTip and speechesTip: Mac and other copy, and the single-key-off copy', () => {
  assert.equal(K.startTip(true, true), 'Start or pause (Space, or ⌘ Enter while typing)');
  assert.equal(K.startTip(false, true), 'Start or pause (Space, or Ctrl+Enter while typing)');
  assert.equal(K.startTip(true, false), 'Start or pause (⌘ Enter)');
  assert.equal(K.startTip(false, false), 'Start or pause (Ctrl+Enter)');
  assert.equal(K.speechesTip(true, true), 'Show speeches ([ or ⌘\\)');
  assert.equal(K.speechesTip(false, true), 'Show speeches ([ or Ctrl+\\)');
  assert.equal(K.isMacPlatform('MacIntel'), true);
  assert.equal(K.isMacPlatform('Win32'), false);
});

// Why: a guard only. If the old blur-to-steal-Space line comes back, checkboxes break and the caret is lost (Q6).
// The real protection is focusKind and the clockKeyAction focus cases above; this regex cannot catch other forms.
test('app.js (guard): the key handler no longer calls el.blur()', () => {
  // CHANGED 2026-11-20 because the owner approved the module split: the page code is now js/*.js plus app.js, and the
  // logic is logic/*.js plus logic.js. readSource('app.js') / readSource('logic.js') read every file of the group, so the
  // checks below cover the same code as before. Old line:
  // const app = require('node:fs').readFileSync(require('node:path').join(__dirname, 'app.js'), 'utf8');
  const app = require('./test-sources.js').readSource('app.js');
  assert.equal(/el\.blur\(\)/.test(app), false);
});

// Why: app.js runs keys only through keyAction; if keyAction and the spec 6.1 rules split, tests would pass on code the page never runs.
test('keyAction: gives the action of the matched entry, and clockKeyAction / speechesKeyAction agree with it', () => {
  assert.equal(K.keyAction({ code: 'Space', key: ' ' }, flow()), 'clock');
  assert.equal(K.keyAction({ key: 'Enter', meta: true }, flow({ focus: 'text' })), 'clock');
  assert.equal(K.keyAction({ key: '[' }, flow()), 'speeches');
  assert.equal(K.keyAction({ key: '\\', ctrl: true }, flow({ focus: 'text' })), 'speeches');
  assert.equal(K.keyAction({ key: 'Escape' }, flow()), null); // the Esc stack owns Esc
  assert.equal(K.keyAction({ code: 'Space', key: ' ' }, flow({ focus: 'text' })), null);
  const x = Object.assign({ key: '[' }, flow());
  assert.equal(K.speechesKeyAction(x), 'toggle');
  assert.equal(K.clockKeyAction(x), null);
});

// Why: an entry with no known action would match a key and then do nothing, so the judge's key press is lost.
test('registry: every entry names an action app.js knows', () => {
  // CHANGED 2026-11-20 because the owner's spec 4.1 adds ⌘P / Ctrl+P (action 'print', the 4.10 dialog), which app.js runs.
  // Old check: for (const e of K.REGISTRY) assert.ok(['clock', 'speeches', 'close'].includes(e.action), e.id + ' action ' + e.action);
  // CHANGED 2026-11-20 because the owner's spec 4.1 / 5.4 / 5.5 (Slice 5) adds ⌘K (palette), ? (shortcut sheet), ] (insights)
  // and \ (focus mode), which app.js runs. Old check:
  // for (const e of K.REGISTRY) assert.ok(['clock', 'speeches', 'close', 'print'].includes(e.action), e.id + ' action ' + e.action);
  for (const e of K.REGISTRY) assert.ok(['clock', 'speeches', 'close', 'print', 'palette', 'shortcuts', 'insights', 'focus'].includes(e.action), e.id + ' action ' + e.action);
});

// Why: a second path from key to action in app.js (the old ACTION table) could drift from the tested keyAction.
test('app.js (guard): the key handler uses K.keyAction and no separate action table', () => {
  // CHANGED 2026-11-20 because the owner approved the module split: the page code is now js/*.js plus app.js, and the
  // logic is logic/*.js plus logic.js. readSource('app.js') / readSource('logic.js') read every file of the group, so the
  // checks below cover the same code as before. Old line:
  // const app = require('node:fs').readFileSync(require('node:path').join(__dirname, 'app.js'), 'utf8');
  const app = require('./test-sources.js').readSource('app.js');
  assert.ok(/K\.keyAction\(/.test(app));
  assert.equal(/K\.ACTION\b/.test(app), false);
});

// Why: ⌘P on the Ballot must open Tabula's print dialog (full text, light colours); elsewhere it must stay the browser's own print.
test('⌘P / Ctrl+P runs print only on the Ballot tab, also while typing, and never under a dialog', () => {
  const ballot = (x) => Object.assign({ place: 'decide', tab: 'ballot', focus: 'none', modal: false, singleKeysOn: true }, x || {});
  assert.equal(K.keyAction({ key: 'p', meta: true }, ballot()), 'print');
  assert.equal(K.keyAction({ key: 'p', ctrl: true }, ballot({ focus: 'text' })), 'print');
  assert.equal(K.keyAction({ key: 'p', ctrl: true }, ballot({ tab: 'eval' })), null);
  assert.equal(K.keyAction({ key: 'p', ctrl: true }, ballot({ modal: true })), null);
  assert.equal(K.keyAction({ key: 'p' }, ballot()), null, 'a plain p types a p');
});

// ---------- Slice 5: the palette, the shortcut sheet and the new keys (spec 4.1, 5.2, 5.4, 5.5, 5.7, §6.1) ----------
const L5 = require('./logic.js');
const SPEECH_ROWS = L5.SPEECHES.map((s) => ({ id: s.id, label: s.label }));
const ctx5 = (over) => Object.assign({ place: 'flow', cur: 0, running: false, runId: '', prep: '', drawerOpen: false, flowView: 'mine', sheets: ['Case', 'DA'], sheetIdx: 0, speechesShown: true, insights: 'open', narrow: false, online: true, undo: '', aiAllowed: true, speeches: SPEECH_ROWS }, over);
const rowsFor = (over) => K.buildCommands(ctx5(over));
const row = (rows, label) => rows.find((r) => r.label === label);

// Why: ⌘K must open the palette from inside a flow column; if it needs an empty focus, a typing judge cannot reach any command.
test('⌘K / Ctrl+K runs the palette on every place, also while typing, but not under a dialog or in the narrow layout', () => {
  for (const place of ['flow', 'setup', 'decide', 'log', 'ai']) {
    assert.equal(K.keyAction({ key: 'k', meta: true }, flow({ place, focus: 'text' })), 'palette', place);
    assert.equal(K.keyAction({ key: 'k', ctrl: true }, flow({ place })), 'palette', place);
  }
  assert.equal(K.keyAction({ key: 'k', meta: true }, flow({ modal: true })), null, 'not over the tour, the welcome or ask()');
  assert.equal(K.keyAction({ key: 'k', meta: true }, flow({ narrow: true })), null, 'narrow: from the ? menu only');
  assert.equal(K.keyAction({ key: 'k' }, flow()), null, 'a plain k types a k');
});

// Why: ? must open the sheet only when nothing has focus; in a box it must type a question mark into the flow.
test('? toggles the shortcut sheet with nothing focused, on any place, and obeys the single-key switch', () => {
  assert.equal(K.keyAction({ key: '?', shift: true }, flow({ place: 'decide' })), 'shortcuts');
  assert.equal(K.keyAction({ key: '?', shift: true }, flow({ focus: 'text' })), null);
  assert.equal(K.keyAction({ key: '?', shift: true }, flow({ focus: 'control' })), null);
  assert.equal(K.keyAction({ key: '?', shift: true }, flow({ singleKeysOn: false })), null);
});

// Why: ] and \ are Flow-only single keys; off Flow, in a box or with the switch off they must type or do nothing.
test('] toggles insights and \\ is focus mode, on Flow only, not while typing, and off with the switch', () => {
  assert.equal(K.keyAction({ key: ']' }, flow()), 'insights');
  assert.equal(K.keyAction({ key: '\\' }, flow()), 'focus');
  assert.equal(K.keyAction({ key: '\\' }, flow({ focus: 'control' })), 'focus');
  for (const key of [']', '\\']) {
    assert.equal(K.keyAction({ key }, flow({ place: 'decide' })), null, key + ' off Flow');
    assert.equal(K.keyAction({ key }, flow({ focus: 'text' })), null, key + ' while typing');
    assert.equal(K.keyAction({ key }, flow({ singleKeysOn: false })), null, key + ' switch off');
    assert.notEqual(K.keyAction({ key, ctrl: true }, flow()), key === ']' ? 'insights' : 'focus', key + ' with Ctrl is not the single key');
  }
  assert.equal(K.keyAction({ key: ']', ctrl: true }, flow()), null);
  // ⌘\ is still the speeches pane, not focus mode.
  assert.equal(K.keyAction({ key: '\\', meta: true }, flow({ focus: 'text' })), 'speeches');
});

// Why: WCAG 2.1.4 needs one switch for every one-key shortcut; a single key that ignores it keeps firing for voice-control users.
test('matchKey with single keys off: every single-key entry is off, every modifier entry still works', () => {
  for (const e of K.REGISTRY) {
    if (e.esc) continue;
    const { mods, key } = K.parseCombo(e.keys.other);
    const ev = key === 'Space' ? { code: 'Space', key: ' ' } : { key, ctrl: mods.includes('Control'), shift: key === '?' };
    const ctx = { place: e.scope === 'flow' ? 'flow' : 'decide', tab: e.scope === 'ballot' ? 'ballot' : 'eval', focus: 'none', modal: false, singleKeysOn: false };
    assert.equal(K.matchKey(ev, ctx), e.single ? null : e.id, e.id);
  }
});

// Why: the sheet lists what the registry says; a row with a wrong key name on Windows teaches a key that does nothing.
test('shortcutRows: built from the registry, with Mac and other key names, the off mark and search', () => {
  const all = K.shortcutRows(false, true, '').flatMap((g) => g.rows);
  assert.equal(all.length, K.REGISTRY.length);
  assert.equal(all.find((r) => r.id === 'palette.toggle').keys, 'Ctrl+K');
  assert.equal(K.shortcutRows(true, true, '').flatMap((g) => g.rows).find((r) => r.id === 'palette.toggle').keys, '⌘K');
  assert.equal(all.find((r) => r.id === 'clock.toggle.mod').keys, 'Ctrl+Enter');
  assert.equal(all.find((r) => r.id === 'layer.close').keys, 'Esc');
  const off = K.shortcutRows(false, false, '').flatMap((g) => g.rows);
  assert.equal(off.find((r) => r.id === 'clock.toggle').off, true);
  assert.equal(off.find((r) => r.id === 'clock.toggle.mod').off, false);
  assert.deepEqual(K.shortcutRows(false, true, 'insights').flatMap((g) => g.rows).map((r) => r.id), ['pane.insights']);
  assert.deepEqual(K.shortcutRows(false, true, 'zzz'), []);
});

// Why: a palette row that names a registry entry shows that key; a broken link shows no key or the wrong one, and a
// registry entry marked for the palette with no row is a key the judge can never find by search.
test('palette and registry links: every row key exists, and every palette entry has a row', () => {
  const ids = new Set(K.REGISTRY.map((e) => e.id));
  for (const c of K.COMMANDS) if (c.key) assert.ok(ids.has(c.key), c.id + ' links to a missing registry entry ' + c.key);
  for (const e of K.REGISTRY) if (e.palette) assert.ok(K.COMMANDS.some((c) => c.key === e.id), e.id + ' is marked for the palette but no command links to it');
  for (const c of K.COMMANDS) assert.ok(K.GROUPS.includes(c.group), c.id + ' has a known group');
});

// Why: the spec gives exact labels; a changed label breaks the judge's search words and the facilitator's test script.
test('COMMANDS: the groups and exact labels of spec 5.4', () => {
  const labels = rowsFor({ undo: 'Undo: delete sheet DA' }).map((r) => r.label);
  // CHANGED 2026-11-20 because the owner asked for the product name to show; the palette now matches the ? menu item "About Tabula Debate". Old check: 'Open About Tabula' in this list.
  // CHANGED 2026-11-20 because the owner said "1: Rename to History". Old check: 'Go to Ballots' and 'Save to Ballots' in this list.
  for (const l of ['Go to Flow', 'Go to Round setup', 'Go to Live Eval', 'Go to Analysis', 'Go to Ballot', 'Go to History', 'Go to Settings', 'Open Debate library', 'Open About Tabula Debate',
    'Start or pause clock', 'Next speech', 'Previous speech', 'Go to speech: 1AC', 'Go to speech: CX of 1A', 'Go to speech: 2AR', 'Reset speech clock', 'Start Aff prep', 'Start Neg prep', 'Show transcript',
    'Go to sheet: Case', 'Go to sheet: DA', 'Next sheet', 'Previous sheet', 'New sheet', 'Rename sheet: Case', 'Duplicate sheet: Case', 'Delete sheet: Case', 'Switch to AI flow',
    'Hide speeches pane', 'Hide insights', 'Focus mode', 'New round', 'Save round file (.tab)', 'Open round file',
    'Draft with AI', 'Print or save as PDF', 'Copy for the tournament ballot', 'Save to History', 'Undo: delete sheet DA',
    'Keyboard shortcuts', 'Take the full tour', 'Tour this page']) assert.ok(labels.includes(l), 'missing: ' + l);
  assert.equal(labels.filter((l) => l.startsWith('Go to speech: ')).length, 12);
  // Theme and reading level are not in the palette.
  assert.equal(labels.some((l) => /theme|dark|light|plain|expert|reading/i.test(l)), false);
  // The labels that follow the round.
  const r2 = rowsFor({ prep: 'aff', drawerOpen: true, flowView: 'ai', speechesShown: false, insights: 'edge-show' }).map((r) => r.label);
  for (const l of ['Stop Aff prep', 'Hide transcript', 'Switch to My flow', 'Show speeches pane', 'Show insights']) assert.ok(r2.includes(l), l);
});

// Why: the Undo row is the keyboard path to Undo; shown with no Undo waiting, it would run nothing.
test('buildCommands: the Undo row shows only while an Undo toast shows', () => {
  assert.equal(rowsFor().some((r) => r.id === 'undo'), false);
  assert.equal(row(rowsFor({ undo: 'Undo: delete sheet DA' }), 'Undo: delete sheet DA').group, 'Undo');
});

// Why: a disabled row that does not say why looks broken; the judge needs the reason in the row itself.
test('disabled rules: Next speech at 2AR, Previous at 1AC, Delete sheet with one sheet, AI rows offline', () => {
  assert.equal(row(rowsFor({ cur: 11 }), 'Next speech').disabled, true);
  assert.equal(row(rowsFor({ cur: 11 }), 'Next speech').note, '· already at 2AR');
  assert.equal(row(rowsFor({ cur: 5 }), 'Next speech').disabled, false);
  assert.equal(row(rowsFor({ cur: 0 }), 'Previous speech').note, '· already at 1AC');
  const one = rowsFor({ sheets: ['Case'] });
  assert.equal(row(one, 'Delete sheet: Case').disabled, true);
  assert.equal(row(one, 'Delete sheet: Case').note, '· the last sheet cannot be deleted');
  assert.equal(row(rowsFor(), 'Delete sheet: Case').disabled, false);
  assert.equal(row(rowsFor({ online: false }), 'Draft with AI').note, '· needs internet');
  assert.equal(row(rowsFor({ online: false }), 'Draft with AI').disabled, true);
  // CHANGED 2026-11-20 because the owner said "1: Rename to History". Old check: row(..., 'Save to Ballots').disabled is false.
  assert.equal(row(rowsFor({ online: false }), 'Save to History').disabled, false, 'only AI rows need the internet');
  assert.equal(row(rowsFor({ insights: 'edge-connect', speechesShown: true }), 'Show insights').disabled, true, '] does nothing with no AI');
});

// Why: a Flow command from Decide changes Flow; the judge must be told the palette will take them there.
test('buildCommands: Flow commands off Flow say "· goes to Flow"; prep says it pauses the running speech', () => {
  const off = rowsFor({ place: 'decide' });
  assert.equal(row(off, 'Start or pause clock').note, '· goes to Flow');
  assert.equal(row(off, 'Go to sheet: DA').note, '· goes to Flow');
  assert.equal(row(off, 'Go to Ballot').note, '');
  assert.equal(row(rowsFor(), 'Start or pause clock').note, '');
  assert.equal(row(rowsFor({ running: true, runId: '2AC' }), 'Start Neg prep').note, '· pauses the 2AC');
  assert.equal(row(rowsFor({ running: true, runId: '2AC', place: 'log' }), 'Start Neg prep').note, '· pauses the 2AC · goes to Flow');
});

// Why: a later program setting must be able to hide every AI row from one place (docs/design/AI-POLICY.md, not built).
test('buildCommands: aiAllowed false hides the AI rows and nothing else', () => {
  const on = rowsFor(), off = rowsFor({ aiAllowed: false });
  const gone = on.filter((r) => !off.some((o) => o.id === r.id && o.arg === r.arg)).map((r) => r.label);
  assert.deepEqual(gone.sort(), ['Draft with AI', 'Switch to AI flow']);
});

// Why: search order is how a judge finds a command in two keys; a fuzzy hit above an exact one sends them to the wrong place.
test('searchCommands: "2ac", "timer", "log", "" and "zzz"', () => {
  const rows = rowsFor();
  assert.equal(K.searchCommands('2ac', rows)[0].label, 'Go to speech: 2AC');
  assert.equal(K.searchCommands('timer', rows)[0].label, 'Start or pause clock');
  // CHANGED 2026-11-20 because the owner said "1: Rename to History". Old check: assert.equal(K.searchCommands('log', rows)[0].label, 'Go to Ballots');
  assert.equal(K.searchCommands('log', rows)[0].label, 'Go to History');
  assert.deepEqual(K.searchCommands('', rows), rows);
  assert.deepEqual(K.searchCommands('zzz', rows), []);
});

// Why: if an alias or fuzzy hit outranks a real word hit, Enter runs the wrong command for a judge who typed a label word (5.4).
test('searchCommands: prefix, then word, then alias, then fuzzy', () => {
  const rows = [
    { label: 'Fuzzy pick row', alias: [] },
    { label: 'Has alias', alias: ['pick'] },
    { label: 'A pick word', alias: [] },
    { label: 'Pick first', alias: [] },
  ];
  assert.deepEqual(K.searchCommands('pick', rows).map((r) => r.label), ['Pick first', 'Fuzzy pick row', 'A pick word', 'Has alias']);
  assert.deepEqual(K.searchCommands('fzpk', rows).map((r) => r.label), ['Fuzzy pick row']);
  assert.deepEqual(K.searchCommands('PICK FIR', rows).map((r) => r.label), ['Pick first']);
});

// Why: a key name on the screen that does not match the judge's keyboard teaches a key that does not work.
test('formatKeys: ⌘ on Mac, Ctrl elsewhere; Esc and Space by name', () => {
  assert.equal(K.formatKeys('Meta+Enter', true), '⌘ Enter');
  assert.equal(K.formatKeys('Control+Enter', false), 'Ctrl+Enter');
  assert.equal(K.formatKeys('Meta+k', true), '⌘K');
  assert.equal(K.formatKeys('Control+k', false), 'Ctrl+K');
  assert.equal(K.formatKeys('Control+\\', false), 'Ctrl+\\');
  assert.equal(K.formatKeys('Escape', true), 'Esc');
  assert.equal(K.formatKeys('Space', false), 'Space');
  assert.equal(K.formatKeys('?', false), '?');
});

// Why: the chip is how a judge off Flow knows a clock still runs; the wrong text or colour hides an over-time speech.
test('chipText: running, last 30 s, over time, prep, paused, on Flow, viewing', () => {
  assert.deepEqual(L5.chipText({ run: { id: '1AR', left: 161 } }), { text: '1AR · 2:41', tone: '', side: 'aff', kind: 'speech', said: '1AR clock still running' });
  assert.equal(L5.chipText({ run: { id: '1AR', left: 29.2 } }).tone, 'caution');
  assert.equal(L5.chipText({ run: { id: '1AR', left: 29.2 } }).text, '1AR · 0:30');
  const over = L5.chipText({ run: { id: '1AR', left: -12 } });
  assert.equal(over.text, '1AR · 0:12 over'); assert.equal(over.tone, 'error');
  assert.equal(L5.chipText({ prep: { side: 'aff', left: 190 } }).text, 'Aff prep · 3:10');
  assert.equal(L5.chipText({ prep: { side: 'neg', left: 10 } }).said, 'Neg prep clock still running');
  assert.equal(L5.chipText({}), null, 'paused: hidden');
  assert.equal(L5.chipText({ onFlow: true, run: { id: '1AR', left: 100 } }), null, 'on Flow the round bar shows the clock');
  // Viewing another speech: the chip still shows the running one (the caller passes R.run, not the viewed speech).
  assert.equal(L5.chipText({ run: { id: 'CX-2A', left: 100 } }).text, 'CX 2A · 1:40');
  assert.equal(L5.chipText({ run: { id: '2NC', left: 100 } }).side, 'neg');
});

// Why: the study result is the pass line for the five-judge test (Q-12); a wrong number passes or fails the app by mistake.
test('studyResult: "Study: 0:47 to start", null until both marks exist', () => {
  const r = L5.studyResult({ firstView: 1000, firstStart: 48000 });
  assert.equal(r.text, 'Study: 0:47 to start');
  assert.equal(r.seconds, 47);
  assert.equal(r.pass, true);
  assert.match(r.copy, /0:47 \(47 s\) from first view to the first 1AC Start/);
  assert.equal(L5.studyResult({ firstView: 0, firstStart: 61500 }).pass, false);
  assert.equal(L5.studyResult({ firstView: 1000 }), null);
  assert.equal(L5.studyResult(null), null);
});

// Why: judges who learned "Ballots" or "history" must still reach the saved ballots in two keys after the rename to History.
test('searchCommands: "history" and the old word "ballots" both find Go to History', () => {
  const rows = rowsFor();
  assert.equal(K.searchCommands('history', rows)[0].label, 'Go to History');
  assert.ok(K.searchCommands('ballots', rows).some((r) => r.label === 'Go to History'), '"ballots" finds Go to History');
});
