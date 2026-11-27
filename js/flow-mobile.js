// Speech focus is a projection of the existing item model. It owns navigation and drafts,
// not another flow, clock, importer, or reconciliation engine.
'use strict';
const FlowMobile = (() => {
  const A = L.atomicFlow, esc = escapeHtml;
  const media = matchMedia('(max-width: 819.98px)');
  let compare = null, related = null, round = null;
  const active = () => media.matches && Boolean(A.migrate(R));
  const state = () => {
    if (!R.mobileFlow || typeof R.mobileFlow !== 'object' || Array.isArray(R.mobileFlow)) R.mobileFlow = {};
    return R.mobileFlow;
  };
  function speech() {
    const selected = state().speech, f = FMT();
    if (selected === 'unspecified' || f.flowSpeeches.includes(selected)) return selected;
    return f.speeches.slice(0, R.cur + 1).reverse().find(s => f.flowSpeeches.includes(s.id))?.id || f.flowSpeeches[0];
  }
  const matches = (e, id) => id === 'unspecified' ? e.speech == null : e.speech === id;
  const name = (id) => id === 'unspecified' ? 'Speech unspecified' : L.shortSpeech(id);
  function resetRound() { if (round !== R) { round = R; compare = related = null; } }
  function choose(id) {
    state().speech = id; compare = related = null; save();
    renderTranscript();
    FlowItems.render('#mobile-speech');
    $('#flow').scrollTop = 0;
  }
  const relatedItems = (f, entry) => A.live(f).filter(e => e.id !== entry.id &&
    (entry.links.includes(e.id) || e.links.includes(entry.id) || entry.card === e.card));
  function controls(f, current, editing) {
    resetRound();
    const on = active();
    document.body.classList.toggle('mobile-flow-enabled', on);
    $('#flow-mobile-head').hidden = !on;
    $('#flow-mobile-compose').hidden = !on || Boolean(editing) || Boolean(compare) || Boolean(related) || speech() === 'unspecified';
    if (!on) return;
    const viewed = speech(), ids = [...FMT().flowSpeeches];
    if (A.live(f).some(e => e.speech == null) || viewed === 'unspecified') ids.push('unspecified');
    const picker = $('#mobile-speech');
    picker.innerHTML = ids.map(id => `<option value="${esc(id)}">${esc(name(id))}</option>`).join('');
    picker.value = viewed;
    $('#mobile-previous').disabled = ids.indexOf(viewed) <= 0;
    $('#mobile-next').disabled = ids.indexOf(viewed) === ids.length - 1;
    const groups = current.groups;
    if (!groups.some(g => g.id === state().group)) state().group = groups[0].id;
    $('#mobile-group').innerHTML = groups.map(g => `<option value="${esc(g.id)}">${esc(g.name === 'General' ? current.name : g.name)}</option>`).join('');
    $('#mobile-group').value = state().group;
    const key = viewed + ':' + state().group;
    const note = $('#mobile-analytic');
    // Do not reset the caret or replace the editor during a transcript redraw.
    if (note.dataset.target !== key) {
      note.dataset.target = key;
      note.value = typeof state().drafts?.[key] === 'string' ? state().drafts[key] : '';
    }
    $('#mobile-add-label').textContent = 'Add to ' + name(viewed);
    $('#mobile-compare').setAttribute('aria-pressed', String(Boolean(compare)));
    clockLabel();
  }
  function clockLabel() {
    if (!active() || !$('#mobile-view-label')) return;
    const viewed = speech(), timed = runSp().id;
    $('#mobile-view-label').textContent = name(viewed) + ' viewed · ' + L.shortSpeech(timed) + (R.run ? ' running' : ' clock paused');
    const back = $('#mobile-return');
    back.hidden = viewed === timed || !FMT().flowSpeeches.includes(timed);
    back.textContent = 'View ' + L.shortSpeech(timed);
  }
  function groupHtml(f, current, group, speechId, entries, entryHtml, editor, editorHtml) {
    const list = A.rows(f, group).flatMap(row => row.items.filter(e => matches(e, speechId)));
    const editing = editor && editor.group === group.id && (editor.speech === speechId || (speechId === 'unspecified' && editor.speech == null));
    return `<section class="mobile-group" data-group="${esc(group.id)}"><div class="item-group" data-group="${esc(group.id)}" tabindex="0" aria-haspopup="menu" aria-label="${esc(group.name)} argument group"><strong>${esc(group.name === 'General' ? current.name : group.name)}</strong><div class="item-tools"><button type="button" data-item-action="group-options" aria-label="Options for ${esc(group.name)} argument group" aria-haspopup="menu">⋯</button></div></div>
      ${list.map(e => `<div class="mobile-entry" data-group="${esc(e.group)}" data-column="${A.columnOf(FMT(), e)}">${e.id === editor?.id ? editorHtml() : entryHtml(e, speechId === 'unspecified', entries)}</div>`).join('')}
      ${editing && !editor.id ? editorHtml() : ''}
      ${!list.length && !editing ? `<p class="mobile-empty">${speechId === 'unspecified' ? 'No unassigned entries in this group.' : 'No entries in ' + esc(name(speechId)) + '. Add a note below or open Documents.'}</p>` : ''}
      ${(group.legacyDetails || []).map(old => `<details><summary>Original details · ${esc(old.speech)}</summary><p class="mobile-original">${esc(old.detailed || old.brief)}</p></details>`).join('')}
    </section>`;
  }
  function html(f, current, entries, entryHtml, editor, editorHtml) {
    if (related) {
      const entry = A.byId(entries, related);
      if (!entry) related = null;
      else return `<section class="mobile-related" aria-label="Related arguments"><div class="mobile-panel-head"><h2>Related arguments</h2><button type="button" data-mobile="close-related">Back to speech</button></div>
        ${[entry, ...relatedItems(f, entry)].sort((a,b) => A.speechIndex(FMT(), a.speech) - A.speechIndex(FMT(), b.speech)).map(e => `<h3>${esc(e.speech || 'Speech unspecified')}${e.id === entry.id ? ' · Selected' : ''}</h3><div data-group="${esc(e.group)}" data-column="${A.columnOf(FMT(),e)}">${e.id === editor?.id ? editorHtml() : entryHtml(e, false, entries)}</div>`).join('')}
        ${entry.speech && A.targets(f, { speech: FMT().flowSpeeches.at(-1) }, FMT()).includes(entry) ? `<button type="button" data-mobile="respond" data-id="${esc(entry.id)}">Respond in a later speech</button>` : ''}</section>`;
    }
    if (compare) {
      const options = FMT().flowSpeeches.filter(id => id !== speech());
      if (!options.includes(compare)) compare = options[0];
      return `<section class="mobile-comparison" aria-label="Compare speeches"><div class="mobile-panel-head"><label>Compare with<select id="mobile-compare-speech">${options.map(id => `<option${id === compare ? ' selected' : ''}>${esc(id)}</option>`).join('')}</select></label><strong>${esc(name(speech()))}</strong><button type="button" data-mobile="close-compare">Back to speech</button></div>
      ${current.groups.map(g => `<h3>${esc(g.name)}</h3>` + A.rows(f, g).filter(r => r.items.some(e => matches(e, speech()) || e.speech === compare)).map(row => `<div class="mobile-compare-row" data-row="${esc(row.id)}">${[compare, speech()].map(id => `<div data-group="${esc(g.id)}" data-column="${L.speechColumn(id, FMT())}">${row.items.filter(e => matches(e,id)).map(e => e.id === editor?.id ? editorHtml() : entryHtml(e,false,entries)).join('') || '<p class="mobile-empty">No entry in this row</p>'}</div>`).join('')}</div>`).join('')).join('')}</section>`;
    }
    return current.groups.map(g => groupHtml(f,current,g,speech(),entries,entryHtml,editor,editorHtml)).join('');
  }
  function reveal(entry) {
    if (!active()) return;
    state().speech = entry.speech || 'unspecified';
    compare = related = null;
    renderTranscript();
  }
  function showRelated(id) { related = id; compare = null; FlowItems.render('[data-mobile="close-related"]'); }
  $('#mobile-speech').addEventListener('change', e => choose(e.target.value));
  for (const [id, step] of [['mobile-previous',-1],['mobile-next',1]]) $('#' + id).addEventListener('click', () => {
    const ids = [...$('#mobile-speech').options].map(o => o.value); const next = ids[ids.indexOf(speech()) + step]; if (next) choose(next);
  });
  $('#mobile-return').addEventListener('click', () => choose(runSp().id));
  $('#mobile-compare').addEventListener('click', () => { compare = compare ? null : FMT().flowSpeeches.find(id => id !== speech()); related = null; FlowItems.render(compare ? '#mobile-compare-speech' : '#mobile-compare'); });
  $('#mobile-check').addEventListener('click', () => FlowItems.toggleReview());
  $('#mobile-tools').addEventListener('click', () => {
    const open = document.body.classList.toggle('mobile-tools-open'); $('#mobile-tools').setAttribute('aria-expanded', String(open));
  });
  $('#mobile-clock').addEventListener('click', () => $('#phone-show-clock').click());
  $('#mobile-group').addEventListener('change', e => { state().group = e.target.value; save(); FlowItems.redraw(); });
  $('#mobile-analytic').addEventListener('input', e => {
    if (!state().drafts || typeof state().drafts !== 'object' || Array.isArray(state().drafts)) state().drafts = {};
    state().drafts[e.target.dataset.target] = e.target.value; save();
  });
  $('#flow-mobile-compose').addEventListener('submit', e => {
    e.preventDefault(); const note = $('#mobile-analytic'), title = note.value.trim();
    if (!title || !FMT().flowSpeeches.includes(speech())) return;
    const f = A.migrate(R), g = A.groupOf(f,state().group); if (!g) return;
    const entry = A.addItem(f,g,speech(),{title});
    if (!entry) return;
    state().drafts ??= {}; delete state().drafts[note.dataset.target]; note.value = ''; save();
    FlowItems.redraw(); note.focus();
    $(`[data-entry="${CSS.escape(entry.id)}"]`)?.scrollIntoView({block:'nearest'});
  });
  $('#mobile-analytic').addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229 || e.key !== 'Enter' || e.altKey) return;
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) return;
    e.preventDefault(); e.stopPropagation(); $('#flow-mobile-compose').requestSubmit();
  });
  $('#flow').addEventListener('change', e => { if (e.target.id === 'mobile-compare-speech') { compare = e.target.value; FlowItems.render('#mobile-compare-speech'); } });
  $('#flow').addEventListener('click', async e => {
    const b = e.target.closest('[data-mobile]'); if (!b) return;
    if (b.dataset.mobile === 'close-related' || b.dataset.mobile === 'close-compare') { related = compare = null; FlowItems.render('#mobile-speech'); }
    if (b.dataset.mobile === 'respond') {
      const originalRound = R, f = A.migrate(R), entry = A.byId(A.live(f),b.dataset.id); if (!entry) return;
      const later = FMT().flowSpeeches.filter(id => A.speechIndex(FMT(),id) > A.speechIndex(FMT(),entry.speech));
      const choice = await ask({ title:'Response speech', radios:{legend:'Write your response in',name:'mobile-response',options:later.map(value => ({value,label:value})),value:later.includes(speech()) ? speech() : later[0]},buttons:[{label:'Cancel',value:null},{label:'Continue',value:true,kind:'primary'}] });
      if (!choice || R !== originalRound || entry.removed) return;
      reveal({ speech: choice.choice });
      R.flowIdx = f.sheets.indexOf(A.sheetOf(f,entry.group));
      FlowItems.respond(entry,choice.choice);
    }
  });
  const resize = () => { if (typeof FlowItems !== 'undefined' && typeof aiReady === 'function') { if (R.tab === 'flow') { FlowItems.redraw(); renderTranscript(); } clockLabel(); } };
  media.addEventListener('change',resize);
  function viewport() {
    const vv = window.visualViewport;
    const inset = active() && vv && vv.scale === 1 ? Math.max(0,innerHeight-vv.height-vv.offsetTop) : 0;
    document.documentElement.style.setProperty('--mobile-keyboard',inset+'px');
  }
  window.visualViewport?.addEventListener('resize',viewport);
  window.visualViewport?.addEventListener('scroll',viewport);
  window.addEventListener('resize',viewport);
  document.addEventListener('focusin',e => { if (active() && e.target.matches('#mobile-analytic,.item-editor input,.item-editor textarea')) { document.body.classList.add('mobile-typing'); viewport(); } });
  document.addEventListener('focusout',() => setTimeout(() => { if (!document.activeElement.matches('#mobile-analytic,.item-editor input,.item-editor textarea')) document.body.classList.remove('mobile-typing'); viewport(); },0));
  new ResizeObserver(() => document.documentElement.style.setProperty('--mobile-compose-h', Math.ceil($('#flow-mobile-compose').getBoundingClientRect().height)+'px')).observe($('#flow-mobile-compose'));
  viewport();
  return { active, speech, controls, html, reveal, relatedItems, showRelated, clockLabel };
})();
