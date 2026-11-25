// Format file: NSDA high school Public Forum (PF), version 1. Data only, no code (docs/architecture/ARCHITECTURE.md §9).
// A published version never changes: a round renders with the version it was judged under. To change the format,
// copy this file to pf.v2.js, raise "version", and add the new file to logic/format.js and formats.test.js.
// Speech times: constructive 4 + 4, crossfire 3, rebuttal 4 + 4, crossfire 3, summary 3 + 3,
// grand crossfire 3, final focus 2 + 2; 3 minutes prep per team.
(function (root) {
  'use strict';
  const format = {
    id: 'pf',
    version: 1,
    name: 'Public Forum (PF)',
    level: 'hs',
    // The side keys name the colour tokens (--aff, --neg): Pro uses the Aff colour, Con the Neg colour.
    sides: { aff: { label: 'Pro', name: 'Pro' }, neg: { label: 'Con', name: 'Con' } },
    // A coin flip picks which side speaks first. Speeches and flow columns name their team ('first' or 'second'),
    // and a speech names its debater by name box (slot); logic/format.js seats them for the round's first side.
    order: 'coinFlip',
    // The first speaker (d1) gives the constructive and the summary; the second speaker (d2) the rebuttal and the
    // final focus. The tags are not "Pro"/"Con": the AI reply gets names put back for tags, and those are also words.
    speakers: [
      { id: 'Pro1', label: 'Pro 1', side: 'aff', slot: 'd1', tag: 'Pro first speaker' },
      { id: 'Pro2', label: 'Pro 2', side: 'aff', slot: 'd2', tag: 'Pro second speaker' },
      { id: 'Con1', label: 'Con 1', side: 'neg', slot: 'd1', tag: 'Con first speaker' },
      { id: 'Con2', label: 'Con 2', side: 'neg', slot: 'd2', tag: 'Con second speaker' },
    ],
    // "{side}" in a label becomes the side's label (Pro or Con) once the round knows who speaks first.
    // A crossfire row lists its debaters (both sides ask and answer), is timed, and is not flowed.
    speeches: [
      { id: 'Const1', label: '{side} Constructive', team: 'first', slot: 'd1', seconds: 240, kind: 'speech', column: 0 },
      { id: 'Const2', label: '{side} Constructive', team: 'second', slot: 'd1', seconds: 240, kind: 'speech', column: 1 },
      { id: 'CF1', label: 'Crossfire (first speakers)', speakers: ['Pro1', 'Con1'], seconds: 180, kind: 'crossfire', column: null },
      { id: 'Reb1', label: '{side} Rebuttal', team: 'first', slot: 'd2', seconds: 240, kind: 'speech', column: 2 },
      { id: 'Reb2', label: '{side} Rebuttal', team: 'second', slot: 'd2', seconds: 240, kind: 'speech', column: 3 },
      { id: 'CF2', label: 'Crossfire (second speakers)', speakers: ['Pro2', 'Con2'], seconds: 180, kind: 'crossfire', column: null },
      { id: 'Sum1', label: '{side} Summary', team: 'first', slot: 'd1', seconds: 180, kind: 'speech', column: 4 },
      { id: 'Sum2', label: '{side} Summary', team: 'second', slot: 'd1', seconds: 180, kind: 'speech', column: 5 },
      { id: 'GCF', label: 'Grand Crossfire (all four)', speakers: ['Pro1', 'Pro2', 'Con1', 'Con2'], seconds: 180, kind: 'crossfire', column: null },
      { id: 'FF1', label: '{side} Final Focus', team: 'first', slot: 'd2', seconds: 120, kind: 'speech', column: 6 },
      { id: 'FF2', label: '{side} Final Focus', team: 'second', slot: 'd2', seconds: 120, kind: 'speech', column: 7 },
    ],
    flowColumns: [
      { label: '{side} Constructive', team: 'first' },
      { label: '{side} Constructive', team: 'second' },
      { label: '{side} Rebuttal', team: 'first' },
      { label: '{side} Rebuttal', team: 'second' },
      { label: '{side} Summary', team: 'first' },
      { label: '{side} Summary', team: 'second' },
      { label: '{side} Final Focus', team: 'first' },
      { label: '{side} Final Focus', team: 'second' },
    ],
    defaultSheets: ['Pro case', 'Con case'],
    // perTeam: one prep clock per side, shared by the team's two debaters.
    prep: { seconds: 180, mode: 'perTeam' },
    // PF ballots give the win and speaker points, with no speaker ranks (lay judges are common).
    ballot: { points: { min: 25, max: 30 }, speakerRanks: false },
    timesNote: 'NSDA PF uses 4-minute constructives and rebuttals, 3-minute crossfires and summaries, 2-minute final focus speeches and 3 minutes prep per team. A coin flip picks the side and who speaks first.',
    ai: {
      kind: 'high school Public Forum',
      abbr: 'PF',
      transcribeHint: 'High school Public Forum debate. Terms: Pro, Con, constructive, rebuttal, summary, final focus, '
        + 'crossfire, grand crossfire, contention, subpoint, framework, weighing, magnitude, probability, timeframe, '
        + 'scope, link, impact, turn, delink, extend, frontline, warrant, evidence, card, paraphrase, resolution.',
      rules: 'In the decision line and the data, the Pro side is called AFF and the Con side is called NEG. '
        + 'Crossfire is not flowed: a crossfire answer counts only when a later speech uses it. '
        + 'The final focus may not make new arguments, and an argument in the final focus counts only if the summary extended it. '
        + 'The second-speaking team\'s rebuttal should answer the other team\'s rebuttal (frontline). Weighing decides close rounds.',
      evalNorms: 'Remember the norms: no new arguments in the final focus; the summary must extend what the final focus goes for; '
        + 'dropped arguments are conceded; crossfire is not flowed; many PF judges are lay judges, so clear weighing and plain explanation matter.',
      flowSheets: 'Put the Pro constructive\'s contentions on a sheet named "Pro case" and the Con constructive\'s contentions on a sheet named "Con case". '
        + 'Answers go on the sheet of the case they answer. A framework or weighing argument that runs across both cases can get a sheet named "Weighing".',
      pointsSpread: 'Spread the four debaters by how well each one did: separate speakers who were not equally good by at least 0.3-0.5. '
        + 'Never put everyone within a few tenths.',
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = format;
  else (root.TabulaFormats = root.TabulaFormats || []).push(format);
})(typeof window !== 'undefined' ? window : globalThis);
