// Speech Events step E12 (docs/events/LANDING.md §4.1): the Custom event. A judge sets the time limit and grace for
// any local event that has no file in events/defs/ (ARCHITECTURE.md §6.1; EVENTS.md §4: a league event, or a middle
// school Prose room at 7:00). Pure: no DOM, no storage.
//
// The room keeps what the judge typed, so it reopens with the same rules (ARCHITECTURE.md §6.3, rules frozen at setup):
//   - the limit goes in the room's own event (room.customEvent, written by room.js createRoom);
//   - the grace goes in the room's own copy of the rules profile (profile.overtime.grace), where timer.js graceOf
//     reads it for every event. The rest of the profile (rating, overtime effect) stays as the judge picked it.
import { CUSTOM_EVENT } from './room.js';
import { parseClock } from './timer.js';

// The limits the form accepts. A limit from 0:30 to 60:00 covers every event in EVENTS.md (the longest group events
// wait for a later step). Grace from 0 (none) to 5 minutes.
const LIMIT_MIN = 30;
const LIMIT_MAX = 3600;
const GRACE_MAX = 300;
const CUSTOM_NAME = 'Custom event';
const NAME_MAX = 60;

// The grace the judge typed, in whole seconds, or null when it is not a whole number of seconds.
export function parseGrace(text) {
  const t = String(text == null ? '' : text).trim();
  return /^\d{1,3}$/.test(t) ? Number(t) : null;
}

// Why the form cannot start a room yet, in plain words, or '' when it can. form: { limit, grace } as typed.
export function customError(form) {
  const f = form || {};
  const limit = parseClock(f.limit);
  if (limit == null) return 'Type the time limit in minutes and seconds, for example 7:00.';
  if (limit < LIMIT_MIN || limit > LIMIT_MAX) return 'Use a time limit from 0:30 to 60:00.';
  const grace = parseGrace(f.grace);
  if (grace == null) return 'Type the grace in whole seconds, for example 30. Type 0 for no grace.';
  if (grace > GRACE_MAX) return 'Use a grace from 0 to ' + GRACE_MAX + ' seconds.';
  return '';
}

// The room's own event file, in the same shape as a published one (ARCHITECTURE.md §6.1), so every screen reads it the
// same way. No rule checks, tags or prompts: the app does not know this event's rules. form: { name, limit } as typed,
// already checked with customError.
export function customEvent(form) {
  const name = String((form && form.name) || '').trim().slice(0, NAME_MAX) || CUSTOM_NAME;
  return {
    id: CUSTOM_EVENT,
    version: 1,
    name,
    short: 'Custom',
    category: 'custom',
    performers: 1,
    timing: { limit: parseClock(form.limit), inRoomPrep: false, sharedClock: false },
    material: '',
    checks: [],
    prompts: [],
    tags: [],
  };
}

// A copy of the rules profile with the judge's grace in it. The registry's profile is frozen and is never changed.
export function withGrace(profile, grace) {
  const p = JSON.parse(JSON.stringify(profile));
  p.overtime = Object.assign({}, p.overtime, { grace: parseGrace(grace) });
  return p;
}
