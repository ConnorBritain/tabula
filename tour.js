// Guided tours: the steps, and the math that places the tour card next to the part it explains.
// No DOM work here, so Node tests can check every tour.
(function (root) {
  'use strict';

  // place: which part of the app to open first ('setup', 'flow', 'eval', 'analysis', 'ballot', 'log', 'ai').
  // target: the part of the screen to highlight. Keep each step short: one idea, a few sentences.
  // feature: the AI gate key of a step on an AI part (dropped when off). mentions + plainBody: a step whose words name
  // an AI part, and its words with no AI (used when that part is off). L.visibleTourSteps applies both (platform 1B).
  const TOURS = {
    main: {
      title: 'Tour of Tabula',
      steps: [
        { place: 'setup', target: '#round-card', title: 'Set up the round', body: 'Type the round, the teams and the debaters. It takes half a minute, and it fills the ballot later.' },
        { place: 'setup', target: '#docs-card', title: 'Add speech docs', body: 'Add the aff case or any speech doc (PDF, Word or text). The AI reads them and puts them on the flow. When a speech has no transcript, its doc counts as the speech.', mentions: 'aiFlow', plainBody: 'Add the aff case or any speech doc (PDF, Word or text). Pick the speech each doc belongs to.' },
        { place: 'flow', target: '.rb-ctl', title: 'Run the clock', body: 'Start and pause the speech clock here. On Flow, press ⌘↵ (Ctrl+↵ on Windows) any time, or Space when nothing is selected. Prep clocks for each team sit on the right.' },
        { place: 'flow', target: '.rb-rec', feature: 'transcription', title: 'Record the speech', body: 'Tick Transcribe. Recording runs only while the speech clock runs. A short bar shows the mic level, and a note warns you if no words come through.' },
        { place: 'flow', target: '#tab-flow', title: 'Flow the round', body: '"My flow" is yours to type. "AI flow" fills itself from the transcript and docs. You can edit any AI cell, and your edits stick.', mentions: 'aiFlow', plainBody: 'Type the flow here. Keep each argument on one line across the columns, so the clash lines up.' },
        { place: 'eval', target: '#subnav', title: 'Decide', body: 'After the round: the Live Eval, deeper analysis and the ballot. Each one works with or without AI.', mentions: 'liveEval', plainBody: 'After the round: the round at a glance, the round map and the ballot.' },
        { place: 'ballot', target: '#draft-open', feature: 'ballotDraft', title: 'Fill the ballot', body: 'Type the ballot yourself, or let the AI draft it. You check each AI field before it goes in, and anything you type stays yours. Then print it, or copy each box into the tournament ballot.' },
        { place: null, target: '#help-btn', title: 'Help is always here', body: 'Click ? to replay this tour, or to get a short tour of the page you are on. Connect AI any time with the gear; without AI, the timers, flow and ballot still work.', mentions: 'setup', plainBody: 'Click ? to replay this tour, or to get a short tour of the page you are on.' },
      ],
    },
    flow: {
      title: 'The Flow workspace',
      steps: [
        { place: 'flow', target: '#tab-timer', title: 'Speeches and docs', body: 'Pick a speech and add its docs. Open the transcript from the round bar. Hide this pane for more room.', mentions: 'transcription', plainBody: 'Pick a speech and add its docs. Hide this pane for more room.' },
        { place: 'flow', target: '#flow-tabs', title: 'Your flow and the AI flow', body: 'Switch between your flow and the AI flow. Sheets hold one argument each. Brief, Standard and Detailed change how much the AI flow shows.', mentions: 'aiFlow', plainBody: 'Sheets hold one argument each. Add, rename and switch sheets here.' },
        { place: 'flow', target: '#tab-flow', title: 'Edit anything', body: 'Type in any cell. An edited AI cell gets an "Edited" mark. If the AI writes something newer, you choose "Use AI" or "Keep mine".', mentions: 'aiFlow', plainBody: 'Type in any cell. Everything saves in this browser as you type.' },
        { place: 'flow', target: '#insights', feature: 'liveEval', title: 'Insights', body: 'The current leaning and what to listen for next. Click Update for a fresh read.' },
      ],
    },
    decide: {
      title: 'Decide',
      steps: [
        { place: 'eval', target: '#tab-eval', feature: 'liveEval', title: 'Live Eval', body: 'A read of the round so far: the leaning, key issues, what each side needs, and feedback for each debater.' },
        { place: 'analysis', target: '#tab-analysis', title: 'Analysis', body: 'Weigh the round under any paradigm (including your own), compare the impacts, and see the round as a map you can edit.', mentions: 'analysis', plainBody: 'The prep used, the key moments, and the round as a map you can edit.' },
        { place: 'ballot', target: '.ballot-card', title: 'Ballot', body: 'Winner, points, ranks, the RFD and comments. A "Yours" tag marks what you typed; the AI will not change it. Print, copy or save from the bar at the bottom.', mentions: 'ballotDraft', plainBody: 'Winner, points, ranks, the RFD and comments. Print, copy or save from the bar at the bottom.' },
        { place: 'ballot', target: '#draft-open', feature: 'ballotDraft', title: 'Draft with AI', body: 'Pick what the AI should draft and tell it your view. Nothing changes until you review the draft and insert it.' },
      ],
    },
    settings: {
      title: 'Settings',
      steps: [
        { place: 'ai', target: '#conn-card', feature: 'setup', title: 'Connect AI', body: 'Paste a key from any AI provider. Tabula works out which one it is and checks it. Step-by-step help is under each provider.' },
        { place: 'ai', target: '#audio-card', feature: 'transcription', title: 'Audio', body: 'Choose "In the room" or "Zoom", pick the microphone, and run the 5-second mic test before the round.' },
      ],
    },
    setup: {
      title: 'Round',
      steps: [
        { place: 'setup', target: '#round-card', title: 'Round details', body: 'The tournament, round, judge and resolution. They show on the ballot and in History.' },
        { place: 'setup', target: '#docs-card', title: 'Round documents', body: 'Add speech docs and pick which speech each one belongs to. The AI maps them onto that speech on the flow.', mentions: 'aiFlow', plainBody: 'Add speech docs and pick which speech each one belongs to.' },
        { place: 'setup', target: '#writing-card', feature: 'any', title: 'How the AI writes', body: 'Expert writes like a college judge. Plain uses short sentences and everyday words, for students and parents. The decision stays the same.' },
        { place: 'setup', target: '#times-card', title: 'Times and points', body: 'Prep time for each team, and the speaker points range your tournament uses. Most leagues use 25–30.' },
      ],
    },
    log: {
      title: 'History',
      steps: [
        { place: 'log', target: '#tab-log .card', title: 'Saved ballots', body: 'Every ballot you save is here. Copy them all into a spreadsheet, or download a CSV.' },
        { place: 'log', target: '#backup-card', title: 'Back up your work', body: 'Everything lives in this browser only. Download a backup now and then, and restore it on any computer.' },
      ],
    },
  };

  // Which short tour fits the place the judge is on.
  const PLACE_TOUR = { setup: 'setup', flow: 'flow', decide: 'decide', log: 'log', ai: 'settings' };

  // Places the tour card next to the highlighted part: below it if it fits, else above, else beside;
  // always fully inside the window with a margin.
  function placeCard(target, card, view, gap) {
    const g = gap == null ? 12 : gap;
    const m = 12;
    const clampX = (x) => Math.max(m, Math.min(x, view.w - card.w - m));
    const clampY = (y) => Math.max(m, Math.min(y, view.h - card.h - m));
    const below = target.top + target.height + g;
    if (below + card.h + m <= view.h) return { top: below, left: clampX(target.left), side: 'below' };
    const above = target.top - g - card.h;
    if (above >= m) return { top: above, left: clampX(target.left), side: 'above' };
    const right = target.left + target.width + g;
    if (right + card.w + m <= view.w) return { top: clampY(target.top), left: right, side: 'right' };
    const left = target.left - g - card.w;
    if (left >= m) return { top: clampY(target.top), left, side: 'left' };
    // The part is bigger than the screen: put the card in the lower corner over it.
    return { top: clampY(view.h - card.h - m), left: clampX(view.w - card.w - m), side: 'over' };
  }

  const api = { TOURS, PLACE_TOUR, placeCard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tours = api;
})(typeof window !== 'undefined' ? window : globalThis);
