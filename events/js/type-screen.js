// Speech Events step S3 (docs/events/EXPERIENCE.md §1.3, §7): the type page, #/type/<eventId>. Three parts:
//   Guide   the plain line, limit, grace, prep, material, performers, rule checks and comment prompts;
//   Rules   each rules profile in plain words;
//   Rounds  the saved rounds of this type, newest first.
// It is reached from the event pill on a My day card and in a round, the picker's "i" link, and History.
// The words are in guide.js (pure); the builders at the top are pure (Node tests call them); createTypeScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { guideModel, rulesLines } from './guide.js';
import { ENABLED_EVENTS, CUSTOM_EVENT, DEFAULT_PROFILE } from './room.js';
import { roundLine, dayOf, STATE_LABEL } from './rooms.js';
import { routeHash } from './routes.js';
import { profileChoices } from './data.js';

// The saved rounds of one type, newest first. A Custom round is one with its own event (room.customEvent).
export function roundsOfType(rooms, eventId) {
  return (rooms || []).filter((r) => r && r.id && Number.isFinite(r.createdAt) && (eventId === CUSTOM_EVENT ? Boolean(r.customEvent) : !r.customEvent && r.eventId === eventId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// The page as HTML text, or null for an id that is not an event this app has.
export function typeHtml(data, eventId, rooms) {
  const custom = eventId === CUSTOM_EVENT;
  const def = custom ? null : data.events.get(eventId);
  if (!custom && (!def || !ENABLED_EVENTS.includes(eventId))) return null;
  const g = guideModel(def, data.profiles.get(DEFAULT_PROFILE));
  const dl = [['Time limit', g.limit], ['Grace', g.grace], ['Prep', g.prep], ['Material', g.material], ['Performers', g.performers]].filter((x) => x[1])
    .map(([k, v]) => `<div class="ty-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const list = (title, items) => (items.length ? `<h3>${esc(title)}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const rules = profileChoices(data).map((p) => { const r = rulesLines(p); return `<h3>${esc(r.name)}</h3><ul>${r.lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`; }).join('');
  const mine = roundsOfType(rooms, eventId);
  const rounds = mine.length
    ? `<ul class="ty-rounds">${mine.map((r) => `<li><a href="${esc(routeHash('round', r.id))}">${esc(roundLine(r, true) || 'Untitled round')}</a> <span class="muted">${esc(dayOf(r.createdAt))} · ${esc(STATE_LABEL[r.state] || STATE_LABEL.setup)}</span></li>`).join('')}</ul>`
    : '<p class="muted">No saved rounds of this type yet.</p>';
  const name = custom ? 'Custom event' : def.name;
  return `<div class="screen-head"><a class="b quiet" href="#/">‹ My day</a><h1 id="screen-title" tabindex="-1">${esc(name)}</h1>${def ? `<span class="pill outline">${esc(def.short)}</span>` : ''}</div>
    <section class="set-part" aria-labelledby="ty-g-h"><h2 id="ty-g-h">Guide</h2>
      <p>${esc(g.line)}</p><dl class="ty-list">${dl}</dl>${list('Rule checks', g.checks)}${list('Questions to think about for comments', g.prompts)}</section>
    <section class="set-part" aria-labelledby="ty-r-h"><h2 id="ty-r-h">Rules</h2>${rules}</section>
    <section class="set-part" aria-labelledby="ty-o-h"><h2 id="ty-o-h">Rounds <span class="muted">${mine.length}</span></h2>${rounds}</section>`;
}

// env: { el, ui, data, rooms(), go(screen, id) }.
export function createTypeScreen(env) {
  return {
    scope: 'type',
    show(eventId) {
      const html = typeHtml(env.data, eventId, env.rooms());
      if (!html) { env.ui.toast('That event is not in this app.', { key: 'notype' }); env.go('rooms'); return; }
      env.el.innerHTML = html;
      env.el.querySelector('#screen-title').focus();
    },
  };
}
