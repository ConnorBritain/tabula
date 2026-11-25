// Copy trim cuts for Speech Events (docs/design/COPY-TRIM-AUDIT.md, top 10). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// CHANGED (Speech Events cleanup 2026-11-25: the pure card builders moved to timer-card-html.js; same functions). Old line:
// import { timerHtml } from './js/timer-view.js';
import { timerHtml } from './js/timer-card-html.js';
import { settingsHtml, aiPartHtml } from './js/settings-screen.js';
import { levelFieldsHtml } from './js/round-frame.js';
import { SHORTCUTS } from './js/keys.js';
import { historyTableHtml, historyHtml } from './js/history-screen.js';
import { setupChecks } from './congress/chamber.js';

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

// ---------- Rest of COPY-TRIM-AUDIT.md §1 (E4 to E58) ----------

// Why: a dialog read mid-round must be one glance; the cross-entry facts (speaks later, stays on the ballot) must stay,
// or a judge may drop a cross-entered speaker from the ballot (E10-E12).
test('roster dialogs: no body on Add an entry; cross-entered keeps both facts in short words', () => {
  assert.match(read('js/room-screen.js'), /title: 'Add an entry', input: /);
  assert.doesNotMatch(read('js/room-screen.js'), /late entry goes at the end/);
  const ra = read('js/room-actions.js');
  assert.match(ra, /body: 'Speaks here later\. Stays on the ballot\.'/);
  assert.match(ra, /placeholder: 'Room 204, IX'/);
});

// Why: the cross-ex card shows only in elims, so "(elim round)" is noise; the missing-length rule must stay, or a
// judge may cut cross-ex short on their own clock (E13-E15).
test('cross-ex card: plain legend and School label, and the no-set-length rule stays', () => {
  const src = read('js/cross-ex-view.js');
  assert.equal((src.match(/<legend>Cross-ex<\/legend>/g) || []).length, 2);
  assert.match(src, /<span>School<\/span><input id="cx-school"/);
  assert.match(src, /No set length\. Ask the tab room\./);
  assert.doesNotMatch(src, /<span class="muted">\(/);
});

// Why: a judge must still see that the panel note is private; the pill keeps that fact without a sentence (E16, E17, W7).
test('panel note: a Not on ballot pill and a short example', () => {
  const html = levelFieldsHtml();
  assert.match(html, /<span>Panel note <span class="pill outline">Not on ballot<\/span><\/span>/);
  assert.match(html, /placeholder="Seats 1–3"/);
  assert.doesNotMatch(html, /for you only|For example/);
});

// Why: the keyboard sheet lives in Settings and cannot know the room size, so 9 and 0 must still say when they work,
// or a judge in a room of 6 thinks the keys are broken (E18, deviation: the audit's premise was false).
test('keyboard sheet: 9 and 0 say they work in rooms over 8, without a parenthesis', () => {
  const labels = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s.label]));
  assert.equal(labels.num9, 'Type 9 in rooms over 8');
  assert.equal(labels.num0, 'Type 0 in rooms over 8');
});

// Why: the room-level reason must still read as "for the whole room" on the room screen, where it sits under the
// speaker cards; on the Rank screen the place says it. The all-over-grace line must keep the rule and the fix (E4,
// E21-E23, E26, E27, E29).
test('rank and rate: short help, Room notes, and the all-over-grace rule with its fix', () => {
  assert.match(read('js/comment-view.js'), /<span>Reason for rank <span class="muted">whole room<\/span><\/span>/);
  const rk = read('js/rank-screen.js');
  assert.match(rk, /id="tap-help" hidden>Tap best to last\. Tap again to undo\.</);
  assert.match(rk, /'Speakers you did not tap follow in speaking order\.'/);
  assert.match(rk, /<label class="field" for="rank-reason"><span>Reason for rank<\/span><\/label>/);
  const rt = read('js/rate-screen.js');
  assert.match(rt, /No ranks\. Rate each speaker\./);
  assert.match(rt, /<span>Room notes<\/span>/);
  assert.match(read('js/profile-layer.js'), /ranks === 'off' \? 'Room notes'/);
  assert.match(read('js/rank.js'), /"Everyone went over grace, so no one can be 1st\. Time wrong\? Clear the flag on the timer\."/);
});

// Why: the over-grace refusal is spec'd word for word in DESIGN.md §4.6; a copy trim must not drift it (E28 kept).
test('the single over-grace refusal keeps its spec wording', () => {
  assert.match(read('js/rank.js'), /" went over grace, so it can't be ranked 1st\. Clear the over-grace flag on the timer if the time was wrong\."/);
});

// Why: the Ready line is the only sentence a ready board shows (no checklist then); dropping it would leave a bare
// "Ready" with no word on what is complete (E24, E25 kept).
test('the Ready line keeps its sentence on Rank and Rate', () => {
  assert.match(read('js/rank-screen.js'), /readyHtml\('Every speaker has a rank'/);
  assert.match(read('js/rate-screen.js'), /readyHtml\('Every speaker is rated\.'\)/);
});

// Why: one error must get one string that says what to do, or a judge whose copy failed is left stuck; the toasts name
// the result only (E31-E35, W1, W9, W20).
test('review and clean-up: short summary, result-only toasts, one copy-error string', () => {
  const src = read('js/review-screen.js');
  assert.match(src, /Comments only\. No ranks to submit\./);
  assert.match(src, /'Ranks copied\.'/);
  assert.match(src, /toast\('All copied\.'/);
  assert.equal((src.match(/'This browser blocked copying\. Select the text and press Ctrl\+C \(⌘C on Mac\)\.'/g) || []).length, 2);
  assert.doesNotMatch(src, /'This browser blocked copying\.'/);
  const cv = read('js/cleanup-view.js');
  assert.match(cv, /announce\('Clean version ready\.'\)/);
  assert.match(cv, /AI rewrote your words\. Check them before you copy\./);
});

// Why: setup and My day are read between rounds; vendor names break DESIGN.md rule 9, and the privacy line on setup
// must stay (E39-E45).
test('setup, picker and My day: no vendor names, no "(optional)", short empty states', () => {
  const su = read('js/setup-screen.js');
  assert.match(su, /<span>Paste the room, or type one code per line<\/span>/);
  assert.match(su, /<p class="field-help">No rule checks for a custom event\.<\/p>/);
  assert.match(su, />Custom event<\/option>/);
  assert.match(su, /<span>Time limit<\/span><input id="custom-limit"[^>]*placeholder="7:00"/);
  assert.match(su, /<span>Grace <span class="muted">sec<\/span><\/span>/);
  assert.doesNotMatch(su, /<span class="muted">\(|Paste the room from/);
  const pk = read('js/picker-screen.js');
  assert.match(pk, /No match\. Pick Custom event\?/);
  assert.doesNotMatch(pk, /<span class="muted">\(optional\)/);
  assert.match(read('index.html'), /id="pal-empty" hidden>No match\.<\/p>/);
  const md = read('js/myday-screen.js');
  assert.equal((md.match(/data-act="submit">Mark submitted<\/button>/g) || []).length, 2);
  assert.match(md, /'Marked submitted: ' \+ name/);
  assert.doesNotMatch(md, />I submitted in Tabroom<|'Marked submitted in Tabroom/);
});

// Why: a judge with no rounds and a judge whose filter hides all rounds need different words, or the first thinks
// rounds were lost; the export privacy fact must stay (E47-E49).
test('History: two empty states, the codes-only fact, and a result-only copy toast', () => {
  assert.match(historyTableHtml([], [], true), />No rounds yet\.</);
  assert.match(historyTableHtml([], [], false), />No rounds match\.</);
  assert.match(historyHtml([], {}), /No rounds yet\./);
  const src = read('js/history-screen.js');
  assert.match(src, /Codes only, unless you tick the box\./);
  assert.doesNotMatch(src, /Paste them into a spreadsheet/);
});

// Why: Settings help must say what each control does and keep the privacy facts (rounds stay on the device, the key
// stays in the browser), with no vendor name (E50-E53).
test('Settings: one-line help, privacy facts kept, no vendor name', () => {
  const view = settingsHtml({ settings: {}, ai: null, keys: '', offline: null });
  assert.match(view, /My day counts down to this time\.</);
  assert.match(view, /How long the room shows "Waiting for next speaker" between Extemp speakers\./);
  assert.match(view, /Your rounds stay on this device\. A backup lets you keep or move them\./);
  assert.doesNotMatch(view, /Tabroom/);
  assert.match(aiPartHtml({ allowed: true, connected: false }), /Use your own AI key for Clean-up\. The key stays in this browser\./);
  assert.match(aiPartHtml({ allowed: true, connected: true, providerName: 'X' }), /<p>Connected: X\.<\/p>/);
  assert.match(read('js/guide.js'), /'Two students'/);
});

// Why: Congress notes are read mid-session; a plain word ("name") and one-line empty states keep the judge on the
// floor, and a tie must still be flagged (E55-E58).
test('Congress: tie warning, plain tap help, short empty states', () => {
  const v = read('congress/views.js');
  assert.match(v, /have the same points\.<\/li>/);
  assert.match(v, /Tap a name to fill the next slot\. Tap a slot to clear it\./);
  const checks = setupChecks({ entries: [{ code: 'A1' }], check: [] }, [], { maxLegislators: 30, name: 'X' });
  assert.equal(checks.find((c) => c.kind === 'noDocket').text, 'Add bill and resolution titles, one per line.');
  assert.match(read('congress/chamber-screen.js'), /'<p class="muted">No chambers yet\.<\/p>'/);
});

// Why: Congress judges may submit on Tabroom or SpeechWire; a vendor name in the copy is wrong for half of them
// (DESIGN.md rule 9), and "(optional)" labels add noise the empty box already says (W6).
test('Congress copy names no vendor and has no "(optional)" labels', () => {
  for (const f of ['congress/views.js', 'congress/session-screen.js', 'congress/chamber-screen.js']) {
    const src = read(f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.doesNotMatch(src, /'[^']*Tabroom[^']*'|>[^<]*Tabroom[^<]*</, f);
    assert.doesNotMatch(src, /\(optional\)/, f);
  }
  assert.match(read('congress/views.js'), /'✓ Submitted' : 'Mark submitted'/);
  assert.match(read('js/room-actions.js'), /label: 'Note',/);
});
