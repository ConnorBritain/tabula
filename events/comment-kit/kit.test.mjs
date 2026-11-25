// Why: if the starters or the word list break, a nervous judge gets wrong or missing help, a hurtful comment about a student's looks or identity goes by with no note, or a normal performance comment ("character voice", "pace") gets a false warning that teaches judges to ignore the note.
// Tests for the comment kit (events/comment-kit/): the data files, the starters, the performance check and the
// length note. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from '../js/data.js';
import { kitDataSource } from './build-data.mjs';
import {
  STARTER_KINDS, starterSetKey, startersFor, insertStarter, checkComment, settledHits, hitWords, hitKeys, CHECK_CATEGORIES,
  NOTE_TEXT, LONG_AT, lengthNote,
} from './kit.js';
import { starterRowHtml, sheetStartersHtml, noteHtml } from './kit-view.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const STARTERS = JSON.parse(read('starters.json'));
const WORDS = JSON.parse(read('words.json'));
const DATA = await loadEventData(async (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8')));
const cats = (text) => checkComment(text).map((h) => h.category);

test('kit-data.js is up to date with starters.json and words.json (if not: run node events/comment-kit/build-data.mjs)', () => {
  assert.equal(read('kit-data.js'), kitDataSource());
});

// ---------- Starters ----------

test('starters.json: each family has 6 to 10 short, plain starters for Strength, To work on and Reason for rank', () => {
  assert.equal(STARTERS.version, 1);
  const want = ['interp', 'platform', 'limitedPrep', 'twoRuns', 'congress', 'general'];
  assert.deepEqual(Object.keys(STARTERS.families).sort(), want.slice().sort());
  for (const [key, fam] of Object.entries(STARTERS.families)) {
    assert.equal(typeof fam.label, 'string', key + ' label');
    assert.deepEqual(Object.keys(fam).filter((k) => k !== 'label').sort(), STARTER_KINDS.slice().sort(), key + ' kinds');
    for (const kind of STARTER_KINDS) {
      const list = fam[kind];
      assert.ok(Array.isArray(list) && list.length >= 6 && list.length <= 10, `${key}.${kind}: 6 to 10 starters`);
      assert.equal(new Set(list).size, list.length, `${key}.${kind}: no repeats`);
      for (const s of list) {
        assert.equal(typeof s, 'string');
        assert.equal(s, s.trim(), `"${s}" has no outer spaces`);
        assert.ok(s.length >= 8 && s.length <= 48, `"${s}" is short`);
        assert.doesNotMatch(s, /[.!?…]$/, `"${s}" is a start, with no end mark`);
        assert.ok(s.split(/\s+/).every((w) => w.replace(/[^A-Za-z]/g, '').length <= 10), `"${s}" uses short words`);
      }
    }
  }
});

test('no starter sets off the performance check', () => {
  for (const [key, fam] of Object.entries(STARTERS.families)) {
    for (const kind of STARTER_KINDS) for (const s of fam[kind]) assert.deepEqual(checkComment(s + ' the second point.'), [], `${key}.${kind}: "${s}"`);
  }
});

test('each event picks its family of starters', () => {
  const want = {
    di: 'interp', hi: 'interp', duo: 'interp', poi: 'interp', pro: 'interp', poe: 'interp', sto: 'interp',
    oo: 'platform', inf: 'platform', exp: 'platform', osw: 'platform', dec: 'platform',
    ix: 'limitedPrep', usx: 'limitedPrep', com: 'limitedPrep', mx: 'limitedPrep', imp: 'limitedPrep',
    pcc: 'twoRuns',
  };
  for (const [id, set] of Object.entries(want)) {
    const def = DATA.events.get(id);
    assert.ok(def, id + ' is a shipped event');
    assert.equal(starterSetKey(def), set, id);
  }
  assert.equal(starterSetKey(null), 'general', 'no event file');
  assert.equal(starterSetKey({ id: 'custom', name: 'My event' }), 'general', 'a Custom event');
  assert.equal(starterSetKey({ family: 'congress' }), 'congress');
  assert.deepEqual(startersFor(DATA.events.get('di'), 'strength'), STARTERS.families.interp.strength);
  assert.deepEqual(startersFor(DATA.events.get('oo'), 'nope'), []);
});

test('a starter goes in at the cursor as a new sentence, with one space after it for the judge to go on', () => {
  assert.deepEqual(insertStarter('', 'I believed you most when', 0), { text: 'I believed you most when ', cursor: 25 });
  assert.deepEqual(insertStarter('Great intro.', 'Try slowing down when', 12), { text: 'Great intro. Try slowing down when ', cursor: 35 });
  // In the middle: the text after it stays as it was.
  const mid = insertStarter('Great intro. Clear end.', 'Try slowing down when', 13);
  assert.equal(mid.text, 'Great intro. Try slowing down when Clear end.');
  assert.equal(mid.text.slice(0, mid.cursor), 'Great intro. Try slowing down when ');
  // A cursor out of range goes to the end; a space already after the cursor is not doubled.
  assert.equal(insertStarter('Hi.', 'X', 99).text, 'Hi. X ');
  const sp = insertStarter('A. B.', 'X', 2);
  assert.equal(sp.text, 'A. X B.');
  assert.equal(sp.cursor, 5);
});

test('the starter rows draw each starter as a button with "…", escaped, and nothing for an empty kind', () => {
  const html = starterRowHtml(DATA.events.get('oo'), 'strength', 'kit');
  assert.equal((html.match(/class="chip kit-chip"/g) || []).length, STARTERS.families.platform.strength.length);
  assert.match(html, /Your main point was clear when…/);
  assert.match(html, /role="group" aria-labelledby="kit-strength"/);
  assert.equal(starterRowHtml(null, 'nope', 'kit'), '');
  const sheet = sheetStartersHtml(DATA.events.get('di'), true);
  assert.match(sheet, /<details class="fold kit-starters" open>/);
  assert.match(sheet, /Sentence starters/);
  assert.doesNotMatch(sheetStartersHtml(DATA.events.get('di'), false), / open>/);
});

// ---------- Performance check: the data ----------

test('words.json: seven categories, each term a word or phrase, no repeats, and each term finds itself', () => {
  assert.equal(WORDS.version, 1);
  assert.deepEqual(CHECK_CATEGORIES, ['looks', 'body', 'clothes', 'voiceType', 'accent', 'identity', 'harsh']);
  assert.ok(Array.isArray(WORDS.roleWords) && WORDS.roleWords.length);
  const seen = new Set();
  for (const c of WORDS.categories) {
    assert.equal(typeof c.label, 'string', c.id);
    assert.equal(typeof c.roleSafe, 'boolean', c.id);
    assert.ok(c.terms.length >= 5, c.id + ' has terms');
    for (const raw of c.terms) {
      const o = typeof raw === 'string' ? { t: raw } : raw;
      assert.deepEqual(Object.keys(o).filter((k) => !['t', 'unlessPrev', 'unlessNext'].includes(k)), [], c.id + ': ' + o.t);
      assert.match(o.t, /^[a-z0-9' ]+$/, `"${o.t}" is lower case words`);
      for (const k of ['unlessPrev', 'unlessNext']) if (o[k]) assert.ok(o[k].every((w) => /^[a-z']+$/.test(w)), `${o.t} ${k}`);
      assert.ok(!seen.has(o.t), `"${o.t}" is listed once`);
      seen.add(o.t);
      const hits = checkComment('Note: ' + o.t + '.');
      assert.equal(hits.length, 1, `"${o.t}" finds itself`);
      assert.equal(hits[0].category, c.id, `"${o.t}" is in ${c.id}`);
    }
  }
});

// ---------- Performance check: one test per category ----------

test('looks: words about how a student looks get the note', () => {
  for (const t of ['Your hair was in your face the whole time.', 'You are cute up there!', 'Your acne was distracting.', 'Such a handsome young man.']) assert.deepEqual(cats(t), ['looks'], t);
});
test('body: words about a student\'s body get the note', () => {
  for (const t of ['You might want to lose weight.', 'You are so skinny.', 'You\'re short, so stand on a step.', 'Your legs were shaking.']) assert.deepEqual(cats(t), ['body'], t);
});
test('clothes: words about what a student wore get the note', () => {
  for (const t of ['Nice outfit!', 'Your skirt was too short.', 'You were well dressed today.', 'Your tie was crooked.']) assert.deepEqual(cats(t), ['clothes'], t);
});
test('voice type: words about the student\'s own voice get the note', () => {
  for (const t of ['Your squeaky voice was hard to hear.', 'You sound so nasally.', 'Your stutter got in the way.', 'Your whiny voice did not help.']) assert.deepEqual(cats(t), ['voiceType'], t);
});
test('accent: words about the student\'s own accent get the note', () => {
  for (const t of ['Your thick accent made it hard to follow.', 'I could not understand your accent.', 'You have an accent.', 'Where are you from?']) assert.deepEqual(cats(t), ['accent'], t);
});
test('identity: words about who a student is get the note', () => {
  for (const t of ['Good job for a girl.', 'Very mature for your age.', 'Man up next time.', 'That is so gay.']) assert.deepEqual(cats(t), ['identity'], t);
});
test('harsh labels get the note ("bad", "boring", "annoying" and more)', () => {
  for (const t of ['That was bad.', 'It was boring.', 'Your pauses were annoying.', 'Honestly it was cringe.', 'Pretty dull overall.']) assert.deepEqual(cats(t), ['harsh'], t);
  assert.deepEqual(cats('Boring, annoying, and bad.'), ['harsh', 'harsh', 'harsh']);
});

// ---------- Performance check: no false hits ----------

test('normal performance words do not set off the note', () => {
  const ok = [
    'Good pace in the intro, and your volume filled the room.',
    'Your character voice for the grandmother was clear.',
    'The character voices were easy to tell apart.',
    'Your blocking showed the fight well.',
    'Nice accent work for the grandmother.',
    'Strong accent work in the second half.',
    'Your accent slipped near the end.',
    'Your body language matched the words.',
    'You shifted your weight a lot; try planting your feet.',
    'Your facial expressions sold the ending.',
    'Your eye contact was strong. Your voice was clear and loud.',
    'Vary your pitch and tone a bit more.',
    'The speech was a little too short; use more of your time.',
    'Pretty good intro, and the pace was pretty fast.',
    'Not bad at all.',
    'The bad guy was scary in the best way.',
    'Avoid the bad habit of saying um.',
    'The vocal variety was great and the gestures were natural.',
    'Your monotone delivery could use more energy.',
    'You dressed the stage with good movement.',
    'Your transitions were smooth and your evidence was strong.',
    'The ending felt rushed; slow down.',
    'A beautiful piece with clear imagery.',
    'You stood tall and kept your feet planted.',
    'The squeaky voice for the mouse character was so fun.',
    'Your accent for the role stayed steady.',
    'Your thick accent work for the old man was steady.',
    'The narrator\'s nasal voice was a smart choice.',
    'Your posture was strong and your projection was great.',
  ];
  for (const t of ok) assert.deepEqual(checkComment(t), [], t);
});

test('a word inside a longer word is not a hit ("badge", "fatal", "outfitted" are fine)', () => {
  assert.deepEqual(checkComment('Your badge story was fatal to the plot, and the boringly named file was fine.'), []);
});

test('the check finds a hit in any letter case and with a curly apostrophe, and gives its place', () => {
  const text = 'Great energy. You’re CUTE.';
  const hits = checkComment(text);
  assert.equal(hits.length, 1);
  assert.equal(text.slice(hits[0].start, hits[0].end), 'You’re CUTE');
  assert.deepEqual(hitWords(text, hits), ['You’re CUTE']);
});

test('a longer term covers a shorter one in the same place, and words are named once', () => {
  const text = 'Your whiny voice. Boring. boring.';
  const hits = checkComment(text);
  assert.deepEqual(hits.map((h) => h.term), ['whiny voice', 'boring', 'boring']);
  assert.deepEqual(hitWords(text, hits), ['whiny voice', 'Boring']);
  assert.deepEqual(hitKeys(hits), ['boring', 'whiny voice']);
});

test('while typing, a word at the very end waits for the next space or mark ("bad" on the way to "badge")', () => {
  assert.deepEqual(settledHits('Your bad', false), []);
  assert.equal(settledHits('Your bad ', false).length, 1);
  assert.equal(settledHits('Your bad', true).length, 1, 'once the judge leaves the box');
});

test('the check can run on a given list (the data drives it, not the code)', () => {
  const data = { roleWords: ['role'], categories: [{ id: 'x', label: 'x', roleSafe: true, terms: ['zap'] }] };
  assert.equal(checkComment('A zap.', data).length, 1);
  assert.equal(checkComment('A zap for the role.', data).length, 0);
});

// ---------- The note and the length note ----------

test('the note says the plain words, names the words to check (escaped), and offers Edit and Keep; nothing with no hits', () => {
  assert.equal(NOTE_TEXT, 'Is this about the performance? Comments about how a student looks or who they are can hurt.');
  const text = 'So <b>boring</b>.';
  const html = noteHtml(text, checkComment(text));
  assert.ok(html.includes(NOTE_TEXT));
  assert.match(html, /Words to check: “boring”/);
  assert.match(html, /data-kit-act="edit">Edit</);
  assert.match(html, /data-kit-act="keep">Keep</);
  assert.equal(noteHtml('Fine.', []), '');
});

test('the length note is a quiet count from a long comment on, with no limit', () => {
  assert.equal(lengthNote(''), '');
  assert.equal(lengthNote('x'.repeat(LONG_AT - 1)), '');
  assert.equal(lengthNote('x'.repeat(LONG_AT)), LONG_AT + ' characters');
  assert.equal(lengthNote('x'.repeat(12345)), '12,345 characters');
});

// ---------- The hooks stay small ----------

test('each screen hooks the kit with one import and one call, and the kit never calls the network', () => {
  for (const [f, call] of [['../js/comment-view.js', 'mountCommentKit('], ['../js/rank-screen.js', 'mountReasonKit(']]) {
    const src = read(f);
    assert.equal(src.split('../comment-kit/').length - 1, 1, f + ': one import');
    assert.equal(src.split(call).length - 1, 1, f + ': one call');
  }
  for (const f of ['kit.js', 'kit-view.js', 'kit-data.js']) assert.doesNotMatch(read(f), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB/, f);
});
