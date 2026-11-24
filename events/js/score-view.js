// Speech Events: the score controls of one entry, shared by the Rank screen (step E7) and the Rate screen (step S4,
// docs/events/EXPERIENCE.md §2.4): the rating control (points steppers or word buttons) and the rubric grid (a row of
// steppers for each criterion). The rules are in rank.js, board.js and profile-layer.js.
// The builders are pure (Node tests call them). scoreClick and scoreInput turn a click or a typed value into a new
// room, so both screens handle them the same way; each screen saves and redraws.
import { escapeHtml as esc } from '../../core/sheets.js';
import { rubricScores, rubricTotal, rubricMax, stepRubric, withRubric, rubricError, layerOf } from './profile-layer.js';
import { ratingScale } from './rank.js';
import { withRating, stepRating } from './board.js';
import { entryOf } from './room.js';

// The rating control of one row as HTML text ('' when the profile has no rating).
export function ratingHtml(e, value, scale, err) {
  if (scale.kind === 'none') return '';
  const label = 'Rating for ' + e.code;
  const errHtml = `<p class="rate-err" id="rate-err-${e.id}">${esc(err)}</p>`;
  if (scale.kind === 'words') {
    return `<div class="rate words" role="group" aria-label="${esc(label)}">${scale.words.map((w) => `<button class="rate-word${w === value ? ' on' : ''}" type="button" data-ract="word" data-id="${e.id}" data-value="${esc(w)}" aria-pressed="${w === value}">${esc(w)}</button>`).join('')}</div>${errHtml}`;
  }
  return `<div class="rate points"><button class="b small" type="button" data-ract="minus" data-id="${e.id}" data-key="minus-${e.id}" aria-label="Lower the rating for ${esc(e.code)}"${value !== '' && Number(value) <= scale.min ? ' disabled' : ''}>−</button>
    <input class="rate-num" id="rate-${e.id}" data-ract="num" data-id="${e.id}" inputmode="decimal" autocomplete="off" value="${esc(value)}" aria-label="${esc(label)}, ${scale.min} to ${scale.max}" aria-describedby="rate-err-${e.id}"${err ? ' aria-invalid="true"' : ''}>
    <button class="b small" type="button" data-ract="plus" data-id="${e.id}" data-key="plus-${e.id}" aria-label="Raise the rating for ${esc(e.code)}"${value !== '' && Number(value) >= scale.max ? ' disabled' : ''}>+</button></div>${errHtml}`;
}


// The grid for one entry as HTML text ('' when the profile has no rubric).
export function rubricHtml(e, rubric) {
  if (!rubric.length) return '';
  const s = rubricScores(e);
  const total = rubricTotal(e, rubric);
  const rows = rubric.map((c) => {
    const v = s[c.id] == null ? '' : String(s[c.id]);
    const err = rubricError(v, c);
    const id = `rub-${e.id}-${c.id}`;
    return `<div class="rub-row"><span class="rub-label" id="${esc(id)}-l">${esc(c.label)} <span class="muted">${c.min}–${c.max}</span></span>
      <button class="b small" type="button" data-rub="minus" data-id="${esc(e.id)}" data-crit="${esc(c.id)}" data-key="rminus-${esc(e.id)}-${esc(c.id)}" aria-label="Lower ${esc(c.label)} for ${esc(e.code)}"${v !== '' && Number(v) <= c.min ? ' disabled' : ''}>−</button>
      <input class="rub-num" id="${esc(id)}" data-rub="num" data-id="${esc(e.id)}" data-crit="${esc(c.id)}" inputmode="numeric" autocomplete="off" value="${esc(v)}" aria-labelledby="${esc(id)}-l"${err ? ' aria-invalid="true"' : ''}>
      <button class="b small" type="button" data-rub="plus" data-id="${esc(e.id)}" data-crit="${esc(c.id)}" data-key="rplus-${esc(e.id)}-${esc(c.id)}" aria-label="Raise ${esc(c.label)} for ${esc(e.code)}"${v !== '' && Number(v) >= c.max ? ' disabled' : ''}>+</button>
      ${err ? `<span class="rate-err">${esc(err)}</span>` : ''}</div>`;
  }).join('');
  return `<div class="rubric" role="group" aria-label="Rubric for ${esc(e.code)}">${rows}
    <p class="rub-total" data-total="${esc(e.id)}">Total ${total == null ? '–' : total} of ${rubricMax(rubric)}</p></div>`;
}

// A click on a rubric stepper. Returns { room, focusKey } or null when the click was not on one.
function rubricClick(b, room, rubric, now) {
  const act = b && b.dataset && b.dataset.rub;
  if (act !== 'minus' && act !== 'plus') return null;
  const crit = rubric.find((c) => c.id === b.dataset.crit);
  const e = entryOf(room, b.dataset.id);
  if (!crit || !e) return null;
  const next = stepRubric(rubricScores(e)[crit.id], act === 'minus' ? -1 : 1, crit);
  return { room: withRubric(room, e.id, crit.id, next, now), focusKey: 'r' + act + '-' + e.id + '-' + crit.id };
}

// A click on a score control: a rubric stepper, a rating word, or a rating − or +. Returns { room, focusKey } (focusKey
// may be '') or null when the click was on none of them. A word clicked again clears the rating.
export function scoreClick(target, room, now) {
  if (!room || !target || !target.closest) return null;
  const rb = target.closest('[data-rub]');
  if (rb) return rubricClick(rb, room, layerOf(room.profile).rubric, now);
  const b = target.closest('[data-ract]');
  const act = b && b.dataset.ract;
  const e = b && entryOf(room, b.dataset.id);
  if (!e) return null;
  if (act === 'word') return { room: withRating(room, e.id, e.rating === b.dataset.value ? '' : b.dataset.value, now), focusKey: '' };
  if (act === 'minus' || act === 'plus') {
    // At the end of the range the button turns off; the screen then puts the focus on the row.
    return { room: withRating(room, e.id, String(stepRating(e.rating ?? '', act === 'minus' ? -1 : 1, ratingScale(room.profile))), now), focusKey: act + '-' + e.id };
  }
  return null;
}

// A typed value in a rating box or a rubric box. Returns the new room, or null when the box is neither.
export function scoreInput(t, room, now) {
  if (!room || !t || !t.dataset) return null;
  if (t.dataset.ract === 'num') return withRating(room, t.dataset.id, String(t.value).trim(), now);
  if (t.dataset.rub === 'num') return withRubric(room, t.dataset.id, t.dataset.crit, String(t.value), now);
  return null;
}

// Is this a score box whose error shows when the judge leaves it?
export const isScoreBox = (t) => Boolean(t && t.dataset && (t.dataset.ract === 'num' || t.dataset.rub === 'num'));
