// The short recording status next to Transcribe (owner note of 2026-11-20: the long line "trails off next to
// transcribe ... Can it just say 'Ready'"). Spec: docs/design/SPEC.md §4.5. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { fnSource } = require('./test-fn-source.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const REC = read('js/recording.js');
const HTML = read('index.html');
const base = { mins: '2 min', engine: 'browser', backlog: 3, on: true };

// Every state the ladder knows, with the word and tone it must show.
const STATES = [
  [{ on: true }, 'Ready', 'quiet'],
  [{ on: false }, 'Off', 'quiet'],
  [{ on: true, wanted: true, ago: 4 }, 'Recording', 'ok'],
  [{ on: true, wanted: true }, 'Recording', 'ok'],
  [{ on: true, wanted: true, stall: 'No new text for 30+ s.' }, 'Check mic', 'caution'],
  [{ on: true, held: 'The key was refused.' }, 'Upload paused', 'error'],
  [{ on: true, degraded: true, retryInMs: 4200 }, 'Retrying', 'caution'],
  [{ on: true, catchingUp: true }, 'Catching up', 'caution'],
  [{ on: true, finishing: true }, 'Finishing', 'quiet'],
  [{ problem: 'the microphone is blocked.', problemKind: 'mic-blocked' }, 'Mic blocked', 'error'],
  [{ problem: 'the microphone was disconnected.', problemKind: 'mic-lost' }, 'Mic lost', 'error'],
  [{ problem: 'browser transcription needs internet.', problemKind: 'offline' }, 'Offline', 'error'],
  [{ problem: 'the key is not connected in this tab.', problemKind: 'no-key' }, 'Key needed', 'error'],
  [{ problem: 'some new error from the service', problemKind: 'service' }, 'Not transcribing', 'error'],
];

// Why: a long line next to Transcribe is cut off at normal widths, so the judge cannot read whether audio is captured.
test('recStatus gives one short word for every recording state, with its tone', () => {
  for (const [o, word, tone] of STATES) {
    const st = L.recStatus(Object.assign({}, base, o));
    assert.equal(st.word, word, JSON.stringify(o));
    assert.equal(st.tone, tone, JSON.stringify(o));
    assert.ok(st.word.length <= 16, st.word);
  }
});

// Why: the word and its tip come from one ladder; if they disagreed, a judge would read "Ready" over a tip saying
// the mic is blocked. The full sentences keep the wording judges already know.
test('recStatus gives the full sentence that matches the word', () => {
  const full = (o) => L.recStatus(Object.assign({}, base, o)).full;
  assert.equal(full({ on: true }), 'Ready. Recording starts when the speech clock starts.');
  assert.equal(full({ on: false }), 'Transcribe is off. Tick the box to record.');
  assert.equal(full({ on: true, wanted: true, ago: 4 }), 'Recording (browser) · last text 4 s ago');
  assert.equal(full({ on: true, wanted: true }), 'Recording (browser) · waiting for first text…');
  assert.equal(full({ problem: 'the microphone is blocked.', problemKind: 'mic-blocked' }), 'Not transcribing: the microphone is blocked.');
  assert.equal(full({ on: true, held: 'The key was refused.' }), 'Paused: The key was refused. 2 min of audio is kept on this device until it is fixed.');
  assert.equal(full({ on: true, degraded: true, retryInMs: 4200 }), 'Connection trouble: recording safely. 2 min of audio waiting, kept on this device only. Trying again in 5 s.');
  for (const [o, word] of STATES) assert.ok(L.recStatus(Object.assign({}, base, o)).full.length > word.length, word);
});

// Why: if a problem the recording code sets has no kind, the judge sees the vague "Not transcribing" instead of the
// fix ("Mic blocked", "Key needed"), and may lose the speech's text while guessing.
test('every problem the recording code sets names its kind, and each kind has a word', () => {
  const sets = [...REC.matchAll(/recProblem = (?!'')[^;]+;([^;\n]*;)?/g)].map((m) => m[0]);
  assert.ok(sets.length >= 6, 'found the problem assignments: ' + sets.length);
  for (const s of sets) {
    const kind = (s.match(/recProblemKind = '([\w-]+)'/) || [])[1];
    assert.ok(kind, 'no recProblemKind next to: ' + s);
    if (kind !== 'service') assert.ok(L.REC_PROBLEM_WORD[kind], 'no word for kind ' + kind);
  }
});

// Why: when the visible text gets short, a screen-reader user must still hear the full reason, and in a state that
// needs action the live region must say it without focus. This runs the real paintRecStatus on a fake element; the
// aria-describedby link itself is made by ui.js in the DOM (checked in the browser), driven by L.tipAddsWords.
test('paintRecStatus shows only the word, keeps the full sentence as data-tip, and reads it out on errors', () => {
  const fake = () => {
    const el = { dataset: {}, kids: [], cls: new Set(), classList: null,
      set textContent(t) { this.kids = [t]; }, get textContent() { return this.kids.map((k) => (typeof k === 'string' ? k : k.textContent)).join(''); },
      append(n) { this.kids.push(n); } };
    el.classList = { add: (c) => el.cls.add(c), remove: (...c) => c.forEach((x) => el.cls.delete(x)) };
    return el;
  };
  const doc = { createElement: () => ({ className: '', textContent: '' }) };
  const paint = new Function('document', 'tone', fnSource(REC, 'paintRecStatus') + '\nreturn paintRecStatus;')(doc,
    (el, kind) => { el.classList.remove('is-error', 'is-caution', 'is-ok', 'is-quiet'); if (kind) el.classList.add('is-' + kind); });
  for (const [o, word, tone] of STATES) {
    const st = L.recStatus(Object.assign({}, base, o));
    const el = fake();
    paint(el, st);
    assert.equal(el.kids[0], word, 'the visible text is the word');
    assert.equal(el.dataset.tip, st.full, 'the tip is the full sentence');
    assert.ok(el.cls.has('is-' + tone));
    const name = el.textContent;
    // The full sentence reaches a screen reader: in the element's own text, or through the tip (ui.js links a tip
    // that adds words with aria-describedby).
    assert.ok(name.includes(st.full) || L.tipAddsWords(name, st.full), word);
    if (tone === 'error') assert.ok(name.includes(st.full), 'error states read the reason without focus: ' + word);
    else assert.equal(el.kids.length, 1, 'no hidden copy outside errors: ' + word);
  }
});

// Why: a keyboard user can only open the tip if the status takes focus; title= tips are not shown on focus or touch.
test('both status spans take focus in the markup and no title= tip is used', () => {
  assert.match(HTML, /<span id="rec-status" class="rb-status" role="status" aria-live="polite" tabindex="0"><\/span>/);
  assert.match(HTML, /<span class="muted" id="cv-rec-status" tabindex="0"><\/span>/);
  assert.doesNotMatch(REC, /\.title\s*=/);
  assert.doesNotMatch(REC, /tabIndex\s*=/, 'focus is set once in index.html, not on every tick');
});
