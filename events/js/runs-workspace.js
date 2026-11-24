// Speech Events step S5 (docs/events/EXPERIENCE.md §2.2, §2.3, §3 F4 row): the workspace of family F4, two runs in one
// entry (Pro Con Challenge). It keeps the §2.3 contract of the room workspace and reuses it: the Rank and Review
// stages are the shipped screens (one rank per entry, the whole clock against the one limit), and validate, summary,
// rankModel and reviewModel read the round the same way. What differs is the judge stage: a Room screen made with the
// F4 parts (runs-view.js: the topic field, the phase bar, the run cards and "Con started"). app.js makes it, as it
// makes every screen, and hands it in as env.runsScreens.judge.
//
// Contract (§2.3), as in room-workspace.js:
//   family, families        'f4', and the WORKSPACES keys that load this module
//   newRound(def, profile, input)   a new round (pure): room.js createRoom, then the run fields on each entry
//   stages, mount, keys, validate, summary, rankModel, reviewModel
import { createRoom } from './room.js';
import { runEntryDefaults } from './runs.js';
import * as room from './room-workspace.js';

export const family = 'f4';
export const families = Object.freeze(['f4']);

// input: { entries, tournament, round, flight, now, makeId } as createRoom takes them. Each entry starts with no runs
// and an empty topic (the student says it in the room).
export function newRound(def, profile, input) {
  const r = createRoom(Object.assign({}, input, { event: def, profile }));
  return Object.assign({}, r, { entries: r.entries.map((e) => Object.assign({}, e, runEntryDefaults())) });
}

export const stages = room.stages;

// The screen of a stage: the F4 Room screen for judge, the shipped Rank and Review screens for the rest.
const own = room.stageMounter('runs workspace', (env, stage) => (stage === 'judge'
  ? (env.runsScreens ? env.runsScreens.judge : null)
  : (env.roomScreens ? env.roomScreens[stage] : null)));
export const mount = own.mount;
export const keys = own.keys;

export const validate = room.validate;
export const summary = room.summary;
export const rankModel = room.rankModel;
export const reviewModel = room.reviewModel;
