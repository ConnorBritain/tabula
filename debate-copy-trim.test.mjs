// Static checks for the Debate copy cuts (copy trim audit §2, docs/design/COPY-TRIM-AUDIT.md).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const HTML = read('index.html');
const DECIDE = read('js/decide.js');
const T = createRequire(import.meta.url)('./tour.js');
const step = (tour, target) => T.TOURS[tour].steps.find((s) => s.target === target);

// Why: on a first run the Analysis button says "Run"; a help line that says "click Update" sends the judge to a button that is not there.
test('the paradigm help line names no button word that changes with state', () => {
  assert.ok(HTML.includes('Each paradigm keeps its own answer, so switching is free. "(yours)" is your Settings paradigm.</p>'));
  assert.doesNotMatch(HTML, /click Update/i);
});

// Why: the Insights pane button always reads "Update with AI"; a tour that says only "Update" makes a new judge hunt for it.
test('the Insights tour step names the Insights button as it reads', () => {
  assert.match(step('flow', '#insights').body, /Click Update with AI for a fresh read\./);
  assert.match(read('js/insights.js'), />Update with AI<\/button>/);
});

// Why: the lock rule must read the same everywhere, or a judge doubts that what they type on the ballot is safe from the AI.
test('the ballot and its tour step use the one lock line', () => {
  assert.ok(HTML.includes('data-ai="ballotDraft">The AI never changes what you type.</p>'));
  assert.match(step('main', '#draft-open').body, /The AI never changes what you type\./);
});

// Why: the RFD goes to both teams and their coaches; a judge who does not know that may write a private note in it.
test('the RFD label keeps the everyone-sees-it fact', () => {
  assert.ok(HTML.includes('<label for="b-rfd">RFD · everyone sees it</label>'));
});

// Why: if the review panel stops saying that nothing reaches the ballot before Insert, a judge may think the AI text is already in.
test('the draft review keeps the insert lock fact', () => {
  assert.ok(DECIDE.includes('<p class="muted">Nothing goes on the ballot until you insert it.</p>'));
});

// Why: a judge whose browser cannot print needs the way out in the same toast, or the ballot is stuck on screen.
test('both no-print toasts point at Copy', () => {
  assert.equal((DECIDE.match(/'This browser cannot print\. Use Copy instead\.'/g) || []).length, 2);
  assert.doesNotMatch(DECIDE, /Printing is not available/);
});

// Why: the paste import is trusted because it never reaches the tournament site; losing that line removes the promise judges rely on.
test('the paste-round help keeps the no-connect promise', () => {
  assert.ok(HTML.includes('Tabula reads it in this browser. It does not connect to the tournament site.</p>'));
});

// Why: the [doc] mark tells the judge which words came from a doc, not the speech; and docs leaving the browser would be a privacy break.
test('the docs help keeps the [doc] rule behind the AI gate and the stays-in-browser fact', () => {
  assert.ok(HTML.includes('<span data-ai="aiFlow">The AI maps each doc onto that speech\'s column and fills transcript gaps from it (marked [doc]).</span> Docs stay in this browser until a new round.</p>'));
});

// Why: "Ask me first" exists to protect the judge's paid rounds; a help line without the consent fact makes the choice look the same as automatic.
test('the Ask me first help keeps the consent fact', () => {
  assert.match(HTML, /<strong>Ask me first<\/strong><span class="muted field-help">Tabula asks first\. No round is used until you say yes\.<\/span>/);
});

// Why: the nav says "Round"; help that says "Round setup" sends the judge looking for a place name that is not in the nav.
test('the Settings writing help calls the place by its nav name', () => {
  assert.ok(HTML.includes('Change it per round in Round.</p>'));
  assert.doesNotMatch(HTML, /in Round setup\./);
});

// Why: the app calls it the clock everywhere else; "timers" in the last tour card makes a new judge think it is a different control.
test('the last main tour step says clock, not timers', () => {
  const last = T.TOURS.main.steps.at(-1).body;
  assert.match(last, /The clock, flow and ballot work without it\./);
  assert.doesNotMatch(last, /timers/);
});

// Why: a vendor name in Settings copy breaks the no-favourites rule and is wrong for judges on other browsers.
test('the mic help names no browser vendor', () => {
  assert.ok(HTML.includes('Only for a connected key. Free browser transcription uses the browser\'s default mic and sound settings, with no level meter.</p>'));
});

// Why: a describedby that points at a removed id leaves screen readers reading nothing, or a stale note, for the locked Ballot box.
test('the locked Ballot print box has no dangling description', () => {
  assert.ok(HTML.includes('<input type="checkbox" checked disabled> Ballot</label>'));
  assert.doesNotMatch(HTML, /print-always/);
});

// Why: one word for the clock across the app (W17), and one lock line for AI edits (W13); mixed words make a judge
// wonder if "timers" or "edits stick" mean something else.
test('tour and offline tip use the shared clock word and lock line', () => {
  const tour = readFileSync(new URL('tour.js', import.meta.url), 'utf8');
  assert.match(tour, /You can edit any AI cell\. The AI never changes what you type\./);
  assert.doesNotMatch(tour, /your edits stick/);
  assert.match(tour, /Plain: short sentences, everyday words\. The decision stays the same\./);
  const shell = readFileSync(new URL('logic/shell.js', import.meta.url), 'utf8');
  assert.match(shell, /'No internet\. Clock, flow and ballot still work\./);
});
