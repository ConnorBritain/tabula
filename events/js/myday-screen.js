// Speech Events step S3 (docs/events/EXPERIENCE.md §1.2, §5.1, §5.3, §5.4): My day, the judge home at #/. It replaces
// the Rooms list. Sections: Now, Later today, Done (comments open), Done. A Standby card shows when today is on standby
// and nothing is in Now or Later today. The Now card counts down to the ranks-due time. Each card can be marked "I
// submitted in Tabroom", moved to another room or cancelled, each with Undo.
// The rules are in cards.js; the builders at the top are pure (Node tests call them); createMydayScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { mydayModel, cardEvent, cardEventId, dueText, cancelCard, moveRoom, submitCard, findById, undoFields, ROOM_MAX } from './cards.js';
import { roomEvent, CUSTOM_EVENT } from './room.js';
import { dayOf } from './rooms.js';
import { routeHash } from './routes.js';
import { ranksDueMinOf } from './settings.js';

export const MD_TOAST_KEY = 'md-card';

// "just now", "12 min ago", "1 h 5 min ago": the time since check-in.
export function sinceText(from, now) {
  const m = Math.floor(Math.max(0, now - from) / 60000);
  if (m < 1) return 'just now';
  return m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min ago';
}

// The key of an item: its card id, or its round id when it has no card yet.
export const itemKey = (it) => (it.card ? 'c:' + it.card.id : 'r:' + it.round.id);

// What one item shows: { key, eventId, short, name, title, meta, status, word, due, startHash, openHash, canEdit, canSubmit }.
export function itemView(it, events) {
  const c = it.card, r = it.round;
  const ev = c ? cardEvent(events, c) : roomEvent(events, r);
  const custom = c ? c.eventKey === CUSTOM_EVENT : Boolean(r && r.customEvent);
  const eventId = custom ? CUSTOM_EVENT : c ? cardEventId(c) : r.eventId;
  const src = c || r;
  const title = [src.round, src.flight ? 'Flight ' + src.flight : ''].filter(Boolean).join(' · ') || 'Untitled round';
  const room = c ? c.roomLabel : r.roomLabel;
  const meta = [it.earlier ? 'From ' + dayOf(src.createdAt) : '', room ? 'Room ' + room : '', src.tournament, src.level === 'elim' ? 'Elim' : ''].filter(Boolean).join(' · ');
  const live = it.status !== 'cancelled' && it.status !== 'done';
  return {
    key: itemKey(it),
    eventId,
    short: custom ? (r && r.customEvent && r.customEvent.short) || 'Custom' : ev ? ev.short || ev.name : eventId.toUpperCase(),
    name: custom ? 'Custom event' : ev ? ev.name : 'Event not on this device',
    title, meta, status: it.status, word: it.word, due: it.due,
    startHash: c && it.status === 'notStarted' ? routeHash('start', c.id) : '',
    openHash: r ? routeHash('round', r.id) : '',
    canEdit: live && it.status !== 'submitted',
    canSubmit: it.status === 'judging' || it.status === 'ranksIn',
  };
}

const PILL = { judging: ' solid', ranksIn: ' solid', cancelled: ' outline', done: ' outline' };

// One card as HTML text.
export function cardHtml(v, now) {
  const act = [];
  if (v.startHash) act.push(`<a class="b primary" href="${esc(v.startHash)}">Start</a>`);
  if (v.openHash) act.push(`<a class="b${v.status === 'judging' || v.status === 'ranksIn' ? ' primary' : ''}" href="${esc(v.openHash)}">Open</a>`);
  if (v.canSubmit) act.push(`<button class="b" type="button" data-act="submit">I submitted in Tabroom</button>`);
  if (v.canEdit) act.push(`<button class="b quiet" type="button" data-act="room">Change room</button>`, `<button class="b quiet" type="button" data-act="cancel">Cancel round</button>`);
  const label = v.short + ' ' + v.title;
  return `<li class="md-card" data-item="${esc(v.key)}" tabindex="-1" aria-label="${esc(label + ', ' + v.word)}">
    <div class="md-card-top">
      <a class="pill md-ev" href="${esc(routeHash('type', v.eventId))}" title="${esc(v.name)}" aria-label="${esc('About ' + v.name)}">${esc(v.short)}</a>
      <span class="md-title">${esc(v.title)}</span>
      <span class="pill${PILL[v.status] || ''}">${esc(v.word)}</span>
    </div>
    ${v.meta ? `<p class="muted md-meta">${esc(v.meta)}</p>` : ''}
    ${Number.isFinite(v.due) ? `<p class="md-due" data-due="${v.due}">${esc(dueText(v.due, now))}</p>` : ''}
    ${act.length ? `<div class="md-act">${act.join('')}</div>` : ''}
  </li>`;
}

// The whole screen as HTML text. m: mydayModel(...); day: today's Day or null; events: the registry.
// congress (optional): [{ id, label }], today's Congress chambers (events/congress/store.js congressToday, via env). A Congress chamber in use counts as a ballot, so Standby does not show.
export function mydayHtml(m, day, events, now, congress) {
  const sub = [dayOf(now), day && day.tournament].filter(Boolean).join(' · ');
  const chambers = Array.isArray(congress) ? congress : [];
  const busy = m.sections[0].items.length + m.sections[1].items.length + chambers.length > 0;
  const standby = m.standby && !chambers.length ? `<section class="md-standby" aria-labelledby="md-sb-h">
      <h2 id="md-sb-h">On standby</h2>
      <p>No ballot yet. When the tab room sends you one, add it here.</p>
      ${Number.isFinite(day.checkInAt) ? `<p class="muted">Checked in <span data-since="${day.checkInAt}">${esc(sinceText(day.checkInAt, now))}</span>.</p>` : ''}
      <div class="md-act"><a class="b primary" href="${esc(routeHash('pick'))}" id="md-got">I got a ballot</a>
        <button class="b quiet" type="button" id="md-standby-off">Leave standby</button></div>
    </section>` : '';
  const note = m.commentsNote ? `<p class="md-note" role="note"><strong>Comments still open.</strong> Tabroom keeps comments open until the tournament ends. Finish them before you go.</p>` : '';
  const secs = m.sections.filter((s) => s.items.length).map((s) => `<section class="md-sec" aria-labelledby="md-h-${s.id}">
      <h2 id="md-h-${s.id}">${esc(s.title)} <span class="muted">${s.items.length}</span></h2>
      <ul class="md-list">${s.items.map((it) => cardHtml(itemView(it, events), now)).join('')}</ul></section>`).join('');
  const cong = chambers.length ? `<section class="md-sec" aria-labelledby="md-h-congress"><h2 id="md-h-congress">Congress <span class="muted">${chambers.length}</span></h2>
      <ul class="md-list">${chambers.map((c) => `<li class="md-card"><div class="md-card-top"><span class="md-title">${esc(c.label)}</span></div><div class="md-act"><a class="b primary" href="${esc(routeHash('chamber', c.id))}">Open</a></div></li>`).join('')}</ul></section>` : '';
  const empty = !m.items.length && !m.standby && !chambers.length ? '<p class="muted md-empty">No ballots yet today. When you get one, tap Start a round.</p>' : '';
  const standbyOn = !m.standby && !busy ? '<button class="b" type="button" id="md-standby-on">I am on standby</button>' : '';
  return `<div class="screen-head"><h1 id="screen-title" tabindex="-1">My day</h1><a class="b primary" id="md-start" href="${esc(routeHash('pick'))}">Start a round</a>${standbyOn}</div>
    ${sub ? `<p class="muted md-sub">${esc(sub)}</p>` : ''}
    ${standby}${note}${empty}${secs}${cong}
    <p class="muted md-foot">Older rounds are in <a href="${esc(routeHash('history'))}">History</a>.</p>`;
}

// env: { el, ui, data, now, rooms(), day (day-store.js), settings() }.
export function createMydayScreen(env) {
  const $ = (s) => env.el.querySelector(s);
  let showing = false, tick = null, model = null;

  function draw(focusKey) {
    const day = env.day.today();
    model = mydayModel({ day, cards: env.day.cards(), rounds: env.rooms(), now: env.now(), ranksDueMin: ranksDueMinOf(env.settings()) });
    env.el.innerHTML = mydayHtml(model, day, env.data.events, env.now(), env.congressToday ? env.congressToday(env.now()) : []);
    focusItem(focusKey);
  }
  // Focus an item by its key (found by position, never by putting an id in a CSS selector), else the title.
  function focusItem(key) {
    if (key === undefined) return;
    const el = key ? [...env.el.querySelectorAll('[data-item]')].find((x) => x.dataset.item === key) : null;
    (el || $('#screen-title')).focus();
  }
  // The countdowns and the check-in time redraw each second; nothing else changes, so focus stays put.
  function update() {
    const now = env.now();
    for (const el of env.el.querySelectorAll('[data-due]')) el.textContent = dueText(Number(el.dataset.due), now);
    for (const el of env.el.querySelectorAll('[data-since]')) el.textContent = sinceText(Number(el.dataset.since), now);
  }

  // The item of a key, with a card made for it when it has none (a round from before S3). null when that fails.
  function cardFor(key) {
    const it = model && model.items.find((x) => itemKey(x) === key);
    if (!it) return null;
    if (it.card) return findById(env.day.cards(), it.card.id);
    const c = env.day.adopt(it.round);
    if (!c) env.ui.toast('This change was not saved. The device storage is full or blocked.', { kind: 'error', key: MD_TOAST_KEY });
    return c;
  }

  // Save a changed card, with a toast whose Undo puts back the card as it was. Focus stays on the card.
  function change(before, after, message, what) {
    if (!env.day.saveCard(after)) return;
    const key = 'c:' + after.id;
    env.ui.dismissToast(MD_TOAST_KEY);
    env.ui.toast(message, { key: MD_TOAST_KEY, action: { label: 'Undo', name: 'Undo: ' + what, run: () => {
      env.ui.dismissToast(MD_TOAST_KEY);
      const cur = findById(env.day.cards(), before.id);
      const back = cur ? Object.assign({}, cur, undoFields(before, after)) : before;
      if (!env.day.saveCard(back)) { env.ui.toast('The change did not go back. The device storage is full or blocked.', { kind: 'error', key: MD_TOAST_KEY }); return; }
      if (showing) draw(key);
      env.ui.toast('Change undone.', { key: MD_TOAST_KEY });
    } } });
    draw(key);
  }

  async function onClick(e) {
    const t = e.target;
    if (t.id === 'md-standby-on') { if (env.day.setStandby(true)) { draw(); $('#md-got').focus(); } return; }
    if (t.id === 'md-standby-off') { if (env.day.setStandby(false)) { draw(); const b = $('#md-standby-on') || $('#screen-title'); b.focus(); } return; }
    const b = t.closest('button[data-act]');
    if (!b) return;
    const li = b.closest('[data-item]');
    const c = li && cardFor(li.dataset.item);
    if (!c) return;
    const name = [c.round || 'the round', c.tournament].filter(Boolean).join(', ');
    if (b.dataset.act === 'submit') change(c, submitCard(c, env.now()), 'Marked submitted in Tabroom: ' + name + '.', 'submitted ' + name);
    if (b.dataset.act === 'cancel') change(c, cancelCard(c, env.now()), 'Cancelled ' + name + '.', 'cancel ' + name);
    if (b.dataset.act === 'room') {
      const label = await env.ui.ask({ title: 'Moved to another room?', input: { label: 'Room', value: c.roomLabel || '', maxLength: ROOM_MAX, emptyError: 'Type the room, for example 204.' },
        buttons: [{ label: 'Cancel', value: null }, { label: 'Save room', value: true, kind: 'primary' }], cancelValue: null });
      if (typeof label !== 'string' || !showing) return;
      const cur = findById(env.day.cards(), c.id) || c;
      change(cur, moveRoom(cur, label), 'Moved to room ' + label + '.', 'move to room ' + label);
    }
  }

  return {
    scope: 'myday',
    show() {
      showing = true;
      env.el.addEventListener('click', onClick);
      draw(null);
      tick = setInterval(update, 1000);
    },
    hide() {
      showing = false;
      clearInterval(tick); tick = null;
      env.el.removeEventListener('click', onClick);
    },
    // After a delete's Undo (History or a round), the list redraws; focus goes to the title, not the page body.
    refresh() { if (showing) draw(null); },
  };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).myday = Object.freeze({ MD_TOAST_KEY, sinceText, itemKey, itemView, cardHtml, mydayHtml });
