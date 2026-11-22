// What a judge sees of a policy round and an LD round, as plain data: the format's speeches, columns, debaters,
// prep and ballot, and the text the logic makes from one sample round of each (clock lines, chip, ballot check,
// decision, print sheet, copy blocks, AI prompt parts). formats-pf.test.js compares it with
// fixtures/format-baseline.json, which this same function made from the code before coin-flip order and crossfire
// rows existed (commit 5f166d8). Takes the logic API (require('../logic.js')) so it can run on any copy of the code.
'use strict';

function snapshot(L) {
  const plain = (x) => JSON.parse(JSON.stringify(x));
  const rounds = {
    'policy-hs': {
      id: 'r1', tournament: 'T', roundName: 'R1', judge: 'J', topic: 'Res', aff: { team: 'Lake AB', d1: 'Ann', d2: 'Bo' },
      neg: { team: 'Hill CD', d1: 'Cy', d2: 'Di' }, transcripts: { '1AC': 'plan text', 'CX-1A': 'question' },
      flows: [{ name: 'Case', cells: { 0: 'adv', 1: 'no link' } }], aiFlows: [], timeLeft: { '1AC': 0, 'CX-1A': 30 },
      prepSeconds: 480, prepLeft: { aff: 300, neg: 480 },
      ballot: { winner: 'aff', pts: { '1A': '27', '2A': '28', '1N': '29', '2N': '28.5' }, ranks: { '1A': 4, '2A': 3, '1N': 1, '2N': 2 }, rfd: 'Case.', affFb: 'a', negFb: 'n' },
    },
    ld: {
      id: 'r2', format: 'ld', formatVersion: 1, tournament: 'T', roundName: 'R2', judge: 'J', topic: 'Res',
      aff: { team: 'Lake AB', d1: 'Ann', d2: '' }, neg: { team: 'Hill CD', d1: 'Cy', d2: '' },
      transcripts: { AC: 'my value', 'CX-AC': 'question' }, flows: [{ name: 'Framework', cells: { 0: 'V: justice' } }], aiFlows: [],
      timeLeft: { AC: 0 }, prepSeconds: 240, prepLeft: { Aff: 200, Neg: 240 },
      ballot: { winner: 'neg', pts: { Aff: '29', Neg: '28' }, ranks: {}, rfd: 'Framework.', affFb: 'a', negFb: 'n' },
    },
  };
  const out = {};
  for (const [id, round] of Object.entries(rounds)) {
    const fmt = L.formatOf(round);
    const ids = fmt.speeches.map((s) => s.id);
    out[id] = {
      format: plain(fmt),
      formatFields: L.formatFields(fmt),
      prepClocks: L.prepClocks(fmt),
      speechLines: ids.map((s) => L.speechLine(s, fmt)),
      chips: ids.map((s) => L.chipText({ onFlow: false, run: { id: s, left: 20 }, prep: null, format: fmt })),
      prepChips: ['aff', 'neg'].map((side) => L.chipText({ onFlow: false, run: null, prep: { side, left: 40 }, format: fmt })),
      steps: [L.stepSpeechState(0, -1, fmt), L.stepSpeechState(ids.length - 1, 1, fmt)],
      checkBallot: L.checkBallot(round.ballot, { range: { min: 25, max: 30 }, format: fmt }),
      lowPoint: L.checkBallot({ winner: 'aff', pts: Object.fromEntries(fmt.speakerIds.map((s, i) => [s, String(26 + i)])), ranks: {}, rfd: '' }, { format: fmt }),
      ballotFields: L.ballotFields(fmt),
      draftGroups: L.draftGroups(fmt),
      fieldLabels: ['winner', 'rfd', 'affFb', 'negFb', ...fmt.speakerIds.map((s) => 'pts.' + s)].map((f) => L.fieldLabel(f, fmt)),
      decision: L.decisionText(round),
      blocks: L.tournamentBlocks(round, { tips: true }),
      print: L.printModel(round, { range: { min: 25, max: 30 } }),
      tally: L.issueTally([{ ahead: 'aff' }, { ahead: 'neg' }, { ahead: 'even' }], fmt),
      judgePrompt: L.buildJudgePrompt(round, []),
      speechesSoFar: L.speechesSoFar(round),
      docSpeech: [L.docSpeech({ side: 'aff' }, fmt), L.docSpeech({ side: 'neg' }, fmt)],
      prepUsed: L.prepUsed(round),
      hostedBody: L.hostedAiBody(round, { callId: 'c' }),
      savedBallot: L.savedBallotView(L.savedBallotEntry(round, 'now', { min: 25, max: 30 })),
      copy: L.formatCopy(fmt),
    };
  }
  return out;
}

module.exports = { snapshot };
