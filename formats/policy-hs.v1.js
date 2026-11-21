// Format file: NSDA high school policy (CX), version 1. Data only, no code (docs/architecture/ARCHITECTURE.md §9).
// A published version never changes: a round renders with the version it was judged under. To change the format,
// copy this file to policy-hs.v2.js, raise "version", and add the new file to logic/format.js and formats.test.js.
// It is a script, not .json, so the page can load it with a plain <script> tag before the logic parts (no fetch,
// no build step). Node and the server's generator read it with require().
(function (root) {
  'use strict';
  const format = {
    id: 'policy-hs',
    version: 1,
    name: 'Policy (CX)',
    level: 'hs',
    // The side keys name the colour tokens (--aff, --neg). Every format so far has these two sides.
    sides: { aff: { label: 'Aff', name: 'Affirmative' }, neg: { label: 'Neg', name: 'Negative' } },
    // slot: which name box in Round setup holds the debater (round.aff.d1, ...). tag: the word that stands in for
    // the debater's name in text sent to an AI (it is the id when there is no tag).
    speakers: [
      { id: '1A', label: '1A', side: 'aff', slot: 'd1' },
      { id: '2A', label: '2A', side: 'aff', slot: 'd2' },
      { id: '1N', label: '1N', side: 'neg', slot: 'd1' },
      { id: '2N', label: '2N', side: 'neg', slot: 'd2' },
    ],
    // CX pairs follow the usual order: 2N asks 1A, 1A asks 1N, 1N asks 2A, 2A asks 2N.
    // column: the flow column the speech fills (null: not flowed). aliases: other words in a doc's file name.
    speeches: [
      { id: '1AC', label: '1AC', side: 'aff', seconds: 480, speaker: '1A', kind: 'speech', column: 0 },
      { id: 'CX-1A', label: 'CX of 1A (2N asks)', side: 'aff', seconds: 180, speaker: '1A', kind: 'cx', column: null },
      { id: '1NC', label: '1NC', side: 'neg', seconds: 480, speaker: '1N', kind: 'speech', column: 1 },
      { id: 'CX-1N', label: 'CX of 1N (1A asks)', side: 'neg', seconds: 180, speaker: '1N', kind: 'cx', column: null },
      { id: '2AC', label: '2AC', side: 'aff', seconds: 480, speaker: '2A', kind: 'speech', column: 2 },
      { id: 'CX-2A', label: 'CX of 2A (1N asks)', side: 'aff', seconds: 180, speaker: '2A', kind: 'cx', column: null },
      { id: '2NC', label: '2NC', side: 'neg', seconds: 480, speaker: '2N', kind: 'speech', column: 3, aliases: ['block'] },
      { id: 'CX-2N', label: 'CX of 2N (2A asks)', side: 'neg', seconds: 180, speaker: '2N', kind: 'cx', column: null },
      { id: '1NR', label: '1NR', side: 'neg', seconds: 300, speaker: '1N', kind: 'speech', column: 3 },
      { id: '1AR', label: '1AR', side: 'aff', seconds: 300, speaker: '1A', kind: 'speech', column: 4 },
      { id: '2NR', label: '2NR', side: 'neg', seconds: 300, speaker: '2N', kind: 'speech', column: 5 },
      { id: '2AR', label: '2AR', side: 'aff', seconds: 300, speaker: '2A', kind: 'speech', column: 6 },
    ],
    // The 2NC and 1NR share one column ("the block").
    flowColumns: [
      { label: '1AC', side: 'aff' },
      { label: '1NC', side: 'neg' },
      { label: '2AC', side: 'aff' },
      { label: 'Block (2NC / 1NR)', side: 'neg' },
      { label: '1AR', side: 'aff' },
      { label: '2NR', side: 'neg' },
      { label: '2AR', side: 'aff' },
    ],
    defaultSheets: ['Case', 'T', 'DA 1', 'CP', 'K'],
    // perTeam: one prep clock per side, shared by the team's two debaters.
    prep: { seconds: 480, mode: 'perTeam' },
    ballot: { points: { min: 25, max: 30 }, speakerRanks: true },
    timesNote: 'NSDA uses 8-3-5 speeches and 8 minutes prep. Many local leagues use 4 or 5.',
    // What the AI is told about this format. The hosted AI gets only the id and version; the server's copy of this
    // block is generated from this same file at deploy.
    ai: {
      kind: 'high school policy',
      abbr: 'CX',
      transcribeHint: 'High school policy debate. Terms: affirmative, negative, 1AC, 1NC, 2AC, 2NC, 1NR, 1AR, 2NR, 2AR, '
        + 'cross-ex, plan text, inherency, harms, solvency, advantage, topicality, T, interpretation, violation, '
        + 'counterplan, CP, disad, DA, uniqueness, link, internal link, impact, kritik, K, alternative, perm, '
        + 'framework, condo, extend, turn, card, tag, status quo, USFG.',
      rules: 'New arguments in the 2NR or 2AR do not count; the 1AR may answer new arguments from the block.',
      evalNorms: 'Remember the norms: the 2NR and 2AR cannot make new arguments; dropped arguments are conceded; the block (2NC + 1NR) splits the neg\'s positions.',
      flowSheets: 'Put the 1AC on a sheet named "Case". A new off-case position gets a new sheet named like "DA - Econ", "CP - States", "K - Cap" or "T - Substantial".',
      pointsSpread: 'Spread the four debaters by how well each one did: separate speakers who were not equally good by at least 0.3-0.5, '
        + 'and in most rounds the best and worst speaker should be 1.0 or more apart. Never put everyone within a few tenths.',
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = format;
  else (root.TabulaFormats = root.TabulaFormats || []).push(format);
})(typeof window !== 'undefined' ? window : globalThis);
