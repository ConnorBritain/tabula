// Flow cells: which column a speech fills, the AI flow cell text and merge rules, and the flow mark shading.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';

  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');

  // ---------- live AI flow (Claude) ----------
  // Which flow column a speech writes to, in the given format (policy-hs when not given). CX is not flowed.
  function speechColumn(speechId, fmt) {
    return F.columnOf(fmt || F.POLICY, speechId);
  }

  // Detail levels for the AI flow. One Claude call writes all three, so switching is instant.
  const FLOW_LEVELS = ['brief', 'standard', 'detailed'];

  // A speech's notes on a sheet are { brief, standard, detailed }.
  // Older saved rounds stored one plain string; treat that as every level.
  function partText(part, level) {
    if (!part) return '';
    if (typeof part === 'string') return part.trim();
    const lv = FLOW_LEVELS.includes(level) ? level : 'standard';
    return String(part[lv] || part.standard || part.detailed || part.brief || '').trim();
  }

  // AI sheets store notes per speech, so the 1NR never overwrites the 2NC in the shared block column.
  function aiFlowCell(sheet, col, level, fmt) {
    const ids = (fmt || F.POLICY).speeches.filter((s) => s.column === col).map((s) => s.id);
    const filled = ids.filter((id) => partText(sheet.parts && sheet.parts[id], level));
    if (filled.length === 1) return partText(sheet.parts[filled[0]], level);
    return filled.map((id) => id + ':\n' + partText(sheet.parts[id], level)).join('\n\n');
  }

  // Claude returns the full notes for the current speech each time.
  // So replace this speech's notes on every sheet; never append.
  function applyLiveFlow(aiFlows, speechId, result) {
    // Judge edits (sheet.edits) are carried over untouched: the AI never overwrites them.
    const flows = (aiFlows || []).map((s) => ({ name: s.name, parts: Object.assign({}, s.parts), ...(s.edits ? { edits: Object.assign({}, s.edits) } : {}) }));
    for (const s of flows) delete s.parts[speechId];
    for (const item of (result && result.sheets) || []) {
      const name = String(item.sheet || '').trim();
      // Older replies had one "notes" field; use it for any level that is missing.
      const fallback = String(item.notes || item.standard || '').trim();
      const part = {};
      for (const lv of FLOW_LEVELS) part[lv] = String(item[lv] || fallback).trim();
      if (!name || !FLOW_LEVELS.some((lv) => part[lv])) continue;
      let sheet = flows.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (!sheet) { sheet = { name, parts: {} }; flows.push(sheet); }
      sheet.parts[speechId] = part;
    }
    return flows.filter((s) => Object.values(s.parts).some((v) => partText(v, 'standard')) || Object.keys(s.edits || {}).length);
  }

  // What a flow cell shows: the judge's own edit if there is one, otherwise the AI's notes.
  function flowCellText(sheet, col, level, fmt) {
    const ed = sheet && sheet.edits && sheet.edits[col];
    return ed ? String(ed.text || '') : aiFlowCell(sheet, col, level, fmt);
  }

  // An edited cell is "behind" when the AI has written something new under it since the judge edited it.
  function editIsBehind(sheet, col, fmt) {
    const ed = sheet && sheet.edits && sheet.edits[col];
    return Boolean(ed) && aiFlowCell(sheet, col, 'standard', fmt) !== (ed.base || '');
  }

  // Keeps the judge's map work when the AI redraws the map: nodes and links the judge made or edited stay;
  // the AI's new nodes and links are added around them.
  function mergeMap(oldMap, freshMap) {
    const old = oldMap || { nodes: [], edges: [] };
    const fresh = freshMap || { nodes: [], edges: [] };
    const norm = (t) => String(t || '').trim().toLowerCase();
    const mine = (old.nodes || []).filter((n) => n.user || n.edited);
    const mineById = new Map(mine.map((n) => [String(n.id), n]));
    // Deleted cards: old saves list ids; newer saves list speech + original text, so a new AI card that
    // happens to reuse an id is not hidden by mistake.
    const goneIds = new Set((old.removedNodes || []).filter((x) => typeof x === 'string'));
    const goneKeys = new Set((old.removedNodes || []).filter((x) => x && typeof x === 'object').map((x) => x.key));
    // The AI reuses short ids ("a1") on every draw. A fresh node with a kept node's id is the same card only
    // if it is in the same speech and (when known) has the text the judge started from; otherwise it gets a new id.
    const idMap = new Map();
    const taken = new Set(mine.map((n) => String(n.id)));
    const added = [];
    for (const n of fresh.nodes || []) {
      const id = String(n.id);
      if (goneIds.has(id) || goneKeys.has(n.speech + '|' + norm(n.label))) { idMap.set(id, null); continue; }
      const kept = mineById.get(id);
      if (kept && kept.speech === n.speech && (!kept.aiLabel || norm(kept.aiLabel) === norm(n.label))) { idMap.set(id, id); continue; }
      let nid = id, k = 2;
      while (taken.has(nid)) nid = id + '_ai' + k++;
      taken.add(nid); idMap.set(id, nid);
      added.push(nid === id ? n : Object.assign({}, n, { id: nid }));
    }
    const nodes = mine.concat(added);
    const ids = new Set(nodes.map((n) => String(n.id)));
    const key = (e) => e.from + '>' + e.to;
    const myEdges = (old.edges || []).filter((e) => e.user);
    const myKeys = new Set(myEdges.map(key));
    const removed = new Set(old.removedEdges || []);
    const freshEdges = (fresh.edges || []).map((e) => Object.assign({}, e, { from: idMap.get(String(e.from)), to: idMap.get(String(e.to)) }))
      .filter((e) => e.from && e.to && !myKeys.has(key(e)) && !removed.has(key(e)));
    const edges = myEdges.concat(freshEdges).filter((e) => ids.has(String(e.from)) && ids.has(String(e.to)));
    return { nodes, edges, removedEdges: [...removed], removedNodes: old.removedNodes || [] };
  }

  // Option B (Q-8): flow mark shading. The flow stays plain text; app.js paints a mirror layer behind each flow
  // textarea, and these marks get a light shade there. Tokens come from docs/library/flow-shorthand.md and the
  // Round Map statuses (dropped, conceded, extended). A mark is a whole token: "ext" shades, "text" does not.
  // Words match in any case; the short capital codes (DT, TC, CT) match only in capitals, so "ct" in a note does not.
  const FLOW_MARK_KINDS = [
    { kind: 'drop', label: 'Dropped', tokens: ['*', '*dropped', 'dropped', 'drop', 'drops', 'no answer', 'no ans'] },
    { kind: 'concede', label: 'Conceded', tokens: ['conceded', 'concedes', 'concede', 'conc'] },
    { kind: 'extend', label: 'Extended', tokens: ['extended', 'extends', 'extend', 'ext'] },
    { kind: 'turn', label: 'Turned', tokens: ['turned', 'turns', 'turn', 'L/T', 'I/T', 'DT', 'TC', 'CT'] },
    { kind: 'weigh', label: 'Outweighs', tokens: ['O/W', 'outweighs'] },
  ];
  const FM_CAPS = new Set(['DT', 'TC', 'CT']);
  const FM_KIND = {};
  FLOW_MARK_KINDS.forEach((k) => k.tokens.forEach((t) => { if (t[0] !== '*') FM_KIND[t.toLowerCase()] = k.kind; }));
  const fmEsc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const FM_WORDS = Object.keys(FM_KIND).sort((a, b) => b.length - a.length).map((t) => fmEsc(t).replace(/ /g, '[ \\t]+'));
  // Left edge: not after a letter, digit, _, / or *. Right edge: not before a letter, digit, _ or /.
  // A star is a drop mark at the start of a token ("*IL", "* L"), with or without "dropped" after it.
  const FM_RE = new RegExp('(?<![\\p{L}\\p{N}_/*])(?:(\\*+(?:(?:dropped|drop)(?![\\p{L}\\p{N}_/]))?)|(?:' + FM_WORDS.join('|') + ')(?![\\p{L}\\p{N}_/]))', 'giu');
  // flowMarkTokens(text) -> [{ start, end, kind }], in order, never overlapping. Pure: it never changes the text.
  function flowMarkTokens(text) {
    const s = String(text == null ? '' : text), out = [];
    FM_RE.lastIndex = 0;
    let m;
    while ((m = FM_RE.exec(s))) {
      const t = m[0];
      const kind = m[1] ? 'drop' : FM_KIND[t.toLowerCase().replace(/[ \t]+/g, ' ')];
      if (!kind) continue;
      if (FM_CAPS.has(t.toUpperCase()) && t !== t.toUpperCase()) continue;
      out.push({ start: m.index, end: m.index + t.length, kind });
    }
    return out;
  }
  const fmHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // flowMarkHtml(text) -> the mirror's HTML for one line (or any text): the same characters, HTML-escaped, with
  // <span class="fm-KIND"> around marks. Marks never cross a line break, so each line can be painted on its own.
  function flowMarkHtml(text) {
    const s = String(text == null ? '' : text);
    let html = '', at = 0;
    for (const t of flowMarkTokens(s)) {
      html += fmHtml(s.slice(at, t.start)) + '<span class="fm-' + t.kind + '">' + fmHtml(s.slice(t.start, t.end)) + '</span>';
      at = t.end;
    }
    return html + fmHtml(s.slice(at));
  }
  // flowLinesChanged(oldLines, newLines) -> { from, oldTo, newTo }: lines [from, oldTo) of the old list became lines
  // [from, newTo) of the new one, and every line outside that range is the same. A keystroke in a long column then
  // repaints one line, not thousands.
  function flowLinesChanged(a, b) {
    let from = 0;
    const min = Math.min(a.length, b.length);
    while (from < min && a[from] === b[from]) from++;
    let ea = a.length, eb = b.length;
    while (ea > from && eb > from && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    return { from, oldTo: ea, newTo: eb };
  }

  // The AI flow before its first update. The AI names its own sheets, so none exists yet; the view still shows the
  // format's columns, with empty bodies, so it looks like a flow. The note says how it fills in. How to connect AI or
  // turn Live AI flow on is the status line's job (it knows who needs a key), so the note never says it.
  const AI_FLOW_EMPTY = 'No AI flow yet. It fills in here while a speech runs with "Transcribe" on. To flow your docs now, click "Map docs to flow now".';
  // columns: the format's flow columns ({ label, side }). Returns the grid's HTML: one empty column per speech.
  // Same column shell as the two sheet views in js/flow.js (markFlowColumns needs .col-mark): change all three.
  function emptyFlowHtml(columns) {
    return (columns || []).map((c) => '<div class="col ' + (c.side === 'neg' ? 'neg' : 'aff') + '"><h3><span>' + fmHtml(String(c.label || ''))
      + '</span><span class="col-mark"></span></h3><div class="flow-cell flow-cell-empty"></div></div>').join('');
  }

  const api = { speechColumn, FLOW_LEVELS, partText, aiFlowCell, applyLiveFlow, flowCellText, editIsBehind, mergeMap,
    FLOW_MARK_KINDS, flowMarkTokens, flowMarkHtml, flowLinesChanged, AI_FLOW_EMPTY, emptyFlowHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).flow = api;
})(typeof window !== 'undefined' ? window : globalThis);
