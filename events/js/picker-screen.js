// Speech Events step S3 (docs/events/EXPERIENCE.md §5.2): the type picker, #/pick, and its confirm sheet. A tap on an
// event opens the sheet: room, round (the last number plus one, editable), flight (A, B or none), level (prelim or
// elim) and tournament (from the day). "Paste the room" makes the ballot card and opens setup for it
// (#/start/<cardId>), where the paste box has focus; "Save for later" makes the card and goes back to My day.
// The rows are in picker.js (pure); the builders at the top are pure (Node tests call them); createPickerScreen does
// the DOM. The sheet is a modal dialog (core/ui.js modalDialog), made once and kept outside <main>.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { pickerRows, pickerSections, recentIds } from './picker.js';
import { cardEventId, nextRoundLabel, FLIGHTS, LEVELS, ROOM_MAX } from './cards.js';
import { CUSTOM_EVENT } from './room.js';
import { routeHash } from './routes.js';
import { withRecentEvent } from './settings.js';

// One row. The chips are grey pills in normal case; "Guide" is a plain text button, not an unlabeled "i"
// (design review §2.2 changes 1 and 2).
const chipsHtml = (chips) => `<span class="pk-chips">${chips.map((c) => `<span class="pill outline pk-chip">${esc(c)}</span>`).join('')}</span>`;
const rowHtml = (r) => `<li class="pk-row">
    <button class="pk-pick" type="button" data-id="${esc(r.id)}">
      <span class="pk-name">${esc(r.name)} <span class="muted">${esc(r.short)}</span></span>
      <span class="pk-line">${esc(r.line)}</span>
      ${chipsHtml(r.chips)}
    </button>
    <a class="b small quiet pk-guide" href="${esc(routeHash('type', r.id))}" aria-label="${esc('Guide for ' + r.name)}">${icon('book-open')}Guide</a></li>`;

// The list as HTML text. sections: pickerSections(...).
export function pickerListHtml(sections) {
  if (!sections.length) return '<p class="muted" id="pk-none">No event matches. Try another word, or pick Custom event.</p>';
  let html = '', allShown = false, congressShown = false;
  for (const s of sections) {
    const group = s.id !== 'recent' && s.id !== 'results';
    if (group && !allShown) { html += '<h2 class="pk-all">All events</h2>'; allShown = true; }
    if (s.id === 'custom' && !congressShown) { html += congressHtml(); congressShown = true; }
    const H = group ? 'h3' : 'h2';
    html += `<section class="pk-sec" aria-labelledby="pk-h-${esc(s.id)}"><${H} id="pk-h-${esc(s.id)}">${esc(s.title)}</${H}><ul class="pk-list">${s.rows.map(rowHtml).join('')}</ul></section>`;
  }
  if (allShown && !congressShown) html += congressHtml();
  return html;
}

// The Congress group (EXPERIENCE.md §5.2; step S6): a chamber is not a room round, so its row opens chamber setup
// (#/chamber/new) instead of the confirm sheet. It shows with the family groups, never in search results.
function congressHtml() {
  return `<section class="pk-sec" aria-labelledby="pk-h-congress"><h3 id="pk-h-congress">Congress</h3><ul class="pk-list"><li class="pk-row">
    <a class="pk-pick" href="${esc(routeHash('chamber', 'new'))}"><span class="pk-name">Congressional Debate <span class="muted">Congress</span></span>
      <span class="pk-line">Students give short speeches on bills and answer questions. You score each speech and rank the chamber.</span>
      ${chipsHtml(['Points per speech', 'Top 8'])}</a></li></ul></section>`;
}

export function pickerHtml() {
  return `<div class="screen-head"><a class="b quiet back" href="#/">${icon('chevron-left')}My day</a><h1 id="screen-title" tabindex="-1">Pick the event</h1></div>
    <label class="field pk-search"><span>Search</span><input id="pk-search" type="search" autocomplete="off" spellcheck="false" placeholder="HI, extemp, poetry…"></label>
    <div id="pk-list"></div>`;
}

// The confirm sheet's form as HTML text. v: { name, round, tournament }.
export function sheetHtml(v) {
  const radios = (name, list, picked) => list.map((x) => `<label class="radio"><input type="radio" name="${name}" value="${esc(x.id)}"${x.id === picked ? ' checked' : ''}> ${esc(x.label)}</label>`).join('');
  return `<h2 id="cf-title">${esc(v.name)}</h2>
    <div class="cf-fields">
      <label class="field"><span>Room</span><input id="cf-room" autocomplete="off" maxlength="${ROOM_MAX}" placeholder="204"></label>
      <label class="field"><span>Round</span><input id="cf-round" autocomplete="off" maxlength="40" value="${esc(v.round)}"></label>
      <fieldset class="radios cf-radios"><legend>Flight</legend>${radios('cf-flight', FLIGHTS.map((f) => ({ id: f, label: f || 'None' })), '')}</fieldset>
      <fieldset class="radios cf-radios"><legend>Level</legend>${radios('cf-level', LEVELS, 'prelim')}</fieldset>
      <label class="field wide"><span>Tournament <span class="muted">(optional)</span></span><input id="cf-tour" autocomplete="off" maxlength="80" value="${esc(v.tournament)}"></label>
    </div>
    <p class="form-err" id="cf-err" role="status"></p>
    <div class="ask-btns"><button class="b" type="button" data-cf="later">Save for later</button><button class="b primary" type="submit" data-cf="start">Paste the room</button></div>`;
}

// env: { el, ui, data, now, day (day-store.js), settings(), saveSettings(s), go(screen, id) }.
export function createPickerScreen(env) {
  const $ = (s) => env.el.querySelector(s);
  let rows = [], recent = [], eventId = null;

  // The sheet: made once, outside <main> (a dialog makes <main> inert).
  const wrap = document.createElement('div');
  wrap.className = 'overlay'; wrap.id = 'confirm'; wrap.hidden = true;
  wrap.innerHTML = '<form class="overlay-card cf-card" id="cf-card" role="dialog" aria-modal="true" aria-labelledby="cf-title" novalidate><button class="iconbtn ask-x" id="cf-x" type="button" aria-label="Close">×</button><div id="cf-body"></div></form>';
  document.body.append(wrap);
  const card = wrap.querySelector('#cf-card');
  const dialog = env.ui.modalDialog(wrap, card, { name: 'confirm', rank: 86 });
  wrap.querySelector('#cf-x').addEventListener('click', () => dialog.close());

  function drawList() {
    $('#pk-list').innerHTML = pickerListHtml(pickerSections(rows, recent, $('#pk-search').value));
  }

  function openSheet(id) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    eventId = id;
    const today = env.day.today();
    const cards = today ? env.day.cards().filter((c) => c.dayId === today.id) : [];
    const lastTour = cards.filter((c) => c.tournament).sort((a, b) => a.createdAt - b.createdAt).pop();
    card.querySelector('#cf-body').innerHTML = sheetHtml({ name: row.name, round: nextRoundLabel(cards), tournament: (lastTour && lastTour.tournament) || (today && today.tournament) || '' });
    dialog.open(card.querySelector('#cf-room'));
  }

  function save(next) {
    const f = (sel) => card.querySelector(sel);
    const round = f('#cf-round').value.trim();
    if (!round) { f('#cf-err').textContent = 'Type the round, for example Round 2.'; f('#cf-round').focus(); return; }
    const checked = (name) => { const r = card.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };
    const event = eventId === CUSTOM_EVENT ? { id: CUSTOM_EVENT } : env.data.events.get(eventId);
    const c = env.day.addCard({ event, round, roomLabel: f('#cf-room').value, flight: checked('cf-flight'), level: checked('cf-level'), tournament: f('#cf-tour').value });
    if (!c) { f('#cf-err').textContent = 'The card was not saved. The device storage is full or blocked.'; return; }
    env.saveSettings(withRecentEvent(env.settings(), eventId));
    dialog.close();
    if (next === 'start') env.go('start', c.id);
    else { env.go('rooms'); env.ui.toast('Saved for later: ' + round + '.', { key: 'pick' }); }
  }
  card.addEventListener('submit', (e) => { e.preventDefault(); save('start'); });
  card.addEventListener('click', (e) => { const b = e.target.closest('[data-cf="later"]'); if (b) save('later'); });

  function onClick(e) { const b = e.target.closest('.pk-pick'); if (b) openSheet(b.dataset.id); }
  function onInput(e) { if (e.target.id === 'pk-search') drawList(); }

  return {
    scope: 'pick',
    show() {
      rows = pickerRows(env.data);
      const today = env.day.today();
      const todayIds = today ? env.day.cards().filter((c) => c.dayId === today.id).sort((a, b) => a.createdAt - b.createdAt).map(cardEventId) : [];
      recent = recentIds(rows, todayIds, env.settings().recentEvents);
      env.el.innerHTML = pickerHtml();
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('input', onInput);
      drawList();
      $('#screen-title').focus();
    },
    hide() {
      dialog.close();
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('input', onInput);
    },
  };
}
