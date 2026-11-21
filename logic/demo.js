// The staged demo of the AI features (?demo=policy or ?demo=ld): a sample round plays through the real app screens.
// The sample rounds are data files (demo/*.js). Their "AI" parts are saved replies in the same shape the real AI
// returns, so the page runs them through its own code (js/demo.js answers callAI with them). Nothing here calls a
// provider or the Tabula server. assets/demo-boot.js keeps the demo apart from the judge's real data.
// One part of logic.js (pure logic, no DOM, no network). logic.js joins the parts into one API.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const { formatFields } = part('format');

  // The nudge at the end. Buying is not live yet (the owner wants full QA and capacity tests first), so the button
  // opens the Plans page. The "Buy a round" button shows only when the demoBuy flag is on (logic/flags.js, off).
  const DEMO_CTA = Object.freeze({
    title: 'Try your first round for $2',
    body: 'That was a sample round with saved AI answers. In your own round, Tabula transcribes the speeches, flows them, and drafts the ballot and the decision. You check and change every word.',
    plans: 'See plans',
    buy: 'Buy a round',
  });

  // The ?demo= value that opens the demo for a format (assets/demo-boot.js reads it back): 'ld' for LD, else 'policy'.
  const demoParam = (formatId) => (formatId === 'ld' ? 'ld' : 'policy');

  // The sample round for a format id, from the loaded demo files (list), or null.
  function demoSample(list, formatId) { return (list || []).find((s) => s && s.format === formatId) || null; }

  // Each speech in the sample that the format flows (has a flow column), in order.
  const flowedSpeeches = (sample) => (sample.speeches || []).map((s) => s.id);

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
        tab: 'setup', flowView: 'ai', cur: 0,
      }),
      // The welcome, the D2 note and the one-time D2 reset (L.d2Reset) are for the real app; the demo skips them. Live AI flow is on,
      // so the AI flow pass runs as it would in a real round. Auto Live Eval and auto ballot stay off: the steps run them.
      settings: { setupDone: true, d2NoteShown: true, d2Reset: true, liveFlow: true, autoEval: false, autoBallot: false },
    };
  }

  // The steps of the demo, in order. Each step: { id, place, title, body, speech? (live), speeches? (fast) }.
  // The first two speeches play live (the transcript types in, then the AI flows it); the rest of the round is filled
  // at once; then Live Eval, the ballot draft, the decision, and the nudge.
  function demoSteps(sample, fmt) {
    const ids = flowedSpeeches(sample);
    const name = (id) => (fmt.speeches.find((s) => s.id === id) || { label: id }).label;
    const steps = [{
      id: 'intro', place: 'setup', title: 'A sample round',
      body: 'This is a ' + fmt.name + ' round with made-up debaters. The AI answers are saved, so nothing is sent anywhere and nothing is saved. Press Next to start.',
    }];
    ids.slice(0, 2).forEach((id, i) => steps.push({
      id: 'speech-' + id, place: 'flow', speech: id, title: 'The ' + name(id) + (i ? ', flowed for you' : ', written down'),
      body: i ? 'The next speech. The AI flow adds each answer next to the argument it answers.'
        : 'Tabula listens and writes down each speech. When the speech ends, the AI flows it for you on the AI flow.',
    }));
    const rest = ids.slice(2);
    if (rest.length) steps.push({
      id: 'rest', place: 'flow', speeches: rest, title: 'The rest of the round',
      body: 'We skip ahead: ' + rest.map(name).join(', ') + '. Each speech is transcribed and flowed the same way.',
    });
    steps.push(
      { id: 'eval', place: 'eval', title: 'Live Eval', body: 'Live Eval reads the flow and tells you who is ahead, on which issues, and what to listen for.' },
      { id: 'draft', place: 'ballot', title: 'Draft the ballot', body: 'One press drafts the winner, the points, the reason for decision and the comments. Review each part before it goes on the ballot.' },
      { id: 'decision', place: 'ballot', title: 'Your decision, drafted', body: 'The draft is on the ballot. Every field stays yours to change.' },
      { id: 'end', place: 'ballot', title: DEMO_CTA.title, body: DEMO_CTA.body },
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

  const api = { DEMO_CTA, demoParam, demoSample, demoSeed, demoSteps, demoReply, transcriptChunks, demoTranscript };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).demo = api;
})(typeof window !== 'undefined' ? window : globalThis);
