// Speech Events: the score controls of one entry, shared by the Rank screen (step E7) and the Rate screen (step S4,
// docs/events/EXPERIENCE.md §2.4): the rating control and the rubric grid. The rules are in rank.js, board.js and
// profile-layer.js.
// DESIGN.md §4.6 (design review 2026-11-24, top 10 #5): a short scale (word scales, and point scales with at most
// SHORT_SCALE_MAX values, such as 1 to 5 or 1 to 10) is a row of buttons; the chosen one is filled solid. A wide range
// (70 to 100) keeps the number box with − and +. The number buttons are one radio group per row: one Tab stop, the
// arrow keys and Home and End move the choice, and a digit key picks that number (0 picks 10), as typing did before.
// The builders are pure (Node tests call them). scoreClick, scoreKey and scoreInput turn a click, a key or a typed
// value into a new room, so both screens handle them the same way; each screen saves and redraws.
import { escapeHtml as esc } from '../../core/sheets.js';
import { foldSummaryHtml, foldValueHtml } from './fold.js';
import { rubricScores, rubricTotal, rubricMax, stepRubric, withRubric, rubricError, layerOf } from './profile-layer.js';
import { ratingScale } from './rank.js';
import { withRating, stepRating } from './board.js';
import { entryOf } from './room.js';

// The most values a point scale can have and still show as a row of buttons.
export const SHORT_SCALE_MAX = 10;

// The values of a point scale as a list of numbers, when it is short enough for a row of buttons; else null.
// range: { min, max, step } (a rating scale, or a rubric criterion with step 1).
export function buttonValues(range) {
  const step = Number(range && range.step) > 0 ? Number(range.step) : 1;
  const min = Number(range && range.min), max = Number(range && range.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  if (count > SHORT_SCALE_MAX) return null;
  return Array.from({ length: count }, (_, i) => Math.round((min + i * step) * 1000) / 1000);
}

// One row of number buttons as a radio group. value: the stored value ('' or null when none). o: { label | labelledby,
// describedby, attrs (the data attributes every button carries), key (the data-key of the button that has the Tab
// stop: the chosen one, else the first) }.
function pickRowHtml(values, value, o) {
  const cur = value == null || String(value).trim() === '' ? NaN : Number(value);
  const on = values.indexOf(cur);
  const tabAt = on >= 0 ? on : 0;
  const name = o.labelledby ? ` aria-labelledby="${esc(o.labelledby)}"` : ` aria-label="${esc(o.label)}"`;
  const desc = o.describedby ? ` aria-describedby="${esc(o.describedby)}"` : '';
  return `<div class="pick-row" role="radiogroup"${name}${desc}>${values.map((v, i) => `<button class="pick${i === on ? ' on' : ''}" type="button" role="radio" aria-checked="${i === on}" tabindex="${i === tabAt ? 0 : -1}" ${o.attrs} data-value="${v}"${i === tabAt ? ` data-key="${esc(o.key)}"` : ''}>${v}</button>`).join('')}</div>`;
}

// The rating control of one row as HTML text ('' when the profile has no rating).
export function ratingHtml(e, value, scale, err) {
  if (scale.kind === 'none') return '';
  const label = 'Rating for ' + e.code;
  const errHtml = `<p class="rate-err" id="rate-err-${e.id}">${esc(err)}</p>`;
  if (scale.kind === 'words') {
    return `<div class="rate words" role="group" aria-label="${esc(label)}">${scale.words.map((w) => `<button class="rate-word${w === value ? ' on' : ''}" type="button" data-ract="word" data-id="${e.id}" data-value="${esc(w)}" aria-pressed="${w === value}">${esc(w)}</button>`).join('')}</div>${errHtml}`;
  }
  const values = buttonValues(scale);
  if (values) {
    return `<div class="rate points-row">${pickRowHtml(values, value, { label: label + ', ' + scale.min + ' to ' + scale.max, describedby: 'rate-err-' + e.id, attrs: `data-ract="pick" data-id="${esc(e.id)}"`, key: 'pick-' + e.id })}</div>${errHtml}`;
  }
  return `<div class="rate points"><button class="b small" type="button" data-ract="minus" data-id="${e.id}" data-key="minus-${e.id}" aria-label="Lower the rating for ${esc(e.code)}"${value !== '' && Number(value) <= scale.min ? ' disabled' : ''}>−</button>
    <input class="rate-num" id="rate-${e.id}" data-ract="num" data-id="${e.id}" inputmode="decimal" autocomplete="off" value="${esc(value)}" aria-label="${esc(label)}, ${scale.min} to ${scale.max}" aria-describedby="rate-err-${e.id}"${err ? ' aria-invalid="true"' : ''}>
    <button class="b small" type="button" data-ract="plus" data-id="${e.id}" data-key="plus-${e.id}" aria-label="Raise the rating for ${esc(e.code)}"${value !== '' && Number(value) >= scale.max ? ' disabled' : ''}>+</button></div>${errHtml}`;
}


// The total line under a rubric: live while the judge scores, and it says that every part is added (all criteria
// count; the profile has no part outside the total). "Total 16 of 25 so far, 4 of 5 parts added".
export function rubricTotalText(e, rubric) {
  const s = rubricScores(e);
  const set = rubric.filter((c) => s[c.id] != null && String(s[c.id]).trim() !== '' && !rubricError(s[c.id], c)).length;
  const total = rubricTotal(e, rubric);
  const n = rubric.length;
  if (set === n) return `Total ${total} of ${rubricMax(rubric)}, all ${n} parts added`;
  return `Total ${total == null ? '–' : total} of ${rubricMax(rubric)} so far, ${set} of ${n} parts added`;
}

// The grid for one entry as HTML text ('' when the profile has no rubric): one compact row per criterion, the label
// on the left and the control on the right (a row of buttons for a short range, else − box +).
// Color review §5.4 "Rubric speaker blocks": the grid sits in one fold row per speaker whose value is the total (the
// bold total line went). open: this speaker's block is the open one (ballot-nav.js createRubricFolds).
export function rubricHtml(e, rubric, open) {
  if (!rubric.length) return '';
  const s = rubricScores(e);
  const rows = rubric.map((c) => {
    const v = s[c.id] == null ? '' : String(s[c.id]);
    const err = rubricError(v, c);
    const id = `rub-${e.id}-${c.id}`;
    const values = buttonValues({ min: c.min, max: c.max, step: 1 });
    const errHtml = err ? `<span class="rate-err" id="${esc(id)}-e">${esc(err)}</span>` : '';
    if (values) {
      return `<div class="rub-row"><span class="rub-label" id="${esc(id)}-l">${esc(c.label)}</span>
      ${pickRowHtml(values, v, { labelledby: id + '-l', describedby: err ? id + '-e' : '', attrs: `data-rub="pick" data-id="${esc(e.id)}" data-crit="${esc(c.id)}"`, key: `rpick-${e.id}-${c.id}` })}${errHtml}</div>`;
    }
    return `<div class="rub-row"><span class="rub-label" id="${esc(id)}-l">${esc(c.label)} <span class="muted">${c.min}–${c.max}</span></span>
      <span class="rub-step"><button class="b small" type="button" data-rub="minus" data-id="${esc(e.id)}" data-crit="${esc(c.id)}" data-key="rminus-${esc(e.id)}-${esc(c.id)}" aria-label="Lower ${esc(c.label)} for ${esc(e.code)}"${v !== '' && Number(v) <= c.min ? ' disabled' : ''}>−</button>
      <input class="rub-num" id="${esc(id)}" data-rub="num" data-id="${esc(e.id)}" data-crit="${esc(c.id)}" inputmode="numeric" autocomplete="off" value="${esc(v)}" aria-labelledby="${esc(id)}-l"${err ? ` aria-invalid="true" aria-describedby="${esc(id)}-e"` : ''}>
      <button class="b small" type="button" data-rub="plus" data-id="${esc(e.id)}" data-crit="${esc(c.id)}" data-key="rplus-${esc(e.id)}-${esc(c.id)}" aria-label="Raise ${esc(c.label)} for ${esc(e.code)}"${v !== '' && Number(v) >= c.max ? ' disabled' : ''}>+</button></span>
      ${errHtml}</div>`;
  }).join('');
  return `<details class="fold rub-fold" data-rubfold="${esc(e.id)}"${open ? ' open' : ''}>${foldSummaryHtml('Rubric for ' + esc(e.code), foldValueHtml(rubricTotalText(e, rubric)))}
    <div class="rubric" role="group" aria-label="Rubric for ${esc(e.code)}">${rows}</div></details>`;
}

// Is v the number already stored? A number tapped again clears it, as a rating word does.
const sameNumber = (stored, v) => stored != null && String(stored).trim() !== '' && Number(stored) === Number(v);

// A click on a rubric stepper or number button. Returns { room, focusKey } or null when the click was not on one.
function rubricClick(b, room, rubric, now) {
  const act = b && b.dataset && b.dataset.rub;
  if (act !== 'minus' && act !== 'plus' && act !== 'pick') return null;
  const crit = rubric.find((c) => c.id === b.dataset.crit);
  const e = entryOf(room, b.dataset.id);
  if (!crit || !e) return null;
  if (act === 'pick') {
    const v = Number(b.dataset.value);
    return { room: withRubric(room, e.id, crit.id, sameNumber(rubricScores(e)[crit.id], v) ? '' : v, now), focusKey: 'rpick-' + e.id + '-' + crit.id };
  }
  const next = stepRubric(rubricScores(e)[crit.id], act === 'minus' ? -1 : 1, crit);
  return { room: withRubric(room, e.id, crit.id, next, now), focusKey: 'r' + act + '-' + e.id + '-' + crit.id };
}

// A click on a score control: a rubric stepper or number, a rating word, a rating number, or a rating − or +. Returns { room, focusKey } (focusKey
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
  if (act === 'pick') {
    return { room: withRating(room, e.id, sameNumber(e.rating, b.dataset.value) ? '' : b.dataset.value, now), focusKey: 'pick-' + e.id };
  }
  if (act === 'minus' || act === 'plus') {
    // At the end of the range the button turns off; the screen then puts the focus on the row.
    return { room: withRating(room, e.id, String(stepRating(e.rating ?? '', act === 'minus' ? -1 : 1, ratingScale(room.profile))), now), focusKey: act + '-' + e.id };
  }
  return null;
}

// The values of the number row that the button is in, read from the room's profile (not the page), or null.
function rowValues(b, room) {
  if (b.dataset.rub === 'pick') {
    const c = layerOf(room.profile).rubric.find((x) => x.id === b.dataset.crit);
    return c ? buttonValues({ min: c.min, max: c.max, step: 1 }) : null;
  }
  const scale = ratingScale(room.profile);
  return scale.kind === 'points' ? buttonValues(scale) : null;
}

// A key on a number button (a radio group): ArrowRight or ArrowUp picks the next number, ArrowLeft or ArrowDown the
// one before, Home and End the ends, and a digit that number (0 is 10). Returns { room, focusKey } (the caller stops
// the key's default), or null when the key is not one of these or the focus is not on a number button. Alt, Ctrl and
// Meta keys pass through (Alt+Up and Alt+Down move a Rank row).
export function scoreKey(ev, room, now) {
  if (!room || !ev || ev.altKey || ev.ctrlKey || ev.metaKey || !ev.target || !ev.target.closest) return null;
  const b = ev.target.closest('[data-ract="pick"], [data-rub="pick"]');
  if (!b) return null;
  const values = rowValues(b, room);
  if (!values) return null;
  const at = values.indexOf(Number(b.dataset.value));
  const last = values.length - 1;
  let i = -1;
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') i = Math.min(at + 1, last);
  else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') i = Math.max(at - 1, 0);
  else if (ev.key === 'Home') i = 0;
  else if (ev.key === 'End') i = last;
  else if (/^[0-9]$/.test(ev.key)) i = values.indexOf(ev.key === '0' ? (values.includes(10) ? 10 : 0) : Number(ev.key));
  else return null;
  if (i < 0) return { room, focusKey: '' }; // a digit that is not on this scale: the key is used, nothing changes
  const v = values[i];
  if (b.dataset.rub === 'pick') return { room: withRubric(room, b.dataset.id, b.dataset.crit, v, now), focusKey: 'rpick-' + b.dataset.id + '-' + b.dataset.crit };
  return { room: withRating(room, b.dataset.id, String(v), now), focusKey: 'pick-' + b.dataset.id };
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
