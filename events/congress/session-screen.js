// Speech Events step S6 (docs/events/CONGRESS.md §4.2 to §4.4): the session stages Log, Rank and Review in the page.
// views.js builds the HTML; the rules are in speech.js, po.js, rank.js and review.js. This file wires the buttons,
// runs the tick (timer and session clock), and saves after each change: every action writes the whole Congress value
// at once (env.store, key tabulaEvents.congress.v1). The comment box saves after a short pause and on leaving it.
import { congressIO, findSession, findChamber, withSession, withChamber } from './store.js';
import { startSpeech, updateSpeech, removeSpeech, startQuestions, endSpeech, timerView, clockText } from './speech.js';
import { startTerm, endTerm, setHourScore } from './po.js';
import { toggleRank } from './rank.js';
import { reviewBlocks, rankProblems } from './review.js';
import { markDebated, firstOpenItem } from './chamber.js';
import { barHtml, logHtml, rankHtml, reviewHtml, sessionClock } from './views.js';
import { copyText } from '../js/review-screen.js';
import { newId } from '../js/room.js';

const COMMENT_PAUSE_MS = 400;

// Draw one stage of a session in el. Returns unmount().
export function mountSession(el, env, sessionId, stage) {
  const io = congressIO(env.store);
  const view = { selectedId: null, picking: false, query: '', choosingPO: false };
  let commentTimer = null;
  let pendingComment = null;

  const state = () => io.read();
  const parts = () => { const st = state(); const s = findSession(st, sessionId); return { st, s, c: s ? findChamber(st, s.chamberId) : null }; };
  function save(session, chamber) {
    let st = withSession(state(), session);
    if (chamber) st = withChamber(st, chamber);
    io.write(st);
  }
  function flushComment() {
    clearTimeout(commentTimer); commentTimer = null;
    if (!pendingComment) return;
    const { id, text } = pendingComment; pendingComment = null;
    const { s } = parts();
    if (s) save(updateSpeech(s, id, { comment: text }));
  }

  {
    const { s } = parts();
    if (s && s.live) view.selectedId = s.live.speechId;
  }

  function draw(focusKey) {
    const { s, c } = parts();
    if (!s || !c) { el.innerHTML = '<p class="muted">This session is not on this device.</p><a class="b" href="#/chamber">Chambers</a>'; return; }
    const now = env.now();
    const body = stage === 'log' ? logHtml(c, s, view, now) : stage === 'rank' ? rankHtml(c, s, now) : reviewHtml(c, s, now);
    el.innerHTML = `<div class="cg-screen">${barHtml(c, s, stage, now)}<h1 class="sr-only" id="screen-title" tabindex="-1">${stage === 'log' ? 'Speech log' : stage === 'rank' ? 'Rank' : 'Review and copy'}</h1>${body}</div>`;
    const target = focusKey ? el.querySelector(`[data-key="${CSS.escape(focusKey)}"]`) : null;
    if (target) target.focus(); else if (!focusKey) el.querySelector('#screen-title').focus({ preventScroll: true });
    if (focusKey === 'search') { const box = el.querySelector('#cg-search'); if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); } }
  }

  // The tick: only the timer digits and the session clock change, so a draw never steals the comment box's focus.
  // A full hour of a PO term redraws once, so its score prompt shows.
  let lastHourKey = '';
  const tick = setInterval(() => {
    const { s, c } = parts();
    if (!s || !c) return;
    const now = env.now();
    const clock = el.querySelector('#cg-session-clock');
    if (clock) clock.textContent = sessionClock(s, now);
    const t = timerView(s, now, c.profile.questionBlockMs);
    const digits = el.querySelector('#cg-digits');
    if (t && digits) {
      digits.textContent = clockText(t.leftMs);
      const card = el.querySelector('#cg-timer');
      card.classList.toggle('stage-over', t.leftMs < 0);
      card.classList.toggle('stage-last', t.leftMs >= 0 && t.leftMs <= 30000);
      card.classList.toggle('stage-speaking', t.leftMs > 30000);
      const sub = el.querySelector('#cg-timer-sub');
      if (t.phase === 'questions' && sub) sub.textContent = `Question block ${Math.min(t.block, t.blocks)} of ${t.blocks} · ${clockText(t.blockLeftMs)} left in this block`;
    }
    const hourKey = s.poTerms.map((x) => Math.floor(((x.endedAt != null ? x.endedAt : now) - x.startedAt) / 3600000)).join(',');
    if (hourKey !== lastHourKey) {
      const first = !lastHourKey;
      lastHourKey = hourKey;
      if (!first && stage === 'log' && document.activeElement && document.activeElement.id !== 'cg-comment') draw();
    }
  }, 250);

  async function copyBlock(id) {
    const { s, c } = parts();
    const now = env.now();
    if (id === 'ranks' && rankProblems(c, s, now).length) { draw(); return; }
    const b = reviewBlocks(c, s).find((x) => x.id === id);
    if (!b || !b.text) return;
    if (!(await copyText(b.text))) { env.ui.toast('This browser blocked copying. Select the text and press Ctrl+C (⌘C on Mac).', { kind: 'error', key: 'copy' }); return; }
    const fresh = parts().s;
    if (id === 'ranks') save(Object.assign({}, fresh, { copiedAt: env.now() }));
    else if (b.kind === 'speech') save(Object.assign({}, fresh, { speeches: fresh.speeches.map((x) => (x.id === id ? Object.assign({}, x, { copiedAt: env.now() }) : x)) }));
    draw('copy-' + id);
    env.ui.announce(id === 'ranks' ? 'Ranks copied. Paste them into Tabroom.' : 'Copied.');
  }

  function act(b) {
    flushComment();
    const { s, c } = parts();
    if (!s || !c) return;
    const now = env.now();
    const a = b.dataset.cact;
    const mk = (p) => newId(p);
    switch (a) {
      case 'next': view.picking = true; view.query = ''; return draw('search');
      case 'cancel-pick': view.picking = false; return draw('next');
      case 'pick': {
        const next = startSpeech(s, b.dataset.id, { now, makeId: mk });
        save(next);
        view.picking = false; view.selectedId = next.live.speechId;
        env.ui.announce('Speech started. The timer runs.');
        return draw('questions');
      }
      case 'questions': save(startQuestions(s, now)); return draw('end');
      case 'end': save(endSpeech(s, now)); return draw('comment');
      case 'set': save(updateSpeech(s, view.selectedId, { [b.dataset.field]: b.dataset.value })); return draw(b.dataset.key);
      case 'points': save(updateSpeech(s, view.selectedId, { points: b.dataset.value === '' ? null : Number(b.dataset.value) })); return draw(b.dataset.key);
      case 'penalty': {
        const sp = s.speeches.find((x) => x.id === view.selectedId);
        save(updateSpeech(s, view.selectedId, { penalty: sp && sp.penalty === b.dataset.value ? null : b.dataset.value }));
        return draw(b.dataset.key);
      }
      case 'select': view.selectedId = b.dataset.id; view.picking = false; return draw('comment');
      case 'close': view.selectedId = null; return draw('next');
      case 'remove': {
        const id = view.selectedId;
        const at = s.speeches.findIndex((x) => x.id === id);
        const gone = s.speeches[at];
        save(removeSpeech(s, id));
        view.selectedId = null;
        draw('next');
        env.ui.toast('Speech removed.', { key: 'cg-undo', action: { label: 'Undo', name: 'Undo: remove speech', run: () => {
          const cur = parts().s;
          if (cur && gone && !cur.speeches.some((x) => x.id === id)) { const speeches = cur.speeches.slice(); speeches.splice(Math.min(at, speeches.length), 0, gone); save(Object.assign({}, cur, { speeches })); }
          view.selectedId = id; draw('comment');
        } } });
        return undefined;
      }
      case 'next-item': {
        const chamber = markDebated(c, s.itemId, s.number);
        const item = firstOpenItem(chamber);
        save(Object.assign({}, s, { itemId: item ? item.id : null }), chamber);
        env.ui.announce(item ? 'Next item: ' + item.title : 'No items left on the docket.');
        return draw('next-item');
      }
      case 'po-choose': view.choosingPO = !view.choosingPO; return draw('po-choose');
      case 'po-start': save(startTerm(s, b.dataset.id, now)); view.choosingPO = false; return draw('po-end');
      case 'po-end': save(endTerm(s, now)); return draw('po-choose');
      case 'po-score': save(setHourScore(s, Number(b.dataset.term), Number(b.dataset.hour), Number(b.dataset.value), now)); return draw();
      case 'po-clear': save(setHourScore(s, Number(b.dataset.term), Number(b.dataset.hour), null, now)); return draw();
      case 'rank': case 'unrank': save(toggleRank(c, s, b.dataset.id)); return draw(b.dataset.key);
      case 'copy': copyBlock(b.dataset.id); return undefined;
      case 'submitted': {
        const was = s.submittedAt || null;
        save(Object.assign({}, s, { submittedAt: was ? null : now }));
        draw('submitted');
        if (!was) env.ui.toast('Marked as submitted.', { key: 'cg-undo', action: { label: 'Undo', name: 'Undo: submitted', run: () => { save(Object.assign({}, parts().s, { submittedAt: null })); draw('submitted'); } } });
        return undefined;
      }
      default: return undefined;
    }
  }

  const onClick = (ev) => { const b = ev.target.closest('[data-cact]'); if (b && el.contains(b) && !b.disabled) act(b); };
  const onInput = (ev) => {
    const t = ev.target;
    if (t.id === 'cg-search') { view.query = t.value; return draw('search'); }
    if (t.dataset.cfield === 'comment') {
      pendingComment = { id: view.selectedId, text: t.value };
      clearTimeout(commentTimer);
      commentTimer = setTimeout(flushComment, COMMENT_PAUSE_MS);
      const { s, c } = parts();
      const reason = el.querySelector('#cg-reason');
      const sp = s && s.speeches.find((x) => x.id === view.selectedId);
      if (reason && sp && c) reason.textContent = c.profile.reasonBelow != null && sp.points != null && sp.points < c.profile.reasonBelow && !t.value.trim() ? `Below ${c.profile.reasonBelow}: write a specific reason. You can still save.` : '';
    }
    return undefined;
  };
  const onChange = (ev) => {
    const t = ev.target;
    if (t.dataset.cfield === 'itemId' || t.dataset.cfield === 'type') {
      const { s } = parts();
      save(updateSpeech(s, view.selectedId, { [t.dataset.cfield]: t.value }));
      draw(t.dataset.key);
    }
  };
  const onKey = (ev) => {
    if (ev.target.id === 'cg-search' && ev.key === 'Enter') {
      ev.preventDefault();
      const first = el.querySelector('[data-cact="pick"]');
      if (first) act(first);
    }
  };
  const onBlur = (ev) => { if (ev.target.id === 'cg-comment') flushComment(); };
  const onHide = () => flushComment();

  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onChange);
  el.addEventListener('keydown', onKey);
  el.addEventListener('focusout', onBlur);
  window.addEventListener('pagehide', onHide);
  draw();
  return function unmount() {
    flushComment();
    clearInterval(tick);
    el.removeEventListener('click', onClick);
    el.removeEventListener('input', onInput);
    el.removeEventListener('change', onChange);
    el.removeEventListener('keydown', onKey);
    el.removeEventListener('focusout', onBlur);
    window.removeEventListener('pagehide', onHide);
    el.innerHTML = '';
  };
}
