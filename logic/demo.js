// The staged demo of the AI features (?demo=policy or ?demo=ld): a sample round plays through the real app screens.
// The sample rounds are data files (demo/*.js). Their "AI" parts are saved replies in the same shape the real AI
// returns, so the page runs them through its own code (js/demo.js answers callAI with them). Nothing here calls a
// provider or the Tabula server. assets/demo-boot.js keeps the demo apart from the judge's real data.
// One part of logic.js (pure logic, no DOM, no network). logic.js joins the parts into one API.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const { formatFields, labelOf } = part('format');

  // The nudge at the end. Buying is not live yet (the owner wants full QA and capacity tests first), so the button
  // opens the Plans page. The "Buy a round" button shows only when the demoBuy flag is on (logic/flags.js, off).
  const DEMO_CTA = Object.freeze({
    title: 'Try your first round',
    plans: 'See plans',
    buy: 'Buy a round',
  });

  // The sample round a ?demo= value opens, from the loaded demo files (list): the file that names that value, else the
  // first file (so ?demo alone, or an unknown value, still shows a demo). No files: null.
  function demoSample(list, param) {
    const all = (list || []).filter(Boolean);
    return all.find((s) => s.param === param) || all[0] || null;
  }

  // The ?demo= value for a round in this format (the Help menu link): the param of that format's sample round, else
  // the first file's. The format-to-value pairs live in the demo files, not here.
  function demoParamFor(list, formatId) {
    const all = (list || []).filter(Boolean);
    const s = all.find((x) => x.format === formatId) || all[0];
    return s ? s.param : '';
  }

  // Which nudge buttons show: both only on the last step, and "Buy a round" only while its flag (demoBuy) is on.
  function demoCtaButtons(o) {
    const x = o || {};
    return { plans: Boolean(x.last), buy: Boolean(x.last && x.buyOn) };
  }

  // What the demo page starts with: the round (merged into a fresh round by js/core.js) and the settings.
  // id starts with "demo-" so nothing could ever mistake it for a real round.
  function demoSeed(sample, fmt) {
    const r = sample.round;
    const copy = (o) => JSON.parse(JSON.stringify(o));
    return {
      round: Object.assign(formatFields(fmt), {
        id: 'demo-' + fmt.id,
        tournament: r.tournament, roundName: r.roundName, judge: r.judge, topic: r.topic,
        aff: copy(r.aff), neg: copy(r.neg),
        tab: 'flow', flowView: 'ai', cur: 0,
      }),
      // The welcome, the D2 note and the one-time D2 reset (L.d2Reset) are for the real app; the demo skips them. Live AI flow is on,
      // so the AI flow pass runs as it would in a real round. Auto Live Eval and auto ballot stay off: the steps run them.
      settings: { setupDone: true, d2NoteShown: true, d2Reset: true, liveFlow: true, autoEval: false, autoBallot: false, recOn: false },
    };
  }

  // The steps of the demo, in order. Each step: { id, place, title, body, speech? (live), speeches? (fast) }.
  // The first two speeches play live (the transcript types in, then the AI flows it); the rest of the round is filled
  // at once; then Live Eval, the ballot draft, the decision, and the nudge.
  function demoSteps(sample, fmt) {
    const ids = (sample.speeches || []).map((s) => s.id); // the sample has only the speeches the format flows
    const name = (id) => (fmt.speeches.find((s) => s.id === id) || { label: id }).label;
    const steps = [{
      id: 'intro', place: 'flow', title: 'Select your round type',
      body: 'This is a ' + labelOf(fmt) + ' round with made-up debaters. Your changes stay on this page.',
      detail: 'Use the same controls as a real round. The demo uses saved AI replies and never opens your microphone.',
    }, {
      id: 'manual', place: 'flow', title: 'Add your first note',
      body: 'Choose + Entry in the first speech to open the editor.',
      detail: 'An analytic is a reason in your own words. Citation fields are optional. Use Tab to reach them and Shift+Enter for a new line.',
    }];
    const speech = id => ({
      id: 'speech-' + id, place: 'flow', speech: id, title: name(id) + ' · Speech to flow',
      body: 'See silent sample captions turn into flow entries.',
      detail: 'A saved AI reply maps the transcript. Your notes stay in place. Pause or replay the sample at any time.',
    });
    if (ids[0]) steps.push(speech(ids[0]));
    steps.push(
      { id: 'options', place: 'flow', title: 'Set the note detail',
        body: 'Open Flow options. Try a different AI note length.',
        detail: 'The AI help setting controls how Tabula handles your own notes. The saved sample replies stay the same.' },
      { id: 'documents', place: 'setup', title: 'Import a speech',
        body: 'Try a sample document. It starts as unconfirmed.',
        detail: 'An imported document does not show what was actually read aloud. You can also use SpeechDrop in a real round.' },
      { id: 'organize', place: 'flow', title: 'Link and organize arguments',
        body: 'Open the ⋯ menu on an entry. Try Respond or Extend.',
        detail: 'Move changes where an entry sits. Extend keeps the original and adds notes for a later speech. Use Flow Check to compare spoken order with the flow. Undo restores a removed entry.' },
      { id: 'clocks', place: 'flow', title: 'Run the speech clock',
        body: 'Start the speech clock, then pause it. Try a prep clock next.',
        detail: 'On a phone, you can view one speech while timing another. Open Round to change clock settings.' },
    );
    if (ids[1]) steps.push(speech(ids[1]));
    const rest = ids.slice(2);
    if (rest.length) steps.push({
      id: 'rest', place: 'flow', speeches: rest, title: 'Fill the rest of the round',
      body: 'Load the remaining sample speeches and keep your notes.',
      detail: 'This adds sample transcripts and flow entries for untouched speeches. Existing transcripts stay in place.',
    });
    steps.push(
      { id: 'eval', place: 'eval', title: 'Check who is ahead',
        body: 'Choose Run to see the sample Live Eval.',
        detail: 'Live Eval compares arguments across the round. You can view the saved sample in any order. It uses no rounds.' },
      { id: 'draft', place: 'ballot', title: 'Draft a ballot',
        body: 'Pick the fields you want help with, then choose Draft.',
        detail: 'The saved draft includes a sample decision and feedback. You choose what goes onto the ballot.' },
      { id: 'decision', place: 'ballot', title: 'Review your decision',
        body: 'Insert the suggestions you want. Edit the ballot in your own words.',
        detail: 'You can change the reason for decision and speaker feedback before you finish.' },
      { id: 'end', place: 'ballot', title: DEMO_CTA.title,
        body: 'Keep practicing here, or choose “See plans” to try your own round.',
        detail: 'The demo uses no rounds. In a real round, your first use of Tabula AI on a personal plan uses one round from your balance. Choose “Check my rounds” to see your balance or buy more in your account.' },
    );
    return steps;
  }

  // The saved AI answer for a hosted job (L.HOSTED_TASKS names: flow, eval, ballot, ...). extra.speech names the speech
  // for a flow pass. A job the demo has no answer for gives null (the page then says so). A copy, so the app may change it.
  function demoReply(sample, job, extra) {
    const copy = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
    if (job === 'flow') {
      const sp = (sample.speeches || []).find((s) => s.id === (extra && extra.speech));
      return sp ? copy(sp.flow) : { sheets: [] };
    }
    if (job === 'eval') return copy(sample.eval);
    if (job === 'ballot') return copy(sample.ballot);
    return null;
  }

  // A transcript cut into pieces about n words long, so it can type in as live transcription does.
  function transcriptChunks(text, n) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const size = Math.max(1, Math.floor(n) || 1);
    const out = [];
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '));
    return out;
  }

  // The transcript of a speech in the sample ('' for a speech the sample does not have).
  function demoTranscript(sample, speechId) {
    const sp = (sample.speeches || []).find((s) => s.id === speechId);
    return sp ? sp.transcript : '';
  }

  const api = { DEMO_CTA, demoSample, demoParamFor, demoCtaButtons, demoSeed, demoSteps, demoReply, transcriptChunks, demoTranscript };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).demo = api;
})(typeof window !== 'undefined' ? window : globalThis);
