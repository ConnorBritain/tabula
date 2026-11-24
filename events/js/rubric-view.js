// Speech Events step S4 (docs/events/EXPERIENCE.md §2.4): the rubric grid, a row of steppers for each criterion. The
// Rank screen and the Rate screen both draw it for each entry. The rules are in profile-layer.js. The builders are
// pure (Node tests call them); rubricClick and rubricInput turn a click or a typed value into a new room.
import { escapeHtml as esc } from '../../core/sheets.js';
import { rubricScores, rubricTotal, rubricMax, stepRubric, withRubric, rubricError } from './profile-layer.js';
import { entryOf } from './room.js';

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

// A click on a stepper. Returns { room, focusKey } or null when the click was not on a stepper.
export function rubricClick(b, room, rubric, now) {
  const act = b && b.dataset && b.dataset.rub;
  if (act !== 'minus' && act !== 'plus') return null;
  const crit = rubric.find((c) => c.id === b.dataset.crit);
  const e = entryOf(room, b.dataset.id);
  if (!crit || !e) return null;
  const next = stepRubric(rubricScores(e)[crit.id], act === 'minus' ? -1 : 1, crit);
  return { room: withRubric(room, e.id, crit.id, next, now), focusKey: 'r' + act + '-' + e.id + '-' + crit.id };
}

// A typed value. Returns the new room, or null when the box is not a rubric box.
export function rubricInput(t, room, now) {
  if (!(t && t.dataset && t.dataset.rub === 'num')) return null;
  return withRubric(room, t.dataset.id, t.dataset.crit, String(t.value), now);
}
