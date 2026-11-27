// The saved flow and its local operations. This module has no browser UI or AI transport.
(function (root) {
  'use strict';
  const part = (name) => typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name];
  const F = part('format');
  const oldFlow = part('flow');
  const VERSION = 1;
  const GENERAL = 'General';
  const STATUSES = ['read', 'unconfirmed', 'unread'];
  const MODES = ['auto', 'approve', 'off'];
  const LABELS = { read: 'Confirmed read', unconfirmed: 'Read not confirmed', unread: 'Not read' };
  const str = (value) => typeof value === 'string' ? value : '';
  const norm = (value) => str(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const id = () => root.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const live = (flow) => flow.items.filter((entry) => !entry.removed);
  const byId = (list, key) => list.find((entry) => entry.id === key);
  const groupOf = (flow, key) => flow.sheets.flatMap((sheet) => sheet.groups).find((group) => group.id === key);
  const sheetOf = (flow, key) => flow.sheets.find((sheet) => byId(sheet.groups, key));
  const rowId = (group) => { const key = id(); group.rows.push(key); return key; };
  const newFlow = () => ({ version: VERSION, sheets: [], items: [], suggestions: [], dismissed: [] });
  const isKey = (value) => typeof value === 'string' && value.length > 0;
  const keyList = (value) => Array.isArray(value) && value.every(isKey);
  const validEvidence = (e) => isKey(e?.quote) && Number.isSafeInteger(e.position) && e.position >= 0;
  function supported(flow) {
    if (flow?.version !== VERSION || !Array.isArray(flow.sheets) || !flow.sheets.length ||
      !Array.isArray(flow.items) || !Array.isArray(flow.suggestions) || !keyList(flow.dismissed)) return false;
    const groups = new Map();
    const keys = new Set();
    const unique = (key) => {
      if (!isKey(key) || keys.has(key)) return false;
      keys.add(key);
      return true;
    };
    for (const sheet of flow.sheets) {
      if (!unique(sheet?.id) || typeof sheet.name !== 'string' || !Array.isArray(sheet.groups) || !sheet.groups.length) return false;
      for (const group of sheet.groups) {
        if (!unique(group?.id) || typeof group.name !== 'string' || !keyList(group.rows) || !group.rows.every(unique)) return false;
        if (group.legacyDetails && (!Array.isArray(group.legacyDetails) || group.legacyDetails.some((d) => !isKey(d?.speech) ||
          typeof d.brief !== 'string' || typeof d.detailed !== 'string'))) return false;
        groups.set(group.id, new Set(group.rows));
      }
    }
    const validItems = flow.items.every((e) => unique(e?.id) && isKey(e.card) && typeof e.title === 'string' &&
      (e.speech === null || isKey(e.speech)) && keyList(e.links) && Array.isArray(e.aliases) && e.aliases.every((x) => typeof x === 'string') &&
      Array.isArray(e.observations) && e.observations.every(validEvidence) && STATUSES.includes(e.status) &&
      Number.isSafeInteger(e.rev) && (e.removed || groups.get(e.group)?.has(e.row)));
    const validSuggestions = flow.suggestions.every((s) => isKey(s?.key) && isKey(s.speech) && isKey(s.item) && Number.isSafeInteger(s.rev) &&
      (s.kind === 'links' ? keyList(s.targets) : ['match', 'order'].includes(s.kind) && validEvidence(s.evidence)));
    return validItems && validSuggestions;
  }
  function addGroup(sheet, name = GENERAL) {
    const group = { id: id(), name, rows: [] };
    sheet.groups.push(group);
    return group;
  }
  function addSheet(flow, name) {
    const sheet = { id: id(), name, groups: [] };
    addGroup(sheet);
    flow.sheets.push(sheet);
    return sheet;
  }
  function ensureGroup(flow, sheetName, groupName, fmt) {
    const name = str(sheetName).trim() || fmt.defaultSheets[0] || 'Case';
    const sheet = flow.sheets.find((s) => norm(s.name) === norm(name)) || addSheet(flow, name);
    const label = str(groupName).trim() || GENERAL;
    return sheet.groups.find((g) => norm(g.name) === norm(label)) || addGroup(sheet, label);
  }
  function addItem(flow, group, speech, fields = {}, options = {}) {
    if (!group || !str(fields.title).trim()) return null;
    const key = id();
    const entry = {
      id: key, card: options.card || key, group: group.id, row: options.row ?? rowId(group),
      speech, column: options.column ?? null, source: options.source || 'manual',
      title: str(fields.title), author: str(fields.author), date: str(fields.date), notes: str(fields.notes),
      status: 'unconfirmed', links: [], aliases: [], observations: [], rev: 0,
      ...(options.from ? { from: options.from } : {}),
      ...(options.detail ? { detail: options.detail } : {}),
    };
    flow.items.push(entry);
    return entry;
  }
  function rows(flow, group) {
    const indexed = new Map(group.rows.map((row) => [row, { id: row, items: [] }]));
    for (const entry of live(flow)) if (entry.group === group.id) indexed.get(entry.row)?.items.push(entry);
    return [...indexed.values()];
  }
  const speechIndex = (fmt, speech) => fmt.flowSpeeches.indexOf(speech);
  const columnOf = (fmt, entry) => entry.speech ? F.columnOf(fmt, entry.speech) : entry.column;
  const speechAt = (fmt, column) => fmt.flowSpeeches.filter((key) => F.columnOf(fmt, key) === Number(column));
  const slot = (fmt, column) => { const ids = speechAt(fmt, column); return ids.length === 1 ? ids[0] : null; };
  const present = (round) => supported(round?.itemFlow) && live(round.itemFlow).length > 0;
  function legacyLines(text) {
    const lines = str(text).split('\n');
    return lines.map((line) => /\S/.test(line) ? line : '');
  }
  function legacyCell(flow, group, fmt, column, text) {
    if (!str(text).trim()) return;
    legacyLines(text).forEach((title, index) => {
      while (group.rows.length <= index) rowId(group);
      if (!title) {
        (group.spacers ??= {})[group.rows[index]] = true;
        return;
      }
      addItem(flow, group, slot(fmt, column), { title }, { column: Number(column), row: group.rows[index] });
    });
  }
  function migrate(round, fmt = F.formatOf(round)) {
    if (round.itemFlow != null) return supported(round.itemFlow) ? round.itemFlow : null;
    const flow = newFlow();
    for (const sheet of round.flows || []) {
      const group = addSheet(flow, str(sheet.name)).groups[0];
      for (const [col, text] of Object.entries(sheet.cells || {})) legacyCell(flow, group, fmt, col, text);
    }
    for (const sheet of round.aiFlows || []) {
      const group = ensureGroup(flow, sheet.name, GENERAL, fmt);
      for (const [col, edit] of Object.entries(sheet.edits || {})) legacyCell(flow, group, fmt, col, edit?.text);
      for (const [speech, detail] of Object.entries(sheet.parts || {})) {
        const column = F.columnOf(fmt, speech);
        if (column == null || sheet.edits?.[column]) continue;
        const levels = Object.fromEntries(oldFlow.FLOW_LEVELS.map((level) => [level, legacyLines(oldFlow.partText(detail, level))]));
        levels.standard.forEach((title, index) => {
          if (!title) return;
          while (group.rows.length <= index) rowId(group);
          addItem(flow, group, speech, { title }, { source: /\[doc\??\]$/i.test(title) ? 'document' : 'legacyAI', row: group.rows[index],
            detail: { brief: levels.brief.length === levels.standard.length ? levels.brief[index] : title,
              detailed: levels.detailed.length === levels.standard.length ? levels.detailed[index] : title } });
        });
        if (['brief', 'detailed'].some((level) => levels[level].length !== levels.standard.length && levels[level].some(Boolean))) {
          // Some old replies changed the number of lines at each level. Keep the unmatched text for review.
          group.legacyDetails ??= [];
          group.legacyDetails.push({ speech, brief: levels.brief.join('\n'), detailed: levels.detailed.join('\n') });
        }
      }
    }
    if (!flow.sheets.length) for (const name of fmt.defaultSheets) addSheet(flow, name);
    round.itemFlow = flow;
    return flow;
  }

  function textOf(entry, level) {
    const citation = [entry.author, entry.date].filter(Boolean).join(' ');
    if (level === 'brief' && entry.detail?.brief) return entry.detail.brief;
    const heading = [entry.title, citation].filter(Boolean).join(' · ');
    const detail = level === 'detailed' ? entry.detail?.detailed : '';
    return [detail || heading, entry.notes].filter(Boolean).join('\n');
  }
  function projectedSheets(round, { source, level = 'detailed', excludeSpeech, statusNotes = true } = {}) {
    const flow = round.itemFlow;
    if (!supported(flow)) return [];
    const fmt = F.formatOf(round);
    const entries = live(flow);
    return flow.sheets.map((sheet) => {
      const cells = fmt.flowColumns.map((_, column) => {
        const lines = [];
        for (const group of sheet.groups) {
          const blocks = [];
          for (const row of group.rows) {
            const items = entries.filter((e) => e.group === group.id && e.row === row && columnOf(fmt, e) === column &&
              (!excludeSpeech || e.speech !== excludeSpeech) && (!source || (e.source === 'manual' || (e.source !== 'document' && Boolean(e.edited))) === (source === 'manual')));
            if (!items.length && !group.spacers?.[row]) continue;
            blocks.push(items.map((e) => {
              const speech = speechAt(fmt, column).length > 1 ? (e.speech || 'Speech unspecified') + ': ' : '';
              const status = !statusNotes ? '' : e.status === 'unread' ? ' [not read]'
                : (e.source === 'document' || e.origin === 'document') && e.status !== 'read' ? ' [document, read not confirmed]' : '';
              const targets = e.links.map((key) => byId(entries, key)?.title).filter(Boolean);
              return speech + textOf(e, level) + status + (targets.length ? '\nAnswers: ' + targets.join(' / ') : '');
            }).join('\n'));
          }
          if (blocks.some(Boolean)) lines.push(...(group.name === GENERAL ? [] : [group.name]), ...blocks);
        }
        return lines.join('\n');
      });
      return { name: sheet.name, cells };
    });
  }
  function updateItem(entry, fields) {
    entry.aliases = [...new Set([...entry.aliases, norm(entry.title)])];
    for (const key of ['title', 'author', 'date', 'notes']) entry[key] = str(fields[key]);
    delete entry.detail;
    entry.edited = true;
    entry.rev++;
  }
  function setStatus(entry, status) {
    if (!STATUSES.includes(status)) return false;
    entry.status = status;
    entry.statusOverride = true;
    if (status !== 'read') delete entry.spoken;
    entry.rev++;
    return true;
  }
  function moveGroup(sheet, key, step) {
    const index = sheet.groups.findIndex((g) => g.id === key);
    const to = index + step;
    if (index < 0 || to < 0 || to >= sheet.groups.length) return false;
    [sheet.groups[index], sheet.groups[to]] = [sheet.groups[to], sheet.groups[index]];
    return true;
  }
  function stepItem(flow, entry, step) {
    const group = groupOf(flow, entry.group);
    if (!group) return false;
    // Move only this entry. Use a fresh row so linked responses in the old row stay put.
    const occupied = rows(flow, group).filter((r) => r.items.length).map((r) => r.id);
    const index = occupied.indexOf(entry.row), other = occupied[index + step];
    if (!other) return false;
    const row = id();
    group.rows.splice(group.rows.indexOf(other) + (step > 0 ? 1 : 0), 0, row);
    return moveItem(flow, entry, group, entry.speech, row);
  }
  function moveItem(flow, entry, group, speech, row, choice, fmt) {
    if (!entry || entry.removed || !group) return null;
    if (speech === entry.speech) {
      Object.assign(entry, { group: group.id, row: group.rows.includes(row) ? row : rowId(group), moved: true });
      entry.rev++;
      return entry;
    }
    if (entry.status === 'read' || choice === 'extend') {
      if (speechIndex(fmt, speech) < 0 || speechIndex(fmt, speech) <= speechIndex(fmt, entry.speech)) return null;
      const extension = addItem(flow, group, speech, entry, { from: entry.id, card: entry.card, row: group.rows.includes(row) ? row : undefined, source: 'manual' });
      extension.origin = entry.origin || entry.source;
      if (entry.document) extension.document = entry.document;
      return extension;
    }
    if (entry.status !== 'unread' && choice !== 'move') return null;
    entry.previousSpeeches = [...new Set([...(entry.previousSpeeches || []), entry.speech])];
    Object.assign(entry, { group: group.id, row: group.rows.includes(row) ? row : rowId(group), speech, column: null, moved: true });
    delete entry.spoken;
    delete entry.statusOverride;
    entry.status = 'unconfirmed';
    entry.rev++;
    return entry;
  }
  function targets(flow, entry, fmt) {
    const index = speechIndex(fmt, entry.speech);
    const byTime = live(flow).filter((e) => {
      const n = speechIndex(fmt, e.speech);
      return n >= 0 && n < index;
    });
    return byTime;
  }
  function setLinks(flow, entry, keys, fmt) {
    const available = new Set(targets(flow, entry, fmt).map((e) => e.id));
    // Keep links to removed targets so Undo restores their meaning.
    const retained = entry.links.filter((key) => byId(flow.items, key)?.removed);
    entry.links = [...new Set([...keys.filter((key) => available.has(key)), ...retained])];
    const primary = byId(live(flow), entry.links[0]);
    if (primary) Object.assign(entry, { group: primary.group, row: primary.row });
    entry.linkEdited = true;
    entry.rev++;
  }
  function removeItem(entry) {
    if (entry.removed) return false;
    entry.removed = true;
    entry.rev++;
    return true;
  }
  function restoreItem(entry) {
    if (!entry.removed) return false;
    delete entry.removed;
    entry.rev++;
    return true;
  }
  function spokenItems(flow, speech) {
    return live(flow).filter((e) => e.speech === speech).sort((a, b) => (a.spoken ?? Infinity) - (b.spoken ?? Infinity));
  }
  function cloneSheet(flow, at) {
    const old = flow.sheets[at];
    if (!old) return null;
    const copy = addSheet(flow, (old.name + ' copy').slice(0, 40));
    copy.groups = [];
    const groups = new Map(old.groups.map((group) => {
      const next = addGroup(copy, group.name);
      const rows = new Map(group.rows.map((row) => [row, rowId(next)]));
      if (group.legacyDetails) next.legacyDetails = structuredClone(group.legacyDetails);
      if (group.spacers) next.spacers = Object.fromEntries(group.rows.filter((r) => group.spacers[r]).map((r) => [rows.get(r), true]));
      return [group.id, { group: next, rows }];
    }));
    const originals = live(flow).filter((entry) => groups.has(entry.group));
    const copied = new Map(originals.map((entry) => [entry.id, id()]));
    const shared = new Set(live(flow).filter((e) => !copied.has(e.id)).map((e) => e.card));
    const cards = new Map();
    for (const entry of originals) {
      if (!cards.has(entry.card)) cards.set(entry.card, shared.has(entry.card) ? entry.card : id());
      const target = groups.get(entry.group);
      const clone = { ...structuredClone(entry), id: copied.get(entry.id), card: cards.get(entry.card),
        group: target.group.id, row: target.rows.get(entry.row), links: entry.links.map((key) => copied.get(key) || key) };
      if (entry.from) clone.from = copied.get(entry.from) || entry.from;
      delete clone.docKey;
      flow.items.push(clone);
    }
    flow.sheets.pop();
    flow.sheets.splice(at + 1, 0, copy);
    return copy;
  }
  const api = { VERSION, GENERAL, STATUSES, MODES, LABELS, norm, id, live, byId, groupOf, sheetOf, byTime: spokenItems,
    supported, addGroup, addSheet, ensureGroup, addItem, rows, speechIndex, columnOf, speechAt, present, migrate,
    textOf, projectedSheets, updateItem, setStatus, cloneSheet, moveGroup, stepItem, moveItem, targets, setLinks, removeItem, restoreItem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {})['atomic-flow'] = api;
})(typeof window !== 'undefined' ? window : globalThis);
