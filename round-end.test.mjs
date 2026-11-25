// The round's end in Debate: the Save as PDF step after Save to History, and the day-end backup reminder.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const L = require('./logic.js');
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const H = 3600 * 1000;
const day = (y, m, d, h) => new Date(y, m - 1, d, h).getTime();

// Why: a judge who never backs up loses every saved ballot when the browser clears its data; the reminder must come once the judging is over, and never while they are still judging.
test('backupReminderDue: due after a quiet spell or on a new day, never before a save, after a backup or after "Not now"', () => {
  const saved = day(2026, 3, 7, 15);
  const due = (o) => L.backupReminderDue(Object.assign({ lastSavedAt: saved, lastBackupAt: null, dismissedAt: null }, o));
  assert.equal(due({ now: saved + 30 * 60 * 1000 }), false, 'still judging: 30 minutes after the last save');
  assert.equal(due({ now: saved + 2 * H }), true, '2 hours after the last save');
  assert.equal(due({ now: day(2026, 3, 8, 7) }), true, 'the next morning');
  assert.equal(due({ now: day(2026, 3, 8, 0) + 1, lastSavedAt: day(2026, 3, 7, 23) }), true, 'past midnight counts as a new day');
  assert.equal(due({ now: saved + 3 * H, lastBackupAt: saved + 1 }), false, 'a backup after the last save');
  assert.equal(due({ now: saved + 3 * H, lastBackupAt: saved - 1 }), true, 'a backup before the last save');
  assert.equal(due({ now: saved + 3 * H, dismissedAt: saved }), false, '"Not now" for this save');
  assert.equal(due({ now: saved + 3 * H, dismissedAt: saved - 5 }), true, '"Not now" was for an older save');
  assert.equal(L.backupReminderDue({ lastSavedAt: null, now: saved }), false, 'nothing saved yet');
  assert.equal(L.backupReminderDue(), false);
});

// Why: the reminder is only useful if the History screen shows it with a working button and a way to quiet it; a missing id would throw at load and break the page.
test('History shows the reminder with Download backup and Not now; the app wires them and records each save', () => {
  const html = read('index.html');
  const card = html.slice(html.indexOf('id="backup-card"'), html.indexOf('id="backup-last"'));
  assert.match(card, /<div class="backup-due row" id="backup-due" role="status" hidden>/);
  assert.match(card, /id="backup-due-go">Download backup<\/button>/);
  assert.match(card, /id="backup-due-no">Not now<\/button>/);
  const js = read('js/decide.js');
  assert.match(js, /\$\('#backup-due-go'\)\.addEventListener\('click', \(\) => downloadBackup\(false\)\)/);
  assert.match(js, /\$\('#backup-due-no'\)\.addEventListener\('click', \(\) => \{ S\.backupDismissedAt = S\.lastSavedAt;/);
  assert.match(js, /S\.lastSavedAt = Date\.now\(\); saveSettings\(\); renderBackup\(\);/, 'Save to History records the time');
  assert.match(js, /due\.hidden = !backupDue\(\)/);
});

// Why: the end of a round is when a judge wants a copy of the ballot; Save to History must offer the PDF step right there (the print dialog says how to save a PDF).
test('Save to History offers Save as PDF, which opens the print dialog', () => {
  const js = read('js/decide.js');
  assert.match(js, /toast\('Saved to History\.', \{ action: \{ label: 'Save as PDF', name: 'Save this ballot as a PDF', run: \(\) => openPrintDialog\(\) \} \}\)/);
  assert.match(read('index.html'), /id="print-help">To get a PDF, choose "Save as PDF" in the print window\.<\/p>/);
});
