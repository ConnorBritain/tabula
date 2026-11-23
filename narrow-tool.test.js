// The narrow-tool rules for the AI (docs/design/AI-POLICY.md §9: New York GBL Art. 48, from 2027-01-01): stay on the
// round, no first-person views, no praise of the judge, no persona. Hosted AI's prompts live on the server
// (tabula-cloud narrow-tool.test.ts); these are the own-key prompts and the demo's saved answers.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');

// Why: own-key judges use the same tool; a prompt without the rule could be steered off the round or speak as a
// person, which would make the AI a "companion" under NY Art. 48.
test('every own-key system text, in every format, carries the narrow-tool line', () => {
  for (const id of L.FORMAT_IDS) {
    const P = L.promptsFor(L.getFormat(id));
    for (const k of ['judgeSystem', 'liveFlowSystem', 'evalSystem', 'analysisSystem']) assert.ok(P[k].includes(L.NARROW_TOOL), id + ' ' + k);
    // The ballot draft uses judgeSystem up to its reply structure (js/decide.js BALLOT_SYSTEM): the line must be in that part.
    assert.ok(P.judgeSystem.split('\n\nReply in this exact structure')[0].includes(L.NARROW_TOOL), id + ' ballot part');
  }
  assert.match(L.NARROW_TOOL, /Stay on this round only/);
  assert.match(L.NARROW_TOOL, /no "I think", "I feel", "I believe" or "in my opinion"/);
  assert.match(L.NARROW_TOOL, /no praise or encouragement\s+aimed at the judge/);
});

// Why: a role is a persona, which the rules forbid; only "you help/flow/analyse ... for a judge" is allowed.
test('no own-key system text gives the AI a name or a role such as a coach', () => {
  for (const id of L.FORMAT_IDS) {
    const P = L.promptsFor(L.getFormat(id));
    for (const k of ['judgeSystem', 'liveFlowSystem', 'evalSystem', 'analysisSystem']) assert.doesNotMatch(P[k], /\byou (?:coach|are an? )|\bmy name\b|\bI am\b/i, id + ' ' + k);
  }
});

// Why: the demo shows saved answers as AI output to people trying Tabula; they must follow the same rules.
test('no demo answer has a first-person view or praise of the reader', () => {
  const dir = path.join(__dirname, 'demo');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(text, /\bI\s+(?:think|feel|believe)\b|\bin\s+my\s+(?:opinion|view)\b/i, f);
    assert.doesNotMatch(text, /\b(?:great|excellent|amazing)\s+(?:job|work)\b|\bwell\s+done\b|\bproud\s+of\s+you\b/i, f);
  }
});
