// Speech Events step S6 (docs/events/CONGRESS.md §4.1; EXPERIENCE.md §1.3): the chamber screens.
//   #/chamber          the chambers on this device, and "New chamber"
//   #/chamber/new      chamber setup: paste the chamber list, the docket, House or Senate, the rules and the scale
//   #/chamber/<id>     the chamber overview: its sessions (each opens #/round/<sessionId>/log), "Start session N",
//                      who is present, and the docket (items debated in an earlier session are grayed out)
// The parliamentarian's full-chamber rank on this page is step S7. The builders at the top are pure (Node tests);
// createChamberScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from '../js/icons.js';
import { statusPillHtml } from '../js/status-pill.js';
import { parseRoom } from '../js/parse.js';
import { newId } from '../js/room.js';
import { congressIO, findChamber, chamberSessions, withChamber, withSession } from './store.js';
import { CONGRESS_PROFILES, DEFAULT_CONGRESS_PROFILE, SCALE_CHOICES, RANK_POOL_WORDS, congressProfile, scaleId, scaleText, ranksOnly, unverifiedWords, poScaleChoices, rankPoolChoices } from './profiles.js';
import { BETA_TAG, betaNoteHtml, CHECK_RULE } from './views.js';
import { createChamber, newSession, setStatus, setupChecks, docketLines, houseWord, closeSession, sessionsToClose } from './chamber.js';
import { sessionStatus } from './review.js';

const STATUS_WORDS = Object.freeze({ present: 'Present', absent: 'Absent', left: 'Left' });

export function listHtml(state) {
  const rows = state.chambers.slice().sort((a, b) => b.createdAt - a.createdAt).map((c) => {
    const n = chamberSessions(state, c.id).length;
    return `<li><a class="room-link" href="#/chamber/${esc(c.id)}"><span class="room-name">${houseWord(c)}${c.tournament ? ' · ' + esc(c.tournament) : ''}${c.roomLabel ? ' · ' + esc(c.roomLabel) : ''}</span>
      <span class="room-meta">${c.legislators.length} legislators · ${n} ${n === 1 ? 'session' : 'sessions'}</span></a></li>`;
  }).join('');
  return `<div class="screen-head"><a class="b quiet back" href="#/">${icon('chevron-left')}My day</a><h1 id="screen-title" tabindex="-1">Congress chambers ${BETA_TAG}</h1><a class="b primary" href="#/chamber/new">New chamber</a></div>
    ${betaNoteHtml()}
    ${rows ? `<ul class="room-list">${rows}</ul>` : '<p class="muted">No chambers yet.</p>'}`;
}

// The setup form. prefs: the last profile and scale the judge picked.
export function setupHtml(prefs) {
  const pid = (prefs && prefs.profileId && congressProfile(prefs.profileId)) ? prefs.profileId : DEFAULT_CONGRESS_PROFILE;
  const prOpts = CONGRESS_PROFILES.map((p) => `<option value="${esc(p.id)}"${p.id === pid ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  const scOpts = `<option value="">The rules' scale</option>` + SCALE_CHOICES.map((s) => `<option value="${s.id}"${prefs && prefs.scale === s.id ? ' selected' : ''}>${esc(scaleText(s))}</option>`).join('');
  return `<div class="screen-head"><a class="b quiet back" href="#/chamber">${icon('chevron-left')}Chambers</a><h1 id="screen-title" tabindex="-1">New Congress chamber ${BETA_TAG}</h1></div>
  ${betaNoteHtml()}
  <form class="setup" id="cg-setup" novalidate>
    <div class="setup-fields">
      <label class="field"><span>Tournament</span><input id="cg-tournament" autocomplete="off" maxlength="80"></label>
      <label class="field"><span>Room</span><input id="cg-room" autocomplete="off" maxlength="40"></label>
      <!-- House or Senate as a two-option segmented control (design review §2.15, bug 7): the label sits on its option,
           never under the radio. Role is a fixed line, not a label with no control. -->
      <fieldset class="field cg-house"><legend>Chamber</legend><div class="seg"><label class="seg-opt"><input type="radio" name="cg-house" value="house" checked><span>House</span></label><label class="seg-opt"><input type="radio" name="cg-house" value="senate"><span>Senate</span></label></div></fieldset>
      <p class="cg-role"><span class="cg-role-k">Role:</span> Scorer <span class="muted">(parliamentarian tools come later)</span></p>
      <label class="field"><span>Rules</span><select id="cg-profile">${prOpts}</select></label>
      <label class="field" id="cg-scale-field"><span>Points scale</span><select id="cg-scale">${scOpts}</select></label>
      <div class="wide cg-open" id="cg-open"></div>
      <p class="field-help wide" id="cg-profile-note"></p>
      <label class="field wide"><span>Chamber list <span class="muted">paste the chamber list, or one code per line</span></span><textarea id="cg-paste" rows="8" spellcheck="false"></textarea></label>
      <label class="field wide"><span>Docket <span class="muted">(one bill or resolution for each line, in agenda order)</span></span><textarea id="cg-docket" rows="5"></textarea></label>
    </div>
    <div class="preview" id="cg-preview" aria-live="polite"></div>
    <div class="setup-btns"><button class="b primary" type="submit" id="cg-create">Start the chamber</button></div>
  </form>`;
}

// The choices for the values a source did not confirm (the PO points range, who can be ranked), each with "Check
// your tournament's rule". The app does not decide these: the rules' value comes first and the judge can change it.
// picks: { poScale?: '4-8', rankPool?: 'present' } (the current form values, so a redraw keeps them).
export function openFactsHtml(profile, picks = {}) {
  const po = poScaleChoices(profile);
  const pool = rankPoolChoices(profile);
  if (!po.length && !pool.length) return '';
  const opt = (v, words, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(words)}</option>`;
  const poCur = picks.poScale && po.some((c) => scaleId(c) === picks.poScale) ? picks.poScale : (po[0] ? scaleId(po[0]) : '');
  const poolCur = picks.rankPool && pool.includes(picks.rankPool) ? picks.rankPool : pool[0];
  return `<p class="cg-open-head">Not settled in the rules we found. ${CHECK_RULE}</p><div class="cg-open-fields">`
    + (po.length ? `<label class="field"><span>PO points for each full hour</span><select id="cg-po-scale">${po.map((c) => opt(scaleId(c), scaleText(c), scaleId(c) === poCur)).join('')}</select></label>` : '')
    + (pool.length ? `<label class="field"><span>Who can be ranked</span><select id="cg-rank-pool">${pool.map((k) => opt(k, RANK_POOL_WORDS[k], k === poolCur)).join('')}</select></label>` : '')
    + '</div>';
}

// The line under the rules: the scales and what a source did not confirm.
export function profileNote(profile, scale) {
  const s = scale || profile.scale;
  const po = profile.poRule === 'none' ? 'The PO gets no points.' : profile.poRule === 'parliScores' ? 'The parliamentarian scores the PO.' : 'PO: ' + scaleText(profile.poScale) + ' for each full hour.';
  const open = unverifiedWords(profile);
  const speeches = ranksOnly(profile) ? 'Ranks only: no speech points' : 'Speeches: ' + scaleText(s);
  return speeches + '. ' + po + ' Top ' + profile.topN + '.' + (profile.reasonBelow != null ? ' A score below ' + profile.reasonBelow + ' needs a reason.' : '')
    + (profile.rankPool === 'spokeOrPresided' ? ' Only those who spoke or presided can be ranked.' : '')
    + (open.length ? ' Not verified: ' + open.join(', ') + '. ' + CHECK_RULE : '');
}

// The preview: the legislators found and the "Check these" lines.
export function previewHtml(parsed, checks) {
  const n = parsed.entries.length;
  return `<h2 class="preview-title">${n ? n + (n === 1 ? ' legislator' : ' legislators') : 'No legislators yet'}</h2>
    ${n ? `<p class="cg-codes">${parsed.entries.map((e) => `<span class="pill outline code">${esc(e.code)}</span>`).join(' ')}</p>` : ''}
    ${checks.length ? `<h3>Check these</h3><ul class="check-list">${checks.map((c) => `<li class="check-row"><p>${esc(c.text)}</p></li>`).join('')}</ul>` : ''}`;
}

// Absent or Left as a neutral word beside the code (color review §6: absent is not an error, so no status color).
export const outPill = (status) => (status === 'absent' || status === 'left' ? statusPillHtml('', STATUS_WORDS[status], '', 'data-out') : '');

// A session's status as a pill in words (color review §6 Chamber overview): green once submitted, a quiet tint while
// in progress, plain before it starts.
const SESSION_TONE = Object.freeze({ Submitted: ['ok', 'circle-check'], 'Ranks copied': ['live', 'copy'], Ranking: ['live', 'list-ordered'], Scoring: ['live', 'circle-dashed'], 'Not started': ['', 'circle'] });
export const sessionPill = (s) => { const w = sessionStatus(s); const [tone, ic] = SESSION_TONE[w] || ['', '']; return statusPillHtml(tone, w, ic); };

export function overviewHtml(state, chamber) {
  const sessions = chamberSessions(state, chamber.id);
  const next = sessions.length + 1;
  const p = chamber.profile;
  // While the latest session is not handed in, the judge most likely wants to go back to it, so that is the primary
  // action, and "Start session N" is a plain button (one stray tap no longer opens a new ballot mid-session).
  const last = sessions[sessions.length - 1];
  const open = last && !last.submittedAt ? last : null;
  const startBtn = `<button class="b${open ? '' : ' primary'}" type="button" data-chact="session" data-key="session">${icon('play', 20)}Start session ${next}</button>`;
  const head = open ? `<div class="cg-row"><a class="b primary" href="#/round/${esc(open.id)}/log">Open session ${esc(open.number)}</a>${startBtn}</div>` : startBtn;
  const picked = (p.picked || []).map((f) => (f === 'poScale' ? 'PO points ' + scaleText(p.poScale) : 'who can be ranked: ' + RANK_POOL_WORDS[p.rankPool].toLowerCase()));
  const srows = sessions.map((s) => `<li><a class="room-link" href="#/round/${esc(s.id)}/log"><span class="room-name">Session ${esc(s.number)}</span>
      ${sessionPill(s)}<span class="room-meta">${s.speeches.length} ${s.speeches.length === 1 ? 'speech' : 'speeches'}</span>${icon('chevron-right')}</a></li>`).join('');
  const lrows = chamber.legislators.map((l) => `<li class="cg-leg"><span class="code">${esc(l.code)}</span>${outPill(l.status)}<span class="muted">${esc(l.name || '')}</span>
      <label class="sr-only" for="st-${esc(l.id)}">Status of ${esc(l.code)}</label>
      <select id="st-${esc(l.id)}" data-status="${esc(l.id)}">${Object.keys(STATUS_WORDS).map((k) => `<option value="${k}"${l.status === k ? ' selected' : ''}>${STATUS_WORDS[k]}</option>`).join('')}</select></li>`).join('');
  const drows = chamber.docket.map((d) => `<li${d.debatedInSession ? ' class="muted"' : ''}>${esc(d.title)}${d.debatedInSession ? ' ' + statusPillHtml('live', 'Done in session ' + d.debatedInSession, 'check') : ''}</li>`).join('');
  return `<div class="screen-head"><a class="b quiet back" href="#/chamber">${icon('chevron-left')}Chambers</a><h1 id="screen-title" tabindex="-1">${houseWord(chamber)}${chamber.tournament ? ' · ' + esc(chamber.tournament) : ''} ${BETA_TAG}</h1>
      ${head}</div>
    <p class="cg-before" id="cg-before">${icon('info')}Mark who is absent before a session. Absent legislators are not in the rank pool. A session whose ranks are copied or submitted keeps its own list.</p>
    <p class="muted">${esc(p.name)} · ${esc(profileNote(p))}${picked.length ? ' Set at setup: ' + esc(picked.join('; ')) + '.' : ''}</p>
    <h2 class="cg-h">Sessions</h2>${srows ? `<ul class="room-list">${srows}</ul>` : '<p class="muted">No sessions yet.</p>'}
    <h2 class="cg-h">Legislators <span class="muted">(${chamber.legislators.length})</span></h2>
    <ul class="room-list cg-legs">${lrows}</ul>
    <h2 class="cg-h">Docket</h2>${drows ? `<ol class="cg-docket-list">${drows}</ol>` : '<p class="muted">No docket items.</p>'}
    <p class="muted">The parliamentarian's full-chamber rank comes in a later step.</p>`;
}

// A status change from the overview, as a new Congress state. Before the chamber changes, each session that must not
// follow it (every earlier session, and the latest once its ranks are copied or it is submitted: chamber.js
// sessionsToClose) keeps a copy of the statuses it had. So a change never empties a slot on a ballot handed in.
export function statusChange(state, chamberId, legislatorId, status, now) {
  const c = findChamber(state, chamberId);
  if (!c) return state;
  let st = state;
  for (const s of sessionsToClose(chamberSessions(state, chamberId))) st = withSession(st, closeSession(s, c));
  return withChamber(st, setStatus(c, legislatorId, status, now));
}

// env: { el, ui, store, now, go }.
export function createChamberScreen(env) {
  const io = congressIO(env.store);
  const $ = (s) => env.el.querySelector(s);
  let id = null;
  let off = () => {};

  function wireSetup() {
    const form = $('#cg-setup');
    const read = () => {
      const profile = congressProfile($('#cg-profile').value) || congressProfile(DEFAULT_CONGRESS_PROFILE);
      const sc = ranksOnly(profile) ? null : SCALE_CHOICES.find((s) => s.id === $('#cg-scale').value) || null;
      const parsed = parseRoom($('#cg-paste').value);
      const docket = docketLines($('#cg-docket').value);
      const poSel = $('#cg-po-scale');
      const poolSel = $('#cg-rank-pool');
      const open = { poScale: poSel ? (poScaleChoices(profile).find((c) => scaleId(c) === poSel.value) || null) : null, rankPool: poolSel ? poolSel.value : null };
      return { profile, sc, open, parsed, docket, checks: setupChecks(parsed, docket, profile) };
    };
    let shownFor = null;
    const update = () => {
      // The open-fact choices belong to one rules profile: draw them again only when the rules change, so a pick holds.
      const pid = $('#cg-profile').value;
      if (pid !== shownFor) {
        shownFor = pid;
        $('#cg-open').innerHTML = openFactsHtml(congressProfile(pid) || congressProfile(DEFAULT_CONGRESS_PROFILE));
      }
      const r = read();
      $('#cg-scale-field').hidden = ranksOnly(r.profile);
      const shown = Object.assign({}, r.profile, r.open.poScale ? { poScale: r.open.poScale } : {}, r.open.rankPool ? { rankPool: r.open.rankPool } : {});
      $('#cg-profile-note').textContent = profileNote(shown, r.sc);
      $('#cg-preview').innerHTML = previewHtml(r.parsed, r.checks);
      $('#cg-create').disabled = r.checks.some((c) => c.block);
    };
    const onSubmit = (ev) => {
      ev.preventDefault();
      const r = read();
      if (r.checks.some((c) => c.block)) { update(); return; }
      const now = env.now();
      const chamber = createChamber({ entries: r.parsed.entries, docket: r.docket, house: (form.querySelector('input[name="cg-house"]:checked') || {}).value,
        profile: r.profile, scale: r.sc, open: r.open, tournament: $('#cg-tournament').value.trim(), roomLabel: $('#cg-room').value.trim(), now, makeId: newId });
      const made = newSession(chamber, [], { now, makeId: newId });
      let st = withSession(withChamber(io.read(), made.chamber), made.session);
      st = Object.assign({}, st, { prefs: { profileId: r.profile.id, scale: r.sc ? scaleId(r.sc) : '' } });
      if (!io.write(st)) return;
      location.hash = '#/round/' + made.session.id + '/log';
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', onSubmit);
    update();
    off = () => { form.removeEventListener('input', update); form.removeEventListener('change', update); form.removeEventListener('submit', onSubmit); };
  }

  function wireOverview() {
    const onClick = (ev) => {
      const b = ev.target.closest('[data-chact="session"]');
      if (!b) return;
      const st = io.read();
      const c = findChamber(st, id);
      const earlier = chamberSessions(st, id);
      const made = newSession(c, earlier, { now: env.now(), makeId: newId });
      // Each earlier session keeps the statuses it ended with, so marking someone absent for this session never
      // changes the rank pool of a ballot already scored (chamber.js closeSession).
      let next = withChamber(st, made.chamber);
      for (const old of earlier) next = withSession(next, closeSession(old, c));
      if (io.write(withSession(next, made.session))) location.hash = '#/round/' + made.session.id + '/log';
    };
    const onChange = (ev) => {
      const sel = ev.target.closest('select[data-status]');
      if (!sel) return;
      io.write(statusChange(io.read(), id, sel.dataset.status, sel.value, env.now()));
      // The word beside the code follows the select at once (no redraw, so the focus stays on the select).
      const row = sel.closest('.cg-leg');
      const old = row && row.querySelector('[data-out]');
      if (old) old.remove();
      if (row) row.querySelector('.code').insertAdjacentHTML('afterend', outPill(sel.value));
      env.ui.announce('Saved.');
    };
    env.el.addEventListener('click', onClick);
    env.el.addEventListener('change', onChange);
    off = () => { env.el.removeEventListener('click', onClick); env.el.removeEventListener('change', onChange); };
  }

  function show(routeId) {
    off(); off = () => {};
    id = routeId;
    const st = io.read();
    if (!id) env.el.innerHTML = listHtml(st);
    else if (id === 'new') { env.el.innerHTML = setupHtml(st.prefs); wireSetup(); }
    else {
      const c = findChamber(st, id);
      if (!c) { env.ui.toast('That chamber is not on this device.', { key: 'nochamber' }); location.hash = '#/chamber'; return; }
      env.el.innerHTML = overviewHtml(st, c); wireOverview();
    }
    const t = $('#screen-title'); if (t) t.focus({ preventScroll: true });
  }

  return { scope: null, run: () => false, show, hide() { off(); off = () => {}; }, refresh() { show(id); } };
}
