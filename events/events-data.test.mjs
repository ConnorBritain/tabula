// Schema tests for the Speech Events data files (docs/events/ARCHITECTURE.md §6.1, §6.2). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { readCheckList } from './check-list.mjs';
import { dataSource } from './prototype/build-data.mjs';

const at = (p) => new URL(p, import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(at(p), 'utf8'));
const PUB = readJson('published.json');
const jsonIn = (dir) => readdirSync(at(dir)).filter((f) => f.endsWith('.json'));
const DEFS = jsonIn('defs/').map((f) => ({ f, d: readJson('defs/' + f) }));
const PROFILES = jsonIn('profiles/').map((f) => ({ f, d: readJson('profiles/' + f) }));
const CHECK_IDS = new Set(readCheckList().map((c) => c.id));

// The v1 fields, and only these (ARCHITECTURE.md §6.1 and §6.2). Later fields wait for the pack that needs them.
const EVENT_KEYS = ['id', 'version', 'name', 'short', 'category', 'performers', 'timing', 'material', 'checks', 'prompts', 'tags', 'source'];
const TIMING_KEYS = ['limit', 'inRoomPrep', 'sharedClock'];
const PROFILE_KEYS = ['id', 'version', 'name', 'rating', 'ratingNoTies', 'rankRatingRule', 'overtime', 'biasNote', 'source'];
const V1_EVENTS = ['oo', 'inf', 'usx', 'ix', 'di', 'hi', 'duo', 'poi', 'com', 'pro', 'poe', 'exp', 'imp', 'sto', 'osw', 'dec', 'mx', 'mspro', 'mspoe'];
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

// Why: the app reads these fields with no guard; a missing or extra field means a room screen that breaks or a field that silently does nothing.
test('every event file has exactly the v1 fields, with the right types', () => {
  for (const { f, d } of DEFS) {
    assert.deepEqual(Object.keys(d).sort(), [...EVENT_KEYS].sort(), f);
    assert.deepEqual(Object.keys(d.timing).sort(), [...TIMING_KEYS].sort(), f + ' timing');
    assert.ok(nonEmpty(d.id) && /^[a-z]+$/.test(d.id), f + ' id');
    assert.ok(Number.isInteger(d.version) && d.version >= 1, f + ' version');
    assert.ok(nonEmpty(d.name) && nonEmpty(d.short), f + ' name');
    assert.ok(['publicAddress', 'interp', 'limitedPrep'].includes(d.category), f + ' category');
    assert.ok([1, 2].includes(d.performers), f + ' performers');
    assert.ok(['memorized', 'manuscript', 'noNotes'].includes(d.material), f + ' material');
    assert.equal(typeof d.timing.inRoomPrep, 'boolean', f);
    assert.equal(typeof d.timing.sharedClock, 'boolean', f);
    assert.ok(Array.isArray(d.checks) && d.checks.length > 0, f + ' checks');
    assert.ok(Array.isArray(d.prompts) && d.prompts.length > 0 && d.prompts.every(nonEmpty), f + ' prompts');
    assert.ok(Array.isArray(d.tags) && d.tags.length > 0, f + ' tags');
    for (const t of d.tags) {
      assert.deepEqual(Object.keys(t).sort(), ['id', 'label', 'strength', 'toWork'], f + ' tag ' + t.id);
      assert.ok([t.id, t.label, t.strength, t.toWork].every(nonEmpty), f + ' tag ' + t.id);
    }
  }
});

// Why: the file name is how an old room finds the exact rules it was judged under; a name that disagrees with the contents opens the wrong rules.
test('each file name matches its id and version', () => {
  for (const { f, d } of [...DEFS, ...PROFILES]) assert.equal(f, `${d.id}.v${d.version}.json`);
});

// Why: two events (or two tags in one event) with the same id make the picker and the chips pick the wrong one, and a saved room loads the wrong rules.
test('ids are unique: events, short codes, profiles, and tags inside each event', () => {
  const key = ({ d }) => `${d.id}.v${d.version}`;
  assert.equal(new Set(DEFS.map(key)).size, DEFS.length, 'event id + version');
  assert.equal(new Set(PROFILES.map(key)).size, PROFILES.length, 'profile id + version');
  const latest = DEFS.filter(({ d }) => !DEFS.some((o) => o.d.id === d.id && o.d.version > d.version));
  assert.equal(new Set(latest.map(({ d }) => d.short)).size, latest.length, 'short codes');
  for (const { f, d } of DEFS) {
    assert.equal(new Set(d.tags.map((t) => t.id)).size, d.tags.length, f + ' tag ids');
    assert.equal(new Set(d.checks).size, d.checks.length, f + ' check ids');
  }
});

// Why: the plan promises these 19 events in v1 (17 at first; middle school Prose and Poetry added 2026-11-21); a lost file means a judge cannot open that event at all.
test('the 19 v1 events are all present', () => {
  assert.deepEqual(DEFS.map(({ d }) => d.id).filter((id, i, a) => a.indexOf(id) === i).sort(), [...V1_EVENTS].sort());
});

// Why: a zero, negative or fractional limit makes the timer show "over" from the first second, or never, so every rank rule fails.
test('times are positive whole seconds, and grace is a whole number of seconds', () => {
  for (const { f, d } of DEFS) assert.ok(Number.isInteger(d.timing.limit) && d.timing.limit > 0, f);
  for (const { f, d } of PROFILES) assert.ok(Number.isInteger(d.overtime.grace) && d.overtime.grace >= 0, f);
});

// Why: shared prep and speech time is only correct when prep happens in the room; impromptu needs both or the clock starts at the wrong moment.
test('only impromptu runs prep in the room, on one shared clock', () => {
  for (const { f, d } of DEFS) {
    const imp = d.id === 'imp';
    assert.equal(d.timing.inRoomPrep, imp, f);
    assert.equal(d.timing.sharedClock, imp, f);
    if (d.timing.sharedClock) assert.ok(d.timing.inRoomPrep, f + ': a shared clock needs in-room prep');
  }
});

// Why: the room screen shows a label for each check from the §7 list; an id not on that list shows a blank pill or a made-up rule to a lay judge.
test('every check id is in the EVENTS.md §7 list', () => {
  assert.ok(CHECK_IDS.size >= 12, 'the §7 table was read');
  for (const { f, d } of DEFS) for (const c of d.checks) assert.ok(CHECK_IDS.has(c), `${f}: unknown check ${c}`);
});

// Why: rules change each season (PLAN.md R4); a file with no named source and season cannot be reviewed each August, and nobody can tell it is stale.
test('every event and profile file names its source and season', () => {
  for (const { f, d } of [...DEFS, ...PROFILES]) {
    assert.ok(nonEmpty(d.source), f);
    assert.match(d.source, /\b20\d\d-\d\d\b/, f + ': source must name a season such as 2026-27');
  }
});

// Why: an old room opens with the rules it was judged under (ARCHITECTURE.md §6.1); a deleted version file makes that room unreadable.
test('every event and profile version file ever published still exists', () => {
  for (const f of PUB.defs) assert.ok(existsSync(at('defs/' + f)), 'missing published event file ' + f);
  for (const f of PUB.profiles) assert.ok(existsSync(at('profiles/' + f)), 'missing published profile file ' + f);
});

// Why: the "ever published" list only protects files it names; a new file left off it could later be deleted with no test failing.
test('every data file on disk is on the published list', () => {
  for (const { f } of DEFS) assert.ok(PUB.defs.includes(f), f + ' is not in events/published.json');
  for (const { f } of PROFILES) assert.ok(PUB.profiles.includes(f), f + ' is not in events/published.json');
});

// Why: a profile field the rank board does not understand lets a tie or an over-grace first place through, or blocks a legal rank.
test('every profile file has exactly the v1 fields, with valid values', () => {
  for (const { f, d } of PROFILES) {
    assert.deepEqual(Object.keys(d).sort(), [...PROFILE_KEYS].sort(), f);
    assert.deepEqual(Object.keys(d.overtime).sort(), ['effect', 'grace'], f);
    assert.ok(['noFirst', 'flagOnly'].includes(d.overtime.effect), f + ' effect');
    assert.equal(typeof d.ratingNoTies, 'boolean', f);
    assert.equal(typeof d.rankRatingRule, 'boolean', f);
    const r = d.rating;
    const ok = r === 'none'
      || (r && typeof r === 'object' && Number.isFinite(r.min) && Number.isFinite(r.max) && r.step > 0 && r.min < r.max)
      || (r && typeof r === 'object' && Array.isArray(r.words) && r.words.length >= 2 && r.words.every(nonEmpty));
    assert.ok(ok, f + ' rating must be "none", {min, max, step} or {words: [best first]}');
  }
  assert.deepEqual(PROFILES.map(({ d }) => d.id).sort(), ['custom', 'nsda-district', 'nsda-invitational']);
});

// Why: PLAN.md Q5: we never ship NSDA's bias statement; the default must be our own short neutral line, or we copy rules text.
test('the bias note is our own short neutral line', () => {
  for (const { f, d } of PROFILES) {
    assert.ok(nonEmpty(d.biasNote) && d.biasNote.length <= 80, f);
    assert.doesNotMatch(d.biasNote, /NSDA|National Speech/i, f);
  }
});

// Why: the prototype reads a generated copy of these files; if it drifts, the lay-judge test runs on rules that are not the shipped ones.
test('the prototype data file is up to date with the data files', () => {
  assert.equal(readFileSync(at('prototype/data.js'), 'utf8'), dataSource(), 'run: node events/prototype/build-data.mjs');
});

// Why: middle school Prose and Poetry run 7:00, not the high school 5:00; the wrong limit marks every middle school speaker over time and blocks rank 1.
test('middle school Prose and Poetry run 7:00, high school Prose and Poetry run 5:00', () => {
  const lim = (id) => DEFS.find(({ d }) => d.id === id).d.timing.limit;
  assert.equal(lim('mspro'), 420);
  assert.equal(lim('mspoe'), 420);
  assert.equal(lim('pro'), 300);
  assert.equal(lim('poe'), 300);
});
