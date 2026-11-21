// Tests for guided tracks and checks (learn-tracks.mjs, check.js; docs/library/TRACKS.md). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { parseCheck, loadTracks, trackState } from './learn-tracks.mjs';
import { buildSite, loadPages, readingPaths, SRC } from './build-learn.mjs';

const C = createRequire(import.meta.url)('./check.js');
const site = buildSite();
const pages = loadPages();
const tracks = loadTracks(SRC);
const PATHS = readingPaths(tracks);
const q = (body) => `---\npage: debate-101\nversion: 1\n---\n${body}`;
const good = '## A\n\nWhich?\n\n- [x] Yes\n- [ ] No\n\n**Why:** Because.\n\n';

// Why: a wrong answer key teaches a judge the wrong rule. Every real check file must parse, point at a real page, and give a "why".
test('every check file parses, matches a page, and every question has a right answer and a why', () => {
  const files = readdirSync(join(SRC, 'checks')).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 6);
  for (const f of files) {
    const c = parseCheck(readFileSync(join(SRC, 'checks', f), 'utf8'), f);
    assert.equal(c.page + '.md', f);
    assert.ok(pages.has(c.page), `${f}: no page`);
    for (const x of c.questions) {
      assert.ok(x.why.length > 10, `${f} "${x.name}": why is too short`);
      if (!x.self) assert.ok(x.choices.some((ch) => ch.right), `${f} "${x.name}": no right answer`);
    }
  }
});

// Why: a broken check must stop the build, not ship a quiz with no answer, a hidden flow, or a trick question.
test('the check parser refuses broken checks', () => {
  assert.throws(() => parseCheck(q(good + good), 'x'), /3 to 5 questions/);
  assert.throws(() => parseCheck(q(good.replace('[x]', '[ ]').repeat(3)), 'x'), /right choice/);
  assert.throws(() => parseCheck(q(good.replace('**Why:** Because.', '').repeat(3)), 'x'), /Why/);
  assert.throws(() => parseCheck(q('## A\n\n```\nflow\n```\n\nWhich?\n\n- [x] Yes\n- [ ] No\n\n**Why:** B.\n\n'.repeat(3)), 'x'), /In words/);
  assert.throws(() => parseCheck(q(good.replace('- [ ] No', '- [x] No').repeat(3)), 'x'), /Pick all that apply/);
  assert.throws(() => parseCheck(q(good.replace('- [ ] No', '- [ ] All of the above').repeat(3)), 'x'), /all of the above/);
  assert.equal(parseCheck(q(good.repeat(3)), 'x').questions.length, 3);
});

// Why: a track may only go live when every step has a page and a reviewed check (TRACKS.md §2); a half-built track could not be finished.
test('a track is ready only with every page and check, and live only when every check is reviewed', () => {
  const t = { steps: ['a', 'b'] };
  const p = new Map([['a', {}], ['b', {}]]);
  assert.deepEqual(trackState(t, p, new Map([['a', { status: 'reviewed' }]])), { ready: false, live: false });
  assert.deepEqual(trackState(t, p, new Map([['a', { status: 'reviewed' }], ['b', { status: 'draft' }]])), { ready: true, live: false });
  assert.deepEqual(trackState(t, p, new Map([['a', { status: 'reviewed' }], ['b', { status: 'reviewed' }]])), { ready: true, live: true });
});

// Why: the parent judge track is the first release. Its page must exist, show every step, and be marked a draft until coaches review the checks.
test('the parent judge track page is built, lists its six steps, and is a noindex draft until reviewed', () => {
  const html = site.files.get('tracks/judge/index.html');
  assert.ok(html, 'learn/tracks/judge/ is not built');
  const steps = [...html.matchAll(/<li data-step="([a-z0-9-]+)">/g)].map((m) => m[1]);
  assert.deepEqual(steps, tracks.find((t) => t.id === 'judge').steps);
  assert.equal(site.states.get('judge').live, false);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /Draft track/);
  assert.match(html, /Not a certification or endorsement by any league or tournament\. Not verified\./);
  // CHANGED 2026-11-21 because the owner approved building the novice track (all 14 checks now written, as drafts).
  // A track missing a check must still not be built; the unit test of trackState() covers that rule. Old check:
  //   assert.ok(!site.files.has('tracks/novice/index.html'), 'the novice track has unwritten steps, so it must not be built');
  assert.ok(site.files.has('tracks/novice/index.html'), 'the novice track has all its checks, so it must be built');
  assert.equal(site.states.get('novice').live, false, 'its checks are drafts, so the novice track must stay a draft');
});

// Why: every page with a check needs the script and a check section; without the script tag the quiz never becomes interactive.
test('pages with a check carry the check section and the check script', () => {
  for (const t of tracks.find((x) => x.id === 'judge').steps) {
    const html = site.files.get(`${t}/index.html`);
    assert.match(html, /<section class="check" id="check" data-check="[a-z0-9-]+" data-version="\d+"/, t);
    assert.match(html, /<script src="\.\.\/check\.js" defer><\/script>/, t);
  }
  assert.ok(site.files.has('check.js'));
});

// Why: the reading paths and the tracks must be one list, or the "Next" box and the track page send readers different ways.
test('PATHS comes from tracks.json, and every step is a planned library page', () => {
  assert.deepEqual(PATHS.judge.steps, tracks.find((t) => t.id === 'judge').steps);
  assert.equal(PATHS.judge.name, 'New judge path');
  const plan = readFileSync(join(SRC, 'PLAN.md'), 'utf8');
  for (const t of tracks) for (const s of t.steps) assert.match(plan, new RegExp('`/learn/' + s + '`'), `${t.id}: "${s}" is not in PLAN.md`);
});

// Why: progress is stored on the same site as the app's API keys. Only the expected shape may be kept, so a crafted file or a stray value cannot ride along.
test('check.js keeps only clean progress data', () => {
  const dirty = { steps: { 'debate-101': { v: 1, done: '2026-11-20' }, 'bad slug': { v: 1, done: '2026-11-20' }, x: { v: '1', done: '2026-11-20' }, y: { v: 1, done: '<img>' } }, tracks: { judge: { done: '2026-11-20', extra: 'no' } }, apiKey: 'sk-secret' };
  assert.deepEqual(C.clean(dirty), { steps: { 'debate-101': { v: 1, done: '2026-11-20' } }, tracks: { judge: { done: '2026-11-20' } } });
  assert.deepEqual(C.clean('junk'), { steps: {}, tracks: {} });
  assert.equal(C.KEY, 'tabula.learn.v1');
  const d = new Date();
  assert.equal(C.today(), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, 'dates use the local day, not UTC');
});

// Why: a question counts as right only when the exact right set is picked; picking every box must not pass a "pick all that apply" question.
test('check.js grades the exact set of right choices', () => {
  assert.equal(C.isRight([1], [1]), true);
  assert.equal(C.isRight([0, 2], [0, 2]), true);
  assert.equal(C.isRight([0, 2], [0, 1, 2]), false);
  assert.equal(C.isRight([0, 2], [0]), false);
  assert.deepEqual(C.progress(['a', 'b', 'c'], { steps: { a: {}, c: {} } }), { done: 2, total: 3, next: 'b' });
});

// Why: the built page carries the answer key. If it drifts from the check file, a judge who picks the right answer is told it is wrong.
test('every built check has the same right answers and question types as its source file', () => {
  for (const f of readdirSync(join(SRC, 'checks')).filter((x) => x.endsWith('.md'))) {
    const c = parseCheck(readFileSync(join(SRC, 'checks', f), 'utf8'), f);
    const html = site.files.get(`${c.page}/index.html`);
    const built = [...html.matchAll(/<div class="q( self)?" data-q="(\d+)"(?: data-multi="(\d)")?>([\s\S]*?)<\/div>(?=\n<div class="q|\n<div class="check-actions)/g)];
    assert.equal(built.length, c.questions.length, `${f}: question count`);
    c.questions.forEach((q, n) => {
      const [, self, , multi, body] = built[n];
      assert.equal(Boolean(self), q.self, `${f} "${q.name}": self-check flag`);
      if (q.self) return;
      assert.equal(multi, q.multi ? '1' : '0', `${f} "${q.name}": radio vs checkbox`);
      assert.deepEqual([...body.matchAll(/<li data-key="(\d)">/g)].map((m) => m[1] === '1'), q.choices.map((ch) => ch.right), `${f} "${q.name}": answer key`);
    });
  }
});

// Why: in private mode or with blocked storage, the checks must still work and never crash; they only cannot remember.
test('progress storage falls back safely when the browser blocks it', () => {
  const blocked = C.storage(() => { throw new Error('SecurityError'); });
  assert.deepEqual(blocked.load(), { steps: {}, tracks: {} });
  assert.equal(blocked.save({ steps: {} }), false);
  assert.equal(blocked.clear(), false);
  const mem = {}; const box = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  const ok = C.storage(() => box);
  assert.equal(ok.save({ steps: { 'debate-101': { v: 1, done: '2026-11-20' } }, other: 'x' }), true);
  assert.deepEqual(Object.keys(mem), ['tabula.learn.v1'], 'only its own key is written');
  assert.equal(ok.load().steps['debate-101'].done, '2026-11-20');
  mem['tabula.learn.v1'] = 'not json';
  assert.deepEqual(ok.load(), { steps: {}, tracks: {} });
});

// Why: a value of the wrong type in stored or imported progress must be dropped, not carried along and saved again.
test('check.js drops dates that are not plain strings', () => {
  assert.deepEqual(C.clean({ steps: { a: { v: 1, done: ['2026-11-20'] } }, tracks: { t: { done: ['2026-11-20'] } } }), { steps: {}, tracks: {} });
});

// Why: the writing-task format must parse, and a malformed one, or a question with lost text, must stop the build.
test('the parser reads self-checks and refuses leftover or mislabeled parts', () => {
  const self = '## Write\n\nWrite a short RFD.\n\n**Self-check:**\n\n- [ ] Who won?\n- [ ] Why?\n\n**Model answer:** I vote aff.\n\n**Why:** Short is fine.\n\n';
  const c = parseCheck(q(good + good + self), 'x');
  assert.deepEqual(c.questions[2].items, ['Who won?', 'Why?']);
  assert.equal(c.questions[2].model, 'I vote aff.');
  assert.throws(() => parseCheck(q(good + good + self.replace('**Model answer:** I vote aff.\n\n', '')), 'x'), /Model answer/);
  assert.throws(() => parseCheck(q(good + good + good.replace('**Why:** Because.', '**Why:** Because.\n\nExtra text.')), 'x'), /only the "\*\*Why:\*\*"/);
  assert.throws(() => parseCheck(q(good + good + good.replace('Which?', 'Which? Pick all that apply.')), 'x'), /only one choice is right/);
});
