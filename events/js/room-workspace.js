// Speech Events step S1 (docs/events/EXPERIENCE.md §2.2, §2.3): the room workspace. It puts the shipped Room, Rank and
// Review screens behind the workspace contract, so the round-type router (js/workspaces.js) can open a round of any
// room family the same way. It is a thin wrapper: each stage is the shipped screen, drawn by its own show() and hide().
// The stage names are the router's (#/round/<id>/<stage>): judge is the Room screen.
// It does not import the screens: only app.js imports and makes them (LANDING.md §3, events/room.test.mjs), once for
// the page as before S1, and hands them in as env.roomScreens { judge, rank, review }.
//
// Contract (§2.3). §2.3 names one registry key per module (`family`). This one module serves four keys (§2.2), so it
// also names them all in `families`; `family` is its own name.
//   family, families                          the workspace name, and the WORKSPACES keys that load this module
//   newRound(def, profile, input)             a new round record (pure): room.js createRoom
//   stages(round)                             the stepper list: judge, rank, review
//   mount(el, env, round, stage) -> unmount   draws one stage in el (the shipped screen's show), and the clean-up
//                                             (its hide). el must be env.el, the box the screens were made with.
//   keys(round, stage)                        { scope, run(action) } for the page's one key handler (js/keys.js)
//   validate(round)                           the lines that stop the ranks from being copied ([] = none)
//   summary(round)                            { status, done, total, next } for a home card and History
//   rankModel(round), reviewModel(round)      the data the Rank and Review screens draw
// In S1 nothing in the page calls newRound, validate, summary, rankModel or reviewModel: the shipped screens still
// read the room themselves. Their shapes are first drafts for S2 and later; check them before building on them.
import { createRoom, present, nextWaiting } from './room.js';
import { STATE_LABEL } from './rooms.js';
import { boardCtx, ranksOf, ratingsOf } from './board.js';
import { ranksBlock, ranksProblems, cards, checklist, statusText } from './ballot.js';
import { stagesOf, layerOf } from './profile-layer.js';

export const family = 'room';
export const families = Object.freeze(['f1', 'f2', 'f3', 'custom']);

// Step S4 (profile layer, EXPERIENCE.md §2.4): the round's frozen profile picks the stages and the Rank screen. A
// critiqueOnly round has no Rank stage (judge, review). A ranks 'off' round draws its 'rank' stage with the Rate screen
// (env.roomScreens.rate), so the address stays #/round/<id>/rank.
const screenFor = (env, round, stage) => (stage === 'rank' && layerOf(round.profile).ranks === 'off' ? env.roomScreens.rate : env.roomScreens[stage]);
// Each stage's key scope (js/keys.js names the room scope's shortcuts; rank and review have none yet).
const SCOPE = Object.freeze({ judge: 'room', rank: 'rank', review: 'review' });

// input: { entries, tournament, round, flight, now, makeId } as createRoom takes them.
export const newRound = (def, profile, input) => createRoom(Object.assign({}, input, { event: def, profile }));

export const stages = (round) => stagesOf(round && round.profile);

// The screen that shows now (one round shows at a time), for keys().run.
let showing = null;

export function mount(el, env, round, stage) {
  if (el !== env.el) throw new Error('room workspace: the shipped screens draw in env.el');
  const screen = stages(round).includes(stage) && env.roomScreens ? screenFor(env, round, stage) : null;
  if (!screen) throw new Error('room workspace: no screen for the stage ' + stage);
  showing = screen;
  screen.show(round.id);
  return function unmount() {
    if (showing === screen) showing = null;
    if (screen.hide) screen.hide();
  };
}

export const keys = (round, stage) => ({
  scope: SCOPE[stage],
  run: (action) => Boolean(showing && showing.run && showing.run(action)),
});

export const validate = (round) => ranksProblems(round);

export function summary(round) {
  const list = present(round);
  const next = nextWaiting(round);
  return { status: STATE_LABEL[round.state] || STATE_LABEL.setup, done: list.filter((e) => e.status === 'done').length, total: list.length, next: next ? next.code : null };
}

export const rankModel = (round) => (layerOf(round.profile).critiqueOnly ? null : { ranks: ranksOf(round), ratings: ratingsOf(round), ctx: boardCtx(round) });

export const reviewModel = (round) => ({ status: statusText(round), checklist: checklist(round), ranks: ranksBlock(round), cards: cards(round) });
