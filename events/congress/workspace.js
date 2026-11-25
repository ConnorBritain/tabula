// Speech Events step S6 (docs/events/EXPERIENCE.md §2.2, §2.3; CONGRESS.md §4): the Congress workspace behind the
// round-type router. A "round" here is one CongressSession; it opens at #/round/<sessionId>/<stage> with the stages
// log, rank and review. Its records live in tabulaEvents.congress.v1 (store.js), never in rooms.v1.
// Contract (§2.3): family, families, newRound, stages, mount, keys, validate, summary, rankModel, reviewModel.
// The model members need the session's chamber; they take it as a second argument when the caller has it
// (round.chamber is not stored on the session, so a caller with only the session passes the chamber in).
import { newSession } from './chamber.js';
import { mountSession } from './session-screen.js';
import { congressIO, findSession, findChamber } from './store.js';
import { rankModel as rankOf } from './rank.js';
import { reviewBlocks, rankProblems, sessionStatus } from './review.js';
import { precedenceOrder } from './speech.js';

export const family = 'congress';
export const families = Object.freeze(['congress']);
const STAGES = Object.freeze(['log', 'rank', 'review']);

// A new session record (pure). def: the chamber; profile: unused (the chamber holds its frozen profile);
// input: { sessions, now, makeId }. Returns { chamber, session } (the chamber gains the session id).
export const newRound = (def, profile, input) => newSession(def, input.sessions || [], input);

export const stages = () => STAGES;

export function mount(el, env, round, stage) {
  if (!STAGES.includes(stage)) throw new Error('congress workspace: no stage ' + stage);
  return mountSession(el, env, round.id, stage);
}

// No Congress shortcuts yet (the page's palette still works on every screen).
export const keys = () => ({ scope: null, run: () => false });

// The chamber of a session from the page's store.
export const chamberOf = (env, session) => findChamber(congressIO(env.store).read(), session.chamberId);
// The saved session with this id from the page's store, or null (app.js uses it when rooms.v1 has no such round).
export const findRound = (store, id) => findSession(congressIO(store).read(), id);

export const validate = (round, chamber, now = Date.now()) => (chamber ? rankProblems(chamber, round, now) : ['This chamber is not on this device.']);

export function summary(round, chamber) {
  const next = chamber ? precedenceOrder(chamber, round)[0] : null;
  return { status: sessionStatus(round), done: round.speeches.length, total: chamber ? chamber.legislators.filter((l) => l.status === 'present').length : 0, next: next ? next.code : null };
}

export const rankModel = (round, chamber) => (chamber ? rankOf(chamber, round) : null);
export const reviewModel = (round, chamber) => (chamber ? { status: sessionStatus(round), blocks: reviewBlocks(chamber, round) } : null);

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressWorkspace = Object.freeze({ family, families, newRound, stages, mount, keys, validate, summary, rankModel, reviewModel, findRound, chamberOf });
