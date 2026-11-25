// Why: if this breaks, new judge help words drift above a US grade 6 reading level and a first-time parent judge stops reading them.
// The plain-language check (events/js/help/grade.mjs) in the test run. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fkGrade, syllables, helpBlocks, TARGET_GRADE } from './grade.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const PUB = JSON.parse(read('../../published.json'));
const PROFILES = PUB.profiles.map((f) => JSON.parse(read('../../profiles/' + f)));

test('the grade rule tells easy words from hard ones', () => {
  assert.equal(syllables('cat'), 1);
  assert.equal(syllables('table'), 2);
  assert.equal(syllables('information'), 4);
  assert.ok(fkGrade('The cat sat on the mat. It was fun.') < 2);
  assert.ok(fkGrade('Comprehensive organizational considerations necessitate institutional deliberation regarding performance evaluation methodologies and their interpretive implications.') > 12);
  assert.equal(fkGrade(''), 0);
});

test('every block of new judge help words reads at US grade 6 or lower', () => {
  const blocks = helpBlocks(PROFILES);
  assert.ok(blocks.length >= 3 + PROFILES.length);
  for (const b of blocks) assert.ok(b.grade <= TARGET_GRADE, b.name + ' reads at grade ' + b.grade);
});
