// Tests for step S5 (docs/events/EXPERIENCE.md §11.1 S5 row; §2.1 to §2.4, §3 F4 row and the phase bar note, §8.2,
// §8.5): the def v2 schema (a NEW test; the v1 key assertions in events-data.test.mjs stay as they are), the PCC event
// file, the F4 workspace, the run split (events/js/runs.js), the phase bar (events/js/phase-bar.js), the run parts of
// the Room screen (events/js/runs-view.js) and the read-time migration of entry runs. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadEventData, familyOf } from './js/data.js';
import { WORKSPACES, loadWorkspace, roundFamily } from './js/workspaces.js';
import { createRoom, ENABLED_EVENTS, setupError, updateEntry, entryOf, addEntry } from './js/room.js';
import { eventChoices } from './js/setup-screen.js';
import { stoppedTiming, adjustTiming, resetTiming, timerFace, graceOf } from './js/timer.js';
import { runsAt, syncRuns, resetRunFields, markNextRun, unmarkLastRun, runsPhase, runsBarModel, runsLine, setTopic, TOPIC_MAX, hasRuns } from './js/runs.js';
import { phasesHtml, phaseState } from './js/phase-bar.js';
import { runsHeadHtml, runCardsHtml, runsRowHtml } from './js/runs-view.js';
import { migrateRoom, migrateRooms } from './js/migrate.js';
import { ranksBlock, cards } from './js/ballot.js';
import { cardHtml } from './js/review-screen.js';
import { readCheckList } from './check-list.mjs';

const at = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(at(p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const PUB = readJson('published.json');
const V2_FILES = readdirSync(at('defs/v2/')).filter((f) => f.endsWith('.json'));
const V2 = V2_FILES.map((f) => ({ f, d: readJson('defs/v2/' + f) }));
const DATA = await loadEventData(async (p) => readJson(p));
const PCC = DATA.events.get('pcc');
const DISTRICT = DATA.profiles.get('nsda-district');
const INVITATIONAL = DATA.profiles.get('nsda-invitational');
const CHECK_IDS = new Set(readCheckList().map((c) => c.id));
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

// The def v2 fields (EXPERIENCE.md §8.5: v1 plus family, performers {min, max}, fields[], and the optional timing.total,
// timing.prepMax, timing.window and maxEntries; MODELS.md §4.4: runs; VENN.md §6: topic; notVerified for facts the
// rules do not settle). There is no timing.minPerRun and no per-run minimum (§8.5).
const V2_REQUIRED = ['id', 'version', 'family', 'name', 'short', 'category', 'performers', 'timing', 'material', 'checks', 'prompts', 'tags', 'source'];
const V2_OPTIONAL = ['runs', 'fields', 'topic', 'maxEntries', 'notVerified'];
const V2_TIMING = ['limit', 'inRoomPrep', 'sharedClock', 'total', 'prepMax', 'window'];
const FAMILIES = ['f1', 'f2', 'f3', 'f4'];

let n = 0;
const makeId = (p) => p + (++n);
const pccRoom = (profile, codes) => createRoom({ event: PCC, profile: profile || DISTRICT, entries: (codes || ['A1', 'B2']).map((code) => ({ code })), round: 'R1', now: 1000, makeId });
const LIMIT = 630;
// A running clock with `used` seconds on it at `now` (the shape core/clock.js createDriver writes).
const running = (timing, used, now) => Object.assign({}, timing, { run: { kind: 'speech', endAt: now + (LIMIT - used) * 1000, startLeft: LIMIT - used } });
const withTiming = (e, timing) => Object.assign({}, e, { timing });
const sync = (e, now) => syncRuns(e, PCC, now, LIMIT);

// Why: the app reads def v2 fields with no guard; a missing field, a wrong type or a field nobody reads would open a
// PCC round with no limit, the wrong family, or a run list the screen cannot draw.
test('every def v2 file has the v2 fields with the right types, and no per-run minimum', () => {
  assert.ok(V2.length >= 1, 'defs/v2/ holds the def v2 files');
  for (const { f, d } of V2) {
    for (const k of V2_REQUIRED) assert.ok(k in d, f + ' has ' + k);
    for (const k of Object.keys(d)) assert.ok(V2_REQUIRED.includes(k) || V2_OPTIONAL.includes(k), f + ': unknown field ' + k);
    for (const k of Object.keys(d.timing)) assert.ok(V2_TIMING.includes(k), f + ': unknown timing field ' + k);
    assert.equal(f, `${d.id}.v${d.version}.json`, f + ' name matches id and version');
    assert.ok(/^[a-z]+$/.test(d.id) && Number.isInteger(d.version) && d.version >= 2, f + ' id and version');
    assert.ok(FAMILIES.includes(d.family), f + ' family');
    assert.ok(['publicAddress', 'interp', 'limitedPrep'].includes(d.category), f + ' category');
    assert.ok(Number.isInteger(d.performers.min) && Number.isInteger(d.performers.max) && d.performers.min >= 1 && d.performers.max >= d.performers.min, f + ' performers');
    assert.ok(Number.isInteger(d.timing.limit) && d.timing.limit > 0, f + ' limit');
    assert.ok(['memorized', 'manuscript', 'noNotes'].includes(d.material), f + ' material');
    assert.ok(Array.isArray(d.checks) && d.checks.every((c) => CHECK_IDS.has(c)), f + ' checks are on the EVENTS.md §7 list');
    assert.ok(Array.isArray(d.prompts) && d.prompts.length > 0 && d.prompts.every(nonEmpty), f + ' prompts');
    assert.ok(Array.isArray(d.tags) && d.tags.length > 0, f + ' tags');
    for (const t of d.tags) assert.ok([t.id, t.label, t.strength, t.toWork].every(nonEmpty), f + ' tag ' + t.id);
    assert.equal(new Set(d.tags.map((t) => t.id)).size, d.tags.length, f + ' tag ids are unique');
    assert.match(d.source, /\b20\d\d-\d\d\b/, f + ': source names a season');
    assert.ok(!('minPerRun' in d.timing) && !('min' in d.timing), f + ': no minimum time (§8.5)');
    if (d.runs) {
      assert.ok(Array.isArray(d.runs) && d.runs.length >= 2, f + ': runs means two or more');
      for (const r of d.runs) assert.deepEqual(Object.keys(r).sort(), ['label', 'side'], f + ': a run is a side and a label, with no min or max');
      assert.equal(new Set(d.runs.map((r) => r.side)).size, d.runs.length, f + ' run sides are unique');
      assert.equal(d.family, 'f4', f + ': an event with runs is family F4');
    }
    if (d.fields) assert.ok(Array.isArray(d.fields) && d.fields.every(nonEmpty), f + ' fields');
    if (d.notVerified) assert.ok(Array.isArray(d.notVerified) && d.notVerified.every(nonEmpty), f + ' notVerified');
  }
});

// Why: the published list is how an old round finds the rules it was judged under; a v2 file off the list could be
// deleted later with no test failing, and a listed file that is gone stops the whole app from loading.
test('every def v2 file on disk is in published.json as "v2/<file>", and every listed one exists', () => {
  assert.deepEqual(V2_FILES.map((f) => 'v2/' + f).sort(), PUB.defs.filter((f) => f.startsWith('v2/')).sort());
  const v1Ids = new Set(PUB.defs.filter((f) => !f.startsWith('v2/')).map((f) => f.split('.v')[0]));
  for (const { f, d } of V2) assert.ok(!v1Ids.has(d.id) || d.version > 1, f + ' does not reuse a v1 key');
});

// Why: these are the PCC facts the rules settle (VENN.md §6): one 10:30 limit for both speeches, Pro then Con, a topic
// the student picks, and no minimum per run. A wrong one times every PCC student against the wrong rule.
test('the PCC file: one 10:30 limit, Pro then Con, the student picks the topic, grace left to the profile', () => {
  assert.ok(PCC, 'pcc loads');
  assert.equal(PCC.timing.limit, 630);
  assert.deepEqual(PCC.runs.map((r) => r.side), ['pro', 'con']);
  assert.deepEqual(PCC.runs.map((r) => r.label), ['Pro', 'Con']);
  assert.equal(PCC.topic.drawn, false);
  assert.ok(PCC.fields.includes('topic'));
  assert.ok(!('overtime' in PCC) && !('grace' in PCC.timing), 'the event file holds no grace: the profile does');
  assert.ok(PCC.notVerified.some((s) => /grace/i.test(s)), 'the unknown grace length is marked not verified');
  assert.equal(graceOf(pccRoom()), DISTRICT.overtime.grace, 'a PCC round uses its profile\'s grace');
});

// Why: the family picks the workspace; if PCC opened in the plain room workspace, the judge would get one run with no
// split and no topic field, and could not record Pro and Con.
test('PCC is family F4 and opens in the F4 workspace, which keeps the whole §2.3 contract', async () => {
  assert.equal(familyOf(PCC), 'f4');
  assert.equal(familyOf({ id: 'x', family: 'f4', category: 'publicAddress', timing: {} }), 'f4', 'a def v2 family wins over the derived one');
  assert.equal(WORKSPACES.f4, './runs-workspace.js');
  const r = pccRoom();
  assert.equal(r.family, 'f4', 'a PCC round keeps its family');
  assert.equal(roundFamily(DATA.events, r), 'f4');
  const ws = await loadWorkspace('f4');
  assert.equal(ws.family, 'f4');
  assert.ok(ws.families.includes('f4'));
  for (const m of ['newRound', 'stages', 'mount', 'keys', 'validate', 'summary', 'rankModel', 'reviewModel']) assert.equal(typeof ws[m], 'function', m);
  assert.deepEqual(ws.stages(r), ['judge', 'rank', 'review']);
  const made = ws.newRound(PCC, DISTRICT, { entries: [{ code: 'A1' }], round: 'R1', now: 1, makeId });
  assert.deepEqual(made.entries.map((e) => [e.runs, e.topic]), [[[], '']], 'a new F4 entry has no runs and no topic yet');
  assert.equal(made.family, 'f4');
  assert.equal(ws.keys(r, 'judge').scope, 'room', 'Space and the number keys work on the PCC judge stage');
  assert.deepEqual(ws.summary(r), { status: ws.summary(r).status, done: 0, total: 2, next: 'B2' });
  assert.throws(() => ws.mount({}, { el: {} }, r, 'judge'), /env.el/);
  assert.throws(() => ws.mount(null, { el: null, runsScreens: {} }, r, 'judge'), /no screen/);
});

// Why: a judge picks the event before anything else; if PCC were not offered or setup refused it, the F4 workspace
// could never be reached.
test('PCC is offered in room setup and setup accepts it', () => {
  assert.ok(ENABLED_EVENTS.includes('pcc'));
  assert.ok(eventChoices(DATA).some((e) => e.id === 'pcc'));
  assert.equal(setupError({ entries: [{ code: 'A1' }], check: [] }, 'pcc'), '');
});

// Why: PCC is one clock with a split (VENN.md §6): if the split were wrong, the judge would copy a Pro or Con time that
// is not what the student spoke, and the total could drift from the clock the rank rules read.
test('the run split: Pro holds the clock until Con starts, then Con holds the rest, under one limit', () => {
  const base = entryOf(pccRoom(), 'e2') || pccRoom().entries[0];
  const t0 = base.timing;
  // Start: the clock runs with 0 s on it; the entry has one run, Pro.
  let e = sync(withTiming(base, running(t0, 0, 10_000)), 10_000);
  assert.deepEqual(e.runs.map((r) => [r.side, r.ms]), [['pro', 0]]);
  // 4:00 in: Con starts. Pro is fixed at 4:00, Con starts at 0.
  const res = markNextRun(withTiming(e, running(t0, 240, 250_000)), PCC, 250_000, LIMIT);
  assert.equal(res.refused, '');
  e = res.entry;
  assert.deepEqual(e.runs.map((r) => [r.side, r.ms]), [['pro', 240_000], ['con', 0]]);
  assert.equal(e.runs[1].startedAt, 250_000);
  // 7:30 on the clock: Con has 3:30, live and once stopped.
  assert.deepEqual(runsAt(withTiming(e, running(t0, 450, 460_000)), PCC, 460_000, LIMIT).map((r) => r.ms), [240_000, 210_000]);
  const stopped = stoppedTiming(running(t0, 450, 460_000), running(t0, 450, 460_000).run, LIMIT - 450, LIMIT, 30, 460_000);
  e = sync(withTiming(e, stopped), 460_000);
  assert.deepEqual(e.runs.map((r) => r.ms), [240_000, 210_000]);
  assert.equal(e.runs[0].ms + e.runs[1].ms, e.timing.usedMs, 'the runs add up to the one clock');
  assert.equal(runsLine(e, PCC, 460_000, LIMIT), 'Pro 4:00 · Con 3:30');
  assert.deepEqual(markNextRun(e, PCC, 470_000, LIMIT).refused, 'Every run has started.');
  assert.match(markNextRun(base, PCC, 1, LIMIT).refused, /Start the clock for Pro first/);
  assert.equal(hasRuns(PCC), true);
  assert.equal(hasRuns(DATA.events.get('oo')), false);
  assert.equal(sync(Object.assign({}, base), 1).runs, undefined, 'no time, no runs field written: nothing changes');
});

// Why: the over-grace flag must read the whole entry against the one 10:30 limit; if each run had its own limit, a
// student who spoke 6:00 and 5:00 would never be flagged, and rank 1 would go to a student over time.
test('the one limit covers both runs: the flags count the total, not each run', () => {
  const base = pccRoom().entries[0];
  const t = Object.assign({}, base.timing, { usedMs: 675_000 }); // 11:15 in all
  const face = timerFace(withTiming(base, t), LIMIT, 30, 0);
  assert.equal(face.overLimit, true);
  assert.equal(face.overGrace, true);
});

// Why: NSDA mandates no minimum for a run (VENN.md §6 item 1); a warning on a short run would push a judge to mark down
// a student who broke no rule.
test('a short run shows its time with no warning', () => {
  const base = pccRoom().entries[0];
  const e = sync(withTiming(base, Object.assign({}, base.timing, { usedMs: 20_000 })), 1);
  const split = Object.assign({}, e, { runs: [{ side: 'pro', startedAt: 0, ms: 20_000 }, { side: 'con', startedAt: 20_000, ms: 0 }] });
  const html = runCardsHtml(split, PCC, 1, LIMIT);
  assert.match(html, /0:20/);
  assert.doesNotMatch(html.replace(/<p class="field-help">[^<]*<\/p>/, ''), /minimum|too short|under/i);
  assert.doesNotMatch(html, /pill err|class="[^"]*\berr\b/);
});

// Why: a correction or a reset must keep the runs true to the clock: after "Reset time" a stale Pro time would be
// copied into the ballot, and after a −10 s a run would show more time than the student had.
test('corrections and Reset time keep the runs in step; Undo of the split gives the time back to Pro', () => {
  const base = pccRoom().entries[0];
  let e = Object.assign({}, withTiming(base, Object.assign({}, base.timing, { usedMs: 300_000 })), { runs: [{ side: 'pro', startedAt: 0, ms: 200_000 }, { side: 'con', startedAt: 1, ms: 100_000 }] });
  e = sync(withTiming(e, adjustTiming(e.timing, 10, 1, LIMIT, 30)), 1);
  assert.deepEqual(e.runs.map((r) => r.ms), [200_000, 110_000], '+10 s goes to the run on now');
  const low = withTiming(e, Object.assign({}, e.timing, { usedMs: 150_000 }));
  assert.deepEqual(runsAt(low, PCC, 1, LIMIT).map((r) => r.ms), [150_000, 0], 'a fixed run never shows more than the clock');
  assert.equal(sync(low, 1).runs[0].ms, 200_000, 'but its stored time is kept, so a +10 s can give it back');
  assert.deepEqual(unmarkLastRun(e, PCC, 1, LIMIT).runs.map((r) => [r.side, r.ms]), [['pro', 310_000]]);
  const reset = sync(Object.assign(withTiming(e, resetTiming(e.timing)), resetRunFields()), 1);
  assert.deepEqual(reset.runs, [], 'Reset time clears the runs');
  assert.deepEqual(runsAt(withTiming(e, resetTiming(e.timing)), PCC, 1, LIMIT), [], 'no time on the clock: no run shows');
});

// Why: the phase bar is the judge's at-a-glance "where are we"; if done, now and next were wrong, the judge would tap
// "Con started" at the wrong time or miss it, and the split would be wrong.
test('the phase bar: a done phase has a check, the phase on now is filled, and a Next line sits below', () => {
  const model = { label: 'Pro, then Con', phases: [{ id: 'pro', label: 'Pro', time: '4:00' }, { id: 'con', label: 'Con', time: '1:10' }], current: 1, next: 'Next: stop the clock when the Con speech ends.' };
  const html = phasesHtml(model, { id: 'bar1' });
  assert.match(html, /id="bar1"/);
  assert.match(html, /class="phase is-done" data-phase="pro"><span class="phase-mark" aria-hidden="true">✓<\/span>/);
  assert.match(html, /class="phase is-on" data-phase="con" aria-current="step"/);
  assert.equal((html.match(/aria-current/g) || []).length, 1);
  assert.match(html, /<p class="phase-next">Next: stop the clock when the Con speech ends\.<\/p>/);
  assert.match(html, /\(done\)/, 'the state is in words for screen readers, not only a mark');
  assert.deepEqual([0, 1, 2].map((i) => phaseState(i, 1)), ['done', 'on', 'todo']);
  assert.doesNotMatch(phasesHtml({ phases: [{ id: 'a', label: 'A' }], current: -1 }), /aria-current|✓|phase-next/, 'nothing started: no fill, no check, no line');
  assert.equal((phasesHtml({ phases: model.phases, current: 2 }).match(/✓/g) || []).length, 2, 'every phase done: every phase has a check');
  assert.match(phasesHtml({ label: '<b>', phases: [{ id: 'x', label: '<i>' }], current: 0 }), /&lt;b&gt;.*&lt;i&gt;/s, 'text is escaped');
});

// Why: the bar must follow the entry through Pro, Con and done; a bar stuck on Pro after Con started would tell the
// judge the split never happened.
test('the PCC bar model follows the entry: ready, Pro, Con, done', () => {
  const base = pccRoom().entries[0];
  const ready = runsBarModel(base, PCC, 1, LIMIT);
  assert.equal(ready.current, -1);
  assert.match(ready.next, /^Next: Pro\./);
  const pro = sync(withTiming(base, running(base.timing, 60, 70_000)), 70_000);
  assert.equal(runsBarModel(pro, PCC, 70_000, LIMIT).current, 0);
  assert.match(runsBarModel(pro, PCC, 70_000, LIMIT).next, /^Next: Con\. Tap Con started/);
  const con = markNextRun(pro, PCC, 70_000, LIMIT).entry;
  const conModel = runsBarModel(con, PCC, 80_000, LIMIT);
  assert.equal(conModel.current, 1);
  assert.deepEqual(conModel.phases.map((p) => p.time), ['1:00', '0:10'], 'ten seconds after the split, Con has 0:10');
  const done = sync(withTiming(con, Object.assign({}, con.timing, { run: null, usedMs: 400_000 })), 90_000);
  assert.equal(runsPhase(done, PCC, 90_000, LIMIT).index, 2);
  assert.equal(runsBarModel(done, PCC, 90_000, LIMIT).next, 'Pro and Con are done.');
  const paused = sync(withTiming(pro, Object.assign({}, pro.timing, { run: null, usedMs: 60_000 })), 71_000);
  assert.equal(runsPhase(paused, PCC, 71_000, LIMIT).index, 0, 'a clock paused during Pro is still in Pro');
});

// Why: the judge sees the topic, the bar, the run cards and the button on the PCC Room screen; if a part were missing
// the judge could not record the topic or split the runs, and a no show must not offer a clock it cannot use.
test('the run parts of the Room screen: topic field, bar, run cards, the Con started button, the roster line', () => {
  const r = pccRoom();
  const base = Object.assign({}, r.entries[0], { topic: 'Resolved: <b>x</b>' });
  const head = runsHeadHtml(base, PCC, 1, LIMIT);
  assert.match(head, /id="run-topic"[^>]*value="Resolved: &lt;b&gt;x&lt;\/b&gt;"/);
  assert.match(head, /Pro, then Con/);
  assert.match(head, /class="phase-next">Next: Pro\./);
  assert.doesNotMatch(runCardsHtml(base, PCC, 1, LIMIT), /data-ract="next"/, 'before Pro starts there is no Con started button');
  const pro = sync(withTiming(base, running(base.timing, 30, 40_000)), 40_000);
  const cards = runCardsHtml(pro, PCC, 40_000, LIMIT);
  assert.match(cards, /data-ract="next"[^>]*>Con started</);
  assert.match(cards, /data-run-word="pro">Now</);
  assert.match(cards, /data-run-word="con">Not started</);
  assert.match(runsRowHtml(pro, PCC, 40_000, LIMIT), /Pro 0:30/);
  assert.equal(runsRowHtml(base, PCC, 1, LIMIT), '');
  const noShow = Object.assign({}, base, { status: 'noShow' });
  assert.equal(runsHeadHtml(noShow, PCC, 1, LIMIT) + runCardsHtml(noShow, PCC, 1, LIMIT), '');
  assert.equal(setTopic(base, 'x'.repeat(TOPIC_MAX + 50)).topic.length, TOPIC_MAX);
});

// Why: the points line on the ballot must appear only when the rules profile asks for points (EXPERIENCE.md §3 F4:
// "points only if the profile asks"); points under a ranks-only profile would put a number in Tabroom nobody wanted.
test('PCC points show only when the profile asks for a rating', () => {
  const plain = pccRoom(DISTRICT, ['A1']);
  const rated = pccRoom(INVITATIONAL, ['A1']);
  assert.doesNotMatch(ranksBlock(plain).text, /Rating/);
  assert.match(ranksBlock(rated).text, /Rating/);
});

// Why: a PCC round saved before a field existed (or a late entry added on the roster) must still open with runs and a
// topic; and the migration must never touch other rounds' entries or overwrite what a PCC entry already holds.
test('migration: each entry of an F4 round gets runs and topic, with values kept and nothing shared', () => {
  const r = pccRoom();
  const late = addEntry(r, 'C3', '', 2).room; // a late entry: createRoom's defaults are not on it
  const bare = Object.assign({}, late, { entries: late.entries.map((e) => { const x = Object.assign({}, e); delete x.runs; delete x.topic; return x; }) });
  bare.entries[0] = Object.assign({}, bare.entries[0], { topic: 'Kept', runs: [{ side: 'pro', startedAt: 1, ms: 5000 }] });
  const out = migrateRoom(bare);
  assert.equal(out.entries[0].topic, 'Kept');
  assert.deepEqual(out.entries[0].runs, [{ side: 'pro', startedAt: 1, ms: 5000 }]);
  assert.deepEqual(out.entries.slice(1).map((e) => [e.runs, e.topic]), [[[], ''], [[], '']]);
  assert.notEqual(out.entries[1].runs, out.entries[2].runs, 'each entry gets its own list');
  assert.deepEqual(migrateRoom(out), out, 'idempotent');
  const oo = createRoom({ event: DATA.events.get('oo'), profile: DISTRICT, entries: [{ code: 'A1' }], now: 1, makeId });
  assert.ok(!('family' in oo), 'a one-run round stores no family (no change to the v1 room shape)');
  assert.deepEqual(migrateRoom(oo).entries, oo.entries, 'entries of other rounds are not touched');
  assert.equal(migrateRooms([bare])[0].entries[2].topic, '');
  assert.equal(updateEntry(out, out.entries[0].id, (e) => setTopic(e, 'New'), 3).entries[0].topic, 'New');
});

// Why: on a stop the clock clears its run a moment before it writes the time used; if that moment wiped the split,
// the first stop after "Con started" would lose Con and put all the time on Pro (found in the browser check of S5).
test('a stop keeps the split: the moment with no run and no time does not wipe the runs', () => {
  const base = pccRoom().entries[0];
  const split = Object.assign(withTiming(base, running(base.timing, 100, 200_000)), { runs: [{ side: 'pro', startedAt: 1, ms: 60_000 }, { side: 'con', startedAt: 2, ms: 0 }] });
  const between = sync(withTiming(split, Object.assign({}, split.timing, { run: null })), 200_000); // run cleared, usedMs still 0
  assert.deepEqual(between.runs, split.runs, 'the split is kept');
  const stopped = sync(withTiming(between, stoppedTiming(split.timing, split.timing.run, LIMIT - 100, LIMIT, 30, 200_000)), 200_000);
  assert.deepEqual(stopped.runs.map((r) => [r.side, r.ms]), [['pro', 60_000], ['con', 40_000]]);
});

// Why: the judge writes and checks each PCC comment on Review; without the topic and the Pro and Con times there, the
// judge cannot tie the comment to what the student argued or see how the time split, and must go back to the room.
test('Review shows each PCC entry\'s topic and its Pro and Con times, outside the comment', () => {
  const r = pccRoom(DISTRICT, ['A1', 'B2']);
  const [a, b] = r.entries;
  const judged = Object.assign({}, r, { entries: [
    Object.assign({}, a, { topic: '  Resolved: <x>  ', timing: Object.assign({}, a.timing, { usedMs: 450_000 }), runs: [{ side: 'pro', startedAt: 1, ms: 240_000 }, { side: 'con', startedAt: 2, ms: 210_000 }] }),
    Object.assign({}, b, { topic: '', runs: [] }),
  ] });
  const [ca, cb] = cards(judged, 'speaking');
  assert.equal(ca.topic, 'Resolved: <x>');
  assert.equal(ca.runs, 'Pro 4:00 · Con 3:30');
  assert.equal(ca.comment, '', 'the topic and times are not put into the comment that goes to Tabroom');
  const html = cardHtml(ca, false);
  assert.match(html, /Topic:<\/span> Resolved: &lt;x&gt;/);
  assert.match(html, /Runs:<\/span> Pro 4:00 · Con 3:30/);
  assert.doesNotMatch(cardHtml(cb, false), /card-topic|card-runs/, 'an entry with no topic and no time shows no empty lines');
  const oo = createRoom({ event: DATA.events.get('oo'), profile: DISTRICT, entries: [{ code: 'A1' }], now: 1, makeId });
  assert.doesNotMatch(cardHtml(cards(oo, 'speaking')[0], false), /card-topic|card-runs/, 'other events show neither line');
});
