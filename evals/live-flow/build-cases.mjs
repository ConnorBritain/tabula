// Builds live-flow eval cases from a Tabula backup file.
// Run with: node evals/live-flow/build-cases.mjs <backup.json> [--scrub Name1,Name2]
// --scrub: extra names heard in the room (coaches, other people) to replace with "someone".
// Writes evals/.data/live-flow/cases.jsonl (for the runner) and cases.md (for a person to read).
// The data folder is git-ignored: it holds student speech from real rounds.
//
// One case = one live-flow call, exactly as the app makes it: the flow so far (earlier speeches only),
// the current speech, and the transcript cut at a point in the speech (the app re-flows every 30 s).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../../logic.js');

const CUTS = [0.35, 0.7, 1.0]; // early, middle, and the end-of-speech pass
const MIN_WORDS = 150; // shorter transcripts were flowed from the doc, which a backup does not hold

const file = process.argv[2];
if (!file) { console.error('Usage: node evals/live-flow/build-cases.mjs <backup.json>'); process.exit(2); }
const backup = JSON.parse(readFileSync(file, 'utf8'));
const round = JSON.parse(backup.storage['policyJudge.round.v1']);

// Names out: debaters become 1A/2A/1N/2N, teams become "Aff team"/"Neg team".
// Spoken names that the round setup does not list cannot be caught; cases.md asks a person to check.
const swaps = [];
const addName = (name, tag) => {
  const n = String(name || '').trim();
  if (!n) return;
  swaps.push([n, tag]);
  for (const part of n.split(/\s+/)) if (part.length >= 3) swaps.push([part, tag]);
};
addName(round.aff && round.aff.d1, '1A'); addName(round.aff && round.aff.d2, '2A');
addName(round.neg && round.neg.d1, '1N'); addName(round.neg && round.neg.d2, '2N');
addName(round.aff && round.aff.team, 'Aff team'); addName(round.neg && round.neg.team, 'Neg team');
addName(round.tournament, 'the tournament'); addName(round.judge, 'the judge');
const extra = process.argv.indexOf('--scrub');
if (extra > 0) for (const n of String(process.argv[extra + 1] || '').split(',')) if (n.trim()) swaps.push([n.trim(), 'someone']);
swaps.sort((a, b) => b[0].length - a[0].length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scrub = (text) => swaps.reduce((t, [name, tag]) => t.replace(new RegExp('\\b' + esc(name) + '\\b', 'gi'), tag), String(text || ''));
const scrubDeep = (x) => (typeof x === 'string' ? scrub(x) : Array.isArray(x) ? x.map(scrubDeep) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, scrubDeep(v)])) : x);

const order = L.SPEECHES.map((s) => s.id);
const flowable = L.MAP_SPEECHES; // the speeches that get a flow column (no cross-ex)
const cases = [];
for (const speechId of flowable) {
  const words = String((round.transcripts || {})[speechId] || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS) continue;
  const before = new Set(order.slice(0, order.indexOf(speechId)));
  // The flow so far: only speeches before this one, as the judge would have it at that moment.
  const aiFlows = (round.aiFlows || []).map((sheet) => ({
    name: sheet.name,
    parts: Object.fromEntries(Object.entries(sheet.parts || {}).filter(([sp]) => before.has(sp))),
  })).filter((s) => Object.keys(s.parts).length);
  for (const cut of CUTS) {
    const n = Math.max(1, Math.round(words.length * cut));
    const snapshot = { topic: round.topic || '', aiFlows, transcripts: { [speechId]: words.slice(0, n).join(' ') } };
    const prompt = scrub(L.buildLiveFlowPrompt(scrubDeep(snapshot), speechId, []));
    cases.push({ id: speechId + '@' + Math.round(cut * 100), speech: speechId, cut, words: n, prompt });
  }
}

const out = new URL('../.data/live-flow/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('cases.jsonl', out), cases.map((c) => JSON.stringify(c)).join('\n') + '\n');
const fence = '`'.repeat(6);
const md = ['# Live-flow eval cases', '',
  `${cases.length} cases from one round (backup exported ${backup.exportedAt}). Debater, team, tournament and judge names are replaced.`,
  '**Please skim each transcript for names said out loud** (for example "my partner Sam"). Tell me any you find and I will scrub them.', '',
  '| id | speech | point in speech | words |', '|---|---|---|---|',
  ...cases.map((c) => `| ${c.id} | ${c.speech} | ${Math.round(c.cut * 100)}% | ${c.words} |`), '',
  ...cases.flatMap((c) => [`## ${c.id}`, '', fence, c.prompt, fence, ''])].join('\n');
writeFileSync(new URL('cases.md', out), md);
console.log(`Wrote ${cases.length} cases to evals/.data/live-flow/ (cases.jsonl, cases.md)`);
