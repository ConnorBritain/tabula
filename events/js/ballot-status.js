// Progress on the Rank and Rate screens (design build 2026-11-24; docs/design/EVENTS-COLOR-ICON-REVIEW.md top 10 #7,
// owner D2 A). "Before you review" is a caution list; each item names a speaker and is a button that scrolls to that
// row. "Ready" is green with a check (the D2 reading: the ranking work is finished). A Rate or Rubric row says how far
// it is ("Rated 8", "16 / 25 · 4 of 5"). Every color goes with a word. Pure builders (Node tests call them); the
// clicks that use them are in ballot-nav.js.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { present } from './room.js';
import { ratingError, ratingScale } from './rank.js';
import { rubricScores, rubricTotal, rubricMax, rubricError, layerOf, layerProblems } from './profile-layer.js';

const blank = (v) => v == null || String(v).trim() === '';
// The one answer to "is this row done?" that the row pills and the footer count share.
export const ratedOk = (rating, scale) => !blank(rating) && !ratingError(rating, scale);
export const rubricScored = (e, crit) => { const v = rubricScores(e)[crit.id]; return !blank(v) && !rubricError(v, crit); };

// The entry a problem line is about: the first present entry whose code stands as a whole word in the text, or null
// (a room-wide line such as "Add the speakers"). Longer codes first, so "A12" never matches inside "A120".
export function problemTarget(room, text) {
  const list = present(room).slice().sort((a, b) => b.code.length - a.code.length);
  const hit = list.find((e) => new RegExp('(^|[^A-Za-z0-9-])' + e.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^A-Za-z0-9-])').test(text));
  return hit ? hit.id : null;
}

// "Before you review" as HTML text: a caution panel (a full 1 px edge in --caution, never a side bar) with a word in
// its heading. An item about one speaker is a button that takes the judge to that row (data-jump).
export function problemsListHtml(room, list) {
  const items = list.map((p) => {
    const id = problemTarget(room, p);
    return id ? `<li><button class="prob-jump" type="button" data-jump="${esc(id)}">${esc(p)}${icon('arrow-right')}</button></li>` : `<li>${esc(p)}</li>`;
  }).join('');
  return `<div class="problems caution" role="status"><h2>${statusPillHtml('caution', 'Not ready', 'triangle-alert')} Before you review</h2><ul>${items}</ul></div>`;
}

// The ready line: green, a check and the word, then the plain sentence.
export const readyHtml = (text) => `<p class="problems ok" role="status">${statusPillHtml('ok', 'Ready', 'circle-check')} ${esc(text)}</p>`;

// A Rate or Rubric row's progress pill. Rating: "Rated 8" (green) or "Not rated" (caution). Rubric: "16 / 25 · 4 of 5"
// while open (caution), "All scored · 21 / 25" when every part has a valid score (green). Both: the rubric pill
// follows the rating pill. scale: rank.js ratingScale; rubric: the profile's criteria.
export function rateRowPill(e, rating, scale, rubric) {
  const out = [];
  if (scale && scale.kind !== 'none') {
    out.push(ratedOk(rating, scale) ? statusPillHtml('ok', 'Rated ' + rating, 'circle-check') : statusPillHtml('caution', 'Not rated', 'circle'));
  }
  if (rubric && rubric.length) {
    const scored = rubric.filter((c) => rubricScored(e, c)).length;
    const total = rubricTotal(e, rubric);
    const sum = (total == null ? 0 : total) + ' / ' + rubricMax(rubric);
    out.push(scored === rubric.length ? statusPillHtml('ok', 'All scored · ' + sum, 'circle-check') : statusPillHtml('caution', sum + ' · ' + scored + ' of ' + rubric.length, 'circle'));
  }
  return out.length ? `<span class="row-status">${out.join('')}</span>` : '';
}


// How far the ballot is, for the sticky footer (top 10 #6). Returns { word, open } where word is the progress in words
// ("2 of 3 rated", "4 of 5 scored", "All ranked", "All rated") and open is the id of the first row still to fix, or
// null when there is nothing to fix (or the problem names no speaker). stage: 'rank' or 'rate'.
export function ballotProgress(room, stage) {
  const list = present(room);
  const problems = layerProblems(room);
  const open = problems.map((p) => problemTarget(room, p)).find(Boolean) || null;
  if (!problems.length) return { word: stage === 'rate' ? 'All rated' : 'All ranked', open: null };
  const rubric = layerOf(room.profile).rubric;
  const scale = ratingScale(room.profile);
  if (rubric.length) {
    const scored = list.filter((e) => rubric.every((c) => rubricScored(e, c))).length;
    return { word: scored + ' of ' + list.length + ' scored', open };
  }
  if (scale.kind !== 'none') {
    const rated = list.filter((e) => ratedOk(e.rating, scale)).length;
    return { word: rated + ' of ' + list.length + ' rated', open };
  }
  return { word: problems.length + (problems.length === 1 ? ' thing' : ' things') + ' to fix', open };
}

// The sticky ballot footer as HTML text (top 10 #6, owner D4 B): the progress word on the left and a full-height
// "Review and copy" on the right, the screen's one primary. It is never disabled (§5.1 rule 1): while work is open, a
// tap takes the judge to the first open row (data-open), and the word says what is left. Only the Rank and Rate screens
// draw it, so it never shows with the Room's sticky timer bar (OD1).
export function ballotFootHtml(room, stage) {
  const p = ballotProgress(room, stage);
  return `<span class="bf-progress" id="bf-progress" role="status">${p.open ? icon('circle', 14) : icon('circle-check', 14)}${esc(p.word)}</span>
    <a class="b primary" id="go-review" href="#/review/${encodeURIComponent(room.id)}"${p.open ? ` data-open="${esc(p.open)}"` : ''}>Review and copy${icon('arrow-right', 20)}</a>`;
}

// The rubric block to open first (§5.4): the first speaker not fully scored, else none. list: the rows in screen order.
export function firstOpenRubric(list, rubric) {
  if (!rubric.length) return null;
  const e = list.find((x) => !rubric.every((c) => rubricScored(x, c)));
  return e ? e.id : null;
}
