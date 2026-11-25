// Speech Events step S3 (docs/events/EXPERIENCE.md §1.2, §5.1, §5.3, §5.4): My day, the judge home at #/. It replaces
// the Rooms list. Sections: Now, Later today, Done (comments open), Done. A Standby card shows when today is on standby
// and nothing is in Now or Later today. The Now card counts down to the ranks-due time. Each card can be marked "I
// submitted in Tabroom", moved to another room or cancelled, each with Undo.
// Design build 2026-11-24 (owner decision OD2 A, design review §2.1): one large "Up next" card (the round being judged,
// else the next one), then the other rounds as compact rows with a status pill and a "⋯" menu that holds Change room and
// Cancel round. Ranks due is a pill in words. The room shows as typed (bug 3).
// The rules are in cards.js; the builders at the top are pure (Node tests call them); createMydayScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon, iconButton } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { mydayModel, cardEvent, cardEventId, duePill, roomText, upNextItem, cancelCard, moveRoom, submitCard, findById, undoFields, ROOM_MAX } from './cards.js';
import { roomEvent, present, CUSTOM_EVENT } from './room.js';
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

// What one item shows: { key, eventId, short, name, title, meta, status, word, due, progress, startHash, openHash,
// goHash, goWord, canEdit, canSubmit }. goHash and goWord are the one main step: Start, Continue or Open.
export function itemView(it, events) {
  const c = it.card, r = it.round;
  const ev = c ? cardEvent(events, c) : roomEvent(events, r);
  const custom = c ? c.eventKey === CUSTOM_EVENT : Boolean(r && r.customEvent);
  const eventId = custom ? CUSTOM_EVENT : c ? cardEventId(c) : r.eventId;
  const src = c || r;
  const title = [src.round, src.flight ? 'Flight ' + src.flight : ''].filter(Boolean).join(' · ') || 'Untitled round';
  const room = roomText(c ? c.roomLabel : r.roomLabel); // bug 3: "Room 214" as typed, never "Room Room 214"
  const meta = [it.earlier ? 'From ' + dayOf(src.createdAt) : '', room, src.tournament, src.level === 'elim' ? 'Elim' : ''].filter(Boolean).join(' · ');
  const live = it.status !== 'cancelled' && it.status !== 'done';
  const here = r ? present(r) : [];
  const startHash = c && it.status === 'notStarted' ? routeHash('start', c.id) : '';
  const openHash = r ? routeHash('round', r.id) : '';
  return {
    key: itemKey(it),
    eventId,
    short: custom ? (r && r.customEvent && r.customEvent.short) || 'Custom' : ev ? ev.short || ev.name : eventId.toUpperCase(),
    name: custom ? 'Custom event' : ev ? ev.name : 'Event not on this device',
    title, meta, status: it.status, word: it.word, due: it.due,
    progress: here.length ? here.filter((e) => e.status === 'done').length + ' of ' + here.length + ' done' : '',
    startHash, openHash,
    goHash: startHash || openHash,
    goWord: startHash ? 'Start' : it.status === 'judging' ? 'Continue' : 'Open',
    canEdit: live && it.status !== 'submitted',
    canSubmit: it.status === 'judging' || it.status === 'ranksIn',
  };
}

// The status pill of a round (top 10 #4, D2-A): a tint, an icon and the word, never the solid fill (the one solid
// shape on My day is the Up next card's main button). Finished work is green; in progress is a quiet tint.
const PILL = Object.freeze({ notStarted: ['outline', 'circle'], judging: ['live', 'circle-dashed'], ranksIn: ['live', 'list-ordered'], submitted: ['ok', 'circle-check'], done: ['ok', 'circle-check'], cancelled: ['outline', ''] });
export const roundPill = (v) => { const [tone, ic] = PILL[v.status] || ['', '']; return statusPillHtml(tone, v.word, ic); };
const DUE_TONE = { caution: ' caution', late: ' err' };

// The ranks-due pill in words (design review §2.1 change 3). update() redraws its text and tone each second.
export function dueHtml(due, now) {
  const p = duePill(due, now);
  return p ? `<span class="pill md-due${DUE_TONE[p.tone] || ''}" data-due="${due}">${esc(p.text)}</span>` : '';
}

// The "⋯" button and, when open, its menu (owner decision OD2 A): the rare steps, with the destructive one last and
// set apart (design review §2.1 change 2). It works like the Room roster's row menu: a button that opens a group in place.
function moreHtml(v, open) {
  if (!v.canEdit) return '';
  const label = v.short + ' ' + v.title;
  return iconButton('ellipsis', 'More for ' + label, 'iconbtn md-more', `data-act="menu" aria-expanded="${open}"`);
}
// withSubmit (owner D5 A, which reverses change 2 in §2.1 of the last review): on a row still judging, "I submitted
// in Tabroom" is not the next step, so it waits here as the first item instead of on the row.
function menuHtml(v, open, withSubmit) {
  if (!v.canEdit || !open) return '';
  return `<div class="md-menu" role="group" aria-label="${esc('More for ' + v.short + ' ' + v.title)}">
      ${withSubmit && v.canSubmit ? '<button class="b small" type="button" data-act="submit">I submitted in Tabroom</button>' : ''}
      <button class="b small" type="button" data-act="room">Change room</button>
      <button class="b small quiet danger-text md-cancel" type="button" data-act="cancel">Cancel round</button></div>`;
}
// D5 A: the row keeps the button only where submitting is the next step (the ranks are copied, status "ranksIn").
const rowSubmits = (v) => v.status === 'ranksIn';
const submitHtml = (v, small) => (v.canSubmit ? `<button class="b${small ? ' small' : ''}" type="button" data-act="submit">I submitted in Tabroom</button>` : '');
const evPill = (v) => `<a class="pill md-ev" href="${esc(routeHash('type', v.eventId))}" title="${esc(v.name)}" aria-label="${esc('About ' + v.name)}">${esc(v.short)}</a>`;

// One compact row as HTML text (owner decision OD2 A): event pill, round and room (the link that opens it), the
// status pill, the ranks-due pill, "I submitted in Tabroom" when it applies, and the "⋯" menu.
export function cardHtml(v, now, menuOpen) {
  const label = v.short + ' ' + v.title;
  const main = `<span class="md-title">${esc(v.title)}</span>${v.meta ? `<span class="muted md-meta">${esc(v.meta)}</span>` : ''}`;
  return `<li class="md-row" data-item="${esc(v.key)}" tabindex="-1" aria-label="${esc(label + ', ' + v.word)}">
    ${evPill(v)}
    ${v.goHash ? `<a class="md-row-main" href="${esc(v.goHash)}" aria-label="${esc(v.goWord + ' ' + label)}">${main}${icon('chevron-right')}</a>` : `<span class="md-row-main">${main}</span>`}
    <span class="md-pills">${roundPill(v)}${dueHtml(v.due, now)}</span>
    ${rowSubmits(v) ? submitHtml(v, true) : ''}${moreHtml(v, Boolean(menuOpen))}
    ${menuHtml(v, Boolean(menuOpen), !rowSubmits(v))}
  </li>`;
}

// The "Up next" card as HTML text (owner decision OD2 A): the one round to go to now, large, with one primary button.
export function upNextHtml(v, now, menuOpen) {
  const label = v.short + ' ' + v.title;
  const facts = [v.progress ? `<span class="md-progress">${esc(v.progress)}</span>` : '', dueHtml(v.due, now)].filter(Boolean).join('');
  return `<section class="md-next" aria-labelledby="md-h-next"><h2 id="md-h-next">Up next</h2>
    <div class="md-next-card" data-item="${esc(v.key)}" tabindex="-1" aria-label="${esc(label + ', ' + v.word)}">
      <div class="md-card-top">${evPill(v)}<span class="md-next-title">${esc(v.title)}</span>${roundPill(v)}</div>
      ${v.meta ? `<p class="md-next-meta">${esc(v.meta)}</p>` : ''}
      ${facts ? `<p class="md-facts">${facts}</p>` : ''}
      <div class="md-act">${v.goHash ? `<a class="b primary md-go" href="${esc(v.goHash)}">${esc(v.goWord)}${icon('arrow-right', 20)}</a>` : ''}${submitHtml(v, false)}${moreHtml(v, Boolean(menuOpen))}</div>
      ${menuHtml(v, Boolean(menuOpen), false)}
    </div></section>`;
}

// The whole screen as HTML text. m: mydayModel(...); day: today's Day or null; events: the registry.
// congress (optional): [{ id, label }], today's Congress chambers (events/congress/store.js congressToday, via env). A Congress chamber in use counts as a ballot, so Standby does not show.
// menuFor (optional): the key of the item whose "⋯" menu is open.
export function mydayHtml(m, day, events, now, congress, menuFor) {
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
  const next = upNextItem(m);
  const nextHtml = next ? upNextHtml(itemView(next, events), now, menuFor === itemKey(next)) : '';
  const secs = m.sections.map((s) => Object.assign({}, s, { items: s.items.filter((it) => it !== next) })).filter((s) => s.items.length).map((s) => `<section class="md-sec" aria-labelledby="md-h-${s.id}">
      <h2 id="md-h-${s.id}">${esc(s.title)} <span class="muted">${s.items.length}</span></h2>
      <ul class="md-list">${s.items.map((it) => cardHtml(itemView(it, events), now, menuFor === itemKey(it))).join('')}</ul></section>`).join('');
  const cong = chambers.length ? `<section class="md-sec" aria-labelledby="md-h-congress"><h2 id="md-h-congress">Congress <span class="muted">${chambers.length}</span></h2>
      <ul class="md-list">${chambers.map((c) => `<li class="md-row"><span class="pill md-ev">Congress</span><a class="md-row-main" href="${esc(routeHash('chamber', c.id))}" aria-label="${esc('Open ' + c.label)}"><span class="md-title">${esc(c.label)}</span></a></li>`).join('')}</ul></section>` : '';
  const empty = !m.items.length && !m.standby && !chambers.length ? '<p class="muted md-empty">No ballots yet today. When you get one, tap Start a round.</p>' : '';
  const standbyOn = !m.standby && !busy ? '<button class="b" type="button" id="md-standby-on">I am on standby</button>' : '';
  return `<div class="screen-head"><h1 id="screen-title" tabindex="-1">My day</h1><a class="b${next ? '' : ' primary'}" id="md-start" href="${esc(routeHash('pick'))}">${icon('plus')}Start a round</a>${standbyOn}</div>
    ${sub ? `<p class="muted md-sub">${esc(sub)}</p>` : ''}
    ${standby}${note}${empty}${nextHtml}${secs}${cong}
    <p class="muted md-foot">Older rounds are in <a href="${esc(routeHash('history'))}">History</a>.</p>`;
}

// env: { el, ui, data, now, rooms(), day (day-store.js), settings() }.
export function createMydayScreen(env) {
  const $ = (s) => env.el.querySelector(s);
  let showing = false, tick = null, model = null;
  let menuFor = null; // the key of the item whose "⋯" menu is open

  function draw(focusKey) {
    const day = env.day.today();
    model = mydayModel({ day, cards: env.day.cards(), rounds: env.rooms(), now: env.now(), ranksDueMin: ranksDueMinOf(env.settings()) });
    env.el.innerHTML = mydayHtml(model, day, env.data.events, env.now(), env.congressToday ? env.congressToday(env.now()) : [], menuFor);
    focusItem(focusKey);
  }
  // The item element of a key, found by position (an id never goes in a CSS selector).
  const itemEl = (key) => [...env.el.querySelectorAll('[data-item]')].find((x) => x.dataset.item === key) || null;
  // Open or close an item's "⋯" menu; focus stays on its "⋯" button.
  function toggleMenu(key) {
    menuFor = menuFor === key ? null : key;
    draw();
    const el = itemEl(key);
    const b = el && el.querySelector('[data-act="menu"]');
    if (b) b.focus();
  }
  // Focus an item by its key (found by position, never by putting an id in a CSS selector), else the title.
  function focusItem(key) {
    if (key === undefined) return;
    const el = key ? itemEl(key) : null;
    (el || $('#screen-title')).focus();
  }
  // The countdowns and the check-in time redraw each second; nothing else changes, so focus stays put.
  function update() {
    const now = env.now();
    for (const el of env.el.querySelectorAll('[data-due]')) {
      const p = duePill(Number(el.dataset.due), now);
      if (!p) continue;
      el.textContent = p.text;
      el.classList.toggle('caution', p.tone === 'caution');
      el.classList.toggle('err', p.tone === 'late');
    }
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
    if (li && b.dataset.act === 'menu') { toggleMenu(li.dataset.item); return; }
    menuFor = null; // a step from the menu (or any other button) closes it
    const c = li && cardFor(li.dataset.item);
    if (!c) { draw(); return; }
    const name = [c.round || 'the round', c.tournament].filter(Boolean).join(', ');
    if (b.dataset.act === 'submit') change(c, submitCard(c, env.now()), 'Marked submitted in Tabroom: ' + name + '.', 'submitted ' + name);
    if (b.dataset.act === 'cancel') change(c, cancelCard(c, env.now()), 'Cancelled ' + name + '.', 'cancel ' + name);
    if (b.dataset.act === 'room') {
      const label = await env.ui.ask({ title: 'Moved to another room?', input: { label: 'Room', value: c.roomLabel || '', maxLength: ROOM_MAX, emptyError: 'Type the room, for example 204.' },
        buttons: [{ label: 'Cancel', value: null }, { label: 'Save room', value: true, kind: 'primary' }], cancelValue: null });
      if (typeof label !== 'string' || !showing) { if (showing) draw('c:' + c.id); return; }
      const cur = findById(env.day.cards(), c.id) || c;
      change(cur, moveRoom(cur, label), 'Moved to ' + roomText(label) + '.', 'move to ' + roomText(label)); // bug 3: never "room Room 214"
    }
  }

  // Esc closes an open "⋯" menu and puts focus back on its button (as the Room roster's row menu does).
  if (env.ui.escLayer) env.ui.escLayer('md-menu', 40, () => showing && menuFor !== null, () => {
    const key = menuFor; menuFor = null; draw();
    const el = itemEl(key); const b = el && el.querySelector('[data-act="menu"]'); if (b) b.focus();
  });

  return {
    scope: 'myday',
    show() {
      showing = true;
      menuFor = null;
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

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).myday = Object.freeze({ MD_TOAST_KEY, sinceText, itemKey, itemView, dueHtml, cardHtml, upNextHtml, mydayHtml });
