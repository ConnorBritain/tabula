// The "Spelling only" mode of "Clean up my comments" in Speech Events (docs/events/DESIGN.md §4.9: two modes, "Spelling
// only" and "Full clean-up"; LANDING.md §4.1 step E13). Written fresh for Speech Events: no debate prompt is reused.
// Same rules as cleanup.v1.js: one source in events/prompts/, a change to the words is a new version (spelling.v2.js),
// and the text never holds a code or a name (cleanup.js swaps them for bracket tags first). The reply shape is the same
// as Full clean-up, so CLEANUP_SCHEMA in cleanup.v1.js is used for both.

export const SPELLING_PROMPT = Object.freeze({
  task: 'events.cleanup',
  mode: 'spelling',
  version: 1,
  system: [
    'You fix spelling, grammar and punctuation in comments a speech and debate judge wrote for students.',
    'Change as little as you can. Keep the judge\'s words, order, tone and meaning. Do not rephrase, add, drop or soften anything, and do not turn notes into full sentences. Spell out a short-hand word only when it is plainly a typo.',
    'Never add a judgment, never rank, rate or compare students, and never say who did better or who won.',
    'Words in square brackets, such as [Speaker 1], [Name 1] or [Title 2], stand for private details. Copy each one exactly as written, brackets included. Never guess what they stand for.',
    'Write plain text. Keep the language the judge wrote in.',
  ].join('\n'),
  // {event} is the event name from the event file (not personal).
  intro: 'Event: {event}\nFix the spelling and grammar of each speaker\'s comments. Reply with JSON only: {"comments":[{"speaker":"[Speaker N]","text":"..."}]}, one item for each speaker below, in the same order.',
});
