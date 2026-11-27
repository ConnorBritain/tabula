// Synthetic teaching material. No recording, provider output, or performance claim.
import { createEventsWriter } from '../js/writer.js';
import { createRoom, updateEntry } from '../js/room.js';
import { applyInput } from '../js/comments.js';
import { setUsedTiming } from '../js/timer.js';
import { withRanks } from '../js/board.js';
export const speech = [
  'A repair table can change how we see a broken object. Imagine a lamp with a loose wire. We can throw it away, or ask someone to teach us how to repair it.',
  'My proposal is a monthly repair table at the library. Volunteers would explain each repair while the owner watches. The goal is to share a skill, not just return a working lamp.',
  'Safety comes first. Volunteers must refuse unsafe jobs. The library should start with simple repairs and make the limits clear.',
  'A repaired lamp is useful. A person who knows when to repair something, and when to ask for help, carries that lesson home.'
];
export const manualNote = 'The repair-table proposal is clear. Explain how volunteers would check which repairs are safe.';
export const draft = 'Your repair-table proposal was clear. Explain how volunteers would decide which repairs are safe before they begin.';
export function sampleRoom(data, id = 'events-watch', frame = 0) {
  let n = 0;
  let room = createRoom({event: data.events.get('oo'), profile: data.profiles.get('nsda-district'), tournament: 'Sample community invitational', round: 'Practice 1', now: 0, makeId: prefix => prefix === 'r' ? id : 'sample-' + (++n), entries: [
    {code:'A12', name:'Maya Chen', title:'The repair table'},
    {code:'B07', name:'Jordan Ellis', title:'A place to listen'}
  ]});
  if (frame >= 1) room = updateEntry(room, room.current, e => ({...e, timing:setUsedTiming(e.timing, 24, 0, 600, 30), status:'done'}), 0);
  if (frame >= 2) room = applyInput(room, 'notes', manualNote, 0);
  if (frame >= 3) room = updateEntry(room, 'sample-2', e => ({...e, status:'done', notes:'The quiet-bench example made your listening proposal clear. Explain who would maintain the space.', timing:setUsedTiming(e.timing, 28, 0, 600, 30)}), 0);
  if (frame >= 4) room = {...withRanks(room, {'sample-1':'1','sample-2':'2'}, 0), reasonForRank:'Sample judge decision: Maya addressed a safety limit. Jordan left the maintenance question open.'};
  return room;
}
// One cancellable playback clock. Manual advance remains available under reduced motion.
export function createPlayback({schedule = setTimeout, cancel = clearTimeout, advance, delay = 4500}) {
  let timer = null, generation = 0;
  const pause = () => { generation++; if (timer !== null) cancel(timer); timer = null; };
  const play = () => { pause(); const ticket = generation; const tick = () => { if (ticket !== generation) return; timer = null; if (advance()) timer = schedule(tick, delay); }; timer = schedule(tick, delay); };
  return {play, pause};
}

// Only this fixed manual note has a saved rewrite. Practice text is never sent or invented.
export async function savedDraft(entries, signal, { mode = 'full', selection, request } = {}) {
  await Promise.resolve();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (mode !== 'full' || selection || request) throw new Error('This sample only includes Clarify for the whole sample comment. No AI service was called.');
  const entry = entries[0];
  if (!entry || (entry.comment || entry.notes).trim() !== manualNote) throw new Error('No saved sample matches these words. Keep your own feedback. No AI service was called.');
  return { [entry.id]: draft };
}

// The sample owns only memory in this page. Reuse the released writer lifecycle without claiming the real device lock.
export function createSampleWriter() {
  return createEventsWriter({ locks: () => ({ request: (name, options, callback) => Promise.resolve(callback({ name, mode: options.mode })) }) });
}
