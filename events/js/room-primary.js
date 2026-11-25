// The one primary of the Room screen (design build 2026-11-24; docs/design/EVENTS-COLOR-ICON-REVIEW.md top 10 #1). The
// solid fill moves with the work: Start or Stop while the speaker is up; after the stop, with speakers left, "Next
// speaker"; when nobody waits, "Rank the room" (or Rate, or "Review and copy"). Until then the header's Rank button is
// secondary and says how far the room is ("Rank the room · 2 of 6"). Pure (Node tests call it).
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { nextWaiting, present } from './room.js';
import { rankStageLabel } from './profile-layer.js';

// 'timer' | 'next' | 'rank'. entry: the speaker on screen (null when the room has none).
export function roomPrimary(room, entry) {
  if (entry && (entry.status === 'waiting' || entry.status === 'speaking')) return 'timer';
  return nextWaiting(room) ? 'next' : 'rank';
}

// The header's button to the next stage. primary: roomPrimary(...). A room with no rank stage goes to Review.
export function goRankHtml(room, primary) {
  const word = rankStageLabel(room.profile);
  const here = present(room);
  const done = here.filter((e) => e.status === 'done').length;
  const href = word ? `#/rank/${encodeURIComponent(room.id)}` : `#/review/${encodeURIComponent(room.id)}`;
  const label = word ? word + ' the room' : 'Review and copy';
  if (primary === 'rank') return `<a class="b primary" id="go-rank" href="${href}">${icon(word ? 'list-ordered' : 'copy', 20)}${esc(label)}</a>`;
  return `<a class="b" id="go-rank" href="${href}">${icon(word ? 'list-ordered' : 'copy')}${esc(label)} <span class="muted">· ${done} of ${here.length}</span></a>`;
}

// "Next speaker: U2" next to the timer when it is the primary (the code of the next speaker who waits).
export function nextTopHtml(room) {
  const nx = nextWaiting(room);
  return nx ? `<button class="b primary next-top" type="button" data-act="next" data-key="next">Next speaker: ${esc(nx.code)}${icon('arrow-right', 20)}</button>` : '';
}
