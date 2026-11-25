// Plain-language check for the judge help words (events/js/help/). Reports the US school grade of each block with
// the Flesch-Kincaid grade formula: 0.39 × (words per sentence) + 11.8 × (syllables per word) − 15.59.
// The target is grade 6 or lower. The syllable count is a simple rule of thumb (vowel groups, a silent final "e"),
// good enough to catch long words and long sentences; it is not a full dictionary.
// Run with: node events/js/help/grade.mjs     (events/js/help/grade.test.mjs holds the same line in the test run)
// Not shipped: build-events.mjs leaves out every .mjs file.
import { fileURLToPath } from 'node:url';
import { WALK_STEPS, rankHelpLines, tipsPartHtml } from './help.js';
import { LISTEN_FOR } from './listen-for.js';

export const TARGET_GRADE = 6;

// Syllables in one word (at least 1).
export function syllables(word) {
  let w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Words and sentences of a text. A number or a time ("10:00") counts as one short word.
export function counts(text) {
  const s = String(text || '').trim();
  const sentences = Math.max(1, (s.match(/[.!?]+(\s|$)/g) || []).length);
  const words = s.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  const syl = words.reduce((n, w) => n + (/[a-z]/i.test(w) ? syllables(w) : 1), 0);
  return { sentences, words: words.length, syllables: syl };
}

// The Flesch-Kincaid grade of a text, to one decimal. An empty text reads as 0.
export function fkGrade(text) {
  const c = counts(text);
  if (!c.words) return 0;
  const g = 0.39 * (c.words / c.sentences) + 11.8 * (c.syllables / c.words) - 15.59;
  return Math.round(g * 10) / 10;
}

// Each block of new judge-facing words: { name, text }. Rank help is read for the published rules profiles' shapes.
export function helpBlocks(profiles) {
  const blocks = [{ name: 'First-room walk', text: WALK_STEPS.map((s) => s.title + '. ' + s.text).join(' ') }];
  for (const [id, list] of Object.entries(LISTEN_FOR)) blocks.push({ name: 'What to listen for: ' + id, text: list.join(' ') });
  for (const p of profiles || [{ id: 'default', overtime: { grace: 30, effect: 'noFirst' } }]) {
    blocks.push({ name: 'How to rank: ' + (p.id || 'profile'), text: rankHelpLines({ profile: p }).join(' ') });
  }
  blocks.push({ name: 'Settings tips line', text: tipsPartHtml().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/again The/, 'again. The') });
  return blocks.map((b) => Object.assign(b, { grade: fkGrade(b.text) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { readFileSync } = await import('node:fs');
  const pub = JSON.parse(readFileSync(new URL('../../published.json', import.meta.url), 'utf8'));
  const profiles = pub.profiles.map((f) => JSON.parse(readFileSync(new URL('../../profiles/' + f, import.meta.url), 'utf8')));
  const rows = helpBlocks(profiles);
  for (const r of rows) console.log((r.grade <= TARGET_GRADE ? 'ok  ' : 'HIGH') + '  grade ' + r.grade.toFixed(1).padStart(4) + '  ' + r.name);
  const all = fkGrade(rows.map((r) => r.text).join(' '));
  const high = rows.filter((r) => r.grade > TARGET_GRADE).length;
  console.log('All new judge help words together: grade ' + all.toFixed(1) + ' (target ' + TARGET_GRADE + ' or lower). Blocks over: ' + high + ' of ' + rows.length + '.');
  process.exitCode = high ? 1 : 0;
}
