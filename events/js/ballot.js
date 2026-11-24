// Speech Events step E8 (docs/events/LANDING.md §4.1): what the judge copies into the online ballot, in two stages,
// and the print sheet (primitive N12; DESIGN.md §4.4, §4.7). Pure.
//
// Two stages, because Tabroom and SpeechWire lock ranks when the judge submits but keep comments open to edit:
//   1. "Ranks to submit": one line per entry (code, rank, rating, over time yes or no) and one Copy ranks button.
//   2. One card per entry with its comment and its own Copy comment button; then the reason for rank.
// Room state (ARCHITECTURE.md §6.3): 'review' once the ranks are copied ("Ranks sent, comments open"), 'done' only
// when every speaker in the room has a comment and it is copied, and the reason for rank (when written) is copied
// too. A speaker with no comment keeps the room open: a ballot with an empty comment is not finished.
import { ballotComment } from './comments.js';
import { present, entryOf } from './room.js';
import { orderOf, ratingScale } from './rank.js';
import { boardCtx, ranksOf, isOverGrace } from './board.js';
import { clockText } from './timer.js';
import { pieceLine } from './piece.js';
import { questionOf } from './question.js';
import { layerOf, layerProblems, ranksShown, shownRank, notRankedText, rubricScores, rubricTotal, rubricMax } from './profile-layer.js';
import { storedRunsLine, topicOf } from './runs.js';

// "Over time" on the ranks line: the sticky over-grace flag (inside grace is still on time, ARCHITECTURE.md §6.2).
export const overTime = isOverGrace;
const ratingText = (e) => (e.rating == null || e.rating === '' ? '' : String(e.rating));

// The entries in the order a card list shows them: 'speaking' (the order online ballots list them) or 'rank'.
export function entriesIn(room, order) {
  const list = present(room);
  if (order !== 'rank') return list;
  return orderOf(ranksOf(room), boardCtx(room)).map((id) => entryOf(room, id));
}

// Stage 1: one row per entry, in speaking order. Returns { rows: [{ id, code, rank, rating, overTime, rubric }], text,
// rated, ranked, rubric }.
// Step S4 (profile layer, profile-layer.js): ranked is false under ranks 'off' and critiqueOnly (no Rank column);
// under 'topN' a rank past N is '' and the copy text says "Not in top N"; a rubric adds each score and the total.
export function ranksBlock(room) {
  const rated = ratingScale(room.profile).kind !== 'none';
  const layer = layerOf(room.profile);
  const ranked = ranksShown(room.profile);
  const rubric = layer.rubric;
  const rows = present(room).map((e) => {
    const s = rubricScores(e);
    const total = rubricTotal(e, rubric);
    return { id: e.id, code: e.code, rank: shownRank(e.rank, room.profile), rating: ratingText(e), overTime: overTime(e),
      rubric: rubric.length ? { scores: rubric.map((c) => ({ label: c.label, value: s[c.id] == null ? '' : String(s[c.id]) })), total: total == null ? '' : String(total), max: rubricMax(rubric) } : null };
  });
  const rankWord = (r) => (r.rank ? 'Rank ' + r.rank : layer.ranks === 'topN' ? notRankedText(room.profile) : 'Rank –');
  const rubricWords = (r) => (r.rubric ? rubricParts(r.rubric).concat(['Total ' + (r.rubric.total || '–') + ' of ' + r.rubric.max]).join('\t') : '');
  const text = rows.map((r) => [r.code, ranked ? rankWord(r) : '', rated ? 'Rating ' + (r.rating || '–') : '', rubricWords(r), 'Over time: ' + (r.overTime ? 'Yes' : 'No')].filter(Boolean).join('\t')).join('\n');
  return { rows, text, rated, ranked, rubric: rubric.length > 0 };
}
// One row's rubric scores in words: ['Content 4', 'Delivery –', ...] (ranksBlock, the print sheet, the Review table).
const rubricParts = (rub) => rub.scores.map((x) => x.label + ' ' + (x.value || '–'));
// The same with the total, on one line: "Content 4, Delivery 3 · 7 of 10".
export const rubricLine = (rub) => rubricParts(rub).join(', ') + ' · ' + (rub.total || '–') + ' of ' + rub.max;

// Why the ranks cannot be copied yet ([] = they can): rank.js checkBoard's list, or the Rate checks under ranks 'off',
// or nothing under critiqueOnly (profile-layer.js layerProblems).
export const ranksProblems = (room) => layerProblems(room);

// The critique helper under each comment (N11, DESIGN.md §4.4): three quiet checks in words that tick themselves
// from simple text checks. No score, and it never blocks copying. The word lists are a starting guess.
const STRENGTH = /\b(good|great|strong|clear|well|liked?|loved?|enjoyed|effective|excellent|nice|impressive|engaging|confident|natural|kept my interest|easy to (follow|listen|understand))\b/i;
const TO_WORK = /\b(try|work on|next time|could|consider|should|would|more|less|improve|instead|remember|watch|slow|faster|louder|tighten|add|cut)\b/i;
const WHY_RANK = /\b(rank(ed)?|placed?|1st|2nd|3rd|[4-8]th|first|second|third|top|because|compared|over the others|in this round)\b/i;
export function critique(text) {
  const t = String(text || '');
  return [
    { id: 'strength', label: 'Names one strength', ok: STRENGTH.test(t) },
    { id: 'toWork', label: 'Names one thing to work on', ok: TO_WORK.test(t) },
    { id: 'why', label: 'Says why this rank', ok: WHY_RANK.test(t) },
  ];
}

// Stage 2: one card per entry. Returns [{ id, code, name, piece, rank, rating, comment, copied, critique, question, ranked }].
// ranked (step S4): false when the round has no ranks (ranks 'off' or critiqueOnly), so the card says nothing of a rank.
// name: the entry's name ("First & Second" for a Duo, step E9); piece: "“Title” by Author" ('' when not typed).
// question: the drawn question (step E10, extemp events), '' when there is none. It is not part of the comment.
// topic, runs: step S5 (F4, PCC): the student's topic and "Pro 4:12 · Con 3:58" ('' when none). Not part of the comment.
// event (optional): the room's event file, for the run labels. rank and ranked follow the profile layer (step S4).
export function cards(room, order, event) {
  const ranked = ranksShown(room.profile);
  return entriesIn(room, order).map((e) => {
    const comment = ballotComment(e);
    return { id: e.id, code: e.code, name: e.name || '', piece: pieceLine(e), rank: shownRank(e.rank, room.profile), rating: ratingText(e), comment, copied: Boolean(e.commentCopiedAt), critique: critique(comment), question: questionOf(e), ranked,
      topic: topicOf(e), runs: storedRunsLine(e, event) };
  });
}

// The checklist at the top, in words (DESIGN.md §4.7).
// Step S4: under ranks 'off' the first line counts the rated entries; under critiqueOnly there is no ranks line and no
// reason-for-rank line (nothing is ranked).
export function checklist(room) {
  const list = present(room);
  const n = list.length;
  const layer = layerOf(room.profile);
  const commented = list.filter((e) => ballotComment(e).trim()).length;
  const comments = { label: commented + ' of ' + n + ' comments', ok: commented === n };
  if (layer.critiqueOnly) return [comments];
  let first;
  if (layer.ranks === 'off') {
    const rated = ratingScale(room.profile).kind !== 'none';
    const done = list.filter((e) => (!rated || ratingText(e) !== '') && layer.rubric.every((c) => String(rubricScores(e)[c.id] ?? '') !== '')).length;
    first = { label: done + ' of ' + n + ' rated', ok: done === n };
  } else {
    const ranked = list.filter((e) => e.rank).length;
    first = { label: ranked + ' of ' + n + ' ranked', ok: ranked === n };
  }
  return [first, comments, { label: layer.ranks === 'off' ? 'Notes for the room written' : 'Reason for rank written', ok: Boolean(String(room.reasonForRank || '').trim()) }];
}

// Does this round copy ranks at all? Not under critiqueOnly (step S4): its ballot is comments only.
export const hasRanksStage = (room) => !layerOf(room.profile).critiqueOnly;

// The room's status line on the Review screen.
export function statusText(room) {
  if (room.state === 'done') return 'Copied';
  if (!hasRanksStage(room)) return 'Comments open';
  if (room.ranksCopiedAt) return 'Ranks sent, comments open';
  return 'Ranks not sent';
}

// After a copy: the room with its copy marks and state. what: 'ranks' | 'reason' | an entry id.
export function markCopied(room, what, now) {
  let r = Object.assign({}, room, { updatedAt: now });
  if (what === 'ranks') r.ranksCopiedAt = now;
  else if (what === 'reason') r.reasonCopiedAt = now;
  else r.entries = room.entries.map((e) => (e.id === what ? Object.assign({}, e, { commentCopiedAt: now }) : e));
  const allComments = present(r).every((e) => e.commentCopiedAt && ballotComment(e).trim());
  const reasonDone = Boolean(r.reasonCopiedAt) || !String(r.reasonForRank || '').trim();
  const ranksDone = Boolean(r.ranksCopiedAt) || !hasRanksStage(r); // critiqueOnly: there are no ranks to copy
  if (ranksDone && allComments && reasonDone) { r.state = 'done'; r.copiedAt = r.copiedAt || now; }
  else if (ranksDone) r.state = 'review';
  return r;
}

// The judge edits a comment on its card. A changed comment must be copied again, so its copy mark goes (and a room
// that was 'done' is back to 'review').
export function setComment(room, id, text, now) {
  const r = Object.assign({}, room, { updatedAt: now, entries: room.entries.map((e) => (e.id === id ? Object.assign({}, e, { comment: String(text), commentSource: 'judge', commentCopiedAt: null }) : e)) });
  if (r.state === 'done') { r.state = 'review'; r.copiedAt = null; }
  return r;
}
// The reason for rank changed on the Review screen: it must be copied again.
export function setReasonReview(room, text, now) {
  const r = Object.assign({}, room, { reasonForRank: String(text), reasonCopiedAt: null, updatedAt: now });
  if (r.state === 'done') { r.state = 'review'; r.copiedAt = null; }
  return r;
}

// The lines above an entry's comment on "Copy all" and the print sheet: the drawn question (step E10), and for PCC
// (step S5) the student's topic and the Pro and Con times. [] when there are none.
const leadLines = (c) => [c.question && 'Question: ' + c.question, c.topic && 'Topic: ' + c.topic, c.runs && 'Runs: ' + c.runs].filter(Boolean);
// The same lines as one block for the print sheet, then a blank line; '' when there are none.
const entryLead = (c) => {
  const lines = leadLines(c);
  return lines.length ? lines.join('\n') + '\n\n' : '';
};

// "Copy all": one block for paper or email: the ranks, then each comment, then the reason for rank.
export function copyAllText(room, event) {
  const head = [event ? event.name : 'Custom event', room.round, room.tournament].filter(Boolean).join(' · ');
  const block = ranksBlock(room);
  const parts = [head].concat(hasRanksStage(room) ? ['', block.ranked ? 'Ranks' : 'Ratings', block.text] : []);
  for (const c of cards(room, 'speaking', event)) parts.push('', c.code + (c.rank ? ' (rank ' + c.rank + ')' : ''), ...leadLines(c), c.comment || '(no comment)');
  if (String(room.reasonForRank || '').trim()) parts.push('', 'Reason for rank', room.reasonForRank.trim());
  return parts.join('\n');
}

// The print sheet model for core/sheets.js printSheetHtml: facts, the ranks table, one text section per entry, and
// the reason for rank. The private note and rule-check flags are never on it.
export function printModel(room, event, limit) {
  const { rows, rated, ranked, rubric } = ranksBlock(room);
  const head = [{ text: 'Code' }].concat(ranked ? [{ text: 'Rank' }] : [], rated ? [{ text: 'Rating' }] : [], rubric ? [{ text: 'Rubric' }] : [], [{ text: 'Time' }, { text: 'Over time' }]);
  const tableRows = rows.map((r) => {
    const e = entryOf(room, r.id);
    // The time used; on a prep event (step E11) prep and speech together, against the shared limit. Like the speech
    // time here since E8, it is the stopped time (a print has no clock); prep.js totalUsedAt is the live total.
    const used = Math.round((((e.timing && e.timing.usedMs) || 0) + ((e.timing && e.timing.prepMs) || 0)) / 1000);
    return [{ text: r.code }].concat(ranked ? [{ text: r.rank || '–' }] : [], rated ? [{ text: r.rating || '–' }] : [],
      rubric ? [{ text: rubricLine(r.rubric) }] : [],
      [{ text: used ? clockText(used) : '–' }, { text: r.overTime ? 'Yes' : 'No' }]);
  });
  const facts = [['Event', event ? event.name : 'Custom event'], ['Round', room.round], ['Flight', room.flight], ['Tournament', room.tournament], ['Time limit', limit ? clockText(limit) : ''], ['Rules', room.profile && room.profile.name]].filter(([, v]) => v);
  return {
    title: 'Ballot · ' + [event ? event.short : 'Custom', room.round].filter(Boolean).join(' · '),
    landscape: false,
    sections: [{ kind: 'facts', items: facts }].concat(hasRanksStage(room) ? [{ kind: 'table', title: ranked ? 'Ranks' : 'Ratings', head, rows: tableRows }] : [])
      .concat(cards(room, 'speaking', event).map((c) => ({ kind: 'text', title: [c.code + (c.rank ? ' · rank ' + c.rank : ''), c.piece].filter(Boolean).join(' · '), cls: 'ps-entry', text: entryLead(c) + c.comment })))
      .concat([{ kind: 'text', title: 'Reason for rank', cls: 'ps-reason', text: room.reasonForRank || '' }]),
  };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).ballot = Object.freeze({
  overTime, entriesIn, ranksBlock, rubricLine, ranksProblems, critique, cards, checklist, hasRanksStage, statusText, markCopied, setComment, setReasonReview,
  copyAllText, printModel,
});
