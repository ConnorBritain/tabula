// Shape tests for the draft league profiles (phase P3, docs/events/LEAGUES.md §1). Run with: node --test
// The drafts live in events/profiles/v2/ and are not published until the profile layer (events/js/profile-layer.js)
// is on main. These tests read only the JSON files and LEAGUES.md, so they run with or without that module. The
// generic v2 schema belongs to events/profile-layer.test.mjs; this file owns league coverage, the doc match and sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(at(p), 'utf8'));
const LEAGUES_MD = readFileSync(at('../docs/events/LEAGUES.md'), 'utf8');

// The §1 table rows: | `id` | ranks | rating | rubric | grace | `effect` ... |
const ROWS = LEAGUES_MD.split('\n')
  .filter((l) => /^\| `[a-z-]+` \|/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
  .map((c) => ({ id: c[0].replace(/`/g, ''), ranks: c[1], grace: Number(c[4]), effect: ((c[5] || '').match(/`([A-Za-z]+)`/) || [])[1] }));
// Every v2 file except the generic Tabula presets (their source starts "Tabula preset") is a league draft.
const DRAFTS = readdirSync(at('profiles/v2/')).filter((f) => f.endsWith('.json'))
  .map((f) => ({ f: 'v2/' + f, d: readJson('profiles/v2/' + f) }))
  .filter(({ d }) => !/^Tabula preset/.test(d.source || ''))
  .map((x) => ({ ...x, row: ROWS.find((r) => r.id === x.d.id) }));

const V1_KEYS = ['id', 'version', 'name', 'rating', 'ratingNoTies', 'rankRatingRule', 'overtime', 'biasNote', 'source'];
const LAYER_KEYS = ['ranks', 'topN', 'rubric', 'critiqueOnly', 'maxEntries', 'elim']; // EXPERIENCE.md §8.5
// The effects in EXPERIENCE.md §8.5 only (owner decision 2026-11-23: no ARCHITECTURE.md §6.2 reference names in data).
const EFFECTS = ['noFirst', 'flagOnly', 'directorDq', 'windowLast'];
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const isInt = (n) => Number.isInteger(n);

// Why: P3 promises a pack for each of the twelve leagues; a league left out means its judges get the wrong timing rules.
test('every P3 league has a draft profile listed in LEAGUES.md', () => {
  const ids = ROWS.map((r) => r.id);
  for (const league of ['chssa', 'tfa', 'uil', 'ihsa', 'kshsaa', 'mshsl', 'osda', 'mifa', 'ihssa', 'ncfl', 'ncfca', 'stoa']) {
    assert.ok(ids.some((id) => id === league || id.startsWith(league + '-')), league + ' has no row in LEAGUES.md §1');
  }
  assert.equal(new Set(ids).size, ids.length, 'a profile id is listed twice');
  for (const r of ROWS) assert.ok(DRAFTS.some(({ d }) => d.id === r.id), `LEAGUES.md lists ${r.id} but profiles/v2/ has no file for it`);
  for (const { f, row } of DRAFTS) assert.ok(row, `${f} has no row in LEAGUES.md §1, so nobody reviewed it`);
});

// Why: the profile layer reads only these fields; an unknown or mistyped field would silently do nothing in a real room.
test('every draft league profile holds only v1 and §8.5 fields, with valid values', () => {
  for (const { f, d } of DRAFTS) {
    for (const k of Object.keys(d)) assert.ok(V1_KEYS.includes(k) || LAYER_KEYS.includes(k), `${f}: unknown field ${k}`);
    for (const k of V1_KEYS) assert.ok(k in d, `${f}: missing ${k}`);
    assert.equal(f, `v2/${d.id}.v${d.version}.json`, f + ': file name must match id and version');
    assert.ok(isInt(d.version) && d.version >= 1 && nonEmpty(d.name), f);
    assert.ok(['all', 'topN', 'off'].includes(d.ranks), f + ' ranks');
    if (d.ranks === 'topN') assert.ok(isInt(d.topN) && d.topN >= 1, f + ' topN');
    else assert.ok(!('topN' in d), f + ': topN without ranks topN');
    if ('rubric' in d) {
      assert.ok(Array.isArray(d.rubric) && d.rubric.length > 0, f + ' rubric');
      assert.equal(new Set(d.rubric.map((c) => c.id)).size, d.rubric.length, f + ' rubric ids');
      for (const c of d.rubric) assert.ok(/^[a-z][a-zA-Z]*$/.test(c.id) && nonEmpty(c.label) && isInt(c.min) && isInt(c.max) && c.min < c.max, f + ' rubric row ' + c.id);
    }
    if ('critiqueOnly' in d) assert.equal(typeof d.critiqueOnly, 'boolean', f);
    if ('maxEntries' in d) assert.ok(isInt(d.maxEntries) && d.maxEntries >= 2, f + ' maxEntries');
    if ('elim' in d) assert.ok(Object.keys(d.elim).every((k) => ['cx', 'timing'].includes(k)) && typeof d.elim.cx === 'boolean', f + ' elim');
    assert.deepEqual(Object.keys(d.overtime).sort(), ['effect', 'grace'], f);
    assert.ok(isInt(d.overtime.grace) && d.overtime.grace >= 0, f + ' grace');
    assert.ok(EFFECTS.includes(d.overtime.effect), f + ' effect ' + d.overtime.effect);
    assert.equal(typeof d.ratingNoTies, 'boolean', f);
    assert.equal(typeof d.rankRatingRule, 'boolean', f);
    const r = d.rating;
    const ok = r === 'none'
      || (r && typeof r === 'object' && Number.isFinite(r.min) && Number.isFinite(r.max) && r.step > 0 && r.min < r.max)
      || (r && typeof r === 'object' && Array.isArray(r.words) && r.words.length >= 2 && r.words.every(nonEmpty));
    assert.ok(ok, f + ' rating');
    if (d.ranks === 'off') assert.ok(r !== 'none' || 'rubric' in d, f + ': ranks off needs a rating or a rubric');
  }
});

// Why: a draft id that matches a published v1 profile would make an old room open with the wrong league's rules.
test('no draft league id reuses a published v1 profile id', () => {
  const pub = readJson('published.json').profiles.filter((p) => !p.startsWith('v2/')).map((p) => readJson('profiles/' + p).id);
  for (const { f, d } of DRAFTS) assert.ok(!pub.includes(d.id), f);
});

// Why: rules change each season (PLAN.md R4), some facts are unconfirmed (shared brief rule 9), and we copy no league
// text; a source with no season or no named gaps could pass a guess off as a rule, and a league-worded bias note copies text.
test('every draft names its season, its unverified items and our own wording, with our own bias line', () => {
  for (const { f, d } of DRAFTS) {
    assert.match(d.source, /\b20\d\d-\d\d\b/, f + ': source must name a season');
    assert.match(d.source, /not verified/i, f + ': source must name what is not verified');
    assert.match(d.source, /own words/, f + ': source must say the rules are summarized in our own words');
    assert.ok(nonEmpty(d.biasNote) && d.biasNote.length <= 80 && !/NSDA|National Speech/i.test(d.biasNote), f + ' biasNote');
  }
});

// Why: LEAGUES.md is what the coordinator reviews before publishing; if its table and the files disagree, the review
// approves rules that are not the ones shipped.
test('the LEAGUES.md table matches each draft file', () => {
  for (const { f, d, row } of DRAFTS) {
    if (!row) continue; // the coverage test fails for a file with no row
    assert.equal(d.overtime.grace, row.grace, f + ' grace vs LEAGUES.md');
    assert.equal(d.overtime.effect, row.effect, f + ' effect vs LEAGUES.md');
    const ranks = row.ranks === 'off' ? 'off' : row.ranks.startsWith('top') ? 'topN' : 'all';
    assert.equal(d.ranks, ranks, f + ' ranks vs LEAGUES.md');
    if (d.ranks === 'topN') assert.equal(row.ranks, 'top ' + d.topN, f + ' topN vs LEAGUES.md');
  }
});
