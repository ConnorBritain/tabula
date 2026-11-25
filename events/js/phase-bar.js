// Speech Events step S5 (docs/events/EXPERIENCE.md §3, note "Phase bar"): the phase bar, one shared part for every
// family that splits an entry's time into phases: F4 (PCC: Pro, then Con), F3 (IMP: Prep, then Speech) and the F2
// cross-ex (Speak, then Cross-ex). Pure: it turns a model into HTML text.
//
// The rules (§3): a done phase gets a check, the phase on now is filled, and a "Next: ..." line sits below. The house
// look (docs/events/DESIGN.md): black, white and gray; the state is in words and a mark too, never in colour alone.
//
// model: {
//   label    what the steps are, for screen readers ("Pro, then Con")
//   phases   [{ id, label, time? }] in order; time ('4:12') shows after the label once the phase has some
//   current  the index of the phase on now; -1 = none started yet; phases.length = every phase is done
//   next     the line below the bar ('' for none)
// }
// Since the design build (2026-11-24) this is the one phase renderer of the Room screen: F3 prep (timer-view.js
// prepPhaseModel), F4 runs (runs.js runsBarModel) and the F2 cross-ex (cross-ex-view.js cxPhaseModel). On the timer card
// it sits inside the signal track's box (time-track.js), so a screen has one phase control.
// opts: { id } the element id of the bar's box (default 'phase-bar-box'), so a view can replace it in place each tick.
import { escapeHtml as esc } from '../../core/sheets.js';

// The state of one phase: 'done', 'on' or 'todo'.
export const phaseState = (i, current) => (i < current ? 'done' : i === current ? 'on' : 'todo');

export function phasesHtml(model, opts) {
  const m = model || {};
  const id = (opts && opts.id) || 'phase-bar-box';
  const phases = Array.isArray(m.phases) ? m.phases : [];
  const current = Number.isInteger(m.current) ? m.current : -1;
  const steps = phases.map((p, i) => {
    const st = phaseState(i, current);
    const mark = st === 'done' ? '<span class="phase-mark" aria-hidden="true">✓</span>' : '';
    const word = st === 'done' ? ' (done)' : st === 'on' ? ' (now)' : '';
    return `<li class="phase is-${st}" data-phase="${esc(p.id)}"${st === 'on' ? ' aria-current="step"' : ''}>${mark}<span class="phase-label">${esc(p.label)}</span>`
      + `${p.time ? ` <span class="phase-time">${esc(p.time)}</span>` : ''}<span class="sr-only">${word}</span></li>`;
  }).join('');
  return `<div class="phases" id="${esc(id)}"><ol class="phase-steps" aria-label="${esc(m.label || 'Phases')}">${steps}</ol>`
    + `${m.next ? `<p class="phase-next">${esc(m.next)}</p>` : ''}</div>`;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).phaseBar = Object.freeze({ phaseState, phasesHtml });
