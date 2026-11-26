// Speech Events judge help: the "What to listen for" bullets, one list per event id (events/js/help/help.js reads them).
// App copy in our own plain words for a parent who has never judged; no league text is copied. Target: US grade 6 or
// lower (events/js/help/grade.mjs reports it; events/js/help/grade.test.mjs holds the line).
// Only the new words live here. The event's one-line description, time limit, grace and material come from the Guide
// on the type page (events/js/guide.js guideModel), so the room card and the type page can never disagree.
// Rules for a list: 3 to 5 bullets, each one short sentence or two. events/js/help/help.test.mjs checks that every
// published event (events/js/room.js ENABLED_EVENTS) and the Custom event has a list.

export const LISTEN_FOR = Object.freeze({
  oo: Object.freeze([
    'Listen for one big idea that runs through the whole speech.',
    'Each point should have a fact or a story to back it up.',
    'A good speech asks the room to think or act in a new way.',
    'A short slip of memory is fine. Judge the whole speech.',
  ]),
  inf: Object.freeze([
    'You should learn something new by the end.',
    'Listen for a clear plan: what the topic is, and the main parts.',
    'Good speakers say where their facts come from.',
    'Signs or boards are allowed here. Ask if they help you learn.',
  ]),
  usx: Object.freeze([
    'The speaker drew a question about U.S. news and had a short time to prepare.',
    'Check that the speech answers the exact question, not a near one.',
    'Listen for a clear answer, two or three reasons, and named sources.',
    'Expect less polish than a speech made weeks ago. Reward clear thinking.',
  ]),
  ix: Object.freeze([
    'The speaker drew a question about world news and had a short time to prepare.',
    'Check that the speech answers the exact question, not a near one.',
    'Listen for a clear answer, two or three reasons, and named sources.',
    'Expect less polish than a speech made weeks ago. Reward clear thinking.',
  ]),
  mx: Object.freeze([
    'The speaker drew a news question and had a short time to prepare.',
    'Check that the speech answers the exact question, not a near one.',
    'Listen for a clear answer, two or three reasons, and named sources.',
    'Expect less polish than a speech made weeks ago. Reward clear thinking.',
  ]),
  com: Object.freeze([
    'The speaker drew a question and had a short time to prepare.',
    'The speaker stays in a chair the whole time. That is the rule here.',
    'Check that the speech answers the exact question.',
    'Listen for a clear answer and named sources, in a calm, warm way.',
  ]),
  di: Object.freeze([
    'The student acts out a serious story from a book, play or film script.',
    'Listen for clear, different characters you can tell apart.',
    'The feelings should seem real, not forced or too loud.',
    'The short intro should tell you the title, the author and why it matters.',
  ]),
  hi: Object.freeze([
    'The student acts out a funny story and plays every part.',
    'You should always know which character is talking.',
    'Look for quick, clean switches from one character to the next.',
    'Funny is good, but the story should still make sense from start to end.',
  ]),
  duo: Object.freeze([
    'Two students act out one story together.',
    'They look out at the room, not at each other, as if the other one is there.',
    'Listen for teamwork: both parts matter, and the timing is tight.',
    'You give the pair one rank and one set of comments.',
  ]),
  poi: Object.freeze([
    'The student mixes a few short pieces, like poems or stories, around one theme.',
    'The binder is part of the act. It is fine to read from it.',
    'Listen for one clear point that ties the pieces together.',
    'Each move from one piece to the next should be easy to follow.',
  ]),
  pro: Object.freeze([
    'The student reads a story from a binder. Reading is the rule here.',
    'Listen for a clear voice for the teller and for each character.',
    'The story should have a clear start, middle and end.',
    'Good readers look up from the page often and use it well.',
  ]),
  poe: Object.freeze([
    'The student reads poems from a binder. Reading is the rule here.',
    'Listen for lines that make pictures in your mind.',
    'Good pace leaves room for key lines to sink in.',
    'The voice should fit the mood of each poem.',
  ]),
  exp: Object.freeze([
    'The student explains one topic in a short speech they wrote.',
    'Listen for a clear plan you can follow from start to end.',
    'You should be able to explain the topic to a friend after.',
    'A short slip of memory is fine. Judge the whole speech.',
  ]),
  imp: Object.freeze([
    'The student gets a topic in the room, plans, and then speaks.',
    'A short plan leaves more time to speak.',
    'Listen for a clear point, a few parts, and examples that fit.',
    'Reward calm, clear thinking more than polish.',
  ]),
  sto: Object.freeze([
    'The student tells a story from memory, as if to a group of kids.',
    'Listen for a story that pulls you in from the first line.',
    'Each character should be easy to tell apart.',
    'The intro should name the story and who wrote it.',
  ]),
  osw: Object.freeze([
    'The student performs a poem they wrote, from memory.',
    'Listen for strong words that make clear pictures.',
    'The message should come through by the end.',
    'Pace and pauses matter. Notice where they help.',
  ]),
  dec: Object.freeze([
    'The student gives a real speech that someone else gave before, from memory.',
    'The intro should say who gave it, when, and why it still matters.',
    'Listen for the meaning, not just the words.',
    'Good delivery makes an old speech feel fresh and alive.',
  ]),
  pcc: Object.freeze([
    'The student argues for a topic, then against it, on one clock.',
    'Listen for a clear case on each side.',
    'Both sides should get the same care and the same effort.',
    'Facts should be fair and easy to follow.',
  ]),
  custom: Object.freeze([
    'You set up this event. Ask the tab room if you are not sure of the rules.',
    'Listen for a clear message and a plan you can follow.',
    'Note the time, and note anything that seemed off the rules.',
  ]),
});

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).listenFor = LISTEN_FOR;
