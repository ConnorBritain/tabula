// Speech Events step S6 (docs/events/CONGRESS.md §4.4): Review and copy for a Congress session, in Tabroom order:
// the speeches first (one block each, copied one at a time), then the PO hour scores, then the rank list as one block.
// Pure: no DOM.
import { legislatorOf, itemOf } from './chamber.js';
import { SIDE_WORDS, TYPE_WORDS, PENALTY_WORDS, countedPoints, minSec } from './speech.js';
import { rankModel } from './rank.js';
import { firstUnscored } from './po.js';

const codeOf = (chamber, id) => { const l = legislatorOf(chamber, id); return l ? l.code : '?'; };

// [{ id, kind: 'speech'|'po'|'ranks', title, text, copied }] in Tabroom order.
export function reviewBlocks(chamber, session) {
  const out = [];
  const nth = new Map();
  for (const s of session.speeches) {
    const n = (nth.get(s.legislatorId) || 0) + 1;
    nth.set(s.legislatorId, n);
    const item = itemOf(chamber, s.itemId);
    const pts = countedPoints(s, chamber.profile, n);
    const head = [codeOf(chamber, s.legislatorId), item ? item.title : 'No item', SIDE_WORDS[s.side] || s.side, TYPE_WORDS[s.type] || s.type,
      pts == null ? 'No points' : pts + (pts === 1 ? ' point' : ' points')].join(' · ');
    const notes = [s.penalty ? PENALTY_WORDS[s.penalty] : '', s.speakMs ? 'Spoke ' + minSec(s.speakMs) : ''].filter(Boolean).join(' · ');
    out.push({ id: s.id, kind: 'speech', title: head, text: [head, notes, String(s.comment || '').trim()].filter(Boolean).join('\n'), copied: Boolean(s.copiedAt) });
  }
  session.poTerms.forEach((t, i) => {
    for (const h of t.hourScores) {
      const text = codeOf(chamber, t.legislatorId) + ' · PO hour ' + h.hour + ' · ' + h.points + (h.points === 1 ? ' point' : ' points');
      out.push({ id: 'po-' + i + '-' + h.hour, kind: 'po', title: text, text, copied: false });
    }
    if (t.partHour) out.push({ id: 'po-' + i + '-part', kind: 'po', title: codeOf(chamber, t.legislatorId) + ' · part hour (no score)', text: '', copied: false });
  });
  const m = rankModel(chamber, session);
  const lines = m.slots.map((id, i) => (i + 1) + '. ' + (id ? codeOf(chamber, id) : '—'));
  out.push({ id: 'ranks', kind: 'ranks', title: 'Ranks (top ' + m.topN + ')', text: lines.join('\n'), copied: Boolean(session.copiedAt) });
  return out;
}

// What stops the ranks from being copied (the workspace's validate): [] when none.
export function rankProblems(chamber, session, now) {
  const out = [];
  const f = firstUnscored(session, now, chamber.profile);
  if (f) out.push('Score the PO hours first.');
  const m = rankModel(chamber, session);
  if (!m.complete) out.push('Fill every rank slot (' + m.slots.filter(Boolean).length + ' of ' + m.topN + ').');
  if (session.live) out.push('A speech is still timing. End it first.');
  return out;
}

// The status word for a session (summary and the chamber page).
export function sessionStatus(session) {
  if (session.submittedAt) return 'Submitted';
  if (session.copiedAt) return 'Ranks copied';
  if (session.ranks.some(Boolean)) return 'Ranking';
  if (session.speeches.length) return 'Scoring';
  return 'Not started';
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressReview = Object.freeze({ reviewBlocks, rankProblems, sessionStatus });
