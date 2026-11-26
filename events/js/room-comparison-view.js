// Compact, read-only room review. This controller has no saveRoom or ballot-writing path.
import { escapeHtml as esc } from '../../core/sheets.js';
import { aiMark } from '../../core/ai-mark.js';
import { iconButton } from './icons.js';
import { foldSummaryHtml } from './fold.js';
import { askConnectKey } from './ai-connect.js';
import { comparisonCoverage, comparisonMessages, comparisonStamp, comparisonNotes, roomEntries, ROOM_FEATURE } from './room-comparison.js';

const button = (act, label, extra = '') => `<button class="b small quiet" type="button" data-vact="room-${act}"${extra}>${label}</button>`;
export function comparisonButtonHtml(allowed, open = false) {
  return allowed ? button('compare', aiMark('events', 'compare-room') + 'Compare the room', ` aria-label="Compare the room with AI" aria-expanded="${open}" aria-controls="review-room-comparison" data-key="room-compare"`) : '';
}
const sourceLabel = (entries, id) => entries.find((e) => e.id === id)?.code || 'Speaker';
function pointHtml(point, entries) {
  return `<p>${esc(point.text)}</p><details class="fold room-evidence">${foldSummaryHtml('Notes behind this')}<ul>${point.evidence.map((e) => `<li><strong>${esc(sourceLabel(entries, e.id))}</strong><blockquote>${esc(e.quote)}</blockquote><details class="fold">${foldSummaryHtml('Read full public notes')}<p class="room-source-notes">${esc(comparisonNotes(entries.find((x) => x.id === e.id) || {}))}</p></details></li>`).join('')}</ul></details>`;
}
export function comparisonPanelHtml(state, room) {
  if (!state) return '';
  const entries = roomEntries(room), coverage = comparisonCoverage(room);
  const close = iconButton('x', 'Close room comparison', 'b quiet', 'data-vact="room-close"');
  const result = state.result;
  const gaps = [...coverage.missing.map((e) => `${e.code || 'Speaker'}: ${e.status !== 'done' ? 'speech not finished' : 'no original public notes'}.`), ...(result?.gaps || [])];
  const body = state.status === 'busy' ? `<p role="status">${state.mode === 'order' ? 'Considering a suggested order…' : 'Comparing the recorded notes…'}</p>`
    : state.status === 'error' || state.status === 'stale' ? `<p role="alert">${esc(state.error)}</p>${button('compare', 'Try again')}`
      : `<ul class="room-comparison-points">${(result?.comparisons || []).map((p) => `<li>${pointHtml(p, entries)}</li>`).join('')}</ul>${!result?.comparisons.length ? '<p>The notes do not support a clear comparison yet.</p>' : ''}
        ${gaps.length ? `<details class="fold room-gaps" open>${foldSummaryHtml('Gaps and close calls')}<ul>${gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></details>` : ''}
        ${result?.order.length ? `<section aria-labelledby="room-order-title"><h3 id="room-order-title">Suggested order <span class="muted">· for your review</span></h3><ol class="room-suggested-order">${result.order.map((p) => `<li><strong>${esc(sourceLabel(entries, p.id))}</strong>${pointHtml(p, entries)}</li>`).join('')}</ol><p class="field-help">Check this against the performances and room rules. Change any final ranks yourself on the Rank screen.</p></section>` : state.mode === 'order' ? '<p>No complete order suggested. The evidence does not separate the room clearly enough.</p>' : ''}
        <div class="room-comparison-actions">${coverage.canOrder && !result?.order.length ? button('order', 'Suggest an order') : ''}${button('compare', 'Compare again')}</div>
        ${!coverage.canOrder && !result?.order.length ? '<p class="field-help">Suggested order needs ranks enabled, every speech finished and public notes for every speaker.</p>' : ''}`;
  return `<section class="room-comparison card" aria-labelledby="room-comparison-title"><div class="edit-head"><h2 id="room-comparison-title" tabindex="-1">Compare the room</h2>${close}</div><p class="field-help">AI review of your notes. Your final ranks stay yours.</p>${body}<details class="fold room-comparison-about">${foldSummaryHtml('About this review')}<p class="field-help">Only use this where the tournament permits AI review. It uses original public notes and event criteria, with your saved <a href="#/settings">judging priorities</a>. It cannot see the performances. Longer notes do not mean better work. Private notes, existing ranks and ratings are not sent. Known names and codes are replaced; other private details in public notes are sent as written. Nothing here goes on the ballot.</p></details></section>`;
}

export function createRoomComparison(env, hooks) {
  let state = null, controller = null, token = 0;
  const own = env.ai.own;
  const room = () => env.rooms().find((r) => r.id === hooks.roomId());
  const settings = () => env.settings?.() || {};
  const allowed = () => {
    const P = globalThis.TabulaCore.policy;
    return P.canUse(env.ai.gate, ROOM_FEATURE) && P.setupAllowed(env.ai.gate);
  };
  const stamp = () => comparisonStamp(room(), hooks.event(room()), settings());
  const cancel = () => { token++; controller?.abort(); controller = null; };
  function close(focus = true) { cancel(); state = null; hooks.draw(focus ? 'room-compare' : undefined); }
  function invalidate() {
    if (state && state.stamp !== stamp()) {
      cancel(); state = { status: 'stale', error: 'The notes or judging priorities changed. Compare again for a current review.', stamp: stamp() };
      hooks.draw();
    }
  }
  async function run(mode) {
    if (!allowed() || !room() || state?.status === 'busy') return;
    const r = room(), event = hooks.event(r), saved = settings();
    const baseline = comparisonStamp(r, event, saved);
    let msg;
    try { msg = comparisonMessages(r, event, saved, mode); }
    catch (err) { state = { status: 'error', mode, error: err.message, stamp: baseline }; hooks.draw('room-comparison-title'); return; }
    cancel(); controller = new AbortController();
    const signal = controller.signal, mine = token;
    state = { status: 'busy', mode, stamp: baseline };
    hooks.beforeRun?.(); hooks.draw('room-comparison-title');
    try {
      if (!own.hasKey() && !(await askConnectKey(env.ui, own))) {
        if (mine !== token) return;
        throw new Error('Connect an AI key in Settings to compare the room.');
      }
      if (mine !== token || !allowed()) return;
      if (baseline !== stamp()) { invalidate(); return; }
      const result = await own.compareRoom(env.ai.gate, msg, { signal });
      if (mine !== token || !allowed()) return;
      if (baseline !== stamp()) { invalidate(); return; }
      state = { status: 'ready', mode, result, stamp: baseline };
      hooks.draw('room-comparison-title'); env.ui.announce('Room review ready. Your ranks are unchanged.');
    } catch (err) {
      if (mine !== token || !allowed()) return;
      const error = err.kind === 'offline' ? 'You are offline. Room review needs the internet. Your ranks are unchanged.'
        : ['failed', 'reply'].includes(err.kind) ? 'The room review did not work. Try again. Your ranks are unchanged.' : err.message || 'The room review did not work. Your ranks are unchanged.';
      state = { status: 'error', mode, error, stamp: baseline }; hooks.draw('room-comparison-title');
    }
  }
  return {
    button: () => comparisonButtonHtml(allowed(), Boolean(state)),
    panel: () => allowed() ? comparisonPanelHtml(state && state.stamp === stamp() ? state : state ? { status: 'stale', error: 'The notes or judging priorities changed. Compare again for a current review.' } : null, room()) : '',
    click(act, target) {
      if (act === 'room-close') return close();
      if (act === 'room-compare') return run('compare');
      if (act === 'room-order') return run('order');
    },
    key(ev) { if (ev.key === 'Escape' && state) { ev.preventDefault(); close(); } },
    invalidate, close,
    reset() { cancel(); state = null; },
  };
}
