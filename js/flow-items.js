// The item flow grid. The saved model lives in logic/atomic-flow.js.
'use strict';

const FlowItems = (() => {
  const A = L.atomicFlow;
  const AI = L.flowReconcile;
  const grid = $('#flow');
  const tabs = $('#flow-tabs');
  const tools = $('#flow-tools');
  const esc = escapeHtml;
  const flow = () => A.migrate(R);
  const sheet = () => flow()?.sheets[R.flowIdx];
  const level = () => L.FLOW_LEVELS.includes(R.flowLevel) ? R.flowLevel : 'standard';
  const labels = { auto: 'Automatic', approve: 'Ask me first', off: 'Off' };
  const fieldNames = { title: 'Title', author: 'Author', date: 'Date', notes: 'Notes' };
  let editor, move, reviewSpeech, itemMenu, drag, pending, composing;
  let contextMenu = null;
  let lastRound, phoneRound;
  const draftKey = (draft) => draft.id ? "item:" + draft.id : "new:" + draft.group + ":" + draft.speech + ":" + (draft.targets || []).join(",");
  function stashEditor() {
    if (!editor) return;
    if (!R.flowDrafts || typeof R.flowDrafts !== "object" || Array.isArray(R.flowDrafts)) R.flowDrafts = {};
    R.flowDrafts[draftKey(editor)] = { fields: { ...editor.fields }, targets: [...(editor.targets || [])] };
  }
  function clearDraft(draft) { if (draft && R.flowDrafts) delete R.flowDrafts[draftKey(draft)]; }
  const sameRound = (round) => R === round;
  const control = (label, action, name, extra = '') =>
    `<button type="button" data-item-action="${action}"${name ? ` aria-label="${esc(name)}" data-tip="${esc(name)}"` : ''} ${extra}>${label}</button>`;
  const commit = (selector) => { save(); render(selector); };
  const groupName = (group) => group.name === 'General' ? 'Other notes' : group.name;

  function closeContextMenu(restoreFocus = false) {
    if (!contextMenu) return;
    const { node, opener } = contextMenu;
    contextMenu = null;
    node.remove();
    if (restoreFocus && opener.isConnected) opener.focus();
    if (pending) setTimeout(() => { if (pending) redraw(); }, 0);
  }
  function openContextMenu(opener, kind, key, point) {
    closeContextMenu();
    const f = flow(), current = sheet();
    const group = kind === 'group' ? A.groupOf(f, key) : null;
    if (kind === 'group' && !group) return;
    const action = (label, value, disabled = false) => `<button type="button" role="menuitem" data-context-action="${value}"${disabled ? ' disabled' : ''}>${label}</button>`;
    const node = document.createElement('div');
    node.className = 'flow-context-menu';
    node.setAttribute('role', 'menu');
    node.setAttribute('aria-label', kind === 'sheet' ? current.name + ' sheet actions' : groupName(group) + ' argument group actions');
    node.innerHTML = kind === 'sheet'
      ? action('Rename sheet', 'rename') + (f.sheets.length < 2 ? `<button type="button" role="menuitem" data-context-action="delete" aria-disabled="true" data-tip="${esc(ONE_SHEET)}" aria-label="Delete sheet: ${esc(ONE_SHEET)}">Delete sheet</button>` : action('Delete sheet', 'delete')) + sheetLearnLink(current.name).replace('<a ', '<a role="menuitem" ')
      : action('Rename group', 'rename') + action('Move group up', 'up', current.groups[0] === group)
        + action('Move group down', 'down', current.groups.at(-1) === group) + action('Move group to speech…', 'move');
    document.body.append(node);
    const rect = opener.getBoundingClientRect();
    const x = point?.x ?? rect.left, y = point?.y ?? rect.bottom;
    node.style.left = Math.max(8, Math.min(x, innerWidth - node.offsetWidth - 8)) + 'px';
    node.style.top = Math.max(8, Math.min(y, innerHeight - node.offsetHeight - 8)) + 'px';
    contextMenu = { node, opener, round: R };
    node.addEventListener('click', (event) => {
      if (event.target.closest('a')) { closeContextMenu(true); return; }
      const button = event.target.closest('[data-context-action]');
      if (!button || !contextMenu || contextMenu.round !== R) return;
      if (button.getAttribute('aria-disabled') === 'true') { toast(ONE_SHEET); return; }
      const command = button.dataset.contextAction;
      closeContextMenu(true);
      if (kind === 'sheet') {
        if (command === 'rename') renameSheet();
        else if (command === 'delete') deleteSheet();
      } else if (A.groupOf(flow(), key) === group) {
        if (command === 'rename' || command === 'move') groupOptions(group, command);
        else if (A.moveGroup(current, group.id, command === 'up' ? -1 : 1)) commit(`[data-group="${CSS.escape(group.id)}"] [data-item-action="group-options"]`);
      }
    });
    node.querySelector('button:not(:disabled), a')?.focus();
  }
  function sheetContext(index, point, fromOptions = false) {
    if (!flow()?.sheets[index]) return;
    if (R.flowIdx !== index) { R.flowIdx = index; save(); render(); }
    const opener = tabs.querySelector(fromOptions ? '[data-sheet-options]' : `button[data-i="${index}"]`);
    if (opener) openContextMenu(opener, 'sheet', flow().sheets[index].id, point);
  }
  document.addEventListener('pointerdown', (event) => {
    if (contextMenu && !contextMenu.node.contains(event.target)) closeContextMenu();
  });
  escLayer('flow-context-menu', 82, () => Boolean(contextMenu), () => closeContextMenu(true));
  document.addEventListener('keydown', (event) => {
    if (!contextMenu) return;
    if (!contextMenu.node.contains(document.activeElement)) { closeContextMenu(); return; }
    if (event.key === 'Tab') { closeContextMenu(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const items = [...contextMenu.node.querySelectorAll('button:not(:disabled), a')];
    const at = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }, true);
  window.addEventListener('resize', () => closeContextMenu());
  document.addEventListener('scroll', (event) => {
    if (contextMenu && !contextMenu.node.contains(event.target)) closeContextMenu();
  }, true);

  function entryHtml(entry, shared, entries) {
    const text = A.textOf(entry, level());
    const lines = text.split('\n');
    const links = entry.links.map((key) => A.byId(entries, key)?.title).filter(Boolean);
    const origin = entry.from ? 'Extension' : '';
    const source = entry.source === 'document' || entry.origin === 'document' ? 'Document' : ['transcript', 'legacyAI'].includes(entry.source) ? 'AI' : '';
    const symbols = [
      [entry.status === 'read' ? '✓' : entry.status === 'unread' ? '⊘' : '○', A.LABELS[entry.status]],
      ['↳', origin], [source === 'AI' ? 'AI' : '▤', source],
      ['↔', links.length ? 'Answers ' + links.join(', ') : ''],
    ].filter(([, title]) => title).map(([glyph, title]) =>
      `<span class="item-marker" data-tip="${esc(title)}"><span aria-hidden="true">${glyph}</span><span class="sr-only">${esc(title)}</span></span>`).join('');
    return `<article class="flow-item" data-entry="${esc(entry.id)}">
      <div class="item-meta">${shared ? `<span class="item-speech">${esc(entry.speech || 'Speech unspecified')}</span>` : ''}${symbols}
      <div class="item-buttons">${control('⋯', 'menu', 'Options for ' + entry.title, 'draggable="true" aria-expanded="' + (itemMenu === entry.id) + '"')}
      ${control('×', 'remove', 'Remove ' + entry.title)}</div></div>
      <button class="item-text" type="button" data-item-action="edit" aria-label="Edit ${esc(text)}">${lines.map(L.flowMarkHtml).join('<br>')}</button>
      ${FlowMobile.active() && FlowMobile.relatedItems(flow(), entry).length ? control('↔ Related (' + FlowMobile.relatedItems(flow(), entry).length + ')', 'related', 'Related arguments for ' + entry.title, 'class="mobile-related-button"') : ''}
      ${itemMenu === entry.id ? itemMenuHtml(entry) : ''}
    </article>`;
  }
  function itemMenuHtml(entry) {
    return `<div class="item-tools" aria-label="Options for ${esc(entry.title)}">
      ${control('↑', 'up', 'Move item up')}${control('↓', 'down', 'Move item down')}
      ${control('Move…', 'move')}${control('Links…', 'links')}${FlowMobile.active() ? control('Related / respond', 'related') : ''}
      <label>Read status <select data-item-status>${A.STATUSES.map((status) => `<option value="${status}"${entry.status === status ? ' selected' : ''}>${A.LABELS[status]}</option>`).join('')}</select></label>
    </div>`;
  }
  function editorHtml() {
    const fields = Object.keys(fieldNames).map((name) => {
      const val = esc(editor.fields[name] || '');
      const area = name === 'title' || name === 'notes';
      return `<label>${fieldNames[name]}${name === 'title' ? '' : ' <span class="sr-only">optional</span>'}
        ${area ? `<textarea rows="${name === 'title' ? 2 : 3}" name="${name}"${name === 'title' ? ' placeholder="Type here"' : ''} spellcheck="false">${val}</textarea>`
        : `<input type="text" name="${name}" value="${val}" autocomplete="off">`}</label>`;
    });
    const mobileFields = FlowMobile.active()
      ? fields[0] + '<details class="mobile-citation"' + (editor.fields.author || editor.fields.date ? ' open' : '') + '><summary>Citation (optional)</summary>' + fields[1] + fields[2] + '</details>' + fields[3]
      : fields.join('');
    return `<form class="item-editor" aria-label="${editor.id ? 'Edit entry' : 'New entry'}" aria-describedby="item-entry-keys">${editor.targets?.length ? `<p class="item-response-target">Responding to ${editor.targets.map(id => { const target = A.byId(flow().items, id); return esc(target ? (target.speech || "Speech unspecified") + " · " + target.title + (target.removed ? " (removed)" : "") : "Unavailable entry"); }).join("; ")}</p>` : ""}${mobileFields}
      <span class="sr-only" id="item-entry-keys">Enter saves. Shift plus Enter adds a line. Tab moves to the next field.</span>
      <div class="item-tools"><button type="submit">Save</button>${control('Cancel', 'cancel-editor')}</div></form>`;
  }
  const reviewList = (f, speech) => f.suggestions.filter((s) => {
    const entry = A.byId(A.live(f), s.item);
    return s.speech === speech && entry?.rev === s.rev;
  });
  function reviewHtml(f, fmt) {
    if (!reviewSpeech) return '';
    const entries = A.byTime(f, reviewSpeech);
    const reviewEntry = (entry) => `<li class="review-entry" data-entry="${esc(entry.id)}">${esc(entry.title)}
      ${entry.spoken == null || entry.status !== 'read' ? `<span class="muted">· ${A.LABELS[entry.status]}</span>` : ''}
      ${A.targets(f, entry, fmt).length ? control(entry.links.length ? 'Edit links' : 'Add links', 'links', 'Response links for ' + entry.title) : ''}</li>`;
    const suggestions = reviewList(f, reviewSpeech);
    return `<section class="item-review" aria-label="Flow Check">
      <h2>Flow Check</h2><p>Check spoken order, unconfirmed entries, and suggested matches after a speech. Apply or dismiss corrections below.</p>
      <label>Speech <select data-item-review>${fmt.flowSpeeches.map((key) => `<option${key === reviewSpeech ? ' selected' : ''}>${esc(key)}</option>`).join('')}</select></label>
      ${control('Close', 'close-review')}
      ${!entries.length ? '<p>No entries for this speech.</p>' : `
        <h3>Spoken order</h3>
        ${entries.some((e) => e.spoken != null) ? `<ol>${entries.filter((e) => e.spoken != null).map(reviewEntry).join('')}</ol>` : '<p>No spoken positions recorded.</p>'}
        ${entries.some((e) => e.spoken == null) ? `<h3>Position unknown</h3><ul>${entries.filter((e) => e.spoken == null).map(reviewEntry).join('')}</ul>` : ''}`}
      ${suggestions.length ? '<h3>Suggested corrections</h3>' : ''}
      ${suggestions.map((s) => {
        const entry = A.byId(entries, s.item);
        if (!entry) return '';
        return `<div class="item-suggestion" data-suggestion="${esc(s.key)}">
          <strong>${s.kind === 'links' ? 'Possible response links' : s.kind === 'order' ? 'Change spoken position' : 'Confirm match'} · ${esc(entry.title)}</strong>
          ${s.evidence ? `<blockquote>${esc(s.evidence.quote)}</blockquote>` : ''}
          ${s.targets ? s.targets.map((key) => A.byId(A.live(f), key)).filter(Boolean).map((target) =>
            `<label><input type="checkbox" name="target" value="${esc(target.id)}"> ${esc(target.speech + ' · ' + A.sheetOf(f, target.group)?.name + ' · ' + target.title)}</label>`).join('') : ''}
          <div class="item-tools">${control('Apply', 'apply-review')}${control('Dismiss', 'dismiss-review')}</div>
        </div>`;
      }).join('')}
    </section>`;
  }
  function groupHtml(f, current, group, fmt, entries) {
    const groupKey = esc(group.id);
    const add = fmt.flowColumns.map((_, col) => {
      const speeches = A.speechAt(fmt, col);
      return `<div class="item-add" data-group="${groupKey}" data-column="${col}">${speeches.map((id) =>
        control(speeches.length > 1 ? '+ ' + esc(id) : '+ Entry', 'new', 'Add entry in ' + id + ', ' + (current.groups.length === 1 && group.name === 'General' ? current.name : groupName(group)), `data-speech="${esc(id)}"`)).join('')}</div>`;
    }).join('');
    const editingGroup = editor?.group === group.id;
    const composer = (row, col) => editingGroup && editor.row === row && editor.column === col ? editorHtml() : '';
    const items = entries.filter((e) => e.group === group.id);
    const indexed = new Map();
    for (const entry of items) {
      const key = entry.row + ':' + A.columnOf(fmt, entry);
      if (!indexed.has(key)) indexed.set(key, []);
      indexed.get(key).push(entry);
    }
    const occupied = new Set(items.map((entry) => entry.row));
    const cells = group.rows.flatMap((row) => {
      if (!occupied.has(row) && !group.spacers?.[row]) return [];
      return fmt.flowColumns.map((_, col) => `<div class="item-cell" data-group="${groupKey}" data-column="${col}" data-row="${esc(row)}">
        ${(indexed.get(row + ':' + col) || []).map((entry) => entry.id === editor?.id ? composer(row, col) : entryHtml(entry, A.speechAt(fmt, col).length > 1, entries)).join('')}
      </div>`);
    }).join('');
    const orphanDetails = (group.legacyDetails || []).map((old) => `<details class="item-group"><summary>Original details · ${esc(old.speech)}</summary><p>${esc(old[level()] || old.detailed)}</p></details>`).join('');
    const heading = current.groups.length === 1 && group.name === 'General' ? ''
      : `<div class="item-group" data-group="${groupKey}" tabindex="0" aria-haspopup="menu" aria-label="${esc(groupName(group))} argument group"><strong>${esc(groupName(group))}</strong><div class="item-tools">${control('⋯', 'group-options', 'Options for ' + groupName(group) + ' argument group', 'aria-haspopup="menu"')}</div></div>`;
    return `${heading}
      ${add}${cells}${orphanDetails}
      ${editingGroup && editor.row == null ? fmt.flowColumns.map((_, col) => `<div class="item-compose-cell">${composer(null, col)}</div>`).join('') : ''}
    `;
  }
  function render(selector, keepEditor = false) {
    closeContextMenu();
    const f = flow();
    if (!f) return;
    const optionsOpen = lastRound === R && Boolean(tools.querySelector('.flow-options')?.open);
    if (lastRound !== R) {
      editor = move = reviewSpeech = itemMenu = drag = pending = null;
      lastRound = R;
    }
    const fmt = FMT();
    R.flowIdx = Math.max(0, Math.min(R.flowIdx || 0, f.sheets.length - 1));
    const current = sheet();
    pending = false;
    const entries = A.live(f);
    const count = f.suggestions.filter((s) => A.byId(entries, s.item)?.rev === s.rev).length;
    const aiOptions = can('aiFlow') ? `
      <div class="flow-option-field">
      <label class="item-assist" for="flow-match-mode">Match transcript to my notes</label>
      <select id="flow-match-mode" data-item-assist aria-describedby="flow-match-help">
        ${A.MODES.map((mode) => `<option value="${mode}"${AI.modeFor(S.itemFlowAssist) === mode ? ' selected' : ''}>${labels[mode]}</option>`).join('')}</select>
      <p id="flow-match-help">Link spoken arguments to notes you typed. Your words and positions stay unchanged.</p>
      </div>` : '';
    tabs.innerHTML = f.sheets.map((entry, i) => '<span class="flow-sheet-tab">' + sheetTab(entry.name, `data-i="${i}" aria-haspopup="menu" aria-pressed="${i === R.flowIdx}"`, i === R.flowIdx)
      + (i === R.flowIdx ? `<button type="button" data-sheet-options="${i}" aria-label="Options for ${esc(entry.name)} sheet" aria-haspopup="menu" data-tip="Rename or delete this sheet. Same as right-click.">⋯</button>` : '') + '</span>').join('')
      + '<button type="button" data-act="add" aria-label="Add an argument sheet">+ Sheet</button>';
    tools.hidden = false;
    tools.innerHTML = `<div class="flow-sheet-tools" role="group" aria-label="Documents and argument groups">
        <button type="button" data-flow-documents aria-controls="flow-documents" aria-expanded="${!$('#flow-documents').hidden}">Documents</button>
        ${control('+ Argument group', 'new-group', 'Add an argument group in ' + current.name)}
      </div>
      <div class="flow-review-tools" role="group" aria-label="Speech review and flow display">
        <button type="button" data-item-action="review" aria-expanded="${Boolean(reviewSpeech)}" data-tip="Compare your flow with this speech. Check spoken order, unconfirmed arguments, and suggested matches.">Flow Check${count ? ' (' + count + ')' : ''}</button>
        <details class="flow-options"${optionsOpen ? ' open' : ''}>
          <summary>Flow options</summary>
          <div class="flow-options-body">
            <div class="flow-option-field">
              <label for="flow-note-length">AI note length</label>
              <select id="flow-note-length" data-item-level aria-describedby="flow-length-help">${L.FLOW_LEVELS.map((x) => `<option value="${x}"${x === level() ? ' selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select>
              <p id="flow-length-help">Choose how much of each AI summary to show. Notes you typed stay unchanged.</p>
            </div>
            ${aiOptions}
          </div>
        </details>
      </div>
      ${can('aiFlow') ? `<div id="ai-flow-status" class="flow-ai-status" role="status">${flowStatusHtml()}</div>` : ''}`;
    $('#flow-doc-ai').hidden = !can('aiFlow');
    $('#ai-flow-ago').textContent = R.aiFlowAt ? 'Updated ' + agoText(R.aiFlowAt) + '.' : 'No AI updates yet.';
    const offset = grid.scrollLeft;
    FlowMobile.controls(f, current, editor && (editor.speech === FlowMobile.speech() || (FlowMobile.speech() === 'unspecified' && editor.speech == null)));
    grid.classList.toggle('mobile-item-flow', FlowMobile.active());
    setFlowCols();
    grid.classList.add('item-flow');
    const headers = fmt.flowColumns.map((c, i) => `<div class="item-head ${c.side}" data-flow-column="${i}"><h3>
      <span>${esc(c.label)}</span><span class="col-mark"></span></h3></div>`).join('');
    const active = document.activeElement;
    const existingForm = keepEditor ? active?.closest('.item-editor') : null;
    const guides = `<div class="item-column-guides" aria-hidden="true">${fmt.flowColumns.map(() => '<div></div>').join('')}</div>`;
    grid.innerHTML = reviewHtml(f, fmt) + (FlowMobile.active()
      ? FlowMobile.html(f, current, entries, entryHtml, editor, editorHtml)
      : '<div class="item-flow-grid">' + guides + headers + (current?.groups || []).map((group) => groupHtml(f, current, group, fmt, entries)).join('') + '</div>');
    const newForm = existingForm && grid.querySelector('.item-editor');
    if (newForm) {
      newForm.replaceWith(existingForm);
      active.focus({ preventScroll: true });
    }
    grid.scrollLeft = offset;
    mark();
    if (selector) (document.querySelector(selector) || tabs.querySelector('.on'))?.focus();
  }
  function redraw() {
    renderStart();
    if (R.tab !== 'flow' || !flow()) return;
    const active = document.activeElement;
    if (composing || contextMenu || active?.closest('.item-link-picker, .item-move-choice, .item-suggestion')) { pending = true; return; }
    let selector;
    if (active?.matches('[data-item-status], [data-item-action]')) {
      const article = active.closest('[data-entry]');
      const scope = article ? '[data-entry="' + CSS.escape(article.dataset.entry) + '"] ' : '';
      selector = scope + (active.dataset.itemAction ? '[data-item-action="' + CSS.escape(active.dataset.itemAction) + '"]' : '[data-item-status]');
    }
    for (const attr of ['data-item-review', 'data-item-level', 'data-item-assist']) if (active?.hasAttribute(attr)) selector = '[' + attr + ']';
    if (active?.matches('.flow-options > summary')) selector = '.flow-options > summary';
    render(selector, true);
  }
  function mark() {
    FlowMobile.clockLabel();
    const fmt = FMT();
    const active = L.flowMarks(R.run?.id, sp().id, fmt);
    grid.querySelectorAll('[data-flow-column]').forEach((header, i) => {
      const badge = header.querySelector('.col-mark');
      header.classList.toggle('item-current', i === active.current);
      badge.classList.toggle('is-now', i === active.now);
      badge.classList.toggle('is-viewing', i === active.viewing && i !== active.now);
      badge.textContent = i === active.now ? 'Now' : i === active.viewing ? 'Viewing' : '';
    });
  }
  function openEditor(group, speech, entry, targets = []) {
    stashEditor();
    move = itemMenu = null;
    editor = { id: entry?.id, group, speech, row: entry?.row ?? null,
      column: entry ? A.columnOf(FMT(), entry) : L.speechColumn(speech, FMT()), fields: entry ? { ...entry } : {}, targets: [...targets] };
    const savedDraft = R.flowDrafts?.[draftKey(editor)];
    const savedFields = savedDraft?.fields || savedDraft;
    if (savedFields && typeof savedFields === 'object') for (const field of Object.keys(fieldNames)) if (typeof savedFields[field] === 'string') editor.fields[field] = savedFields[field];
    render('.item-editor [name="title"]');
  }
  function showPhoneNavigation(enabled) {
    $('#phone-show-flow').hidden = !enabled;
    $('#phone-legacy-note').hidden = enabled;
    if (phoneRound !== R && enabled) {
      phoneRound = R; document.body.classList.add('show-phone-flow'); $('#phone-show-clock').hidden = false;
    }
    if (!enabled) { document.body.classList.remove('mobile-flow-enabled'); $('#flow-mobile-head').hidden = true; $('#flow-mobile-compose').hidden = true; }
    if (!enabled) document.body.classList.remove('show-phone-flow');
  }
  function phoneMode(showFlow) {
    document.body.classList.toggle('show-phone-flow', showFlow);
    $('#phone-show-clock').hidden = !showFlow;
    const target = showFlow ? ($('#start-panel').hidden ? tabs.querySelector('.on') : $('#start-flow')) : $('#phone-show-flow');
    target?.focus();
    window.scrollTo(0, 0);
  }
  $('#phone-show-flow').addEventListener('click', () => phoneMode(true));
  $('#phone-show-clock').addEventListener('click', () => phoneMode(false));

  function startEntry() {
    const current = sheet();
    const viewed = FlowMobile.active() ? FlowMobile.speech() : sp().id;
    const speech = FMT().flowSpeeches.includes(viewed) ? viewed : FMT().flowSpeeches[0];
    if (FlowMobile.active()) { $('#mobile-analytic').focus(); return; }
    if (current?.groups[0] && speech) openEditor(current.groups[0].id, speech);
  }
  function saveEditor(again) {
    if (!editor) return;
    const draft = editor;
    const entry = draft.id && A.byId(A.live(flow()), draft.id);
    if (draft.fields.title?.trim() && (!draft.id || entry)) {
      if (entry) A.updateItem(entry, draft.fields);
      else {
        const added = A.addItem(flow(), A.groupOf(flow(), draft.group), draft.speech, draft.fields);
        if (added && draft.targets) A.setLinks(flow(), added, draft.targets, FMT());
      }
      save();
    }
    clearDraft(draft); save();
    editor = null;
    if (again) { openEditor(draft.group, draft.speech || A.speechAt(FMT(), draft.column)[0]); return; }
    render(entry ? `[data-entry="${CSS.escape(entry.id)}"] .item-text` : `[data-group="${CSS.escape(draft.group)}"] [data-speech="${CSS.escape(draft.speech)}"]`);
  }
  function cancelEditor() {
    const draft = editor;
    clearDraft(draft); save();
    editor = null;
    render(draft?.id ? `[data-entry="${CSS.escape(draft.id)}"] .item-text` : '[data-item-action="new"]');
  }
  function finishMove(entry, group, speech, row, choice) {
    const changed = A.moveItem(flow(), entry, group, speech, row, choice, FMT());
    if (!changed) { toast('Choose a later speech for an extension.'); return; }
    FlowMobile.reveal(changed);
    const destination = A.sheetOf(flow(), group.id);
    R.flowIdx = flow().sheets.indexOf(destination);
    move = itemMenu = null;
    commit(`[data-entry="${CSS.escape(changed.id)}"] [data-item-action="menu"]`);
  }
  function chooseMove(entry, group, speech, row, anchor) {
    if (entry.speech === speech || entry.status !== 'unconfirmed') { finishMove(entry, group, speech, row); return; }
    move = { entry, group, speech, row };
    grid.querySelector('.item-move-choice')?.remove();
    const host = anchor?.closest('[data-group][data-column]') || grid.querySelector('.item-head') || grid;
    if (!host) return;
    host.insertAdjacentHTML('beforeend', `<div class="item-move-choice" role="group" aria-label="Move or extend ${esc(entry.title)}">
      ${control('Move', 'confirm-move')}${A.speechIndex(FMT(), speech) > A.speechIndex(FMT(), entry.speech) ? control('Extend', 'confirm-extend') : ''}
      ${control('Cancel', 'cancel-move')}</div>`);
    host.querySelector('.item-move-choice button').focus();
  }
  async function movePicker(entry, anchor) {
    const round = R;
    const f = flow();
    const groups = f.sheets.flatMap((s) => s.groups.map((g) => ({ value: g.id, label: s.name + ' · ' + groupName(g) })));
    const group = await ask({ title: 'Move ' + entry.title, radios: { legend: 'Destination group', name: 'flow-group-to', options: groups, value: entry.group },
      buttons: [{ label: 'Cancel', value: null }, { label: 'Next', value: true, kind: 'primary' }] });
    if (!group || !sameRound(round)) return;
    const options = FMT().flowSpeeches.filter((speech) => entry.status !== 'read' || speech === entry.speech || A.speechIndex(FMT(), speech) > A.speechIndex(FMT(), entry.speech));
    const selected = await ask({ title: 'Destination speech', radios: { legend: 'Speech', name: 'flow-speech-to', options: options.map((value) => ({ value, label: value })), value: entry.speech || options[0] },
      buttons: [{ label: 'Cancel', value: null }, { label: 'Go', value: true, kind: 'primary' }] });
    if (!selected || !sameRound(round)) return;
    const destination = A.groupOf(f, group.choice);
    const rows = A.rows(f, destination).filter((row) => row.items.some((other) => other !== entry));
    let rowKey = null;
    if (rows.length) {
      const chosenRow = await ask({ title: 'Destination row', radios: { legend: 'Align with an entry', name: 'flow-row-to',
        options: [{ value: 'new', label: 'New row' }, ...rows.map((row, index) => ({
          value: row.id, label: (index + 1) + '. ' + row.items.map((other) => other.title).join(' / '),
        }))], value: 'new' },
        buttons: [{ label: 'Cancel', value: null }, { label: 'Go', value: true, kind: 'primary' }] });
      if (!chosenRow || !sameRound(round)) return;
      rowKey = chosenRow.choice === 'new' ? null : chosenRow.choice;
    }
    chooseMove(entry, destination, selected.choice, rowKey, anchor);
  }
  async function groupOptions(group, action) {
    const round = R;
    if (action === 'rename') {
      const name = await ask({ title: 'Rename argument group', input: { ...SHEET_INPUT, label: 'Group name', value: groupName(group) },
        buttons: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary' }] });
      if (name && sameRound(round)) { group.name = name; commit('[data-item-action="group-options"]'); }
      return;
    }
    const items = A.live(flow()).filter((entry) => entry.group === group.id);
    const latest = Math.max(-1, ...items.filter((e) => e.status === 'read').map((e) => A.speechIndex(FMT(), e.speech)));
    const options = FMT().flowSpeeches.filter((_, index) => index >= latest);
    const destination = await ask({ title: 'Move argument group to speech', radios: { legend: 'Destination speech', name: 'flow-group-speech', options: options.map((key) => ({ value: key, label: key })), value: options[0] },
      buttons: [{ label: 'Cancel', value: null }, { label: 'Next', value: true, kind: 'primary' }] });
    if (!destination || !sameRound(round)) return;
    const changing = items.filter((e) => e.speech !== destination.choice);
    let choice;
    if (changing.some((e) => e.status === 'unconfirmed')) {
      const canExtend = changing.filter((e) => e.status === 'unconfirmed').every((e) => A.speechIndex(FMT(), destination.choice) > A.speechIndex(FMT(), e.speech));
      choice = await ask({ title: 'Read status is unconfirmed', body: 'How should these entries go into ' + destination.choice + '?',
        buttons: [{ label: 'Cancel', value: null }, { label: 'Move', value: 'move', kind: 'primary' }, ...(canExtend ? [{ label: 'Extend', value: 'extend' }] : [])] });
      if (!choice || !sameRound(round)) return;
    }
    for (const entry of changing) A.moveItem(flow(), entry, group, destination.choice, entry.row, entry.status === 'unconfirmed' ? choice : undefined, FMT());
    FlowMobile.reveal({ speech: destination.choice });
    commit('[data-item-action="group-options"]');
  }
  function openLinkPicker(entry, anchor) {
    grid.querySelector('.item-link-picker')?.remove();
    const options = A.targets(flow(), entry, FMT());
    anchor.closest('[data-entry]').insertAdjacentHTML('beforeend', `<fieldset class="item-link-picker"><legend>Earlier entries</legend>
      ${options.length ? options.map((target) => `<label><input name="target" type="checkbox" value="${esc(target.id)}"${entry.links.includes(target.id) ? ' checked data-pick-order="' + entry.links.indexOf(target.id) + '"' : ''}> ${esc(target.speech + ' · ' + A.sheetOf(flow(), target.group)?.name + ' · ' + target.title)}</label>`).join('') : '<p>No earlier entries.</p>'}
      <div class="item-tools">${control('Save links', 'save-links')}${control('Cancel', 'close-links')}</div></fieldset>`);
    grid.querySelector('.item-link-picker input, .item-link-picker button')?.focus();
  }
  function checked(container) {
    const picks = Array.from(container.querySelectorAll('input[name="target"]:checked'));
    return picks.sort((a, b) => Number(a.dataset.pickOrder || 0) - Number(b.dataset.pickOrder || 0)).map((el) => el.value);
  }
  function undoMatch(matches) {
    const round = R;
    const tokens = Array.isArray(matches) ? matches : [matches];
    const label = tokens.length === 1 ? 'Transcript match' : tokens.length + ' transcript matches';
    undoToast(label + ' applied.', label.toLowerCase(), () => {
      if (!sameRound(round)) return false;
      const undone = tokens.map((token) => AI.undoMatch(flow(), token));
      if (!undone.some(Boolean)) { toast('The entries have changed.'); return false; }
      save(); if (R.tab === 'flow') render('[data-item-action="review"]');
    }, 'Match undone.');
  }
  function getItem(target) {
    const key = target.closest('[data-entry]')?.dataset.entry;
    return A.byId(A.live(flow()), key);
  }
  function remove(entry) {
    const round = R;
    if (!A.removeItem(entry)) return;
    commit('[data-item-action="new"]');
    undoToast('Entry removed.', 'remove ' + entry.title, () => {
      if (!sameRound(round) || !A.restoreItem(entry)) return false;
      save();
      if (R.tab === 'flow') {
        R.flowIdx = flow().sheets.indexOf(A.sheetOf(flow(), entry.group));
        render(`[data-entry="${CSS.escape(entry.id)}"] .item-text`);
      }
    }, 'Entry restored.');
  }
  async function newGroup() {
    const current = sheet();
    const name = await ask({ title: 'Add argument group in ' + current.name, input: { ...SHEET_INPUT, label: 'Argument group name', placeholder: 'For example: Links, Impacts, Solvency' },
      buttons: [{ label: 'Cancel', value: null }, { label: 'Add group', kind: 'primary' }] });
    if (name && sheet() === current) {
      const group = A.addGroup(current, name);
      commit(`[data-group="${CSS.escape(group.id)}"] [data-item-action="new"]`);
    }
  }
  function toggleReview() {
    const viewed = FlowMobile.active() ? FlowMobile.speech() : sp().id;
    reviewSpeech = reviewSpeech ? null : (FMT().flowSpeeches.includes(viewed) ? viewed : FMT().flowSpeeches[0]);
    render(reviewSpeech ? '[data-item-review]' : '[data-item-action="review"]');
  }
  function handleReview(button, action) {
    const container = button.closest('[data-suggestion]');
    const suggestion = reviewList(flow(), reviewSpeech).find((s) => s.key === container.dataset.suggestion);
    if (!suggestion) return;
    if (action === 'dismiss-review') AI.discard(flow(), suggestion);
    else {
      if (suggestion.kind === 'links' && !checked(container).length) { toast('Select at least one response target.'); return; }
      if (suggestion.kind === 'match' && AI.modeFor(S.itemFlowAssist) === 'off') { toast('AI matching is off.'); return; }
      const token = AI.resolve(flow(), suggestion, FMT(), checked(container), R.transcripts[suggestion.speech]);
      if (token?.evidence) undoMatch(token);
      if (!token) toast('The source or entry changed. Run the flow again for new suggestions.');
    }
    commit('[data-item-review]');
  }

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-item-action]');
    if (!button || !flow()) return;
    const action = button.dataset.itemAction;
    if (action === 'close-review') return toggleReview();
    if (action === 'apply-review' || action === 'dismiss-review') return handleReview(button, action);
    if (action === 'cancel-editor') return cancelEditor();
    if (action === 'cancel-move') {
      move = null;
      button.closest('.item-move-choice').remove();
      tabs.querySelector('.on')?.focus();
      return;
    }
    if (action === 'confirm-move' || action === 'confirm-extend') {
      if (move) finishMove(move.entry, move.group, move.speech, move.row, action === 'confirm-move' ? 'move' : 'extend');
      return;
    }
    const group = A.groupOf(flow(), button.closest('[data-group]')?.dataset.group);
    if (action === 'new') return openEditor(group.id, button.dataset.speech);
    if (action === 'group-options') return openContextMenu(button, 'group', group.id);
    const entry = getItem(button);
    if (!entry) return;
    const options = `[data-entry="${CSS.escape(entry.id)}"] [data-item-action="menu"]`;
    if (action === 'related') return FlowMobile.showRelated(entry.id);
    if (action === 'menu') {
      itemMenu = itemMenu === entry.id ? null : entry.id;
      render(options);
    } else if (action === 'edit') openEditor(entry.group, entry.speech, entry);
    else if (action === 'remove') remove(entry);
    else if (action === 'up' || action === 'down') {
      if (A.stepItem(flow(), entry, action === 'up' ? -1 : 1)) commit(options);
    } else if (action === 'move') movePicker(entry, button);
    else if (action === 'links') openLinkPicker(entry, button);
    else if (action === 'close-links') {
      if (button.closest('.review-entry')) render('[data-item-review]');
      else render(options);
    }
    else if (action === 'save-links') {
      A.setLinks(flow(), entry, checked(button.closest('fieldset')), FMT());
      R.flowIdx = flow().sheets.indexOf(A.sheetOf(flow(), entry.group));
      commit(options);
    }
  });
  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-sheet-options]');
    if (button) sheetContext(Number(button.dataset.sheetOptions), undefined, true);
  });
  for (const host of [tabs, grid]) {
    const showObjectMenu = (event, point) => {
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const tab = event.target.closest('button[data-i], button[data-sheet-options]');
      const heading = event.target.closest('.item-group[data-group]');
      if (!tab && !heading) return;
      event.preventDefault();
      if (tab) sheetContext(Number(tab.dataset.i ?? tab.dataset.sheetOptions), point);
      else openContextMenu(heading, 'group', heading.dataset.group, point);
    };
    host.addEventListener('contextmenu', (event) => showObjectMenu(event, { x: event.clientX, y: event.clientY }));
    host.addEventListener('keydown', (event) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) showObjectMenu(event);
    });
  }
  escLayer('flow-options', 80, () => R.tab === 'flow' && Boolean(tools.querySelector('.flow-options[open]')), () => {
    const disclosure = tools.querySelector('.flow-options[open]');
    disclosure.open = false;
    disclosure.querySelector('summary').focus();
  });
  tools.addEventListener('click', (e) => {
    const action = e.target.closest('[data-item-action]')?.dataset.itemAction;
    if (action === 'new-group') newGroup();
    if (action === 'review') toggleReview();
  });
  tools.addEventListener('change', (e) => {
    if (e.target.matches('[data-item-assist]')) { S.itemFlowAssist = AI.modeFor(e.target.value); saveSettings(); }
    if (e.target.matches('[data-item-level]')) { R.flowLevel = e.target.value; commit('[data-item-level]'); }
  });
  for (const host of [grid, tabs, tools]) {
    host.addEventListener('focusout', () => {
      if (!pending) return;
      setTimeout(() => {
        if (!grid.contains(document.activeElement) && !tabs.contains(document.activeElement) && !tools.contains(document.activeElement)) { pending = false; redraw(); }
      }, 0);
    });
  }
  grid.addEventListener('compositionstart', (e) => { if (e.target.closest('.item-editor')) composing = true; });
  grid.addEventListener('compositionend', () => {
    composing = false;
    if (pending) setTimeout(redraw, 0);
  });
  grid.addEventListener('input', (e) => {
    if (editor && e.target.closest('.item-editor')) { editor.fields[e.target.name] = e.target.value; stashEditor(); save(); }
  });
  let pickOrder = 0;
  grid.addEventListener('change', (e) => {
    if (e.target.matches('input[name="target"]')) {
      if (e.target.checked) e.target.dataset.pickOrder = String(++pickOrder + A.live(flow()).length);
      else delete e.target.dataset.pickOrder;
    }
    if (e.target.matches('[data-item-review]')) { reviewSpeech = e.target.value; render('[data-item-review]'); }
    if (e.target.matches('[data-item-status]')) {
      const entry = getItem(e.target);
      if (entry && A.setStatus(entry, e.target.value)) commit(`[data-entry="${CSS.escape(entry.id)}"] [data-item-status]`);
    }
  });
  grid.addEventListener('submit', (e) => {
    if (!e.target.matches('.item-editor')) return;
    e.preventDefault();
    saveEditor(false);
  });
  grid.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape' && e.target.closest('.item-move-choice')) {
      e.stopPropagation(); e.preventDefault();
      e.target.closest('.item-move-choice').querySelector('[data-item-action="cancel-move"]').click();
      return;
    }
    if (!e.target.closest('.item-editor')) return;
    if (e.key === 'Escape') { e.stopPropagation(); cancelEditor(); return; }
    if (e.key !== 'Enter' || e.altKey || ((e.ctrlKey || e.metaKey) && !e.shiftKey)) return;
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) return;
    if (!e.target.matches('input, textarea')) return;
    e.preventDefault(); e.stopPropagation();
    saveEditor(true);
  });
  grid.addEventListener('dragstart', (e) => {
    const button = e.target.closest('[data-item-action="menu"]');
    const entry = button && getItem(button);
    if (!entry) return;
    drag = entry;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-tabula-flow-entry', entry.id);
  });
  grid.addEventListener('dragend', () => { drag = null; });
  grid.addEventListener('dragover', (e) => {
    if (drag && e.target.closest('[data-group][data-column]')) e.preventDefault();
  });
  grid.addEventListener('drop', async (e) => {
    const destination = e.target.closest('[data-group][data-column]');
    if (!drag || !destination || !e.dataTransfer.types.includes('application/x-tabula-flow-entry')) return;
    e.preventDefault(); e.stopPropagation();
    const entry = drag;
    const explicit = e.target.closest('[data-speech]')?.dataset.speech;
    const col = Number(destination.dataset.column);
    const speeches = A.speechAt(FMT(), col);
    const group = A.groupOf(flow(), destination.dataset.group);
    const row = destination.dataset.row;
    if (explicit || speeches.length === 1 || speeches.includes(entry.speech)) {
      chooseMove(entry, group, explicit || (speeches.length === 1 ? speeches[0] : entry.speech), row, destination);
    } else {
      const round = R;
      const selected = await ask({ title: 'Destination speech', buttons: [{ label: 'Cancel', value: null }, ...speeches.map((key) => ({ label: key, value: key, kind: 'primary' }))] });
      if (selected && sameRound(round)) chooseMove(entry, group, selected, row, destination);
    }
  });
  function respond(entry, speech) {
    openEditor(entry.group, speech, null, [entry.id]);
  }
  return { flow, sheet, render, redraw, mark, showPhoneNavigation, startEntry, toggleReview, undoMatch, respond };
})();
