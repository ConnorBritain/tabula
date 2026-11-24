// Speech Events step S6 (docs/events/CONGRESS.md §4.1; EXPERIENCE.md §1.3): the chamber screens.
//   #/chamber          the chambers on this device, and "New chamber"
//   #/chamber/new      chamber setup: paste the chamber list, the docket, House or Senate, the rules and the scale
//   #/chamber/<id>     the chamber overview: its sessions (each opens #/round/<sessionId>/log), "Start session N",
//                      who is present, and the docket (items debated in an earlier session are grayed out)
// The parliamentarian's full-chamber rank on this page is step S7. The builders at the top are pure (Node tests);
// createChamberScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { parseRoom } from '../js/parse.js';
import { newId } from '../js/room.js';
import { congressIO, findChamber, chamberSessions, withChamber, withSession } from './store.js';
import { CONGRESS_PROFILES, DEFAULT_CONGRESS_PROFILE, SCALE_CHOICES, congressProfile, scaleId, scaleText, unverifiedWords } from './profiles.js';
import { createChamber, newSession, setStatus, setupChecks, docketLines, houseWord } from './chamber.js';
import { sessionStatus } from './review.js';

const STATUS_WORDS = Object.freeze({ present: 'Present', absent: 'Absent', left: 'Left' });

export function listHtml(state) {
  const rows = state.chambers.slice().sort((a, b) => b.createdAt - a.createdAt).map((c) => {
    const n = chamberSessions(state, c.id).length;
    return `<li><a class="room-link" href="#/chamber/${esc(c.id)}"><span class="room-name">${houseWord(c)}${c.tournament ? ' · ' + esc(c.tournament) : ''}${c.roomLabel ? ' · ' + esc(c.roomLabel) : ''}</span>
      <span class="room-meta">${c.legislators.length} legislators · ${n} ${n === 1 ? 'session' : 'sessions'}</span></a></li>`;
  }).join('');
  return `<div class="screen-head"><a class="b quiet" href="#/">‹ Rooms</a><h1 id="screen-title" tabindex="-1">Congress chambers</h1><a class="b primary" href="#/chamber/new">New chamber</a></div>
    ${rows ? `<ul class="room-list">${rows}</ul>` : '<p class="muted">No chambers yet. A Congress chamber you score shows here.</p>'}`;
}

// The setup form. prefs: the last profile and scale the judge picked.
export function setupHtml(prefs) {
  const pid = (prefs && prefs.profileId && congressProfile(prefs.profileId)) ? prefs.profileId : DEFAULT_CONGRESS_PROFILE;
  const prOpts = CONGRESS_PROFILES.map((p) => `<option value="${esc(p.id)}"${p.id === pid ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  const scOpts = `<option value="">The rules' scale</option>` + SCALE_CHOICES.map((s) => `<option value="${s.id}"${prefs && prefs.scale === s.id ? ' selected' : ''}>${esc(scaleText(s))}</option>`).join('');
  return `<div class="screen-head"><a class="b quiet" href="#/chamber">‹ Chambers</a><h1 id="screen-title" tabindex="-1">New Congress chamber</h1></div>
  <form class="setup" id="cg-setup" novalidate>
    <div class="setup-fields">
      <label class="field"><span>Tournament <span class="muted">(optional)</span></span><input id="cg-tournament" autocomplete="off" maxlength="80"></label>
      <label class="field"><span>Room <span class="muted">(optional)</span></span><input id="cg-room" autocomplete="off" maxlength="40"></label>
      <fieldset class="field cg-house"><legend>Chamber</legend><label><input type="radio" name="cg-house" value="house" checked> House</label> <label><input type="radio" name="cg-house" value="senate"> Senate</label></fieldset>
      <div class="field"><span>Role</span><p class="cg-static">Scorer <span class="muted">(parliamentarian tools come later)</span></p></div>
      <label class="field"><span>Rules</span><select id="cg-profile">${prOpts}</select></label>
      <label class="field"><span>Points scale</span><select id="cg-scale">${scOpts}</select></label>
      <p class="field-help wide" id="cg-profile-note"></p>
      <label class="field wide"><span>Chamber list <span class="muted">(paste from Tabroom, or one code for each line)</span></span><textarea id="cg-paste" rows="8" spellcheck="false"></textarea></label>
      <label class="field wide"><span>Docket <span class="muted">(one bill or resolution for each line, in agenda order)</span></span><textarea id="cg-docket" rows="5"></textarea></label>
    </div>
    <div class="preview" id="cg-preview" aria-live="polite"></div>
    <div class="setup-btns"><button class="b primary" type="submit" id="cg-create">Start the chamber</button></div>
  </form>`;
}

// The line under the rules: the scales and what a source did not confirm.
export function profileNote(profile, scale) {
  const s = scale || profile.scale;
  const po = profile.poRule === 'parliScores' ? 'The parliamentarian scores the PO.' : 'PO: ' + scaleText(profile.poScale) + ' for each full hour.';
  const open = unverifiedWords(profile);
  return 'Speeches: ' + scaleText(s) + '. ' + po + ' Top ' + profile.topN + '.' + (profile.reasonBelow != null ? ' A score below ' + profile.reasonBelow + ' needs a reason.' : '')
    + (open.length ? ' Not verified: ' + open.join(', ') + '. Check with the tab room.' : '');
}

// The preview: the legislators found and the "Check these" lines.
export function previewHtml(parsed, checks) {
  const n = parsed.entries.length;
  return `<h2 class="preview-title">${n ? n + (n === 1 ? ' legislator' : ' legislators') : 'No legislators yet'}</h2>
    ${n ? `<p class="cg-codes">${parsed.entries.map((e) => `<span class="pill outline code">${esc(e.code)}</span>`).join(' ')}</p>` : ''}
    ${checks.length ? `<h3>Check these</h3><ul class="check-list">${checks.map((c) => `<li class="check-row"><p>${esc(c.text)}</p></li>`).join('')}</ul>` : ''}`;
}

export function overviewHtml(state, chamber) {
  const sessions = chamberSessions(state, chamber.id);
  const next = sessions.length + 1;
  const p = chamber.profile;
  const srows = sessions.map((s) => `<li><a class="room-link" href="#/round/${esc(s.id)}/log"><span class="room-name">Session ${esc(s.number)}</span>
      <span class="room-meta">${esc(sessionStatus(s))} · ${s.speeches.length} ${s.speeches.length === 1 ? 'speech' : 'speeches'}</span></a></li>`).join('');
  const lrows = chamber.legislators.map((l) => `<li class="cg-leg"><span class="code">${esc(l.code)}</span><span class="muted">${esc(l.name || '')}</span>
      <label class="sr-only" for="st-${esc(l.id)}">Status of ${esc(l.code)}</label>
      <select id="st-${esc(l.id)}" data-status="${esc(l.id)}">${Object.keys(STATUS_WORDS).map((k) => `<option value="${k}"${l.status === k ? ' selected' : ''}>${STATUS_WORDS[k]}</option>`).join('')}</select></li>`).join('');
  const drows = chamber.docket.map((d) => `<li${d.debatedInSession ? ' class="muted"' : ''}>${esc(d.title)}${d.debatedInSession ? ' <span class="pill outline">Done in session ' + esc(d.debatedInSession) + '</span>' : ''}</li>`).join('');
  return `<div class="screen-head"><a class="b quiet" href="#/chamber">‹ Chambers</a><h1 id="screen-title" tabindex="-1">${houseWord(chamber)}${chamber.tournament ? ' · ' + esc(chamber.tournament) : ''}</h1>
      <button class="b primary" type="button" data-chact="session" data-key="session">Start session ${next}</button></div>
    <p class="muted">${esc(p.name)} · ${esc(profileNote(p))}</p>
    <h2 class="cg-h">Sessions</h2>${srows ? `<ul class="room-list">${srows}</ul>` : '<p class="muted">No sessions yet.</p>'}
    <h2 class="cg-h">Legislators <span class="muted">(${chamber.legislators.length})</span></h2>
    <p class="muted">Mark who is absent before a session. Absent legislators are not in the rank pool.</p>
    <ul class="room-list cg-legs">${lrows}</ul>
    <h2 class="cg-h">Docket</h2>${drows ? `<ol class="cg-docket-list">${drows}</ol>` : '<p class="muted">No docket items.</p>'}
    <p class="muted">The parliamentarian's full-chamber rank comes in a later step.</p>`;
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
      const sc = SCALE_CHOICES.find((s) => s.id === $('#cg-scale').value) || null;
      const parsed = parseRoom($('#cg-paste').value);
      const docket = docketLines($('#cg-docket').value);
      return { profile, sc, parsed, docket, checks: setupChecks(parsed, docket, profile) };
    };
    const update = () => {
      const r = read();
      $('#cg-profile-note').textContent = profileNote(r.profile, r.sc);
      $('#cg-preview').innerHTML = previewHtml(r.parsed, r.checks);
      $('#cg-create').disabled = r.checks.some((c) => c.block);
    };
    const onSubmit = (ev) => {
      ev.preventDefault();
      const r = read();
      if (r.checks.some((c) => c.block)) { update(); return; }
      const now = env.now();
      const chamber = createChamber({ entries: r.parsed.entries, docket: r.docket, house: (form.querySelector('input[name="cg-house"]:checked') || {}).value,
        profile: r.profile, scale: r.sc, tournament: $('#cg-tournament').value.trim(), roomLabel: $('#cg-room').value.trim(), now, makeId: newId });
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
      const made = newSession(c, chamberSessions(st, id), { now: env.now(), makeId: newId });
      if (io.write(withSession(withChamber(st, made.chamber), made.session))) location.hash = '#/round/' + made.session.id + '/log';
    };
    const onChange = (ev) => {
      const sel = ev.target.closest('select[data-status]');
      if (!sel) return;
      const st = io.read();
      io.write(withChamber(st, setStatus(findChamber(st, id), sel.dataset.status, sel.value, env.now())));
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
