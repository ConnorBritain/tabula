// Demo round file: a sample Policy round for the staged demo (?demo=policy). Data only, no code.
// Everything here is made up: the students, the schools, the tournament, the resolution and the evidence authors.
// The "AI" parts are saved replies in the same shape the real AI returns (logic/prompts.js schemas), so the demo
// runs them through the app's own code. The demo never calls an AI provider or the Tabula server.
(function (root) {
  'use strict';
  const round = {
    format: 'policy-hs',
    round: {
      tournament: 'Sample Round (demo)',
      roundName: 'Round 3',
      judge: 'You',
      topic: 'Resolved: The United States federal government should substantially increase its protection of freshwater aquifers.',
      aff: { team: 'Brindlewood AK', d1: 'Ada Kestrel', d2: 'Theo Marlow' },
      neg: { team: 'Quillmont RV', d1: 'Priya Renfield', d2: 'Sam Vantongeren' },
    },
    // The speeches in order. transcript: what speech-to-text writes (a short excerpt of each speech).
    // flow: the live AI flow reply for that speech (LIVE_FLOW_SCHEMA: sheets with brief, standard and detailed notes).
    speeches: [
      {
        id: '1AC',
        transcript: 'Thank you judge. Ada Kestrel for Brindlewood. Observation one is inherency. The Ogallala Aquifer under eight states is dropping about two feet a year, and no federal agency tracks the whole basin. Advantage one, farm collapse. Hollins twenty-four finds a third of irrigated land on the High Plains goes dry by twenty fifty, and that ends corn and wheat exports. Advantage two, drinking water. Small towns that rely on wells face nitrate spikes as levels fall. Our plan: the United States federal government should fund aquifer recharge projects in the High Plains and create a federal basin-wide monitoring network. Solvency: Dorsey twenty-three says recharge plus monitoring cuts the decline by half within a decade, and only federal action covers all eight states. I am ready for cross-ex.',
        flow: { sheets: [
          { sheet: 'Case',
            brief: 'Inh: Ogallala -2 ft/yr, no fed tracking\nAdv 1 Farms: 1/3 land dry by 2050\nAdv 2 Water: nitrate spikes\nPlan: fed recharge + monitoring\nSolv: decline cut 1/2',
            standard: 'Inherency: Ogallala drops ~2 ft/yr; no agency tracks the whole basin\nAdv 1 Farm collapse: Hollins 24, 1/3 of High Plains irrigated land dry by 2050, ends corn/wheat exports\nAdv 2 Drinking water: small towns on wells face nitrate spikes as levels fall\nPlan: USFG funds High Plains recharge + federal basin-wide monitoring\nSolvency: Dorsey 23, recharge + monitoring halves the decline in 10 yrs; only fed covers 8 states',
            detailed: 'Inherency: Ogallala Aquifer under 8 states drops ~2 ft a year; no federal agency tracks the whole basin\nAdv 1 Farm collapse: Hollins 24, a third of irrigated High Plains land goes dry by 2050 -> corn and wheat exports end\nAdv 2 Drinking water: small towns that rely on wells face nitrate spikes as levels fall\nPlan: USFG funds aquifer recharge projects in the High Plains and creates a federal basin-wide monitoring network\nSolvency: Dorsey 23, recharge plus monitoring cuts the decline by half within a decade\nSolvency: only federal action covers all 8 states' },
        ] },
      },
      {
        id: '1NC',
        transcript: 'Priya Renfield, first negative. Three off. First off, the states counterplan: the eight Ogallala states should form an interstate compact to fund recharge and monitoring. States already run water rights, so they solve faster. Second off, spending disadvantage. Federal discretionary money is tight; Ashgrove twenty-four says new water spending is paid for by cutting rural health grants, and that closes clinics. Third off, on case. Their Hollins evidence assumes no new farming methods; drip irrigation already slows the decline. And recharge projects take fifteen years to fill, so the plan is too slow for their twenty fifty impact.',
        flow: { sheets: [
          { sheet: 'CP - States',
            brief: 'CP: 8 states compact, recharge + monitoring\nStates own water rights -> faster',
            standard: 'CP text: the 8 Ogallala states form an interstate compact to fund recharge + monitoring\nNet benefit: avoids the spending DA\nSolvency: states already run water rights, so they act faster',
            detailed: 'CP text: the 8 Ogallala states form an interstate compact to fund recharge and monitoring\nNet benefit: avoids the spending DA (no federal money)\nSolvency: states already run water rights, so they solve faster than a new federal program' },
          { sheet: 'DA - Spending',
            brief: 'Tight budget\nAshgrove 24: water $ = rural health cuts\nClinics close',
            standard: 'Uniqueness: federal discretionary money is tight now\nLink: Ashgrove 24, new water spending is paid for by cutting rural health grants\nImpact: rural clinics close',
            detailed: 'Uniqueness: federal discretionary budget is tight now\nLink: Ashgrove 24, new water spending is offset by cuts to rural health grants\nImpact: rural clinics close; rural patients lose care' },
          { sheet: 'Case',
            brief: 'Hollins ignores drip irrigation\nRecharge takes 15 yrs, too slow',
            standard: 'Adv 1: Hollins assumes no new farming methods; drip irrigation already slows the decline\nSolvency: recharge projects take 15 yrs to fill, too slow for the 2050 impact',
            detailed: 'Adv 1 Farms: Hollins assumes no new farming methods; drip irrigation already slows the decline\nSolvency: recharge projects take ~15 years to fill -> too slow for their 2050 impact' },
        ] },
      },
      {
        id: '2AC',
        transcript: 'Theo Marlow, second affirmative. On the counterplan: permute, do both. And states cannot solve, Dorsey says the basin crosses state lines and Texas and Kansas already sued each other over the Republican River, so a compact deadlocks. No monitoring means no data, so the counterplan cannot target recharge. On the spending disad: non-unique, Congress passed new water infrastructure money last session without health cuts. No link, the plan is under a billion dollars. On case, drip irrigation is in Hollins already and the decline still happens. Fifteen years is fine, the impact is twenty fifty.',
        flow: { sheets: [
          { sheet: 'CP - States',
            brief: 'Perm: do both\nCompact deadlocks (TX v KS suit)\nNo fed monitoring = no data',
            standard: 'Perm: do both\nSolvency deficit: basin crosses state lines; TX and KS already sued over the Republican River -> compact deadlocks\nNo federal monitoring = no data to target recharge',
            detailed: 'Perm: do both\nSolvency deficit: Dorsey, the basin crosses state lines; Texas and Kansas already sued each other over the Republican River -> a compact deadlocks\nNo federal monitoring network = no data, so the CP cannot target recharge' },
          { sheet: 'DA - Spending',
            brief: 'N/U: water $ passed w/o health cuts\nNo link: plan < $1B',
            standard: 'Non-unique: Congress passed new water infrastructure money last session with no health cuts\nNo link: the plan costs under $1B',
            detailed: 'Non-unique: Congress passed new water infrastructure money last session with no rural health cuts\nNo link: the plan costs under $1 billion, too small to force offsets' },
          { sheet: 'Case',
            brief: 'Drip in Hollins already\n15 yrs fine for 2050',
            standard: 'Drip irrigation is already in Hollins; the decline still happens\n15 yrs is fine: the impact is 2050',
            detailed: 'Drip irrigation is already counted in Hollins; the decline still happens\nTimeframe: 15 years to fill is fine, the impact is in 2050' },
        ] },
      },
      {
        id: '2NC',
        transcript: 'Sam Vantongeren, second negative. I will take the counterplan. The permutation links to the disad because it still spends federal money. On the deadlock argument, the Republican River case was settled, and compacts work, the Colorado River compact has run for a century. The states can build their own shared monitoring; they do not need a federal network. Extend the net benefit: any federal dollar trades off with rural health.',
        flow: { sheets: [
          { sheet: 'CP - States',
            brief: 'Perm links to DA\nRepublican R. suit settled\nCompacts work: Colorado 100 yrs\nStates can share monitoring',
            standard: 'Perm links to the DA: still spends federal money\nDeadlock: the Republican River case settled; compacts work (Colorado River compact, 100 yrs)\nStates can build shared monitoring without a fed network',
            detailed: 'Perm links to the DA: it still spends federal money\nDeadlock answer: the Republican River case was settled; compacts work, the Colorado River compact has run for a century\nMonitoring: states can build their own shared monitoring; no federal network needed\nExtend net benefit: any federal dollar trades off with rural health' },
        ] },
      },
      {
        id: '1NR',
        transcript: 'Priya Renfield, first negative rebuttal, on the spending disad. On non-unique, last session\'s water money came from an emergency bill; this year there is a spending cap, so new money now means cuts. On no link, Ashgrove says even small programs get offsets under the cap. Extend the impact: clinic closures hurt rural patients now, before their twenty fifty impact.',
        flow: { sheets: [
          { sheet: 'DA - Spending',
            brief: 'Last yr = emergency bill; cap now\nSmall programs still offset\nClinics close now, before 2050',
            standard: 'Uniqueness: last session\'s water money was an emergency bill; a spending cap applies this year\nLink: Ashgrove, even small programs get offsets under the cap\nImpact: clinic closures happen now, before the aff\'s 2050 impact',
            detailed: 'Uniqueness: last session\'s water money came from an emergency bill; this year there is a spending cap, so new money means cuts\nLink: Ashgrove, even small programs get offsets under the cap\nImpact: clinic closures hurt rural patients now, before the aff\'s 2050 impact' },
        ] },
      },
      {
        id: '1AR',
        transcript: 'Ada Kestrel, first affirmative rebuttal. On the counterplan, extend that states have no basin-wide data. They said states can share monitoring, but no state has a law to do that and no evidence says they will. Settling one lawsuit took twelve years; the aquifer cannot wait. On the disad, the cap has exceptions for water projects, so there is no link. And their impact is a few clinics; ours is a third of the farmland on the High Plains.',
        flow: { sheets: [
          { sheet: 'CP - States',
            brief: 'No state law for shared monitoring\nSuit took 12 yrs, too slow',
            standard: 'Extend: states have no basin-wide data; no evidence states will share monitoring\nThe Republican River suit took 12 yrs to settle; the aquifer cannot wait',
            detailed: 'Extend: states have no basin-wide data; no state has a law to share monitoring and no evidence says they will\nSettling the Republican River suit took 12 years; the aquifer cannot wait' },
          { sheet: 'DA - Spending',
            brief: 'Cap exempts water -> no link\nImpact small v 1/3 farmland',
            standard: 'No link: the spending cap has exceptions for water projects\nWeighing: a few clinics vs a third of High Plains farmland',
            detailed: 'No link: the cap has exceptions for water projects\nWeighing: their impact is a few clinics; the aff\'s is a third of High Plains farmland' },
        ] },
      },
      {
        id: '2NR',
        transcript: 'Sam Vantongeren for the negative. I am going for the counterplan and the disad. The counterplan solves most of the case: states control water rights and can fund recharge. Even if monitoring is weaker, a risk of the disad outweighs a small solvency deficit. They never answered that the perm links. Clinics close now; their farm impact is decades away.',
        flow: { sheets: [
          { sheet: 'CP - States',
            brief: 'CP solves most of case\nPerm links: dropped',
            standard: 'CP solves most of the case: states control water rights and fund recharge\nRisk of the DA outweighs a small solvency deficit\nPerm links to the DA: not answered in the 1AR',
            detailed: 'CP solves most of the case: states control water rights and can fund recharge\nEven if monitoring is weaker, a risk of the DA outweighs a small solvency deficit\nThe perm links to the DA: not answered in the 1AR' },
          { sheet: 'DA - Spending',
            brief: 'Clinics now > farms decades away',
            standard: 'Timeframe: clinics close now; the farm impact is decades away',
            detailed: 'Timeframe: clinics close now; the aff\'s farm impact is decades away' },
        ] },
      },
      {
        id: '2AR',
        transcript: 'Theo Marlow, final affirmative rebuttal. The round comes down to monitoring. The counterplan cannot target recharge without basin-wide data, and the negative conceded there is no state law to share it. That is not a small deficit; it is the whole plan. On the disad, the water exception to the cap was never answered in the 2NR, so there is no link and no reason to fear the perm. Vote affirmative.',
        flow: { sheets: [
          { sheet: 'CP - States',
            brief: 'No data = CP can\'t target recharge\nNo state law: conceded',
            standard: 'The round is monitoring: without basin-wide data the CP cannot target recharge\nNo state law to share data: conceded by the neg\nNot a small deficit: it is the whole plan',
            detailed: 'The round comes down to monitoring: without basin-wide data the CP cannot target recharge\nThe neg conceded there is no state law to share data\nThat is not a small solvency deficit; it is the whole plan' },
          { sheet: 'DA - Spending',
            brief: 'Water exception: dropped in 2NR\nNo link -> perm OK',
            standard: 'The water exception to the cap was not answered in the 2NR -> no link\nNo link means the perm is safe',
            detailed: 'The water exception to the spending cap was never answered in the 2NR -> no link\nNo link means there is no reason to fear the perm' },
        ] },
      },
    ],
    // The Live Eval reply after the last speech (EVAL_SCHEMA).
    eval: {
      leaning: { side: 'aff', confidence: 'medium', why: 'The 2NR went for the counterplan but did not answer that states have no basin-wide data. The water exception to the spending cap also went unanswered, so the disad has little link.' },
      summary: 'The negative collapsed to the states counterplan and the spending disad. The affirmative kept the monitoring solvency deficit alive in every speech. The 2NR called it small but gave no evidence that states will share data. The 1AR said the spending cap exempts water projects, and the 2NR did not answer that.',
      key_issues: [
        { issue: 'CP solvency: monitoring', ahead: 'aff', note: 'No state law to share data was conceded; the 2AR made it the whole round.' },
        { issue: 'Spending DA link', ahead: 'aff', note: 'The water exception to the cap was dropped in the 2NR.' },
        { issue: 'Perm links to the DA', ahead: 'neg', note: 'Unanswered in the 1AR, but it only matters if the DA links.' },
        { issue: 'Timeframe', ahead: 'even', note: 'Clinics now vs farms by 2050; neither side weighed it in depth.' },
      ],
      watch_for: [
        'Whether you count the 2AR monitoring framing as new or as an extension of the 2AC.',
        'How much risk of the DA is left after the dropped water exception.',
      ],
      aff_needs: 'The round is over. The 2AR did what it needed: it framed monitoring as the whole plan.',
      neg_needs: 'The round is over. The 2NR needed evidence that states will share monitoring data.',
      feedback: [
        { speaker: '1A', so_far: 'Clear 1AC and an efficient 1AR.', strength: 'Answered every 2NC argument in the 1AR.', fix: 'Weigh the farm impact against the clinics, not just compare sizes.', points: '28.6' },
        { speaker: '2A', so_far: 'Strong 2AC and a focused 2AR.', strength: 'Found the key issue (monitoring) and stayed on it.', fix: 'Read evidence for the water exception in the 2AC, not only in the 1AR.', points: '28.9' },
        { speaker: '1N', so_far: 'A well-built 1NC; the 1NR held the disad.', strength: 'Good uniqueness answer about the emergency bill.', fix: 'Answer the water exception directly.', points: '28.3' },
        { speaker: '2N', so_far: 'A clean 2NC; the 2NR went for two positions.', strength: 'Pointed out the dropped perm link.', fix: 'Collapse to one position and answer the monitoring deficit with evidence.', points: '28.0' },
      ],
    },
    // The ballot draft reply (BALLOT_SCHEMA for policy: points and ranks for 1A, 2A, 1N, 2N).
    ballot: {
      winner: 'aff',
      confidence: 'medium',
      points: { '1A': 28.6, '2A': 28.9, '1N': 28.3, '2N': 28.0 },
      ranks: { '1A': 2, '2A': 1, '1N': 3, '2N': 4 },
      rfd: 'I vote affirmative on the states counterplan. The negative never showed that states will build basin-wide monitoring: the 1AR said no state has a law to share data, and the 2NR did not answer it. Without that data the counterplan cannot target recharge, so it does not solve the case. The spending disad has little link, because the water exception to the cap went unanswered in the 2NR. The perm link was a good catch, but with no link to the disad it does not matter. With the counterplan not solving and almost no risk of the disad, the affirmative wins.',
      aff_comments: 'Ada: a clear 1AC and a 1AR that covered every 2NC argument. Next time, weigh your impact against theirs, not just its size.\nTheo: you found the key issue in the 2AC and made it the whole 2AR. Read the water exception evidence earlier.',
      neg_comments: 'Priya: a well-built 1NC, and the emergency bill answer in the 1NR was smart. Answer the water exception head-on.\nSam: a clean 2NC. In the 2NR, collapse to one position and answer the monitoring deficit with evidence.',
      points_reasoning: 'Theo (28.9): best strategic choices of the round.\nAda (28.6): efficient, complete 1AR.\nPriya (28.3): strong uniqueness work.\nSam (28.0): good catch on the perm, but the 2NR spread itself thin.',
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = round;
  else (root.TabulaDemoRounds = root.TabulaDemoRounds || []).push(round);
})(typeof window !== 'undefined' ? window : globalThis);
