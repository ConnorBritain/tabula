// Format file: NSDA high school Lincoln-Douglas (LD), version 1. Data only, no code (docs/architecture/ARCHITECTURE.md §9).
// A published version never changes: a round renders with the version it was judged under. To change the format,
// copy this file to ld.v2.js, raise "version", and add the new file to logic/format.js and formats.test.js.
// Speech times: AC 6, CX 3, NC 7, CX 3, 1AR 4, NR 6, 2AR 3; 4 minutes prep per debater.
(function (root) {
  'use strict';
  const format = {
    id: 'ld',
    version: 1,
    name: 'Lincoln-Douglas (LD)',
    level: 'hs',
    sides: { aff: { label: 'Aff', name: 'Affirmative' }, neg: { label: 'Neg', name: 'Negative' } },
    // One debater per side. The tag is not "Aff": the AI reply gets names put back for tags, and "Aff" is also a word.
    speakers: [
      { id: 'Aff', label: 'Aff', side: 'aff', slot: 'd1', tag: 'Aff debater' },
      { id: 'Neg', label: 'Neg', side: 'neg', slot: 'd1', tag: 'Neg debater' },
    ],
    speeches: [
      { id: 'AC', label: 'AC', side: 'aff', seconds: 360, speaker: 'Aff', kind: 'speech', column: 0 },
      { id: 'CX-AC', label: 'CX of the AC (Neg asks)', side: 'aff', seconds: 180, speaker: 'Aff', kind: 'cx', column: null },
      { id: 'NC', label: 'NC', side: 'neg', seconds: 420, speaker: 'Neg', kind: 'speech', column: 1 },
      { id: 'CX-NC', label: 'CX of the NC (Aff asks)', side: 'neg', seconds: 180, speaker: 'Neg', kind: 'cx', column: null },
      { id: '1AR', label: '1AR', side: 'aff', seconds: 240, speaker: 'Aff', kind: 'speech', column: 2 },
      { id: 'NR', label: 'NR', side: 'neg', seconds: 360, speaker: 'Neg', kind: 'speech', column: 3 },
      { id: '2AR', label: '2AR', side: 'aff', seconds: 180, speaker: 'Aff', kind: 'speech', column: 4 },
    ],
    flowColumns: [
      { label: 'AC', side: 'aff' },
      { label: 'NC', side: 'neg' },
      { label: '1AR', side: 'aff' },
      { label: 'NR', side: 'neg' },
      { label: '2AR', side: 'aff' },
    ],
    defaultSheets: ['Framework', 'AC', 'NC'],
    // perDebater: one prep clock per debater (here one per side, since LD is 1 v 1).
    prep: { seconds: 240, mode: 'perDebater' },
    // LD ballots give speaker points but no speaker ranks (two debaters, and the winner is already picked).
    ballot: { points: { min: 25, max: 30 }, speakerRanks: false },
    timesNote: 'NSDA LD uses 6-3-7-3-4-6-3 speeches and 4 minutes prep per debater.',
    ai: {
      kind: 'high school Lincoln-Douglas',
      abbr: 'LD',
      transcribeHint: 'High school Lincoln-Douglas debate. Terms: affirmative, negative, AC, NC, 1AR, NR, 2AR, '
        + 'cross-ex, value, value criterion, criterion, framework, standard, contention, burden, resolution, '
        + 'utilitarianism, deontology, Kant, social contract, theory, topicality, T, interpretation, violation, '
        + 'kritik, K, counterplan, CP, disad, DA, link, impact, weighing, extend, turn, card, tag.',
      rules: 'Weigh the framework first (each side\'s value and criterion, or standard): decide which framework wins, then which side better meets it. New arguments in the NR or 2AR do not count; the 1AR may answer new arguments from the NC.',
      evalNorms: 'Remember the norms: the NR and 2AR cannot make new arguments; dropped arguments are conceded; the 1AR must answer the whole NC in less time, so short answers are normal; framework (value and criterion) usually decides how offense is weighed.',
      flowSheets: 'Put each side\'s value and criterion (or standard) on a sheet named "Framework". Put the AC\'s contentions on a sheet named "AC" and the NC\'s contentions on a sheet named "NC". A new position gets a new sheet named like "T - Nebel", "Theory - Spec", "K - Cap" or "CP - States".',
      pointsSpread: 'Separate the two debaters by how well each one did: if one was clearly better, by at least 0.3-0.5. Give both the same points only when they were truly even.',
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = format;
  else (root.TabulaFormats = root.TabulaFormats || []).push(format);
})(typeof window !== 'undefined' ? window : globalThis);
