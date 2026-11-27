// Speech Events step E4: the Room setup screen (ARCHITECTURE.md §5 screen 2, DESIGN.md §4.8). The judge picks the
// event and the rules, then pastes the room text from Tabroom or SpeechWire (or types one code per line). A live
// preview shows each entry; lines the parser is not sure about wait under "Check these" until the judge sorts them.
// The builders at the top are pure (Node tests call them); createSetupScreen does the DOM.
// Step S3 (EXPERIENCE.md §5.2): #/start/<cardId> opens this screen filled from a ballot card (event, round, flight,
// tournament) with the paste box in focus. Start makes the round, links the card, and opens #/round/<id>. A round
// started from #/new gets a card too (decision 2a), so it shows on My day.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { foldSummaryHtml, foldValueHtml } from './fold.js';
import { parseRoom } from './parse.js';
import { ENABLED_EVENTS, CUSTOM_EVENT, DEFAULT_PROFILE, createRoom, setupError, findRoom, entryCap } from './room.js';
import { levelFieldsHtml, makePanel } from './round-frame.js';
import { customError, customEvent, withGrace } from './custom.js';
import { graceOf } from './timer.js';
import { profileChoices as allProfileChoices } from './data.js';
import { cardEventId } from './cards.js';

// The event files' { id, name, short } in the picker order, for the enabled events only.
export function eventChoices(data) {
  return (data.order || []).filter((id) => ENABLED_EVENTS.includes(id)).map((id) => data.events.get(id)).filter(Boolean);
}
// Every rules profile, newest version of each, in published order (data.js since step S3; the type page lists them all).
const allProfiles = (data) => allProfileChoices(data);
// Step S4: the Rules picker has two groups. The league rules come first, as before S4. The Tabula ballot shapes (top 3,
// rate only, rubric, comments only, elim room) say so in their own file with group: 'shape', and show in their own
// group under them. A league profile with profile-layer fields (a later league pack) has no group, so it stays a rule.
export const isBallotShape = (p) => Boolean(p) && p.group === 'shape';
export const profileChoices = (data) => allProfiles(data).filter((p) => !isBallotShape(p));
export const shapeChoices = (data) => allProfiles(data).filter(isBallotShape);

// The live preview beside the paste box (under it on a phone) as HTML text. parsed: parseRoom's result. One row per
// entry: its place, code, name and piece title; the lines the parser is not sure of wait under "Check these (N)"
// (design review §2.3 change 2, DESIGN.md §4.8).
export function previewHtml(parsed) {
  const n = parsed.entries.length, k = parsed.check.length;
  const rows = parsed.entries.map((e) => `<li><span class="code">${esc(e.code)}</span>${e.name ? ` <span class="pv-name">${esc(e.name)}</span>` : ''}${e.title ? ` <span class="muted pv-title">${esc(e.title)}</span>` : ''}${e.late ? ' ' + statusPillHtml('', 'Late add') : ''}</li>`).join('');
  const checks = parsed.check.map((c, i) => `<li class="check-row">
      <p class="mono">${esc(c.line)}</p><p class="muted">${esc(c.why)}</p>
      <div class="check-act"><label class="sr-only" for="chk-${i}">Code for this line</label>
        <input id="chk-${i}" class="chk-code" data-key="${esc(c.key)}" value="${esc(c.guess || '')}" placeholder="Code" autocomplete="off" spellcheck="false">
        <button class="b small" type="button" data-act="use" data-key="${esc(c.key)}">Use code</button>
        <button class="b small quiet" type="button" data-act="skip" data-key="${esc(c.key)}">Skip line</button></div></li>`).join('');
  const skipped = parsed.skipped.length ? `<details class="skipped fold">${foldSummaryHtml('Lines left out', statusPillHtml('caution', parsed.skipped.length + ' left out'))}<ul>${parsed.skipped.map((s) => `<li><span class="mono">${esc(s.line)}</span></li>`).join('')}</ul></details>` : '';
  const count = n || k ? `<p class="muted pv-count">${n} ${n === 1 ? 'entry' : 'entries'} found${k ? ' · ' + k + ' to check' : ''}</p>` : '<p class="muted pv-count">Paste the room and each entry shows here as you type.</p>';
  return `<h2 class="preview-title">${n ? n + (n === 1 ? ' entry' : ' entries') + ', in speaking order' : 'No entries yet'}</h2>
    ${count}
    ${n ? `<ol class="preview-list">${rows}</ol>` : ''}
    ${checks ? `<h3>Check these (${k})</h3><ul class="check-list">${checks}</ul>` : ''}${skipped}`;
}

// The Custom event fields (step E12) as HTML text: shown only when the judge picks "Custom event". grace: the picked
// rules profile's grace in seconds, the starting value.
export function customHtml(grace) {
  return `<fieldset class="setup-custom" id="setup-custom" hidden>
      <legend>Custom event</legend>
      <div class="setup-fields">
        <label class="field wide"><span>Event name</span><input id="custom-name" autocomplete="off" placeholder="Custom event" maxlength="60"></label>
        <label class="field"><span>Time limit</span><input id="custom-limit" autocomplete="off" inputmode="numeric" placeholder="7:00"></label>
        <label class="field"><span>Grace <span class="muted">sec</span></span><input id="custom-grace" autocomplete="off" inputmode="numeric" value="${esc(grace)}"></label>
      </div>
      <p class="field-help">No rule checks for a custom event.</p>
    </fieldset>`;
}

// The whole setup form as HTML text.
// The current value of the "Elim or panel?" fold in words (§5.4): "Prelim · Only me", "Elim · Panel of 3".
export const levelSummary = (level, panel) => (level === 'elim' ? 'Elim' : 'Prelim') + ' · ' + (String(panel) === '1' ? 'Only me' : 'Panel of ' + panel);

export function setupHtml(data) {
  const evOpts = eventChoices(data).map((e) => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.limitMinutes)} min)</option>`).join('');
  const opt = (p) => `<option value="${esc(p.id)}"${p.id === DEFAULT_PROFILE ? ' selected' : ''}>${esc(p.name)}</option>`;
  const shapes = shapeChoices(data);
  const prOpts = shapes.length ? `<optgroup label="League rules">${profileChoices(data).map(opt).join('')}</optgroup><optgroup label="Other ballot shapes">${shapes.map(opt).join('')}</optgroup>` : profileChoices(data).map(opt).join('');
  return `<div class="screen-head"><a class="b quiet back" href="#/">${icon('chevron-left')}My day</a><h1 id="screen-title" tabindex="-1">New room</h1></div>
  <form class="setup" id="setup-form" novalidate>
    <div class="setup-fields">
      <label class="field"><span>Event</span><select id="setup-event"><option value="">Pick the event</option>${evOpts}<option value="${CUSTOM_EVENT}">Custom event</option></select></label>
      <label class="field"><span>Rules</span><select id="setup-profile">${prOpts}</select></label>
      <label class="field"><span>Round</span><input id="setup-round" autocomplete="off" placeholder="Round 1"></label>
      <label class="field"><span>Flight</span><input id="setup-flight" autocomplete="off"></label>
      <label class="field wide"><span>Tournament</span><input id="setup-tournament" autocomplete="off"></label>
    </div>
    <!-- The rare fields (design review §2.3 change 3): closed for a prelim, open when the ballot card says elim. -->
    <details class="setup-more fold" id="setup-more">${foldSummaryHtml('Elim or panel?', foldValueHtml(levelSummary('prelim', '1'), 'setup-more-value'))}
      <div class="setup-fields">${levelFieldsHtml()}</div></details>
    <p class="field-help setup-round-help">Check your ballot or room posting for the round stage and judges. Not sure? Ask tournament staff.</p>
    ${customHtml(graceOf({ profile: data.profiles.get(DEFAULT_PROFILE) }))}
    <!-- Laptop: the paste box on the left and the live preview on the right. Phone: the preview under the box. -->
    <div class="setup-paste-area">
      <div class="setup-paste-col">
        <label class="field wide" for="setup-paste"><span>Paste the room, or type one code per line</span></label>
        <textarea id="setup-paste" rows="8" spellcheck="false" placeholder="1. A12&#10;2. B07&#10;3. C33"></textarea>
        <p class="field-help">Codes are enough. The text stays on this device.</p>
      </div>
      <div class="preview" id="setup-preview" aria-live="polite"></div>
    </div>
    <p class="form-err" id="setup-err" role="status"></p>
    <div class="setup-btns"><button class="b primary" type="submit" id="setup-start">Start room</button></div>
  </form>`;
}

// env: { el, ui, data, now, saveRoom(room), go(screen, id), day (day-store.js) }.
export function createSetupScreen(env) {
  let decided = {};
  let cardId = null; // the ballot card this setup starts (#/start/<cardId>), or null (#/new)
  let eventTouched = false;
  let graceTouched = false;
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

  // The Custom event fields show only for the Custom event.
  function showCustom() { $('#setup-custom').hidden = $('#setup-event').value !== CUSTOM_EVENT; }
  // The fold's value follows the Level and Judges fields (§5.4: the closed row still says what is set).
  function showLevel() { $('#setup-more-value').textContent = levelSummary($('#setup-level').value, $('#setup-panel').value); }

  function start(e) {
    e.preventDefault();
    update();
    const eventId = $('#setup-event').value;
    const custom = eventId === CUSTOM_EVENT;
    const form = { name: $('#custom-name').value, limit: $('#custom-limit').value, grace: $('#custom-grace').value };
    const cErr = custom ? customError(form) : '';
    if (cErr) { $('#setup-err').textContent = cErr; $(/limit/.test(cErr) ? '#custom-limit' : '#custom-grace').focus(); return; }
    const profile = env.data.profiles.get($('#setup-profile').value);
    const err = setupError(parsed, eventId, entryCap(profile)); // step S4: the picked rules may hold more than 8
    if (err) { $('#setup-err').textContent = err; (eventId ? $('#setup-paste') : $('#setup-event')).focus(); return; }
    const room = createRoom({
      event: custom ? customEvent(form) : env.data.events.get(eventId),
      profile: custom ? withGrace(profile, form.grace) : profile,
      entries: parsed.entries,
      round: $('#setup-round').value, flight: $('#setup-flight').value, tournament: $('#setup-tournament').value,
      level: $('#setup-level').value, panel: makePanel($('#setup-panel').value, $('#setup-panel-note').value),
      now: env.now(),
    });
    // The card gets the round (or a new card is made for it); the round gets the card's day, level and room.
    const link = env.day ? env.day.linkNewRound(room, cardId, { level: $('#setup-level').value }) : { round: room, card: null };
    if (env.saveRoom(link.round) === false) { $('#setup-err').textContent = 'The round was not saved. The device storage is full or blocked.'; return; }
    if (link.card) env.day.saveCard(link.card); // a failed card save still leaves the round on My day (a round with no card)
    env.go('round', link.round.id);
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
    // eventId: the event to pick at the start (#/new/<eventId>, the palette's "New HI round"; step S2). An id that is
    // not an enabled event is ignored, so the judge picks as before.
    // opts.cardId: the ballot card to start (#/start/<cardId>). A card that is not on this device, or that already has
    // its round, goes back to My day with a word (a reload must never make a second round for one card).
    show(eventId, opts) {
      decided = {}; eventTouched = false; graceTouched = false; cardId = null;
      const card = opts && opts.cardId && env.day ? env.day.card(opts.cardId) : null;
      const started = card && card.roundId && findRoom(env.rooms(), card.roundId);
      if (opts && opts.cardId && (!card || started || card.status === 'cancelled')) {
        env.ui.toast(!card ? 'That ballot card is not on this device.' : started ? 'That round is already started.' : 'That round is cancelled.', { key: 'nocard' });
        if (started) env.go('round', card.roundId); else env.go('rooms');
        return;
      }
      env.el.innerHTML = setupHtml(env.data);
      if (eventId && ENABLED_EVENTS.includes(eventId)) { $('#setup-event').value = eventId; eventTouched = true; }
      if (card) {
        cardId = card.id;
        const id = cardEventId(card);
        if (id === CUSTOM_EVENT || ENABLED_EVENTS.includes(id)) { $('#setup-event').value = id; eventTouched = true; }
        $('#setup-round').value = card.round || '';
        $('#setup-flight').value = card.flight || '';
        $('#setup-tournament').value = card.tournament || '';
        $('#setup-level').value = card.level === 'elim' ? 'elim' : 'prelim'; // the S4 Level field starts as the card's level
        $('#setup-more').open = card.level === 'elim'; // an elim card opens the rare fields
        showLevel();
        $('#screen-title').textContent = 'Paste the room';
        showCustom();
      }
      $('#setup-paste').addEventListener('input', update);
      $('#setup-event').addEventListener('change', () => { eventTouched = true; $('#setup-err').textContent = ''; showCustom(); });
      // The grace starts as the picked rules' grace, until the judge types their own.
      $('#custom-grace').addEventListener('input', () => { graceTouched = true; });
      $('#setup-profile').addEventListener('change', () => { if (!graceTouched) $('#custom-grace').value = String(graceOf({ profile: env.data.profiles.get($('#setup-profile').value) })); });
      $('#setup-panel').addEventListener('change', () => { $('#setup-panel-note-box').hidden = $('#setup-panel').value === '1'; showLevel(); });
      $('#setup-level').addEventListener('change', showLevel);
      $('#setup-form').addEventListener('submit', start);
      $('#setup-preview').addEventListener('click', onClick);
      $('#setup-preview').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('chk-code')) { e.preventDefault(); e.target.parentElement.querySelector('[data-act="use"]').click(); } });
      update();
      (card && !$('#setup-custom').hidden ? $('#custom-limit') : card ? $('#setup-paste') : $('#screen-title')).focus();
    },
  };
}
