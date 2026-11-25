// Speech Events design build (docs/design/EVENTS-DESIGN-REVIEW.md §2.4–§2.7, top 10 #2 and #3; decisions D2-A and
// D3-A in docs/design/EVENTS-VISUAL-DEPTH.md §7–§8): the time track. One pure module draws the event's time budget as
// a data bar, at two sizes:
//   trackHtml      under the timer digits: zones (speech, grace, over), the time used as a fill (in pieces: prep
//                  then the speech on IMP, Pro then Con on PCC), ticks at the signal points with short labels, and a
//                  "now" dot
//   miniTrackHtml  on a roster row and a rank board row: the same zones and fill, small, no labels (the row says the
//                  time and the pill in words next to it, so colour never carries the meaning alone)
// The phase words (done, on now, next) stay in phase-bar.js; a view that has phases puts phasesHtml under the track,
// inside the same box, so a screen never shows two phase controls.
// House rules: neutral speech zone, caution tint for grace, error tint for over (DESIGN.md §3); a full bordered track,
// 1 px neutral ticks and an outlined dot, never a one-sided bar (docs/design/NO-STRIPES.md).
import { escapeHtml as esc } from '../../core/sheets.js';
import { clockText, usedAt, signalPoints } from './timer.js';
import { hasSharedPrep, prepUsedAt, speechLimit } from './prep.js';
import { hasRuns, runsAt } from './runs.js';

// How much "over" the track shows past the end of grace: the grace length, at least 30 s. A time past the end of the
// track pins the fill and the dot to the right edge.
export const overShown = (grace) => Math.max(30, Number(grace) || 0);

// A signal point's short tick label: "5" (whole minutes left), "0:30", "0" (time), "+0:30" (the end of grace).
export function tickLabel(at) {
  if (at < 0) return '+' + clockText(-at);
  if (at === 0) return '0';
  if (at % 60 === 0) return String(at / 60);
  return clockText(at);
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// The track model. Pure.
// in: {
//   limit    the event's limit in seconds (on a prep event, the shared limit for prep and speech)
//   grace    the grace in seconds
//   pieces   [{ sec, kind? }] the time used, in order (kind 'prep', 'used' or 'alt': PCC's second run, so the split
//            shows); the words for each piece are in the phase row (phase-bar.js), not on the track
//   points   timer.js signalPoints(...) (seconds left at each point); the track draws one tick per point
//   running  a clock runs now (the dot shows while a clock runs or once there is time)
// }
// out: { span, limit, grace, used, zones: [{ kind, from, to }], fills: [{ kind, from, to }],
//        ticks: [{ at, pos, label }], now (seconds on the track, or null), past (the time runs past the track's end) }
// Every position is in seconds from the start of the track; pct(model, sec) turns one into a percent.
export function trackModel(input) {
  const i = input || {};
  const limit = Math.max(0, Number(i.limit) || 0);
  const grace = Math.max(0, Number(i.grace) || 0);
  const span = limit + grace + overShown(grace);
  const zones = [
    { kind: 'speech', from: 0, to: limit },
    ...(grace > 0 ? [{ kind: 'grace', from: limit, to: limit + grace }] : []),
    { kind: 'over', from: limit + grace, to: span },
  ];
  const fills = [];
  let at = 0;
  for (const p of Array.isArray(i.pieces) ? i.pieces : []) {
    const sec = Math.max(0, Number(p && p.sec) || 0);
    if (!sec) continue;
    fills.push({ kind: ['prep', 'alt'].includes(p.kind) ? p.kind : 'used', from: Math.min(at, span), to: Math.min(at + sec, span) });
    at += sec;
  }
  const ticks = (Array.isArray(i.points) ? i.points : [])
    .map((p) => ({ at: p.at, pos: limit - p.at, label: tickLabel(p.at) }))
    .filter((t) => t.pos > 0 && t.pos <= span);
  return { span, limit, grace, used: at, zones, fills, ticks, now: at > 0 || i.running ? Math.min(at, span) : null, past: at > span };
}

// A position on the track as a CSS percent (two decimals).
const pct = (model, sec) => (model.span > 0 ? Math.round(clamp(sec / model.span, 0, 1) * 10000) / 100 : 0) + '%';

// Where the time used sits, in words: 'speech', 'grace' or 'over' (for the row's screen-reader text and the mini
// fill's tint).
export const zoneAt = (model, used) => (used > model.limit + model.grace ? 'over' : used > model.limit ? 'grace' : 'speech');

// What the track says to a screen reader: the budget, the signal points, and the time used.
export function trackLabel(model) {
  const parts = ['Time track: ' + clockText(model.limit) + ' limit' + (model.grace ? ', then ' + clockText(model.grace) + ' grace' : '') + '.'];
  // Spoken words for each signal: "5 min left", "0:30 left", "time", "end of grace".
  const spoken = (t) => (t.at < 0 ? 'end of grace' : t.at === 0 ? 'time' : t.at % 60 === 0 ? t.at / 60 + ' min left' : clockText(t.at) + ' left');
  if (model.ticks.length) parts.push('Signals at ' + model.ticks.map(spoken).join(', ') + '.');
  if (model.used > 0) parts.push(clockText(model.used) + ' used' + (zoneAt(model, model.used) === 'speech' ? '' : zoneAt(model, model.used) === 'grace' ? ', in grace' : ', over grace') + '.');
  return parts.join(' ');
}

// The bar itself (zones, fills, ticks, dot). Shared by both sizes.
function barHtml(m, withTicks) {
  const box = (cls, from, to) => `<span class="${cls}" style="left:${pct(m, from)};width:${pct(m, to - from)}"></span>`;
  const zones = m.zones.map((z) => box('track-zone z-' + z.kind, z.from, z.to)).join('');
  const fills = m.fills.filter((f) => f.to > f.from).map((f) => box('track-fill f-' + f.kind, f.from, f.to)).join('');
  const ticks = withTicks ? m.ticks.map((t) => `<span class="track-tick" style="left:${pct(m, t.pos)}"></span>`).join('') : '';
  const dot = m.now == null ? '' : `<span class="track-now z-${zoneAt(m, m.used)}" style="left:${pct(m, m.now)}"></span>`;
  return `<span class="track-bar">${zones}${fills}${ticks}${dot}</span>`;
}

// The full track under the timer digits. opts: { id, phases (HTML from phase-bar.js phasesHtml, shown inside the box) }.
export function trackHtml(model, opts) {
  const o = opts || {};
  const m = model;
  // The tick labels: whole minutes and "0" only. The 0:30 and grace-end ticks sit too close to "0" for a label at
  // any width; the grace zone's tint marks them, and the screen-reader label names every signal.
  const labels = m.ticks.filter((t) => t.at >= 0 && t.at % 60 === 0).map((t) => `<span class="track-tlabel" style="left:${pct(m, t.pos)}">${esc(t.label)}</span>`).join('');
  return `<div class="track"${o.id ? ` id="${esc(o.id)}"` : ''}><div class="track-img" role="img" aria-label="${esc(trackLabel(m))}">`
    + `${barHtml(m, true)}<span class="track-ticks" aria-hidden="true">${labels}</span></div>${o.phases || ''}</div>`;
}

// The mini track's state class: where the time ended, or empty before any time.
const miniClass = (m) => (m.used > 0 ? ' z-' + zoneAt(m, m.used) : ' is-empty');

// The mini track on a row. Hidden from screen readers: the row already says the time and the pill in words.
export function miniTrackHtml(model, opts) {
  const o = opts || {};
  return `<span class="track track-mini${miniClass(model)}"${o.id ? ` data-track="${esc(o.id)}"` : ''} aria-hidden="true">${barHtml(model, false)}</span>`;
}

// The time an entry used, as track pieces, for any family: prep then speech (a shared-prep event, F3), one piece per
// run (F4, PCC: the second run is 'alt' so the split shows), or one piece (every other event). limit: the event's
// limit (the shared one on F3). The roster row, the rank board row and the timer card all read this one function.
export function piecesFor(entry, event, limit, now) {
  const t = (entry && entry.timing) || {};
  if (hasSharedPrep(event)) return [{ sec: prepUsedAt(t, now, limit), kind: 'prep' }, { sec: usedAt(t, now, speechLimit(t, now, limit)) }];
  if (hasRuns(event)) {
    const runs = runsAt(entry, event, now, limit);
    if (runs.length) return runs.map((r, i) => ({ sec: Math.floor(Math.max(0, r.ms) / 1000), kind: i % 2 ? 'alt' : 'used' }));
  }
  return [{ sec: usedAt(t, now, limit) }];
}

// The signal points the track draws for an entry: the same ones the timer's signal chip uses (timer-view.js). On a
// shared-prep event they count down the speech part's own limit, which is what prep left of the shared limit.
export const pointsFor = (entry, event, limit, grace, now) => signalPoints(hasSharedPrep(event) ? speechLimit((entry && entry.timing) || {}, now, limit) : limit, grace);

// The mini track of one row (roster and rank board): the entry's final (or current) time on its event's track.
export const rowTrackHtml = (entry, event, limit, grace, now) => miniTrackHtml(trackModel({ limit, grace, pieces: piecesFor(entry, event, limit, now) }));

