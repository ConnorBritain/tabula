// Demo round file: a sample Public Forum round for the staged demo (?demo=pf). Data only, no code.
// Everything here is made up: the students, the schools, the tournament, the resolution and the evidence authors.
// The "AI" parts are saved replies in the same shape the real AI returns (logic/prompts.js schemas), so the demo
// runs them through the app's own code. The demo never calls an AI provider or the Tabula server.
// The round stores no coin flip, so the Pro speaks first (the default first side).
(function (root) {
  'use strict';
  const round = {
    format: 'pf',
    param: 'pf', // ?demo=pf opens this round
    round: {
      tournament: 'Sample Round (demo)',
      roundName: 'Round 3',
      judge: 'You',
      topic: 'Resolved: Towns should make public buses free to ride.',
      aff: { team: 'Ashgrove RT', d1: 'Rhea Tamsin', d2: 'Theo Varga' },
      neg: { team: 'Pinecrest LO', d1: 'Lena Okoro', d2: 'Oren Hale' },
    },
    // The flowed speeches in order (crossfire is not flowed). transcript: a short excerpt of each speech.
    // flow: the live AI flow reply for that speech (LIVE_FLOW_SCHEMA: sheets with brief, standard and detailed notes).
    speeches: [
      {
        id: 'Const1',
        transcript: 'Thank you judge. Rhea Tamsin for the Pro. Contention one: free buses get more people to work. Hollis twenty-two finds that when Brookvale made buses free, riders went up by a third, and most new riders were going to jobs. Contention two: free buses cut traffic and pollution. Darrow twenty-one shows every full bus takes about thirty cars off the road. So free buses help workers and clean the air. Please vote Pro.',
        flow: { sheets: [
          { sheet: 'Pro case',
            brief: 'C1: jobs, riders +1/3 (Hollis)\nC2: traffic + pollution, 30 cars per bus',
            standard: 'C1 Jobs: Hollis 22, Brookvale free buses, riders up a third, most going to work\nC2 Environment: Darrow 21, a full bus takes about 30 cars off the road',
            detailed: 'C1 Jobs: Hollis 22, when Brookvale made buses free riders went up by a third; most new riders were going to jobs\nC2 Environment: Darrow 21, every full bus takes about 30 cars off the road\nImpact: helps workers and cleans the air' },
        ] },
      },
      {
        id: 'Const2',
        transcript: 'Lena Okoro for the Con. Contention one: fares pay for service. Merrow twenty-three finds fares cover about a fifth of a small town bus budget, so going free means fewer routes or longer waits. Contention two: crowding. When buses are free, crowded routes get worse, and Quill twenty-two shows riders who already pay leave when buses are packed. A free bus that never comes helps no one. We are proud to oppose.',
        flow: { sheets: [
          { sheet: 'Con case',
            brief: 'C1: fares = 1/5 of budget, cuts\nC2: crowding drives riders away',
            standard: 'C1 Funding: Merrow 23, fares cover about a fifth of a small-town bus budget; free means fewer routes\nC2 Crowding: Quill 22, crowded free routes push paying riders away',
            detailed: 'C1 Funding: Merrow 23, fares cover about a fifth of a small-town bus budget, so going free means fewer routes or longer waits\nC2 Crowding: Quill 22, when buses are free crowded routes get worse and riders who already pay leave\nImpact: a free bus that never comes helps no one' },
        ] },
      },
      {
        id: 'Reb1',
        transcript: 'Theo Varga for the Pro, on their case. On funding: Merrow is about big systems; in small towns fare collection itself costs almost as much as it brings in, so the loss is tiny. On crowding: crowding means more riders, which proves our first contention, and towns add buses on busy routes. Their own Quill card says riders leave only when there is no added service.',
        flow: { sheets: [
          { sheet: 'Con case',
            brief: 'C1: collection costs ~= fares\nC2: crowding = more riders; add buses',
            standard: 'C1: in small towns fare collection costs almost what it brings in; loss is tiny\nC2: crowding proves Pro C1; towns add buses; Quill says riders leave only without added service',
            detailed: 'C1: Merrow is about big systems; in small towns fare collection costs almost as much as it brings in\nC2: crowding means more riders, which proves Pro C1; towns add buses on busy routes\nTurn on Quill: riders leave only when no service is added' },
        ] },
      },
      {
        id: 'Reb2',
        transcript: 'Oren Hale for the Con. First, back to our case: they say collection is costly, but they read no evidence, and Merrow is a small town study. On their case: Hollis counts riders, not jobs; many new riders were students and people who used to walk. And Darrow assumes a full bus, but most small town buses run half empty, so the traffic benefit is tiny.',
        flow: { sheets: [
          { sheet: 'Con case',
            brief: 'No evidence on collection cost\nMerrow = small towns',
            standard: 'Frontline C1: Pro has no evidence on collection cost; Merrow studied small towns',
            detailed: 'Frontline C1: the Pro read no evidence that collection is costly, and Merrow is a small-town study' },
          { sheet: 'Pro case',
            brief: 'C1: riders not jobs\nC2: buses half empty',
            standard: 'C1: Hollis counts riders, not jobs; many were students or former walkers\nC2: Darrow assumes a full bus; small-town buses run half empty',
            detailed: 'C1: Hollis counts riders, not jobs; many new riders were students and people who used to walk\nC2: Darrow assumes a full bus, but most small-town buses run half empty, so the traffic gain is tiny' },
        ] },
      },
      {
        id: 'Sum1',
        transcript: 'Rhea for the Pro. Extend contention one. Even if some new riders were students, Hollis says most were going to jobs; they never answered that number. On their funding point, a fifth of the budget is real, but towns already fund roads with taxes, and our weighing is simple: more people reaching work every day outweighs a small budget cost. Crowding only proves more people ride.',
        flow: { sheets: [
          { sheet: 'Pro case',
            brief: 'Extend C1: most went to jobs',
            standard: 'Extend C1: Hollis says most new riders were going to jobs; not answered',
            detailed: 'Extend C1: even if some riders were students, Hollis says most were going to jobs, and the Con never answered that number' },
          { sheet: 'Con case',
            brief: 'Taxes fund roads\nWeigh: jobs > budget',
            standard: 'C1: towns already fund roads with taxes\nWeighing: more people reaching work daily outweighs a small budget cost',
            detailed: 'C1: a fifth of the budget is real, but towns already fund roads with taxes\nWeighing: more people reaching work every day outweighs a small budget cost\nC2: crowding only proves more people ride' },
        ] },
      },
      {
        id: 'Sum2',
        transcript: 'Lena for the Con. The key question is service. Extend Merrow: losing a fifth of the budget means routes get cut, and a cut route hurts the same workers they talk about. They answered with taxes, but never showed a town raising taxes to replace fares. Weigh probability: our cuts are certain, while their jobs number counts riders, not jobs gained.',
        flow: { sheets: [
          { sheet: 'Con case',
            brief: 'Extend Merrow: cuts hurt workers\nNo town raised taxes',
            standard: 'Extend C1 Merrow: losing a fifth of the budget cuts routes and hurts the same workers; Pro never showed a town raising taxes',
            detailed: 'Extend C1 Merrow: losing a fifth of the budget means routes get cut, which hurts the same workers\nThe Pro never showed a town raising taxes to replace fares\nWeighing: probability, cuts are certain' },
          { sheet: 'Pro case',
            brief: 'Riders not jobs gained',
            standard: 'C1: the jobs number counts riders, not jobs gained',
            detailed: 'C1: their jobs number counts riders, not jobs gained, so it is less likely than the cuts' },
        ] },
      },
      {
        id: 'FF1',
        transcript: 'Theo for the Pro, final focus. Two reasons to vote Pro. First, workers: most new riders went to jobs, and that number stands. Second, their cuts are not certain: towns choose to fund buses, and fare collection costs money too. Weigh scope: every rider gains every day, and the Con only gives a maybe. Vote Pro.',
        flow: { sheets: [
          { sheet: 'Pro case',
            brief: 'Workers: number stands\nScope: every rider daily',
            standard: 'Workers: most new riders went to jobs; the number stands\nWeighing: scope, every rider gains every day',
            detailed: 'Workers: most new riders went to jobs, and that number stands\nWeighing: scope, every rider gains every day, while the Con offers a maybe' },
          { sheet: 'Con case',
            brief: 'Cuts not certain',
            standard: 'C1: cuts are not certain; towns choose to fund buses; collection costs money too',
            detailed: 'C1: their cuts are not certain, because towns choose to fund buses and fare collection costs money too' },
        ] },
      },
      {
        id: 'FF2',
        transcript: 'Oren for the Con, final focus. The Pro never read evidence that collection costs as much as fares; that point was only a claim from their rebuttal. Our Merrow card is the only evidence on small town budgets, and it says a fifth of the money goes away. Fewer routes hurt the same workers. Weigh probability over scope. Please vote Con.',
        flow: { sheets: [
          { sheet: 'Con case',
            brief: 'Collection cost: no evidence\nMerrow only small-town card',
            standard: 'Pro never read evidence on collection cost; Merrow is the only small-town budget card: a fifth goes away',
            detailed: 'The Pro never read evidence that collection costs as much as fares\nMerrow is the only evidence on small-town budgets: a fifth of the money goes away\nWeighing: probability over scope' },
        ] },
      },
    ],
    // The Live Eval reply after the last speech (EVAL_SCHEMA). In the data the Pro is "aff" and the Con is "neg".
    eval: {
      leaning: { side: 'aff', confidence: 'low', why: 'The Con never answered that most new riders were going to jobs. The Con\'s funding cut is backed by evidence but was weighed late.' },
      summary: 'A close round on funding against access to work. The Pro\'s Hollis number on jobs went unanswered after the rebuttals. The Con has the only evidence on small-town budgets. The deciding issue is how you weigh a certain budget loss against a large daily gain for riders.',
      key_issues: [
        { issue: 'Hollis: most new riders went to jobs', ahead: 'aff', note: 'Not answered after the second rebuttal.' },
        { issue: 'Merrow: fares are a fifth of the budget', ahead: 'neg', note: 'The only evidence; the Pro answered with a claim.' },
        { issue: 'Crowding', ahead: 'even', note: 'Dropped by both teams after the summaries.' },
        { issue: 'Weighing: scope vs probability', ahead: 'unclear', note: 'Both teams weighed; you decide which counts more.' },
      ],
      watch_for: [
        'Whether the Pro\'s collection-cost answer needed evidence.',
        'How you weigh a certain budget loss against a daily gain for many riders.',
      ],
      aff_needs: 'The round is over. The Pro needed evidence for the collection-cost answer.',
      neg_needs: 'The round is over. The Con needed to answer the jobs number directly in the summary.',
      feedback: [
        { speaker: 'Pro1', so_far: 'A clear constructive and a summary that extended the key number.', strength: 'Kept the jobs number alive.', fix: 'Weigh earlier, in the summary.', points: '28.7' },
        { speaker: 'Pro2', so_far: 'A quick rebuttal and a focused final focus.', strength: 'The turn on Quill.', fix: 'Read evidence for the collection-cost answer.', points: '28.4' },
        { speaker: 'Con1', so_far: 'A well-built constructive and a clear summary.', strength: 'Framed the round on service.', fix: 'Answer the jobs number directly.', points: '28.5' },
        { speaker: 'Con2', so_far: 'A good frontline and a clean final focus.', strength: 'Pointed out the missing evidence.', fix: 'Start the probability weighing in the rebuttal.', points: '28.2' },
      ],
    },
    // The ballot draft reply (BALLOT_SCHEMA for PF: points for the four debaters, no ranks).
    ballot: {
      winner: 'aff',
      confidence: 'low',
      points: { Pro1: 28.7, Pro2: 28.4, Con1: 28.5, Con2: 28.2 },
      rfd: 'I vote Pro. The round came down to jobs against funding. The Con had the better evidence on budgets: Merrow was the only small-town card, and the Pro answered it with a claim. But the Con never answered that most new riders were going to jobs, and the Pro weighed that gain by scope from the summary on. The Con\'s probability weighing came late, in the final focus. A daily gain for many workers outweighed a budget loss that towns can choose to cover.',
      aff_comments: 'Rhea and Theo: a clear case and a summary that kept the jobs number alive. Read evidence for the collection-cost answer, and weigh in the summary, not only in the final focus.',
      neg_comments: 'Lena and Oren: strong evidence on budgets and a good frontline. Answer the jobs number directly, and start the probability weighing in the rebuttal.',
      points_reasoning: 'Rhea (28.7): the clearest speeches and the key extension.\nLena (28.5): strong framing.\nTheo (28.4): a good turn, but no evidence on collection.\nOren (28.2): clean, but the weighing came late.',
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = round;
  else (root.TabulaDemoRounds = root.TabulaDemoRounds || []).push(round);
})(typeof window !== 'undefined' ? window : globalThis);
