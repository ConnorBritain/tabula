// Speech Events step E4: the Room setup screen (ARCHITECTURE.md §5 screen 2, DESIGN.md §4.8). The judge picks the
// event and the rules, then pastes the room text from Tabroom or SpeechWire (or types one code per line). A live
// preview shows each entry; lines the parser is not sure about wait under "Check these" until the judge sorts them.
// The builders at the top are pure (Node tests call them); createSetupScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { parseRoom } from './parse.js';
import { ENABLED_EVENTS, DEFAULT_PROFILE, createRoom, setupError } from './room.js';

// The event files' { id, name, short } in the picker order, for the enabled events only.
export function eventChoices(data) {
  return (data.order || []).filter((id) => ENABLED_EVENTS.includes(id)).map((id) => data.events.get(id)).filter(Boolean);
}
// Every rules profile, newest version of each, in published order.
export function profileChoices(data) {
  const seen = new Set();
  const out = [];
  for (const k of data.profiles.keys()) { const id = k.split('@')[0]; if (!seen.has(id)) { seen.add(id); out.push(data.profiles.get(id)); } }
  return out.filter(Boolean);
}

// The preview under the paste box as HTML text. parsed: parseRoom's result.
export function previewHtml(parsed) {
  const n = parsed.entries.length;
  const rows = parsed.entries.map((e) => `<li><span class="code">${esc(e.code)}</span>${e.name ? ` <span>${esc(e.name)}</span>` : ''}${e.late ? ' <span class="pill">Late add</span>' : ''}</li>`).join('');
  const checks = parsed.check.map((c, i) => `<li class="check-row">
      <p class="mono">${esc(c.line)}</p><p class="muted">${esc(c.why)}</p>
      <div class="check-act"><label class="sr-only" for="chk-${i}">Code for this line</label>
        <input id="chk-${i}" class="chk-code" data-key="${esc(c.key)}" value="${esc(c.guess || '')}" placeholder="Code" autocomplete="off" spellcheck="false">
        <button class="b small" type="button" data-act="use" data-key="${esc(c.key)}">Use code</button>
        <button class="b small quiet" type="button" data-act="skip" data-key="${esc(c.key)}">Skip line</button></div></li>`).join('');
  const skipped = parsed.skipped.length ? `<details class="skipped"><summary>Lines left out (${parsed.skipped.length})</summary><ul>${parsed.skipped.map((s) => `<li><span class="mono">${esc(s.line)}</span></li>`).join('')}</ul></details>` : '';
  return `<h2 class="preview-title">${n ? n + (n === 1 ? ' entry' : ' entries') + ', in speaking order' : 'No entries yet'}</h2>
    ${n ? `<ol class="preview-list">${rows}</ol>` : ''}
    ${checks ? `<h3>Check these</h3><ul class="check-list">${checks}</ul>` : ''}${skipped}`;
}

// The whole setup form as HTML text.
export function setupHtml(data) {
  const evOpts = eventChoices(data).map((e) => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.limitMinutes)} min)</option>`).join('');
  const prOpts = profileChoices(data).map((p) => `<option value="${esc(p.id)}"${p.id === DEFAULT_PROFILE ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  return `<div class="screen-head"><a class="b quiet" href="#/">‹ Rooms</a><h1 id="screen-title" tabindex="-1">New room</h1></div>
  <form class="setup" id="setup-form" novalidate>
    <div class="setup-fields">
      <label class="field"><span>Event</span><select id="setup-event"><option value="">Pick the event</option>${evOpts}</select></label>
      <label class="field"><span>Rules</span><select id="setup-profile">${prOpts}</select></label>
      <label class="field"><span>Round</span><input id="setup-round" autocomplete="off" placeholder="Round 1"></label>
      <label class="field"><span>Flight <span class="muted">(optional)</span></span><input id="setup-flight" autocomplete="off"></label>
      <label class="field wide"><span>Tournament <span class="muted">(optional)</span></span><input id="setup-tournament" autocomplete="off"></label>
    </div>
    <label class="field wide" for="setup-paste"><span>Paste the room from Tabroom or SpeechWire, or type one code per line</span></label>
    <textarea id="setup-paste" rows="8" spellcheck="false" placeholder="1. A12&#10;2. B07&#10;3. C33"></textarea>
    <p class="field-help">The text stays on this device. Codes are enough; names are optional.</p>
    <div class="preview" id="setup-preview" aria-live="polite"></div>
    <p class="form-err" id="setup-err" role="status"></p>
    <div class="setup-btns"><button class="b primary" type="submit" id="setup-start">Start room</button></div>
  </form>`;
}

// env: { el, ui, data, now, saveRoom(room), go(screen, id) }.
export function createSetupScreen(env) {
  let decided = {};
  let eventTouched = false;
  let parsed = null;
  const $ = (s) => env.el.querySelector(s);
  const evList = () => eventChoices(env.data).map((e) => ({ id: e.id, name: e.name, short: e.short }));

  function update() {
    parsed = parseRoom($('#setup-paste').value, { events: evList(), decided });
    // The pasted text may name the event; use it unless the judge already picked one.
    if (!eventTouched && parsed.event && parsed.event.id && ENABLED_EVENTS.includes(parsed.event.id)) $('#setup-event').value = parsed.event.id;
    if (parsed.round && !$('#setup-round').value) $('#setup-round').value = parsed.round;
    $('#setup-preview').innerHTML = previewHtml(parsed);
    $('#setup-err').textContent = '';
  }

  function start(e) {
    e.preventDefault();
    update();
    const eventId = $('#setup-event').value;
    const err = setupError(parsed, eventId);
    if (err) { $('#setup-err').textContent = err; (eventId ? $('#setup-paste') : $('#setup-event')).focus(); return; }
    const room = createRoom({
      event: env.data.events.get(eventId),
      profile: env.data.profiles.get($('#setup-profile').value),
      entries: parsed.entries,
      round: $('#setup-round').value, flight: $('#setup-flight').value, tournament: $('#setup-tournament').value,
      now: env.now(),
    });
    env.saveRoom(room);
    env.go('room', room.id);
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const key = b.dataset.key;
    if (b.dataset.act === 'skip') decided[key] = 'skip';
    if (b.dataset.act === 'use') {
      const input = [...env.el.querySelectorAll('.chk-code')].find((i) => i.dataset.key === key);
      const code = input ? input.value.trim() : '';
      if (!code) { if (input) input.focus(); $('#setup-err').textContent = 'Type the code for that line, or skip it.'; return; }
      decided[key] = code;
    }
    update();
    const next = env.el.querySelector('.chk-code') || $('#setup-start');
    next.focus();
  }

  return {
    scope: 'setup',
    show() {
      decided = {}; eventTouched = false;
      env.el.innerHTML = setupHtml(env.data);
      $('#setup-paste').addEventListener('input', update);
      $('#setup-event').addEventListener('change', () => { eventTouched = true; $('#setup-err').textContent = ''; });
      $('#setup-form').addEventListener('submit', start);
      $('#setup-preview').addEventListener('click', onClick);
      $('#setup-preview').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('chk-code')) { e.preventDefault(); e.target.parentElement.querySelector('[data-act="use"]').click(); } });
      update();
      $('#screen-title').focus();
    },
    hide() {},
  };
}
