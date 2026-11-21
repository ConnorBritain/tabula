// Demo round file: a sample Lincoln-Douglas round for the staged demo (?demo=ld). Data only, no code.
// Everything here is made up: the students, the schools, the tournament, the resolution and the evidence authors.
// The "AI" parts are saved replies in the same shape the real AI returns (logic/prompts.js schemas), so the demo
// runs them through the app's own code. The demo never calls an AI provider or the Tabula server.
(function (root) {
  'use strict';
  const round = {
    format: 'ld',
    param: 'ld', // ?demo=ld opens this round
    round: {
      tournament: 'Sample Round (demo)',
      roundName: 'Round 2',
      judge: 'You',
      topic: 'Resolved: Public libraries ought to end late fees.',
      aff: { team: 'Brindlewood JF', d1: 'Jonah Fairweather', d2: '' },
      neg: { team: 'Quillmont MC', d1: 'Mira Castellane', d2: '' },
    },
    // The speeches in order. transcript: what speech-to-text writes (a short excerpt of each speech).
    // flow: the live AI flow reply for that speech (LIVE_FLOW_SCHEMA: sheets with brief, standard and detailed notes).
    speeches: [
      {
        id: 'AC',
        transcript: 'Thank you judge. Jonah Fairweather, affirming. My value is justice, and my criterion is equal access to public goods, because a public library exists to serve everyone the same way. Contention one: fees push out the poorest readers. Marlo twenty-two finds that one in five cardholders in low-income areas has a blocked card because of fines. Contention two: fees do not work. Libraries that ended fees saw returns stay the same or go up, Penhallow twenty-three, because people came back once their debt was cleared. So ending fees serves equal access with no cost to the collection.',
        flow: { sheets: [
          { sheet: 'Framework',
            brief: 'V: justice\nC: equal access to public goods',
            standard: 'Value: justice\nCriterion: equal access to public goods; a public library must serve everyone the same way',
            detailed: 'Value: justice\nCriterion: equal access to public goods\nWhy: a public library exists to serve everyone the same way' },
          { sheet: 'AC',
            brief: 'C1: fees push out the poor (1 in 5 blocked)\nC2: fees don\'t work; returns same or up',
            standard: 'C1 Access: Marlo 22, 1 in 5 cardholders in low-income areas blocked by fines\nC2 Fees fail: Penhallow 23, libraries that ended fees saw returns stay the same or rise',
            detailed: 'C1 Access: Marlo 22, one in five cardholders in low-income areas has a blocked card because of fines\nC2 Fees fail: Penhallow 23, libraries that ended fees saw returns stay the same or go up\nWhy C2: people came back once their debt was cleared\nImpact: equal access with no cost to the collection' },
        ] },
      },
      {
        id: 'NC',
        transcript: 'Mira Castellane, negating. I accept justice but offer a better criterion: fairness to the community, because books are shared, and one person keeping a book takes it from everyone else. Contention one: fees protect shared books. Without a cost, popular books sit out for weeks, Okafor twenty-one. Contention two: fees fund programs. In small towns, fines pay for summer reading. On the AC: Marlo counts blocked cards, but most blocks are for lost books, not late fees, so ending late fees does not unblock them.',
        flow: { sheets: [
          { sheet: 'Framework',
            brief: 'Accepts justice\nC: fairness to the community',
            standard: 'Accepts justice\nCriterion: fairness to the community; books are shared, keeping one takes it from everyone',
            detailed: 'Accepts the value of justice\nCriterion: fairness to the community\nWhy: books are shared; one person keeping a book takes it from everyone else' },
          { sheet: 'NC',
            brief: 'C1: fees protect shared books\nC2: fines fund summer reading',
            standard: 'C1 Shared books: Okafor 21, with no cost popular books sit out for weeks\nC2 Funding: in small towns fines pay for summer reading',
            detailed: 'C1 Shared books: Okafor 21, without a cost popular books sit out for weeks\nC2 Funding: in small towns, fines pay for summer reading programs' },
          { sheet: 'AC',
            brief: 'C1: blocks are for lost books, not late fees',
            standard: 'C1: Marlo counts blocked cards, but most blocks are for lost books, not late fees',
            detailed: 'C1: Marlo counts blocked cards, but most blocks are for lost books, not late fees -> ending late fees does not unblock them' },
        ] },
      },
      {
        id: '1AR',
        transcript: 'Jonah for the aff. Framework: her criterion collapses into mine; fairness to the community means everyone can use the library, which is equal access. On her contention one, Penhallow already answers it: returns did not drop. On contention two, fines are under one percent of library budgets, so towns fund summer reading other ways. On lost books: extend Marlo, the study separates late fees from lost-book charges, and late fees alone block one in eight cards.',
        flow: { sheets: [
          { sheet: 'Framework',
            brief: 'Her C collapses into mine',
            standard: 'Fairness to the community = everyone can use the library = equal access',
            detailed: 'Her criterion collapses into the aff\'s: fairness to the community means everyone can use the library, which is equal access' },
          { sheet: 'NC',
            brief: 'C1: Penhallow, returns didn\'t drop\nC2: fines < 1% of budgets',
            standard: 'C1: Penhallow answers it; returns did not drop\nC2: fines are under 1% of library budgets; towns fund programs other ways',
            detailed: 'C1: Penhallow already answers it; returns did not drop after fees ended\nC2: fines are under 1% of library budgets, so towns fund summer reading other ways' },
          { sheet: 'AC',
            brief: 'Marlo separates late vs lost: 1 in 8 from late fees',
            standard: 'Extend Marlo: the study separates late fees from lost-book charges; late fees alone block 1 in 8 cards',
            detailed: 'Extend Marlo: the study separates late fees from lost-book charges; late fees alone block one in eight cards' },
        ] },
      },
      {
        id: 'NR',
        transcript: 'Mira for the neg. The criterion debate does not collapse: equal access is about entry, fairness is about sharing once you are in, and I win sharing. Extend Okafor: holds on popular books grow without fees. Penhallow studied big city libraries with large collections; small libraries have one copy. On funding, one percent is still the summer reading budget in a small town. Weigh: my harms land on the whole community.',
        flow: { sheets: [
          { sheet: 'Framework',
            brief: 'Access = entry; fairness = sharing',
            standard: 'No collapse: equal access is about entry, fairness is about sharing once in; neg wins sharing',
            detailed: 'No collapse: equal access is about entry, fairness is about sharing once you are in; the neg wins sharing' },
          { sheet: 'NC',
            brief: 'Okafor: holds grow\nPenhallow = big cities only\n1% = summer reading budget',
            standard: 'Extend Okafor: holds on popular books grow without fees\nPenhallow studied big-city libraries; small libraries have one copy\n1% is still the summer reading budget in a small town',
            detailed: 'Extend Okafor: holds on popular books grow without fees\nPenhallow studied big-city libraries with large collections; small libraries have one copy\nFunding: 1% is still the summer reading budget in a small town\nWeighing: neg harms land on the whole community' },
        ] },
      },
      {
        id: '2AR',
        transcript: 'Jonah, last aff speech. Even under her criterion, I win. A blocked card cannot share anything; one in eight families locked out is the biggest fairness problem in this round. She never answered that late fees alone block one in eight cards; she only argued about lost books. And on Penhallow, her small-library point is new in the NR, so it should not count. Vote aff.',
        flow: { sheets: [
          { sheet: 'Framework',
            brief: 'Aff wins under her C too',
            standard: 'Even under fairness, aff wins: a blocked card cannot share; 1 in 8 locked out is the biggest fairness harm',
            detailed: 'Even under her criterion the aff wins: a blocked card cannot share anything; one in eight families locked out is the biggest fairness problem in the round' },
          { sheet: 'AC',
            brief: '1 in 8 from late fees: dropped',
            standard: 'Late fees alone block 1 in 8 cards: not answered by the neg',
            detailed: 'Late fees alone block one in eight cards: the neg never answered it, only argued lost books' },
          { sheet: 'NC',
            brief: 'Small-library point new in NR',
            standard: 'The small-library answer to Penhallow is new in the NR; do not count it',
            detailed: 'The small-library answer to Penhallow is new in the NR, so it should not count' },
        ] },
      },
    ],
    // The Live Eval reply after the last speech (EVAL_SCHEMA).
    eval: {
      leaning: { side: 'aff', confidence: 'medium', why: 'The neg never answered that late fees alone block one in eight cards. The 2AR showed the aff wins even under the neg\'s criterion.' },
      summary: 'Both debaters value justice. The criterion debate is close, but the 2AR made it matter less by winning under fairness too. The aff\'s Marlo extension went unanswered. The neg\'s best offense, Okafor on holds, is reduced by Penhallow, and the small-library answer came first in the NR.',
      key_issues: [
        { issue: 'Criterion', ahead: 'even', note: 'Entry vs sharing is a real difference; the 2AR wins under both.' },
        { issue: 'Marlo: 1 in 8 blocked by late fees', ahead: 'aff', note: 'Not answered after the 1AR.' },
        { issue: 'Okafor: holds on shared books', ahead: 'neg', note: 'Extended, but Penhallow answers it for most libraries.' },
        { issue: 'New in the NR: small libraries', ahead: 'unclear', note: 'You decide whether it is new or an extension.' },
      ],
      watch_for: [
        'Whether the small-library point in the NR counts as new.',
        'How you weigh one in eight cards blocked against longer holds.',
      ],
      aff_needs: 'The round is over. The 2AR covered the dropped Marlo card and weighed under both criteria.',
      neg_needs: 'The round is over. The NR needed to answer the one-in-eight number directly.',
      feedback: [
        { speaker: 'Aff', so_far: 'A clear AC and an efficient 1AR; the 2AR weighed well.', strength: 'Winning under the opponent\'s criterion.', fix: 'Answer the funding contention with evidence, not only a number.', points: '28.8' },
        { speaker: 'Neg', so_far: 'A strong NC and a good criterion split in the NR.', strength: 'The entry vs sharing distinction.', fix: 'Answer the one-in-eight card, and make the small-library point in the NC.', points: '28.3' },
      ],
    },
    // The ballot draft reply (BALLOT_SCHEMA for LD: points for Aff and Neg, no ranks).
    ballot: {
      winner: 'aff',
      confidence: 'medium',
      points: { Aff: 28.8, Neg: 28.3 },
      rfd: 'I vote affirmative. The criterion debate was close: Mira\'s split between entry and sharing was smart. But Jonah\'s 2AR showed he wins under fairness too, because a blocked card cannot share anything. The deciding argument was Marlo: late fees alone block one in eight cards, and the negative never answered that number. Okafor on holds was the best negative offense, but Penhallow shows returns do not drop, and the small-library answer came first in the NR, so I gave it little weight.',
      aff_comments: 'Jonah: a clear AC and a 1AR that covered every NC argument. Winning under her criterion was the right call. Next time, back up the funding answer with evidence.',
      neg_comments: 'Mira: a strong NC and a smart criterion split. Answer the one-in-eight number directly, and put the small-library argument in the NC so it counts.',
      points_reasoning: 'Jonah (28.8): complete coverage and strong weighing.\nMira (28.3): good framework work, but dropped the key card.',
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = round;
  else (root.TabulaDemoRounds = root.TabulaDemoRounds || []).push(round);
})(typeof window !== 'undefined' ? window : globalThis);
