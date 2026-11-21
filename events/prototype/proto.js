// Tabula Speech Events: clickable prototype for the 5-judge lay test. Throwaway code: the real app waits for core/.
// It follows docs/events/DESIGN.md §3–§5. No AI, no network calls, no recording. State lives in memory and in
// localStorage under the tabulaEvents.proto.* prefix, so a reload keeps the room.
'use strict';
(function () {
  const DATA = window.TABULA_EVENTS_DATA;
  const KEY = 'tabulaEvents.proto.state';
  const THEME_KEY = 'tabulaEvents.proto.theme';
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: memory only */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  const SAMPLE = 'Round 2 · Room 204\nSpeaker order\n1. A12 Maya Chen\n2. B07\n3) C33 Jordan Lee\n4. D41\nE05 - Sam Ortiz\nF18\nsee judge about room change\n';
  const CAT_NAMES = { publicAddress: 'Public address', interp: 'Interp', limitedPrep: 'Limited prep' };
  const MATERIAL = { memorized: 'from memory', manuscript: 'with a script', noNotes: 'no notes' };

  // ---------- State ----------
  const fresh = () => ({ v: 1, screen: 'setup', draft: { eventId: 'oo', profileId: 'nsda-district', round: '', paste: '', grace: 30, effect: 'noFirst', decided: {} }, room: null });
  let S;
  try { S = JSON.parse(store.get(KEY)) || fresh(); } catch { S = fresh(); }
  if (!S || S.v !== 1) S = fresh();
  const save = () => store.set(KEY, JSON.stringify(S));
  const ui = { menuFor: null, tapOrder: null, rankMsg: '', signal: null, signalUntil: 0, copied: {}, reviewOrder: 'speaking', lastSel: null, drag: null };

  const eventById = (id) => DATA.events.find((e) => e.id === id);
  const profileById = (id) => DATA.profiles.find((p) => p.id === id);
  const room = () => S.room;
  const ev = () => eventById(room().eventId);
  const prof = () => room().profile;
  const entry = (id) => room().entries.find((e) => e.id === id);
  const present = () => room().entries.filter((e) => e.status !== 'noShow');

  // ---------- Time ----------
  const now = () => Date.now();
  const running = (en) => { const r = en.timing.runs; return r.length > 0 && r[r.length - 1].e == null; };
  const used = (en, t = now()) => Math.max(0, en.timing.runs.reduce((a, r) => a + ((r.e ?? t) - r.s), 0) + en.timing.offsetMs);
  const limitMs = () => ev().timing.limit * 1000;
  const graceMs = () => prof().overtime.grace * 1000;
  const fmt = (ms) => { const s = Math.floor(Math.abs(ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const parseTime = (txt) => { const m = /^\s*(\d{1,2})(?::(\d{1,2}))?\s*$/.exec(txt); if (!m) return null; const sec = m[2] == null ? +m[1] * 60 : +m[1] * 60 + +m[2]; return m[2] != null && +m[2] > 59 ? null : sec * 1000; };

  // Signal points, in ms of time left: whole minutes from 5 down, 30 s, time, and the end of grace.
  function signalPoints() {
    const lim = limitMs();
    const pts = [];
    for (const m of [5, 4, 3, 2, 1]) if (m * 60000 < lim) pts.push({ at: m * 60000, label: `Show ${m}` });
    pts.push({ at: 30000, label: 'Show 30 s (half)' }, { at: 0, label: 'Show time (stop)' }, { at: -graceMs(), label: 'Grace is over' });
    return pts;
  }
  function stage(en) {
    const u = used(en); const left = limitMs() - u;
    if (!en.timing.runs.length && !en.timing.offsetMs) return { cls: 'ready', word: 'Ready' };
    if (!running(en)) return { cls: 'stopped', word: `Done ${fmt(u)}` };
    if (left > 60000) return { cls: 'speaking', word: ev().timing.inRoomPrep && en.timing.phase === 'prep' ? 'Prep' : 'Speaking' };
    if (left > 0) return { cls: 'last', word: '1 minute left' };
    if (-left <= graceMs()) return { cls: 'grace', word: `Grace +${fmt(-left)}` };
    return { cls: 'over', word: `Over grace +${fmt(-left)}` };
  }
  // Sticky flags: once set, a time correction never clears them (DESIGN.md §4.2).
  function updateFlags(en) {
    const u = used(en); let changed = false;
    if (u > limitMs() && !en.timing.overLimit) { en.timing.overLimit = true; changed = true; }
    if (u > limitMs() + graceMs() && !en.timing.overGrace) { en.timing.overGrace = true; changed = true; }
    return changed;
  }

  // ---------- Paste parser (runs on the device) ----------
  const HEADING = /^(round|rd\.?|room|rm\.?|flight|section|sect\.?|judge|event|speaker order|speaking order|order|entries|entry|code|name|start|time)\b/i;
  const CODE = /^(?=[A-Za-z0-9-]*\d)[A-Za-z]{0,4}-?\d{1,5}[A-Za-z]?$/;
  function parseRoom(text, decided = {}) {
    const entries = []; const check = []; const skipped = []; const seen = new Set();
    text.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim(); if (!line) return;
      const key = `${i}:${line}`;
      if (decided[key] === 'skip') { skipped.push(line); return; }
      if (HEADING.test(line) && !decided[key]) { skipped.push(line); return; }
      const body = line.replace(/^\d{1,2}\s*[.)]\s*/, '');
      const toks = body.split(/[\s\t,;]+/).filter(Boolean);
      const codeIdx = toks.map((t) => CODE.test(t)).reduce((a, ok, j) => (ok ? [...a, j] : a), []);
      let code = null; let name = '';
      if (decided[key]) { code = decided[key]; name = toks.filter((t) => t.toUpperCase() !== code).join(' ').replace(/^[-–—:]\s*/, ''); }
      else if (codeIdx.length === 1 && codeIdx[0] === 0) { code = toks[0].toUpperCase(); name = toks.slice(1).join(' ').replace(/^[-–—:]\s*/, ''); }
      if (!code) { check.push({ key, line, why: codeIdx.length ? 'The code is not at the start of the line.' : 'No entry code found.', guess: codeIdx.length === 1 ? toks[codeIdx[0]].toUpperCase() : '' }); return; }
      if (seen.has(code)) { check.push({ key, line, why: `${code} is already in the list.`, guess: '' }); return; }
      seen.add(code); entries.push({ code, name, key });
    });
    return { entries, check, skipped };
  }

  // ---------- Toast and dialog ----------
  let toastTimer = 0;
  function toast(msg, undo) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>` + (undo ? '<button type="button" class="b quiet" data-key="toast-undo">Undo</button>' : '');
    t.hidden = false;
    if (undo) $('button', t).onclick = () => { undo(); t.hidden = true; save(); render(); };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
  }
  function ask({ title, body = '', ok = 'OK', danger = false, field = null }) {
    const d = $('#ask');
    $('#ask-title').textContent = title; $('#ask-body').textContent = body;
    const okBtn = $('#ask-ok'); okBtn.textContent = ok; okBtn.className = 'b ' + (danger ? 'danger' : 'primary');
    $('#ask-field').hidden = !field; $('#ask-error').hidden = true;
    if (field) { $('#ask-field-label').textContent = field.label; $('#ask-input').value = field.value || ''; }
    return new Promise((resolve) => {
      const onClose = () => {
        d.removeEventListener('close', onClose);
        resolve(d.returnValue === 'ok' ? (field ? $('#ask-input').value : true) : (field ? null : false));
      };
      d.addEventListener('close', onClose);
      d.returnValue = ''; d.showModal();
      if (field) $('#ask-input').select();
    });
  }
  const announce = (msg) => { $('#live').textContent = msg; };

  // ---------- Rendering helpers ----------
  const pill = (word, cls = '') => `<span class="pill ${cls}">${esc(word)}</span>`;
  const statusPill = (en) => ({ waiting: pill('Waiting'), speaking: pill('Speaking', 'solid'), done: pill('Done', 'outline'), noShow: pill('No show', 'outline') }[en.status]);
  function render() {
    const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    if (!room() && S.screen !== 'setup') S.screen = 'setup';
    document.querySelectorAll('.steps button').forEach((b) => {
      const on = b.dataset.screen === S.screen; b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.disabled = b.dataset.screen !== 'setup' && !room();
    });
    const main = $('#main');
    main.innerHTML = { setup: renderSetup, room: renderRoom, rank: renderRank, review: renderReview }[S.screen]();
    main.dataset.screen = S.screen;
    if (S.screen === 'room') renderSheet();
    if (focusKey) { const el = document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`); if (el && !el.disabled) el.focus(); }
  }

  // ---------- Screen: Room setup ----------
  function renderSetup() {
    const d = S.draft; const e = eventById(d.eventId); const parsed = parseRoom(d.paste, d.decided);
    const groups = Object.keys(CAT_NAMES).map((c) => `<optgroup label="${CAT_NAMES[c]}">${DATA.events.filter((x) => x.category === c)
      .map((x) => `<option value="${x.id}"${x.id === d.eventId ? ' selected' : ''}>${esc(x.name)} (${x.short})</option>`).join('')}</optgroup>`).join('');
    const profiles = DATA.profiles.map((p) => `<option value="${p.id}"${p.id === d.profileId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const p = setupProfile();
    const rows = parsed.entries.map((x, i) => `<li class="prev-row"><span class="num">${i + 1}</span><span class="code">${esc(x.code)}</span><span class="name">${esc(x.name) || '<span class="muted">No name</span>'}</span></li>`).join('');
    const checks = parsed.check.map((c, i) => `<li class="check-row"><div><div class="mono">${esc(c.line)}</div><div class="muted">${esc(c.why)}</div></div>
      <div class="row-btns">${c.guess ? `<button type="button" class="b" data-act="decide" data-line="${esc(c.key)}" data-code="${esc(c.guess)}" data-key="chk-add-${i}">Add as ${esc(c.guess)}</button>` : ''}
      <button type="button" class="b quiet" data-act="decide" data-line="${esc(c.key)}" data-code="skip" data-key="chk-skip-${i}">Skip</button></div></li>`).join('');
    const custom = d.profileId === 'custom' ? `<div class="grid2">
      <label class="field"><span>Grace (seconds)</span><input type="number" inputmode="numeric" min="0" max="120" step="5" value="${d.grace}" data-bind="grace" data-key="grace"></label>
      <label class="field"><span>Past grace</span><select data-bind="effect" data-key="effect">
        <option value="noFirst"${d.effect === 'noFirst' ? ' selected' : ''}>I may not rank them 1st</option>
        <option value="flagOnly"${d.effect === 'flagOnly' ? ' selected' : ''}>Flag only; the tab room decides</option></select></label></div>` : '';
    return `<section class="screen setup" aria-labelledby="h-setup">
      <h1 id="h-setup">Set up the room</h1>
      <div class="setup-grid">
        <div class="card">
          <label class="field"><span>Event</span><select data-bind="eventId" data-key="eventId">${groups}</select></label>
          <p class="hint">${fmt(e.timing.limit * 1000)} limit${e.timing.sharedClock ? ', prep and speech together' : ''} · ${p.overtime.grace} s grace · ${MATERIAL[e.material]}${e.performers === 2 ? ' · 2 performers' : ''}</p>
          <div class="grid2">
            <label class="field"><span>Tournament rules</span><select data-bind="profileId" data-key="profileId">${profiles}</select></label>
            <label class="field"><span>Round (optional)</span><input value="${esc(d.round)}" data-bind="round" data-key="round" autocomplete="off" placeholder="Round 2"></label>
          </div>
          ${custom}
          <label class="field"><span>Entries</span>
            <textarea rows="9" data-bind="paste" data-key="paste" placeholder="Paste the room from Tabroom or SpeechWire, or type one code per line.&#10;A12&#10;B07 Jordan Lee">${esc(d.paste)}</textarea></label>
          <div class="row-btns"><button type="button" class="b" data-act="sample" data-key="sample">Use a sample room</button>
            ${d.paste ? '<button type="button" class="b quiet" data-act="clear-paste" data-key="clear-paste">Clear</button>' : ''}</div>
        </div>
        <div class="card" aria-live="polite">
          <h2>Preview <span class="muted">${parsed.entries.length} ${parsed.entries.length === 1 ? 'speaker' : 'speakers'}</span></h2>
          ${rows ? `<ol class="preview">${rows}</ol>` : '<p class="muted">Speakers show here as you paste or type.</p>'}
          ${checks ? `<h3>Check these</h3><ul class="checks-list">${checks}</ul>` : ''}
          ${parsed.skipped.length ? `<p class="muted">Skipped ${parsed.skipped.length} ${parsed.skipped.length === 1 ? "line" : "lines"}: ${esc(parsed.skipped.join(' · '))}</p>` : ''}
          <div class="row-end">
            ${room() ? '<button type="button" class="b" data-act="go" data-screen="room" data-key="back-room">Back to my room</button>' : ''}
            <button type="button" class="b primary" data-act="start-room" data-key="start-room"${parsed.entries.length < 2 || parsed.check.length ? ' disabled' : ''}>Start room</button>
          </div>
          ${parsed.check.length ? '<p class="hint">Sort out the lines under "Check these" first.</p>' : parsed.entries.length < 2 ? '<p class="hint">Add at least 2 speakers.</p>' : ''}
        </div>
      </div></section>`;
  }
  function setupProfile() {
    const d = S.draft; const base = JSON.parse(JSON.stringify(profileById(d.profileId)));
    if (d.profileId === 'custom') base.overtime = { grace: Math.max(0, Math.min(120, Math.round(+d.grace || 0))), effect: d.effect };
    return base;
  }
  async function startRoom() {
    const d = S.draft; const parsed = parseRoom(d.paste, d.decided);
    if (room() && !(await ask({ title: 'Start a new room?', body: 'This replaces the room you have open now. Its notes and ranks go away.', ok: 'Start new room', danger: true }))) return;
    const e = eventById(d.eventId);
    S.room = {
      id: 'r' + now().toString(36), createdAt: now(), productLine: 'events', eventId: e.id, eventVersion: e.version,
      profile: setupProfile(), round: d.round, state: 'judging', reasonForRank: '', ranksCopied: false, ranked: false, rankOrder: null,
      entries: parsed.entries.map((x, i) => ({
        id: 'e' + i, code: x.code, name: x.name, order: i, status: 'waiting',
        timing: { runs: [], offsetMs: 0, phase: 'prep', prepMs: null, overLimit: false, overGrace: false },
        notes: '', priv: '', tags: [], checks: {}, comment: null, rating: null,
      })),
    };
    S.room.current = S.room.entries[0].id;
    S.screen = 'room'; save(); render(); $('#main').focus();
  }

  // ---------- Screen: Room ----------
  function rosterRows(where) {
    return present().concat(room().entries.filter((e) => e.status === 'noShow')).sort((a, b) => a.order - b.order).map((en, i) => {
      const cur = en.id === room().current;
      const menu = ui.menuFor === en.id && where === 'pane' || ui.menuFor === 'sheet:' + en.id && where === 'sheet';
      const mk = where === 'pane' ? en.id : 'sheet:' + en.id;
      return `<li class="r-row${cur ? ' current' : ''}">
        <button type="button" class="r-main" data-act="pick" data-id="${en.id}" data-key="${where}-pick-${en.id}"${cur ? ' aria-current="true"' : ''}>
          <span class="r-num">${i + 1}</span><span class="r-id"><span class="r-code">${esc(en.code)}</span>${en.name ? ` <span class="r-name">${esc(en.name)}</span>` : ''}</span>
          <span class="r-right"><span class="r-time" data-time="${en.id}">${en.timing.runs.length || en.timing.offsetMs ? fmt(used(en)) : ''}</span>${statusPill(en)}</span></button>
        <button type="button" class="b quiet r-more" data-act="menu" data-id="${mk}" aria-expanded="${menu}" aria-label="More for ${esc(en.code)}" data-key="${where}-more-${en.id}">More</button>
        ${menu ? `<div class="r-menu" role="group" aria-label="Actions for ${esc(en.code)}">
          <button type="button" class="b" data-act="move" data-dir="-1" data-id="${en.id}" data-key="${where}-up-${en.id}">Move up</button>
          <button type="button" class="b" data-act="move" data-dir="1" data-id="${en.id}" data-key="${where}-down-${en.id}">Move down</button>
          <button type="button" class="b" data-act="noshow" data-id="${en.id}" data-key="${where}-ns-${en.id}">${en.status === 'noShow' ? 'Undo no show' : 'Mark no show'}</button>
          <button type="button" class="b" data-act="remove" data-id="${en.id}" data-key="${where}-rm-${en.id}">Remove</button></div>` : ''}
      </li>`;
    }).join('');
  }
  function timerCard(en) {
    const st = stage(en); const e = ev(); const u = used(en); const left = limitMs() - u;
    const digits = st.cls === 'stopped' || st.cls === 'ready' && u === 0 ? fmt(st.cls === 'ready' ? limitMs() : u) : left >= 0 ? fmt(left) : '+' + fmt(-left);
    const unit = st.cls === 'stopped' ? 'used' : st.cls === 'ready' ? 'limit' : left >= 0 ? 'left' : 'over';
    const prep = e.timing.inRoomPrep ? `<ol class="phase" aria-label="Phase">
        <li class="${en.timing.phase === 'prep' ? 'on' : 'done'}">Prep${en.timing.prepMs != null ? ' ' + fmt(en.timing.prepMs) : ''}</li>
        <li class="${en.timing.phase === 'speech' ? 'on' : ''}">Speech</li></ol>` : '';
    const sig = ui.signal && ui.signal.id === en.id && now() < ui.signalUntil ? ui.signal.label : '';
    return `<div class="timer stage-${st.cls}" id="timer" role="group" aria-label="Timer for ${esc(en.code)}">
      ${prep}
      <div class="t-top"><span class="t-word" id="t-word">${esc(st.word)}</span><span class="t-flags" id="t-flags">${flagPills(en)}</span></div>
      <div class="t-digits" id="t-digits">${digits}</div>
      <div class="t-sub"><span id="t-unit">${unit}</span> · ${fmt(limitMs())} limit${e.timing.sharedClock ? ' (prep and speech)' : ''} · ${prof().overtime.grace} s grace</div>
      <div class="sig-slot"><span class="sig-chip${sig ? '' : ' empty'}" id="sig-chip">${esc(sig)}</span></div>
      <div class="t-main-btns">
        <button type="button" class="b primary big" data-act="startstop" data-key="startstop">${running(en) ? 'Stop' : en.timing.runs.length ? 'Resume' : 'Start'}</button>
        ${e.timing.inRoomPrep && en.timing.phase === 'prep' && running(en) ? '<button type="button" class="b big" data-act="speech-start" data-key="speech-start">Speech started</button>' : ''}
        <button type="button" class="b big" data-act="next" data-key="next">Next speaker</button>
      </div>
      <div class="t-adj">
        <button type="button" class="b" data-act="adj" data-ms="-10000" data-key="adj-minus" aria-label="Take off 10 seconds">−10 s</button>
        <button type="button" class="b" data-act="adj" data-ms="10000" data-key="adj-plus" aria-label="Add 10 seconds">+10 s</button>
        <button type="button" class="b" data-act="settime" data-key="settime">Set time</button>
        ${en.timing.overGrace ? '<button type="button" class="b" data-act="clear-over" data-key="clear-over">Clear over grace</button>' : ''}
      </div></div>`;
  }
  const flagPills = (en) => (en.timing.overGrace ? pill('Over grace', 'err') : en.timing.overLimit ? pill('Over time', 'caution') : '');
  function chipGroup(title, kind) {
    const en = entry(room().current);
    return `<div class="chip-group" role="group" aria-label="${title}"><div class="chip-title">${title}</div><div class="chips">${ev().tags.map((t) => {
      const id = kind + ':' + t.id; const on = en.tags.includes(id);
      return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-act="chip" data-tag="${id}" data-key="chip-${id}">${esc(t.label)}</button>`;
    }).join('')}</div></div>`;
  }
  function renderRoom() {
    const en = entry(room().current) || present()[0] || room().entries[0];
    if (!en) return `<section class="screen"><h1>No speakers left</h1><button type="button" class="b primary" data-act="go" data-screen="setup" data-key="to-setup">Set up the room</button></section>`;
    room().current = en.id;
    const e = ev();
    const pills = present().sort((a, b) => a.order - b.order).map((x) => `<button type="button" class="code-pill${x.id === en.id ? ' on' : ''}" data-act="pick" data-id="${x.id}" data-key="pp-${x.id}"${x.id === en.id ? ' aria-current="true"' : ''}>${esc(x.code)}${x.status === 'done' ? ' ✓' : ''}</button>`).join('');
    const checks = e.checks.map((c) => {
      const flag = en.checks[c] === 'flag';
      return `<button type="button" class="chk${flag ? ' flag' : ''}" aria-pressed="${flag}" data-act="check" data-check="${c}" data-key="chk-${c}"><span>${esc(DATA.checks[c])}</span>${flag ? pill('Flag', 'err') : pill('OK', 'outline')}</button>`;
    }).join('');
    const doneCount = present().filter((x) => x.status === 'done').length;
    return `<section class="screen room" aria-labelledby="h-room">
      <h1 id="h-room" class="sr">Room: ${esc(e.name)}</h1>
      <div class="room-head"><div><strong>${esc(e.name)}</strong> <span class="muted">${esc(room().round || '')}</span></div>
        <div class="muted">${doneCount} of ${present().length} done</div></div>
      <div class="pill-row" role="group" aria-label="Speakers">${pills}<button type="button" class="b" data-act="open-sheet" data-key="open-sheet">Roster</button></div>
      <div class="room-grid">
        <aside class="roster" aria-label="Roster"><ol class="r-list">${rosterRows('pane')}</ol>
          <button type="button" class="b quiet" data-act="go" data-screen="setup" data-key="add-more">Change entries</button></aside>
        <div class="room-main">
          <div class="who"><span class="who-code">${esc(en.code)}</span>${en.name ? `<span class="who-name">${esc(en.name)}</span>` : ''}${statusPill(en)}</div>
          ${timerCard(en)}
          ${chipGroup('Strengths', 's')}
          ${chipGroup('To work on', 'w')}
          <div class="chk-group" role="group" aria-label="Rule checks"><div class="chip-title">Rule checks <span class="muted">(tap to flag)</span></div><div class="chks">${checks}</div></div>
          <label class="field"><span>Notes for ${esc(en.code)} <span class="muted">(saved as you type)</span></span>
            <textarea rows="8" id="notes" data-bind-entry="notes" data-key="notes" placeholder="${esc(e.prompts.join(' '))}">${esc(en.notes)}</textarea></label>
          <label class="field"><span>Private note <span class="muted">(never copied to the ballot)</span></span>
            <input data-bind-entry="priv" data-key="priv" value="${esc(en.priv)}" autocomplete="off" placeholder="Blue jacket, 3rd speaker"></label>
          <div class="row-end"><button type="button" class="b primary" data-act="go" data-screen="rank" data-key="to-rank">Rank the room</button></div>
        </div>
      </div></section>`;
  }
  function renderSheet() { $('#roster-sheet-body').innerHTML = `<ol class="r-list">${rosterRows('sheet')}</ol>`; }

  function startStop() {
    const en = entry(room().current); const r = en.timing.runs;
    if (running(en)) { r[r.length - 1].e = now(); en.status = 'done'; announce(`${en.code} stopped at ${fmt(used(en))}`); }
    else {
      present().forEach((o) => { if (o !== en && running(o)) { o.timing.runs[o.timing.runs.length - 1].e = now(); o.status = 'done'; } });
      r.push({ s: now(), e: null }); en.status = 'speaking'; room().state = 'judging';
      ui.lastSignalAt = undefined; announce(`${en.code} started`);
    }
    save(); render(); ensureTick();
  }
  function nextSpeaker() {
    const en = entry(room().current);
    if (running(en)) { const r = en.timing.runs; r[r.length - 1].e = now(); en.status = 'done'; }
    const list = present().sort((a, b) => a.order - b.order);
    const after = list.slice(list.indexOf(en) + 1).concat(list.slice(0, list.indexOf(en)));
    const nxt = after.find((x) => x.status === 'waiting') || after[0];
    if (nxt) { room().current = nxt.id; announce(`Now ${nxt.code}`); }
    save(); render();
  }

  // One timer loop while any clock runs. It updates text in place, so focus and typing are never disturbed.
  let tickId = 0;
  function ensureTick() { if (!tickId && room() && room().entries.some(running)) tickId = setInterval(tick, 250); }
  function tick() {
    if (!room() || !room().entries.some(running)) { clearInterval(tickId); tickId = 0; return; }
    let needRender = false;
    for (const en of room().entries.filter(running)) {
      if (updateFlags(en)) { needRender = true; save(); }
      const left = limitMs() - used(en);
      const prev = en._lastLeft; en._lastLeft = left;
      if (prev !== undefined) for (const p of signalPoints()) if (prev > p.at && left <= p.at) {
        ui.signal = { id: en.id, label: p.label }; ui.signalUntil = now() + 3000; announce(p.label);
        if (navigator.vibrate) try { navigator.vibrate(60); } catch { /* not allowed */ }
      }
    }
    if (S.screen !== 'room') return;
    if (needRender) { render(); return; }
    const en = entry(room().current); const t = $('#timer'); if (!t) return;
    const st = stage(en); const u = used(en); const left = limitMs() - u;
    t.className = `timer stage-${st.cls}`;
    $('#t-word').textContent = st.word;
    $('#t-digits').textContent = st.cls === 'stopped' ? fmt(u) : left >= 0 ? fmt(left) : '+' + fmt(-left);
    $('#t-unit').textContent = st.cls === 'stopped' ? 'used' : left >= 0 ? 'left' : 'over';
    const chip = $('#sig-chip'); const sig = ui.signal && ui.signal.id === en.id && now() < ui.signalUntil ? ui.signal.label : '';
    chip.textContent = sig; chip.classList.toggle('empty', !sig);
    document.querySelectorAll('[data-time]').forEach((s) => { const x = entry(s.dataset.time); if (x && (x.timing.runs.length || x.timing.offsetMs)) s.textContent = fmt(used(x)); });
  }

  function insertAtCursor(text) {
    const ta = $('#notes'); const en = entry(room().current);
    const pos = ui.lastSel && ui.lastSel.id === en.id ? ui.lastSel.pos : en.notes.length;
    const before = en.notes.slice(0, pos); const after = en.notes.slice(pos);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    en.notes = before + pad + text + (after && !/^\s/.test(after) ? ' ' : '') + after;
    ui.lastSel = { id: en.id, pos: (before + pad + text).length };
    if (ta) ta.value = en.notes;
  }
  function toggleChip(tagId) {
    const en = entry(room().current); const [kind, id] = tagId.split(':'); const t = ev().tags.find((x) => x.id === id);
    const sentence = kind === 's' ? t.strength : t.toWork;
    if (en.tags.includes(tagId)) { en.tags = en.tags.filter((x) => x !== tagId); en.notes = en.notes.replace(sentence, '').replace(/ {2,}/g, ' ').trim(); }
    else { en.tags.push(tagId); insertAtCursor(sentence); }
    save(); render();
  }
  function toggleCheck(c) {
    const en = entry(room().current); const line = `Flag: ${DATA.checks[c]}`;
    if (en.checks[c] === 'flag') { delete en.checks[c]; en.priv = en.priv.split(' · ').filter((x) => x !== line).join(' · '); }
    else { en.checks[c] = 'flag'; en.priv = en.priv ? en.priv + ' · ' + line : line; }
    save(); render();
  }
  function moveEntry(id, dir) {
    const list = room().entries.slice().sort((a, b) => a.order - b.order); const i = list.findIndex((x) => x.id === id); const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
    announce(`${list[i].code} moved ${dir < 0 ? 'up' : 'down'}`); save(); render();
  }
  function setNoShow(id) {
    const en = entry(id); const prev = en.status;
    en.status = prev === 'noShow' ? 'waiting' : 'noShow'; ui.menuFor = null; room().rankOrder = null;
    if (en.status === 'noShow' && room().current === id) { const nx = present()[0]; if (nx) room().current = nx.id; }
    save(); render();
    if (en.status === 'noShow') toast(`${en.code} marked no show.`, () => { en.status = prev; room().rankOrder = null; });
  }
  function removeEntry(id) {
    const idx = room().entries.findIndex((x) => x.id === id); const [en] = room().entries.splice(idx, 1);
    ui.menuFor = null; room().rankOrder = null;
    if (room().current === id && room().entries[0]) room().current = (present()[0] || room().entries[0]).id;
    save(); render();
    toast(`${en.code} removed.`, () => { room().entries.splice(idx, 0, en); room().rankOrder = null; });
  }

  // ---------- Screen: Rank ----------
  const rule = () => prof().overtime.effect;
  function rankOrder() {
    const ids = present().map((e) => e.id);
    let o = (room().rankOrder || []).filter((id) => ids.includes(id));
    if (o.length !== ids.length) o = o.concat(present().sort((a, b) => a.order - b.order).map((e) => e.id).filter((id) => !o.includes(id)));
    room().rankOrder = o; return o;
  }
  const firstProblem = (order) => (rule() === 'noFirst' && order.length > 1 && entry(order[0]).timing.overGrace ? entry(order[0]) : null);
  const refusal = (en) => `${en.code} went over grace, so it can't be ranked 1st. Clear the over-grace flag on the timer if the time was wrong.`;
  function tryOrder(next) {
    const bad = firstProblem(next);
    if (bad && !firstProblem(rankOrder())) { ui.rankMsg = refusal(bad); announce(ui.rankMsg); render(); return false; }
    room().rankOrder = next; ui.rankMsg = ''; save(); render(); return true;
  }
  function moveRank(from, to) {
    const o = rankOrder().slice(); if (to < 0 || to >= o.length || from === to) return;
    const [id] = o.splice(from, 1); o.splice(to, 0, id);
    if (tryOrder(o)) announce(`${entry(id).code} is now rank ${to + 1}`);
  }
  function ratingCtl(en) {
    const r = prof().rating; if (r === 'none') return '';
    if (r.words) return `<div class="rate-words" role="group" aria-label="Rating for ${esc(en.code)}">${r.words.map((w) => `<button type="button" class="chip${en.rating === w ? ' on' : ''}" aria-pressed="${en.rating === w}" data-act="rate-word" data-id="${en.id}" data-val="${esc(w)}" data-key="rw-${en.id}-${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
    return `<div class="stepper" role="group" aria-label="Rating for ${esc(en.code)}">
      <button type="button" class="b" data-act="rate-step" data-id="${en.id}" data-step="-1" aria-label="Lower rating" data-key="rs-m-${en.id}">−</button>
      <input type="number" inputmode="numeric" min="${r.min}" max="${r.max}" step="${r.step}" value="${en.rating ?? ''}" placeholder="${r.min}–${r.max}" data-rate="${en.id}" data-key="rv-${en.id}" aria-label="Rating for ${esc(en.code)}, ${r.min} to ${r.max}">
      <button type="button" class="b" data-act="rate-step" data-id="${en.id}" data-step="1" aria-label="Raise rating" data-key="rs-p-${en.id}">+</button></div>`;
  }
  function ratingProblems() {
    const r = prof().rating; if (r === 'none') return {};
    const out = {}; const order = rankOrder(); const vals = order.map((id) => entry(id).rating);
    order.forEach((id, i) => {
      const v = vals[i];
      if (v == null || v === '') out[id] = 'Add a rating.';
      else if (!r.words && (v < r.min || v > r.max)) out[id] = `Use a rating from ${r.min} to ${r.max}.`;
      else if (prof().ratingNoTies && vals.filter((x) => x === v).length > 1) out[id] = `Another speaker also has ${v}. Give each a different rating.`;
      else if (prof().rankRatingRule && !r.words && vals.slice(0, i).some((x) => x != null && x < v)) out[id] = 'Rating is higher than a better-ranked speaker.';
    });
    return out;
  }
  function renderRank() {
    const order = rankOrder(); const tap = ui.tapOrder; const probs = ratingProblems(); const stuck = firstProblem(order);
    const rows = order.map((id, i) => {
      const en = entry(id); const tapN = tap ? tap.indexOf(id) : -1;
      const num = tap ? (tapN >= 0 ? tapN + 1 : '–') : i + 1;
      return `<li class="k-row${ui.drag && ui.drag.over === i && ui.drag.from !== i ? ' drop' : ''}" data-idx="${i}" data-id="${id}">
        <span class="k-num" aria-hidden="true">${num}</span>
        ${tap ? `<button type="button" class="k-main tap" data-act="tap" data-id="${id}" data-key="tap-${id}"${tapN >= 0 ? ' disabled' : ''}>` : `<div class="k-main" tabindex="0" data-key="row-${id}" data-row="${i}" aria-label="Rank ${i + 1}: ${esc(en.code)}${en.timing.overGrace ? ', over grace' : ''}. Alt and arrow keys move it.">`}
          <span class="sr">${tap ? (tapN >= 0 ? `Rank ${tapN + 1}: ` : 'Not placed yet: ') : ''}</span>
          <span class="k-code">${esc(en.code)}</span>${en.name ? `<span class="k-name">${esc(en.name)}</span>` : ''}
          <span class="k-time">${en.timing.runs.length || en.timing.offsetMs ? fmt(used(en)) : 'Not timed'}</span>
          ${en.timing.overGrace ? pill('Over grace', 'err') : en.timing.overLimit ? pill('Over time', 'caution') : ''}
        ${tap ? '</button>' : '</div>'}
        ${tap ? '' : `<div class="k-btns">
          <button type="button" class="b" data-act="rank-move" data-from="${i}" data-to="${i - 1}" aria-label="Move ${esc(en.code)} up" data-key="up-${id}"${i === 0 ? ' disabled' : ''}>Up</button>
          <button type="button" class="b" data-act="rank-move" data-from="${i}" data-to="${i + 1}" aria-label="Move ${esc(en.code)} down" data-key="down-${id}"${i === order.length - 1 ? ' disabled' : ''}>Down</button>
          <span class="handle" data-handle="${i}" aria-hidden="true" title="Drag to move">⠿</span></div>`}
        ${ratingCtl(en) ? `<div class="k-rate">${ratingCtl(en)}${probs[id] ? `<span class="field-error">${esc(probs[id])}</span>` : ''}</div>` : ''}
      </li>`;
    }).join('');
    const noShows = room().entries.filter((e) => e.status === 'noShow');
    const ruleLine = rule() === 'noFirst' ? 'A speaker who went over grace cannot be ranked 1st. On a panel, all judges must agree the speaker went over grace.' : 'Your tab room applies the time penalty. Rank on performance.';
    const blocked = !!stuck || Object.keys(probs).length > 0 || !!tap;
    return `<section class="screen rank" aria-labelledby="h-rank">
      <h1 id="h-rank">Rank the speakers</h1>
      <p class="bias">${esc(prof().biasNote)}</p>
      <p class="hint">Best is 1. Every speaker gets a different rank. ${esc(ruleLine)}</p>
      <div class="row-btns">${tap ? `<button type="button" class="b" data-act="tap-cancel" data-key="tap-cancel">Cancel tap in order</button><span class="muted">Tap the speakers from best to last. ${tap.length} of ${order.length} placed.</span>`
        : `<button type="button" class="b" data-act="tap-start" data-key="tap-start">Tap in order</button><button type="button" class="b quiet" data-act="rank-reset" data-key="rank-reset">Back to speaking order</button>`}</div>
      <div class="msg-slot" role="alert">${ui.rankMsg ? `<p class="msg err">${esc(ui.rankMsg)}</p>` : stuck ? `<p class="msg err">${esc(stuck.code)} went over grace, so it can't stay at rank 1. Move another speaker to rank 1.</p>` : ''}</div>
      <ol class="k-list" aria-label="Ranks">${rows}</ol>
      ${noShows.length ? `<p class="muted">Not ranked (no show): ${noShows.map((e) => esc(e.code)).join(', ')}</p>` : ''}
      <div class="row-end"><button type="button" class="b" data-act="go" data-screen="room" data-key="back-to-room">Back to room</button>
        <button type="button" class="b primary" data-act="to-review" data-key="to-review"${blocked ? ' disabled' : ''}>Review and copy</button></div>
    </section>`;
  }
  function tapPick(id) {
    const t = ui.tapOrder;
    if (t.length === 0 && rule() === 'noFirst' && entry(id).timing.overGrace && present().length > 1) { ui.rankMsg = refusal(entry(id)); announce(ui.rankMsg); render(); return; }
    t.push(id); ui.rankMsg = ''; announce(`${entry(id).code} is rank ${t.length}`);
    const rest = rankOrder().filter((x) => !t.includes(x));
    if (rest.length === 1) t.push(rest[0]);
    if (t.length === rankOrder().length) { room().rankOrder = t.slice(); ui.tapOrder = null; save(); render(); const f = $('.k-main'); if (f) f.focus(); return; }
    render(); const nxt = document.querySelector('.k-main.tap:not([disabled])'); if (nxt) nxt.focus();
  }

  // Drag by the handle with pointer events (works with touch, pen and mouse).
  document.addEventListener('pointerdown', (ev0) => {
    const h = ev0.target.closest('[data-handle]'); if (!h || S.screen !== 'rank') return;
    ev0.preventDefault();
    const from = +h.dataset.handle; const rowEls = [...document.querySelectorAll('.k-row')];
    const mids = rowEls.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
    const dragged = rowEls[from]; dragged.classList.add('dragging');
    ui.drag = { from, over: from };
    const startY = ev0.clientY;
    const move = (e) => {
      dragged.style.transform = `translateY(${e.clientY - startY}px)`;
      let over = mids.findIndex((m) => e.clientY < m); if (over < 0) over = mids.length - 1;
      if (over > from) over = Math.max(from, over - (e.clientY < mids[over] ? 1 : 0));
      ui.drag.over = Math.max(0, Math.min(rowEls.length - 1, over));
      rowEls.forEach((r, i) => r.classList.toggle('drop', i === ui.drag.over && i !== from));
    };
    const up = () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      const to = ui.drag.over; ui.drag = null; dragged.style.transform = '';
      if (to !== from) moveRank(from, to); else render();
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  });

  // ---------- Screen: Review and copy ----------
  const commentOf = (en) => (en.comment ?? en.notes);
  const STRENGTH = /\b(strong|great|good|clear|clearly|liked|loved|well|effective|excellent|nice|best|enjoyed|powerful|real)\b/i;
  const TO_WORK = /\b(work on|try|could|next time|consider|improve|more|less|slow down|make|add)\b/i;
  const WHY_RANK = /\b(rank|ranked|placed|because|why)\b/i;
  function critique(en) {
    const t = commentOf(en);
    return [
      { label: 'Names one strength', ok: en.tags.some((x) => x.startsWith('s:')) || STRENGTH.test(t) },
      { label: 'Names one thing to work on', ok: en.tags.some((x) => x.startsWith('w:')) || TO_WORK.test(t) },
      { label: 'Says why this rank', ok: WHY_RANK.test(t) },
    ];
  }
  const rankOf = (en) => rankOrder().indexOf(en.id) + 1;
  const ratingTxt = (en) => (prof().rating === 'none' ? '' : `, rating ${en.rating}`);
  const ranksText = () => rankOrder().map((id) => { const en = entry(id); return `Rank ${rankOf(en)}: ${en.code}${ratingTxt(en)}${en.timing.overGrace ? ', over time: yes' : ', over time: no'}`; }).join('\n');
  function allText() {
    const head = `${ev().name}${room().round ? ' · ' + room().round : ''}\n\nRanks\n${ranksText()}\n`;
    const body = present().sort((a, b) => a.order - b.order).map((en) => `\n${en.code} (rank ${rankOf(en)})\n${commentOf(en).trim() || '(no comment)'}`).join('\n');
    return head + body + (room().reasonForRank.trim() ? `\n\nReason for rank\n${room().reasonForRank.trim()}` : '');
  }
  function checklistHtml() {
    const n = present().length; const withComment = present().filter((e) => commentOf(e).trim()).length;
    const items = [[`${room().ranked ? n : 0} of ${n} ranked`, room().ranked], [`${withComment} of ${n} comments`, withComment === n], ['Reason for rank written', !!room().reasonForRank.trim()]];
    return items.map(([w, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? pill('Yes', 'ok') : pill('Not yet', 'outline')} ${esc(w)}</li>`).join('');
  }
  const critHtml = (en) => critique(en).map((c) => `<li>${c.ok ? pill('Yes', 'ok') : pill('Not yet', 'outline')} ${esc(c.label)}</li>`).join('');
  function renderReview() {
    const order = ui.reviewOrder === 'rank' ? rankOrder().map(entry) : present().sort((a, b) => a.order - b.order);
    const r = room();
    const cards = order.map((en) => `<article class="card c-card" aria-labelledby="cc-${en.id}">
      <div class="c-head"><h3 id="cc-${en.id}">${esc(en.code)}${en.name ? ` <span class="muted">${esc(en.name)}</span>` : ''}</h3>
        <span>${pill('Rank ' + rankOf(en), 'outline')}${prof().rating !== 'none' ? ' ' + pill('Rating ' + en.rating, 'outline') : ''}${en.timing.overGrace ? ' ' + pill('Over grace', 'err') : ''}</span></div>
      <label class="field"><span>Comment for the ballot</span><textarea rows="6" data-comment="${en.id}" data-key="cm-${en.id}">${esc(commentOf(en))}</textarea></label>
      <ul class="crit" id="crit-${en.id}" aria-label="Critique checklist">${critHtml(en)}</ul>
      <div class="row-end"><button type="button" class="b${ui.copied[en.id] ? '' : ' primary'}" data-act="copy-one" data-id="${en.id}" data-key="copy-${en.id}">${ui.copied[en.id] ? 'Copied ✓' : 'Copy comment'}</button></div>
    </article>`).join('');
    return `<section class="screen review" aria-labelledby="h-review">
      <h1 id="h-review">Review and copy</h1>
      <p class="state-line">${r.ranksCopied ? pill('Ranks sent, comments open', 'outline') : pill('Ranks not sent yet', 'outline')}</p>
      <div class="card ranks-block">
        <h2>Ranks to submit</h2>
        <p class="hint">Enter these in Tabroom or SpeechWire first. The tab room wants ranks soon after the last speaker.</p>
        <button type="button" class="b primary big" data-act="copy-ranks" data-key="copy-ranks">${ui.copied.ranks ? 'Copied ✓' : 'Copy ranks'}</button>
        <table class="ranks-table"><thead><tr><th scope="col">Rank</th><th scope="col">Code</th>${prof().rating !== 'none' ? '<th scope="col">Rating</th>' : ''}<th scope="col">Over time</th></tr></thead>
          <tbody>${rankOrder().map((id) => { const en = entry(id); return `<tr><td>${rankOf(en)}</td><td>${esc(en.code)}</td>${prof().rating !== 'none' ? `<td>${esc(en.rating)}</td>` : ''}<td>${en.timing.overGrace ? 'Yes' : 'No'}</td></tr>`; }).join('')}</tbody></table>
      </div>
      <div class="card">
        <h2>Comments</h2>
        <ul class="checklist" id="checklist">${checklistHtml()}</ul>
        <label class="field"><span>Reason for rank</span><textarea rows="3" data-reason="1" data-key="reason" placeholder="Why the top speakers placed where they did.">${esc(r.reasonForRank)}</textarea></label>
        <div class="row-btns">
          <button type="button" class="b" data-act="copy-all" data-key="copy-all">${ui.copied.all ? 'Copied ✓' : 'Copy all'}</button>
          <button type="button" class="b quiet" data-act="review-order" data-key="review-order">Show in ${ui.reviewOrder === 'rank' ? 'speaking' : 'rank'} order</button>
        </div>
      </div>
      ${cards}
      <div class="row-end"><button type="button" class="b" data-act="go" data-screen="rank" data-key="back-rank">Back to ranks</button>
        <button type="button" class="b quiet" data-act="new-room" data-key="new-room">New room</button></div>
    </section>`;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove(); return ok;
    }
  }
  async function doCopy(key, text, okMsg) {
    const ok = await copyText(text);
    if (!ok) { toast('Copy did not work here. Select the text and copy it by hand.'); return; }
    ui.copied[key] = true; if (key === 'ranks') room().ranksCopied = true;
    save(); render(); announce(okMsg);
  }

  // ---------- Events ----------
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act; const id = b.dataset.id;
    switch (a) {
      case 'go': if (b.dataset.screen === 'review' && !room().ranked) { S.screen = 'rank'; } else S.screen = b.dataset.screen; ui.menuFor = null; ui.rankMsg = ''; save(); render(); $('#main').focus(); break;
      case 'theme': cycleTheme(); break;
      case 'sample': S.draft.paste = SAMPLE; S.draft.decided = {}; save(); render(); break;
      case 'clear-paste': S.draft.paste = ''; S.draft.decided = {}; save(); render(); $('[data-key="paste"]').focus(); break;
      case 'decide': S.draft.decided[b.dataset.line] = b.dataset.code; save(); render(); { const n = $('[data-act="decide"]') || $('[data-key="start-room"]'); if (n) n.focus(); } break;
      case 'start-room': startRoom(); break;
      case 'pick': room().current = id; ui.menuFor = null; if ($('#roster-sheet').open) $('#roster-sheet').close(); save(); render(); break;
      case 'menu': ui.menuFor = ui.menuFor === id ? null : id; render(); if (ui.menuFor) { const f = document.querySelector(`[data-key$="-up-${id.replace('sheet:', '')}"]`); if (f) f.focus(); } break;
      case 'move': moveEntry(id, +b.dataset.dir); break;
      case 'noshow': setNoShow(id); break;
      case 'remove': removeEntry(id); break;
      case 'open-sheet': renderSheet(); $('#roster-sheet').showModal(); break;
      case 'close-sheet': $('#roster-sheet').close(); break;
      case 'startstop': startStop(); break;
      case 'next': nextSpeaker(); break;
      case 'speech-start': { const en = entry(room().current); en.timing.phase = 'speech'; en.timing.prepMs = used(en); announce('Speech started'); save(); render(); break; }
      case 'adj': { const en = entry(room().current); en.timing.offsetMs = Math.max(-usedRaw(en), en.timing.offsetMs + +b.dataset.ms); updateFlags(en); en._lastLeft = undefined; save(); render(); break; }
      case 'settime': {
        const en = entry(room().current);
        const v = await ask({ title: 'Set time used', body: `How much time has ${en.code} used? Type minutes and seconds, like 2:30.`, ok: 'Set time', field: { label: 'Time used', value: fmt(used(en)) } });
        if (v == null) break; const ms = parseTime(v);
        if (ms == null) { toast('Use minutes and seconds, like 2:30.'); break; }
        en.timing.offsetMs = ms - usedRaw(en); if (!en.timing.runs.length) en.timing.runs.push({ s: now(), e: now() });
        updateFlags(en); en._lastLeft = undefined; save(); render(); break;
      }
      case 'clear-over': {
        const en = entry(room().current);
        if (await ask({ title: `Clear over grace for ${en.code}?`, body: 'Do this only if the time was wrong. Fix the time first with −10 s or Set time, or the flag comes back.', ok: 'Clear over grace' })) {
          en.timing.overGrace = false; if (used(en) <= limitMs()) en.timing.overLimit = false; updateFlags(en); room().rankOrder = room().rankOrder; save(); render();
        }
        break;
      }
      case 'chip': toggleChip(b.dataset.tag); break;
      case 'check': toggleCheck(b.dataset.check); break;
      case 'rank-move': moveRank(+b.dataset.from, +b.dataset.to); { const k = document.querySelector(`[data-key="${b.dataset.key}"]`); if (k && k.disabled) { const r = document.querySelector(`[data-key="row-${b.dataset.key.slice(b.dataset.key.indexOf('-') + 1)}"]`); if (r) r.focus(); } } break;
      case 'rank-reset': tryOrder(present().sort((x, y) => x.order - y.order).map((x) => x.id)); break;
      case 'tap-start': ui.tapOrder = []; ui.rankMsg = ''; render(); { const f = $('.k-main.tap'); if (f) f.focus(); } break;
      case 'tap-cancel': ui.tapOrder = null; ui.rankMsg = ''; render(); break;
      case 'tap': tapPick(id); break;
      case 'rate-step': {
        const en = entry(id); const r = prof().rating; const st = +b.dataset.step * r.step;
        en.rating = Math.max(r.min, Math.min(r.max, en.rating == null ? (st > 0 ? r.min : r.max) : en.rating + st)); save(); render(); break;
      }
      case 'rate-word': entry(id).rating = b.dataset.val; save(); render(); break;
      case 'to-review': room().ranked = true; room().state = 'review'; S.screen = 'review'; save(); render(); $('#main').focus(); break;
      case 'copy-ranks': doCopy('ranks', ranksText(), 'Ranks copied'); break;
      case 'copy-all': doCopy('all', allText(), 'All copied'); break;
      case 'copy-one': { const en = entry(id); doCopy(id, commentOf(en).trim(), `Comment for ${en.code} copied`); break; }
      case 'review-order': ui.reviewOrder = ui.reviewOrder === 'rank' ? 'speaking' : 'rank'; render(); break;
      case 'new-room': if (await ask({ title: 'Start a new room?', body: 'This clears this room from this device. Copy everything you need first.', ok: 'Clear and start over', danger: true })) {
        const keep = S.draft; S = fresh(); S.draft = { ...keep, paste: '', decided: {} }; ui.copied = {}; save(); render(); $('#main').focus();
      } break;
      default: break;
    }
  });
  const usedRaw = (en) => en.timing.runs.reduce((a, r) => a + ((r.e ?? now()) - r.s), 0);

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.bind) {
      S.draft[t.dataset.bind] = t.value; if (t.dataset.bind === 'paste') S.draft.decided = {};
      save();
      if (t.dataset.bind !== 'round') renderKeepCaret(t);
    } else if (t.dataset.bindEntry) { entry(room().current)[t.dataset.bindEntry] = t.value; save(); }
    else if (t.dataset.comment) {
      const en = entry(t.dataset.comment); en.comment = t.value; en.commentSource = 'judge'; ui.copied[en.id] = false; save();
      $('#crit-' + en.id).innerHTML = critHtml(en); $('#checklist').innerHTML = checklistHtml();
      const btn = $(`[data-key="copy-${en.id}"]`); btn.textContent = 'Copy comment'; btn.className = 'b primary';
    } else if (t.dataset.reason) { room().reasonForRank = t.value; save(); $('#checklist').innerHTML = checklistHtml(); }
    else if (t.dataset.rate) { const v = t.value === '' ? null : +t.value; entry(t.dataset.rate).rating = v; save(); }
  });
  document.addEventListener('change', (e) => { if (e.target.dataset.rate) render(); });
  function renderKeepCaret(t) {
    const s = t.selectionStart; const en = t.selectionEnd; const key = t.dataset.key;
    render(); const n = $(`[data-key="${key}"]`); if (n && n.setSelectionRange && s != null) try { n.setSelectionRange(s, en); } catch { /* select */ }
  }
  // Remember the caret in the notes box, so a chip inserts its sentence where the judge was writing.
  document.addEventListener('selectionchange', () => {
    const ta = document.activeElement; if (ta && ta.id === 'notes') ui.lastSel = { id: room().current, pos: ta.selectionStart };
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target; const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
    if (e.key === 'Escape' && ui.menuFor) { const id = ui.menuFor; ui.menuFor = null; render(); const m = document.querySelector(`[data-id="${id}"][data-act="menu"]`); if (m) m.focus(); return; }
    if (S.screen === 'room' && room() && !typing && !e.altKey && !e.ctrlKey && !e.metaKey && !$('dialog[open]')) {
      if (e.key === ' ' && t.tagName !== 'BUTTON') { e.preventDefault(); startStop(); return; }
      if (/^[1-8]$/.test(e.key) && t.tagName !== 'BUTTON' || /^[1-8]$/.test(e.key) && t.tagName === 'BUTTON' && !t.closest('.timer')) {
        const list = present().sort((a, b) => a.order - b.order); const en = list[+e.key - 1];
        if (en) { e.preventDefault(); room().current = en.id; save(); render(); announce(`Now ${en.code}`); }
      }
    }
    if (S.screen === 'rank' && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const row = t.closest('.k-row'); if (!row) return; e.preventDefault();
      const i = +row.dataset.idx; const id = row.dataset.id; moveRank(i, i + (e.key === 'ArrowUp' ? -1 : 1));
      const r = $(`[data-key="row-${id}"]`); if (r) r.focus();
    }
  });

  // ---------- Theme ----------
  const THEMES = ['auto', 'light', 'dark'];
  function applyTheme(t) {
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    const b = $('.theme-btn'); const word = t[0].toUpperCase() + t.slice(1);
    b.textContent = `Theme: ${word}`; b.setAttribute('aria-label', `Theme: ${word}. Change theme`);
  }
  function cycleTheme() { const cur = store.get(THEME_KEY) || 'auto'; const nxt = THEMES[(THEMES.indexOf(cur) + 1) % 3]; store.set(THEME_KEY, nxt); applyTheme(nxt); }
  applyTheme(THEMES.includes(store.get(THEME_KEY)) ? store.get(THEME_KEY) : 'auto');

  // A clock that ran before a reload resumes from its start time (the record holds start times, not a count).
  if (room()) room().entries.forEach((en) => { en._lastLeft = undefined; });
  render(); ensureTick();
}());
