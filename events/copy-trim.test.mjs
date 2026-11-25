// Copy trim cuts for Speech Events (docs/design/COPY-TRIM-AUDIT.md, top 10). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { timerHtml } from './js/timer-view.js';
import { settingsHtml } from './js/settings-screen.js';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

// Why: a judge whose speaker walks in late must undo the no show from the card in front of them; directions to a
// roster menu cost seconds mid-round (E8).
test('a no-show timer card shows a No show pill and an Undo no show button that runs the roster undo', () => {
  const html = timerHtml({ id: 'e3', code: 'A12', status: 'noShow' }, {}, 0, 0);
  assert.match(html, /class="pill outline"[^>]*>No show</);
  assert.match(html, /<button[^>]*data-act="show" data-id="e3"[^>]*>Undo no show<\/button>/);
  assert.doesNotMatch(html, /roster menu/);
});

// Why: "stays on this device" said four times a round turns a privacy promise into noise; it must be said once, at
// setup, or judges stop reading it (E5-E7, E20).
test('"stays on this device" shows once per round, on setup', () => {
  assert.doesNotMatch(read('js/quote-view.js'), /stays on this device/);
  assert.doesNotMatch(read('js/piece-view.js'), /stays on this device/);
  assert.match(read('js/setup-screen.js'), /Codes are enough\. The text stays on this device\./);
});

// Why: the rank help must keep the top-N rule and the keyboard move keys (they are in no other sheet), or a keyboard
// judge cannot reorder and a judge may think every rank counts (E19).
test('rank help keeps the top-N rule and the Alt keys in short sentences', () => {
  const src = read('js/rank-screen.js');
  assert.match(src, /Best first\. Alt\+Up and Alt\+Down move a row\./);
  assert.match(src, /' Only the top ' \+ layerOf\(r\.profile\)\.topN \+ ' are ranked on the ballot\.'/);
  assert.doesNotMatch(src, /Drag the handle, use the arrows/);
});

// Why: the lock rule is what stops a judge from submitting ranks before checking them; the shorter line must keep it (E30).
test('review keeps the lock rule in three short facts', () => {
  assert.match(read('js/review-screen.js'), /Enter ranks first\. Ranks lock on submit\. Comments stay open\./);
});

// Why: the room toast and My day lines are read at a glance between rounds; a vendor name breaks DESIGN.md rule 9 (E9, E36-E38).
test('room toast and My day lines are one short line each, with no vendor name', () => {
  assert.match(read('js/room-screen.js'), /'Everyone is done\. Rank the room\.'/);
  const md = read('js/myday-screen.js');
  assert.match(md, /<strong>Comments still open\.<\/strong> Finish them before you leave\./);
  assert.match(md, />No ballots yet today\.</);
  assert.match(md, /<p>No ballot yet\.<\/p>/);
  assert.doesNotMatch(md, /Tabroom keeps comments open/);
});

// Why: a setting that does nothing, with a help line that says so, wastes a judge's attention; if it came back, the
// header menu it turns on would again have a switch that changes nothing a judge can use (E46).
test('Settings has no Mode part until Coach and Student screens ship', () => {
  const view = settingsHtml({ settings: {}, ai: null, keys: '', offline: null });
  assert.doesNotMatch(view, /id="set-mode-h"|later version/);
});
